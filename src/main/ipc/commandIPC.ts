// src/main/ipc/commandIPC.ts
// ─────────────────────────────────────────────────────────────────
// IPC bridge for the Kitsune Command Engine.
// Handles macro CRUD, alias management, program launch, history, etc.
// ─────────────────────────────────────────────────────────────────

import type { IpcMain, BrowserWindow } from 'electron'
import type { CommandEngine } from '../services/CommandEngine'
import type { TabManager } from '../services/TabManager'
import type { WorkspaceManager } from '../services/WorkspaceManager'
import type { AIService } from '../services/AIService'

export function registerCommandIPC(
  ipcMain: IpcMain,
  engine: CommandEngine,
  tabManager: TabManager,
  workspaceManager: WorkspaceManager,
  aiService: AIService,
  win: BrowserWindow,
): void {

  // ── Execute a raw command string ──────────────────────────────────
  ipcMain.handle('cmd:execute', async (_e, input: string, extraArgs?: Record<string, unknown>) => {
    const result = await engine.execute(input, extraArgs)
    // Handle special return markers that need renderer-side actions
    if (result && typeof result === 'object' && '__runProgram' in (result as object)) {
      const programName = (result as any).programName
      return runProgram(engine, tabManager, workspaceManager, aiService, win, programName)
    }
    if (result && typeof result === 'object' && '__aiCluster' in (result as object)) {
      const tabs = tabManager.listTabs(workspaceManager.activeId).map(t => ({ id: t.id, title: t.title, url: t.url }))
      return aiService.clusterTabs(tabs)
    }
    if (result && typeof result === 'object' && '__macro' in (result as object)) {
      const r = result as any
      if (r.__macro === 'list') return engine.getMacros()
      if (r.__macro === 'run') return engine.runMacro(String(r.name ?? ''))
    }
    if (result && typeof result === 'object' && '__alias' in (result as object)) {
      const r = result as any
      return engine.createAlias(String(r.short ?? ''), String(r.expanded ?? ''))
    }
    return result
  })

  // ── Macro CRUD ────────────────────────────────────────────────────
  ipcMain.handle('cmd:macro.list',   () => engine.getMacros())
  ipcMain.handle('cmd:macro.get',    (_e, id: string) => engine.getMacro(id))
  ipcMain.handle('cmd:macro.create', (_e, params) => engine.createMacro(params))
  ipcMain.handle('cmd:macro.update', (_e, id: string, patch) => engine.updateMacro(id, patch))
  ipcMain.handle('cmd:macro.delete', (_e, id: string) => engine.deleteMacro(id))
  ipcMain.handle('cmd:macro.run',    async (_e, idOrName: string, overrideArgs?) => {
    const result = await engine.runMacro(idOrName, overrideArgs)
    // Dispatch UI actions from macro results
    for (const step of result.results) {
      if (step.result && typeof step.result === 'object') {
        const r = step.result as any
        if (r.__aiCluster) {
          const tabs = tabManager.listTabs(workspaceManager.activeId).map(t => ({ id: t.id, title: t.title, url: t.url }))
          await aiService.clusterTabs(tabs)
        }
      }
    }
    return result
  })

  // ── Chain commands ─────────────────────────────────────────────────
  ipcMain.handle('cmd:chain.run', async (_e, commands: string[], globalArgs?) => {
    return engine.runChain(commands, globalArgs)
  })

  // ── Alias CRUD ────────────────────────────────────────────────────
  ipcMain.handle('cmd:alias.list',   () => engine.getAliases())
  ipcMain.handle('cmd:alias.create', (_e, short: string, expanded: string, desc?: string) =>
    engine.createAlias(short, expanded, desc))
  ipcMain.handle('cmd:alias.delete', (_e, short: string) => {
    engine.deleteAlias(short)
    return { deleted: true }
  })
  ipcMain.handle('cmd:alias.expand', (_e, input: string) => engine.expandAlias(input))

  // ── Workspace programs ─────────────────────────────────────────────
  ipcMain.handle('cmd:program.list',    () => engine.getPrograms())
  ipcMain.handle('cmd:program.create',  (_e, params) => engine.createProgram(params))
  ipcMain.handle('cmd:program.delete',  (_e, id: string) => { engine.deleteProgram(id); return { deleted: true } })
  ipcMain.handle('cmd:program.run',     async (_e, idOrName: string) =>
    runProgram(engine, tabManager, workspaceManager, aiService, win, idOrName))

  // ── Scheduled commands ─────────────────────────────────────────────
  ipcMain.handle('cmd:scheduled.list',   () => engine.getScheduled())
  ipcMain.handle('cmd:scheduled.create', (_e, params) => engine.createScheduled(params))
  ipcMain.handle('cmd:scheduled.toggle', (_e, id: string, enabled: boolean) => {
    engine.toggleScheduled(id, enabled)
    return { id, enabled }
  })
  ipcMain.handle('cmd:scheduled.delete', (_e, id: string) => {
    engine.deleteScheduled(id)
    return { deleted: true }
  })

  // ── History ────────────────────────────────────────────────────────
  ipcMain.handle('cmd:history.list',  (_e, limit?: number) => engine.getHistory(limit))
  ipcMain.handle('cmd:history.clear', () => { engine.clearHistory(); return { cleared: true } })
  ipcMain.handle('cmd:undo',          () => engine.undoLast())

  // ── Available commands list (for autocomplete) ────────────────────
  ipcMain.handle('cmd:commands.list', () => {
    // Return the categorized command list for the REPL / palette
    return COMMAND_CATALOG
  })
}

// ─── Run a workspace program ──────────────────────────────────────
async function runProgram(
  engine: CommandEngine,
  tabManager: TabManager,
  workspaceManager: WorkspaceManager,
  aiService: AIService,
  win: BrowserWindow,
  idOrName: string,
): Promise<unknown> {
  const program = engine.getProgram(idOrName)
  if (!program) throw new Error(`Program '${idOrName}' not found`)

  let wsId = program.workspaceId

  // Create new workspace if needed
  if (program.newWorkspaceName) {
    const ws = workspaceManager.createWorkspace(
      program.newWorkspaceName, 'folder', '#a594ff'
    )
    wsId = ws.id
    workspaceManager.switchWorkspace(ws.id)
    win.webContents.send('command:ui', { action: 'workspace.switched', id: ws.id })
  } else if (wsId) {
    workspaceManager.switchWorkspace(wsId)
    win.webContents.send('command:ui', { action: 'workspace.switched', id: wsId })
  }

  const activeWsId = wsId ?? workspaceManager.activeId
  const groupCache = new Map<string, string>() // label → groupId

  // Open tabs
  const openedTabs = []
  for (const tabDef of program.tabs) {
    await sleep(150)  // stagger to avoid overwhelming
    const tab = await tabManager.createTab({
      url: tabDef.url,
      workspaceId: activeWsId,
      background: tabDef.background ?? true,
    })
    openedTabs.push(tab)

    // Assign to group if specified
    if (tabDef.groupLabel) {
      if (!groupCache.has(tabDef.groupLabel)) {
        const group = workspaceManager.createGroup({
          label: tabDef.groupLabel,
          color: tabDef.groupColor ?? '#a594ff',
          tabIds: [],
          workspaceId: activeWsId,
          aiManaged: false,
        })
        groupCache.set(tabDef.groupLabel, group.id)
      }
      const groupId = groupCache.get(tabDef.groupLabel)!
      const group = workspaceManager.listGroups(activeWsId).find(g => g.id === groupId)
      if (group) {
        workspaceManager.updateGroup(groupId, { tabIds: [...group.tabIds, tab.id] })
      }
    }
  }

  // Apply settings patch
  if (program.settings) {
    // ... settings applied via settings IPC
  }

  // AI post-processing
  if (program.ai?.clusterAfterLoad) {
    await sleep(2000) // wait for pages to start loading
    const tabs = tabManager.listTabs(activeWsId).map(t => ({ id: t.id, title: t.title, url: t.url }))
    const clusters = await aiService.clusterTabs(tabs)

    // Apply AI clusters as groups
    for (const g of workspaceManager.listGroups(activeWsId)) {
      if (g.aiManaged) workspaceManager.deleteGroup(g.id)
    }
    for (const cluster of clusters) {
      workspaceManager.createGroup({
        label: cluster.label, color: cluster.color,
        tabIds: cluster.tabIds, workspaceId: activeWsId, aiManaged: true,
      })
    }
    workspaceManager.pushGroups(win)
  }

  win.webContents.send('groups:update', workspaceManager.listGroups(activeWsId))
  return { program: program.name, openedTabs: openedTabs.length, workspace: activeWsId }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Flat command catalog (for REPL autocomplete) ─────────────────
export const COMMAND_CATALOG = [
  // Tab
  { command: 'tab.create',           args: 'url [workspace] [background]',   desc: 'Open a new tab',                       category: 'tab' },
  { command: 'tab.close',            args: '[id]',                            desc: 'Close tab (active if no id)',          category: 'tab' },
  { command: 'tab.restore',          args: '',                                desc: 'Restore last closed tab',              category: 'tab' },
  { command: 'tab.navigate',         args: 'url [id]',                        desc: 'Navigate tab to URL',                  category: 'tab' },
  { command: 'tab.activate',         args: 'id',                              desc: 'Focus a tab by ID',                    category: 'tab' },
  { command: 'tab.hibernate',        args: '[id]',                            desc: 'Hibernate a tab',                      category: 'tab' },
  { command: 'tab.hibernateAll',     args: '',                                desc: 'Hibernate all background tabs',        category: 'tab' },
  { command: 'tab.wake',             args: '[id]',                            desc: 'Wake a hibernated tab',                category: 'tab' },
  { command: 'tab.wakeAll',          args: '',                                desc: 'Wake all hibernated tabs',             category: 'tab' },
  { command: 'tab.list',             args: '[workspace]',                     desc: 'List open tabs',                       category: 'tab' },
  { command: 'tab.reload',           args: '[id]',                            desc: 'Reload a tab',                         category: 'tab' },
  { command: 'tab.reloadAll',        args: '',                                desc: 'Reload all active tabs',               category: 'tab' },
  { command: 'tab.pin',              args: '[id]',                            desc: 'Pin a tab',                            category: 'tab' },
  { command: 'tab.unpin',            args: '[id]',                            desc: 'Unpin a tab',                          category: 'tab' },
  { command: 'tab.duplicate',        args: '[id]',                            desc: 'Duplicate a tab',                      category: 'tab' },
  { command: 'tab.openMany',         args: 'urls=url1,url2 [delay=ms]',       desc: 'Open multiple URLs at once',           category: 'tab' },
  { command: 'tab.closeMatching',    args: 'pattern',                         desc: 'Close tabs matching regex',            category: 'tab' },
  { command: 'tab.focusMatching',    args: 'pattern',                         desc: 'Focus first tab matching regex',       category: 'tab' },
  { command: 'tab.memory',           args: '',                                desc: 'Show tab memory stats',                category: 'tab' },
  { command: 'tab.goBack',           args: '[id]',                            desc: 'Go back in history',                   category: 'tab' },
  { command: 'tab.goForward',        args: '[id]',                            desc: 'Go forward in history',                category: 'tab' },
  // Workspace
  { command: 'workspace.create',     args: 'name [color]',                   desc: 'Create a workspace',                   category: 'workspace' },
  { command: 'workspace.switch',     args: 'name|id',                         desc: 'Switch to workspace',                  category: 'workspace' },
  { command: 'workspace.list',       args: '',                                desc: 'List all workspaces',                  category: 'workspace' },
  { command: 'workspace.program',    args: 'name',                            desc: 'Launch a workspace program',           category: 'workspace' },
  { command: 'workspace.closeAll',   args: '',                                desc: 'Close all tabs in workspace',          category: 'workspace' },
  { command: 'group.create',         args: 'label [color]',                   desc: 'Create a tab group',                   category: 'workspace' },
  { command: 'group.delete',         args: 'id',                              desc: 'Delete a tab group',                   category: 'workspace' },
  { command: 'group.aiCluster',      args: '',                                desc: 'AI-cluster tabs into groups',          category: 'workspace' },
  // AI
  { command: 'ai.summarize',         args: '[tabId]',                         desc: 'Summarize current/specified tab',      category: 'ai' },
  { command: 'ai.chat',              args: 'message',                         desc: 'Chat with AI about current page',      category: 'ai' },
  { command: 'ai.cluster',           args: '',                                desc: 'Cluster tabs in current workspace',    category: 'ai' },
  { command: 'ai.riskScore',         args: 'url',                             desc: 'Get AI risk score for a URL',          category: 'ai' },
  { command: 'ai.extractTasks',      args: 'text',                            desc: 'Extract tasks from text',              category: 'ai' },
  { command: 'ai.panel.toggle',      args: '',                                desc: 'Toggle AI panel',                      category: 'ai' },
  { command: 'ai.panel.open',        args: '',                                desc: 'Open AI panel',                        category: 'ai' },
  { command: 'ai.panel.close',       args: '',                                desc: 'Close AI panel',                       category: 'ai' },
  { command: 'ai.panel.tab',         args: 'tab',                             desc: 'Switch AI panel tab',                  category: 'ai' },
  // Lens
  { command: 'lens.set',             args: 'id',                              desc: 'Switch lens (default/research/coding/reading/creative)', category: 'ui' },
  { command: 'lens.restore',         args: '',                                desc: 'Restore previous lens',                category: 'ui' },
  { command: 'lens.list',            args: '',                                desc: 'List available lenses',                category: 'ui' },
  // Privacy
  { command: 'privacy.report',       args: '[tabId]',                         desc: 'Get privacy report for current tab',   category: 'privacy' },
  { command: 'privacy.blocklist',    args: '[tabId]',                         desc: 'List blocked trackers for tab',        category: 'privacy' },
  { command: 'privacy.enable',       args: '',                                desc: 'Enable all privacy protections',       category: 'privacy' },
  { command: 'privacy.disable',      args: '',                                desc: 'Disable privacy protections',          category: 'privacy' },
  // Memory
  { command: 'memory.report',        args: '',                                desc: 'Show memory usage report',             category: 'memory' },
  { command: 'memory.save',          args: '',                                desc: 'Hibernate background tabs',            category: 'memory' },
  { command: 'memory.threshold.set', args: 'mb',                              desc: 'Set memory threshold per tab',         category: 'memory' },
  { command: 'memory.hibernate.threshold', args: 'minutes|ms=<val>',          desc: 'Set auto-hibernate idle time',         category: 'memory' },
  // System
  { command: 'system.volume.set',    args: 'level (0-100)',                   desc: 'Set system volume',                    category: 'system' },
  { command: 'system.volume.mute',   args: '',                                desc: 'Mute system audio',                    category: 'system' },
  { command: 'system.volume.unmute', args: '',                                desc: 'Unmute system audio',                  category: 'system' },
  { command: 'system.notify',        args: 'body [title]',                    desc: 'Show a system notification',           category: 'system' },
  { command: 'system.app.focus',     args: '',                                desc: 'Bring Kitsune to front',               category: 'system' },
  { command: 'system.screenshot',    args: '',                                desc: 'Capture current window',               category: 'system' },
  { command: 'system.exec',          args: 'cmd',                             desc: 'Run a shell command',                  category: 'system' },
  { command: 'system.idle',          args: '',                                desc: 'Get system idle time in seconds',      category: 'system' },
  // UI
  { command: 'ui.commandPalette',    args: '',                                desc: 'Open command palette',                 category: 'ui' },
  { command: 'ui.settings',          args: '',                                desc: 'Open settings',                        category: 'ui' },
  { command: 'ui.fileSearch',        args: '',                                desc: 'Open file search',                     category: 'ui' },
  { command: 'ui.cleave',            args: '',                                desc: 'Open Cleave split layout',             category: 'ui' },
  { command: 'ui.focusUrlBar',       args: '',                                desc: 'Focus the URL bar',                    category: 'ui' },
  { command: 'ui.zoom.in',           args: '',                                desc: 'Zoom in on active tab',                category: 'ui' },
  { command: 'ui.zoom.out',          args: '',                                desc: 'Zoom out on active tab',               category: 'ui' },
  { command: 'ui.zoom.reset',        args: '',                                desc: 'Reset zoom on active tab',             category: 'ui' },
  { command: 'ui.fullscreen',        args: '',                                desc: 'Toggle fullscreen',                    category: 'ui' },
  { command: 'ui.sidebar.toggle',    args: '',                                desc: 'Toggle sidebar visibility',            category: 'ui' },
  { command: 'ui.readingMode',       args: '',                                desc: 'Toggle reading mode',                  category: 'ui' },
  // Page / JS
  { command: 'js.eval',              args: 'code [tabId]',                    desc: 'Eval JS in active tab',                category: 'script' },
  { command: 'js.inject',            args: 'url [tabId]',                     desc: 'Inject a script URL into page',        category: 'script' },
  { command: 'page.scroll',          args: 'y [x] [tabId]',                   desc: 'Scroll the active page',               category: 'script' },
  { command: 'page.scrollTop',       args: '[tabId]',                         desc: 'Scroll to top of page',                category: 'script' },
  { command: 'page.scrollBottom',    args: '[tabId]',                         desc: 'Scroll to bottom of page',             category: 'script' },
  { command: 'page.getText',         args: '[tabId] [maxChars]',              desc: 'Get page text content',                category: 'script' },
  { command: 'page.getTitle',        args: '[tabId]',                         desc: 'Get page title',                       category: 'script' },
  { command: 'page.getUrl',          args: '',                                desc: 'Get current URL',                      category: 'script' },
  { command: 'page.click',           args: 'selector [tabId]',                desc: 'Click a DOM element',                  category: 'script' },
  { command: 'page.find',            args: 'text',                            desc: 'Find text in page',                    category: 'script' },
  // Settings
  { command: 'settings.set',         args: 'key value',                       desc: 'Set a setting value',                  category: 'system' },
  { command: 'settings.get',         args: '[key]',                           desc: 'Get a setting value',                  category: 'system' },
  { command: 'settings.reset',       args: '',                                desc: 'Reset all settings to defaults',       category: 'system' },
  { command: 'settings.theme',       args: 'dark|light|system|midnight|...',  desc: 'Set theme',                            category: 'system' },
  { command: 'settings.ai.toggle',   args: '',                                desc: 'Toggle AI on/off',                     category: 'system' },
  // Meta
  { command: 'help',                 args: '',                                desc: 'Show help',                            category: 'meta' },
  { command: 'help.commands',        args: '[category]',                      desc: 'List all commands',                    category: 'meta' },
  { command: 'noop',                 args: '',                                desc: 'Do nothing (test)',                    category: 'meta' },
]
