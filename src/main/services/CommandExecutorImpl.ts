// src/main/services/CommandExecutorImpl.ts
// ─────────────────────────────────────────────────────────────────
// Implements every executable command available in Kitsune.
// Commands are dispatched by name to this class.
// ─────────────────────────────────────────────────────────────────

import { BrowserWindow, app, systemPreferences } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { CommandExecutor } from './CommandEngine'
import type { TabManager } from './TabManager'
import type { WorkspaceManager } from './WorkspaceManager'
import type { AIService } from './AIService'
import type { PrivacyEngine } from './PrivacyEngine'
import type { SettingsStore } from './SettingsStore'
import type { HibernationScheduler } from './HibernationScheduler'

const execAsync = promisify(exec)

export class CommandExecutorImpl implements CommandExecutor {
  private tabRestoreStack: Array<{ url: string; title: string; workspaceId: string }> = []
  private prevLensId: string | null = null
  private prevSettings: Record<string, unknown> = {}

  constructor(
    private readonly tabs: TabManager,
    private readonly workspaces: WorkspaceManager,
    private readonly ai: AIService,
    private readonly privacy: PrivacyEngine,
    private readonly settings: SettingsStore,
    private readonly hibernation: HibernationScheduler,
    private readonly win: BrowserWindow,
  ) {}

  async execute(command: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = this.getHandler(command)
    if (!handler) throw new Error(`Unknown command: '${command}'`)
    return handler(args)
  }

  getAvailableCommands(): string[] {
    return Object.keys(this.buildHandlerMap())
  }

  private getHandler(command: string): ((args: Record<string, unknown>) => Promise<unknown>) | null {
    const map = this.buildHandlerMap()
    return map[command] ?? null
  }

  private buildHandlerMap(): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
    return {
      // ── Tab commands ─────────────────────────────────────────────
      'tab.create': async (args) => {
        const url = String(args.url ?? args._arg0 ?? 'kitsune://newtab')
        const bg = Boolean(args.background ?? args.bg ?? false)
        const wsId = String(args.workspace ?? args.workspaceId ?? this.workspaces.activeId)
        return this.tabs.createTab({ url, background: bg, workspaceId: wsId })
      },
      'tab.close': async (args) => {
        const id = String(args.id ?? args._arg0 ?? this.tabs.getActiveTabId() ?? '')
        const tab = this.tabs.getTab(id)
        if (tab) this.tabRestoreStack.push({ url: tab.url, title: tab.title, workspaceId: tab.workspaceId })
        return this.tabs.closeTab(id)
      },
      'tab.restore': async (_args) => {
        const entry = this.tabRestoreStack.pop()
        if (!entry) throw new Error('Nothing to restore')
        return this.tabs.createTab({ url: entry.url, workspaceId: entry.workspaceId })
      },
      'tab.navigate': async (args) => {
        const id = String(args.id ?? this.tabs.getActiveTabId() ?? '')
        const url = String(args.url ?? args._arg0 ?? '')
        return this.tabs.navigateTab(id, url)
      },
      'tab.activate': async (args) => {
        const id = String(args.id ?? args._arg0 ?? '')
        return this.tabs.activateTab(id)
      },
      'tab.hibernate': async (args) => {
        const id = String(args.id ?? args._arg0 ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.hibernateTab(id)
      },
      'tab.hibernateAll': async (_args) => {
        const activeId = this.tabs.getActiveTabId()
        const all = this.tabs.listTabs()
        let count = 0
        for (const t of all) {
          if (t.id !== activeId && !t.hibernated && !t.isPinned) {
            await this.tabs.hibernateTab(t.id)
            count++
          }
        }
        return { hibernated: count }
      },
      'tab.wake': async (args) => {
        const id = String(args.id ?? args._arg0 ?? '')
        return this.tabs.wakeTab(id)
      },
      'tab.wakeAll': async (_args) => {
        const sleeping = this.tabs.listTabs().filter(t => t.hibernated)
        for (const t of sleeping) await this.tabs.wakeTab(t.id)
        return { woke: sleeping.length }
      },
      'tab.list': async (args) => {
        const wsId = args.workspace ? String(args.workspace) : undefined
        return this.tabs.listTabs(wsId)
      },
      'tab.reload': async (args) => {
        const id = String(args.id ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.reload(id)
      },
      'tab.reloadAll': async (_args) => {
        const active = this.tabs.listTabs().filter(t => !t.hibernated)
        for (const t of active) this.tabs.reload(t.id)
        return { reloaded: active.length }
      },
      'tab.pin': async (args) => {
        const id = String(args.id ?? this.tabs.getActiveTabId() ?? '')
        this.tabs.updateTabMeta(id, { isPinned: true })
        return { pinned: true }
      },
      'tab.unpin': async (args) => {
        const id = String(args.id ?? this.tabs.getActiveTabId() ?? '')
        this.tabs.updateTabMeta(id, { isPinned: false })
        return { pinned: false }
      },
      'tab.duplicate': async (args) => {
        const id = String(args.id ?? this.tabs.getActiveTabId() ?? '')
        const tab = this.tabs.getTab(id)
        if (!tab) throw new Error('Tab not found')
        return this.tabs.createTab({ url: tab.url, workspaceId: tab.workspaceId })
      },
      'tab.goBack': async (args) => {
        const id = String(args.id ?? this.tabs.getActiveTabId() ?? '')
        this.tabs.goBack(id)
        return { ok: true }
      },
      'tab.goForward': async (args) => {
        const id = String(args.id ?? this.tabs.getActiveTabId() ?? '')
        this.tabs.goForward(id)
        return { ok: true }
      },
      'tab.openMany': async (args) => {
        // tab.openMany urls=url1,url2,url3 delay=200
        const raw = String(args.urls ?? args._arg0 ?? '')
        const urls = raw.split(',').map(u => u.trim()).filter(Boolean)
        const delay = Number(args.delay ?? 0)
        const results = []
        for (const url of urls) {
          if (delay) await sleep(delay)
          const tab = await this.tabs.createTab({ url, background: true, workspaceId: this.workspaces.activeId })
          results.push(tab)
        }
        return { opened: results.length }
      },
      'tab.closeMatching': async (args) => {
        // Close tabs whose URL or title matches a pattern
        const pattern = String(args.pattern ?? args._arg0 ?? '')
        const re = new RegExp(pattern, 'i')
        const matches = this.tabs.listTabs().filter(t => re.test(t.url) || re.test(t.title))
        for (const t of matches) await this.tabs.closeTab(t.id)
        return { closed: matches.length }
      },
      'tab.focusMatching': async (args) => {
        const pattern = String(args.pattern ?? args._arg0 ?? '')
        const re = new RegExp(pattern, 'i')
        const match = this.tabs.listTabs().find(t => re.test(t.url) || re.test(t.title))
        if (!match) throw new Error(`No tab matching '${pattern}'`)
        await this.tabs.activateTab(match.id)
        return match
      },
      'tab.memory': async (_args) => {
        const tabs = this.tabs.listTabs()
        const active = tabs.filter(t => !t.hibernated)
        const total = tabs.reduce((a, t) => a + t.memoryBytes, 0)
        return {
          total: tabs.length,
          active: active.length,
          hibernated: tabs.length - active.length,
          totalMB: Math.round(total / (1024 * 1024)),
        }
      },

      // ── Workspace commands ────────────────────────────────────────
      'workspace.create': async (args) => {
        const name = String(args.name ?? args._arg0 ?? 'New Workspace')
        const color = String(args.color ?? '#ff6b35')
        return this.workspaces.createWorkspace(name, 'folder', color)
      },
      'workspace.switch': async (args) => {
        const id = String(args.id ?? args.name ?? args._arg0 ?? '')
        // Allow switching by name too
        const all = this.workspaces.listWorkspaces()
        const ws = all.find(w => w.id === id || w.name.toLowerCase() === id.toLowerCase())
        if (!ws) throw new Error(`Workspace '${id}' not found`)
        return this.workspaces.switchWorkspace(ws.id)
      },
      'workspace.list': async (_args) => {
        return this.workspaces.listWorkspaces()
      },
      'workspace.program': async (args) => {
        // Handled by commandIPC, just return marker
        const name = String(args.name ?? args._arg0 ?? '')
        return { programName: name, __runProgram: true }
      },
      'workspace.closeAll': async (_args) => {
        const tabs = this.tabs.listTabs(this.workspaces.activeId)
        for (const t of tabs) await this.tabs.closeTab(t.id)
        return { closed: tabs.length }
      },

      // ── Group commands ─────────────────────────────────────────────
      'group.create': async (args) => {
        return this.workspaces.createGroup({
          label: String(args.label ?? args.name ?? args._arg0 ?? 'Group'),
          color: String(args.color ?? '#a594ff'),
          tabIds: [],
          workspaceId: this.workspaces.activeId,
          aiManaged: false,
        })
      },
      'group.delete': async (args) => {
        const id = String(args.id ?? args._arg0 ?? '')
        this.workspaces.deleteGroup(id)
        return { deleted: true }
      },
      'group.aiCluster': async (_args) => {
        // Signals renderer to run AI cluster — returns marker
        return { __aiCluster: true }
      },

      // ── AI commands ───────────────────────────────────────────────
      'ai.summarize': async (args) => {
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        const tab = this.tabs.getTab(tabId)
        if (!tab) throw new Error('No active tab')
        const pageText = await this.tabs.getPageText(tabId)
        return this.ai.summarizePage({ tabId, url: tab.url, title: tab.title, pageText })
      },
      'ai.chat': async (args) => {
        const message = String(args.message ?? args.msg ?? args._arg0 ?? '')
        const tabId = this.tabs.getActiveTabId() ?? undefined
        const pageContext = tabId ? await this.tabs.getPageText(tabId, 3000) : undefined
        return this.ai.chat({ messages: [{ id: 'cmd', role: 'user', content: message, createdAt: Date.now() }], pageContext })
      },
      'ai.cluster': async (_args) => {
        const tabs = this.tabs.listTabs(this.workspaces.activeId).map(t => ({ id: t.id, title: t.title, url: t.url }))
        return this.ai.clusterTabs(tabs)
      },
      'ai.riskScore': async (args) => {
        const url = String(args.url ?? args._arg0 ?? '')
        return this.ai.scorePageRisk(url)
      },
      'ai.extractTasks': async (args) => {
        const text = String(args.text ?? args._arg0 ?? '')
        return this.ai.extractTasks(text, this.workspaces.activeId)
      },
      'ai.panel.toggle': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ai.panel.toggle' })
        return { ok: true }
      },
      'ai.panel.open': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ai.panel.open' })
        return { ok: true }
      },
      'ai.panel.close': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ai.panel.close' })
        return { ok: true }
      },
      'ai.panel.tab': async (args) => {
        const tab = String(args.tab ?? args._arg0 ?? 'summary')
        this.win.webContents.send('command:ui', { action: 'ai.panel.tab', tab })
        return { ok: true }
      },

      // ── Lens commands ─────────────────────────────────────────────
      'lens.set': async (args) => {
        const id = String(args.id ?? args._arg0 ?? 'default')
        this.prevLensId = this.settings.get('activeLensId') ?? 'default'
        this.settings.set('activeLensId', id)
        this.win.webContents.send('command:ui', { action: 'lens.set', id })
        this.win.webContents.send('settings:update', this.settings.getAll())
        return { lens: id }
      },
      'lens.restore': async (_args) => {
        if (this.prevLensId) {
          await this.execute('lens.set', { id: this.prevLensId })
        }
        return { lens: this.prevLensId }
      },
      'lens.list': async (_args) => {
        return ['default', 'research', 'coding', 'reading', 'creative']
      },

      // ── Privacy commands ──────────────────────────────────────────
      'privacy.report': async (args) => {
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        const tab = this.tabs.getTab(tabId)
        if (!tab) throw new Error('No active tab')
        return this.privacy.getRiskReport(tabId, tab.url)
      },
      'privacy.blocklist': async (args) => {
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        return this.privacy.getBlockReport(tabId)
      },
      'privacy.enable': async (_args) => {
        this.settings.setMany({ trackerBlockingEnabled: true, adBlockingEnabled: true, fingerprintProtection: true })
        this.win.webContents.send('settings:update', this.settings.getAll())
        return { enabled: true }
      },
      'privacy.disable': async (_args) => {
        this.settings.setMany({ trackerBlockingEnabled: false, adBlockingEnabled: false })
        this.win.webContents.send('settings:update', this.settings.getAll())
        return { enabled: false }
      },

      // ── Memory / System commands ──────────────────────────────────
      'memory.report': async (_args) => {
        const tabs = this.tabs.listTabs()
        const totalBytes = tabs.reduce((a, t) => a + t.memoryBytes, 0)
        const hibernated = tabs.filter(t => t.hibernated).length
        return {
          totalMB: Math.round(totalBytes / (1024 * 1024)),
          activeTabs: tabs.length - hibernated,
          hibernatedTabs: hibernated,
          savedMB: Math.round(tabs.filter(t => t.hibernated).reduce((a, t) => a + t.memoryBytes, 0) / (1024 * 1024)),
        }
      },
      'memory.save': async (_args) => {
        // Hibernate non-active, non-pinned tabs
        const result = await this.execute('tab.hibernateAll', {})
        return result
      },
      'memory.threshold.set': async (args) => {
        const mb = Number(args.mb ?? args._arg0 ?? 300)
        this.settings.set('maxActiveTabMemoryMB', mb)
        this.win.webContents.send('settings:update', this.settings.getAll())
        return { thresholdMB: mb }
      },
      'memory.hibernate.threshold': async (args) => {
        const ms = Number(args.ms ?? args.minutes ?? args._arg0 ?? 600000)
        const realMs = args.minutes ? Number(args.minutes) * 60000 : ms
        this.settings.set('hibernateAfterMs', realMs)
        this.win.webContents.send('settings:update', this.settings.getAll())
        return { hibernateAfterMs: realMs }
      },

      // ── System commands (OS level) ────────────────────────────────
      'system.volume.set': async (args) => {
        const level = Math.max(0, Math.min(100, Number(args.level ?? args._arg0 ?? 50)))
        const platform = process.platform
        if (platform === 'darwin') {
          await execAsync(`osascript -e 'set volume output volume ${level}'`)
        } else if (platform === 'linux') {
          await execAsync(`amixer set Master ${level}%`)
        } else if (platform === 'win32') {
          // PowerShell volume control
          await execAsync(`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`)
        }
        return { volume: level }
      },
      'system.volume.mute': async (_args) => {
        if (process.platform === 'darwin') {
          await execAsync(`osascript -e 'set volume with output muted'`)
        }
        return { muted: true }
      },
      'system.volume.unmute': async (_args) => {
        if (process.platform === 'darwin') {
          await execAsync(`osascript -e 'set volume without output muted'`)
        }
        return { muted: false }
      },
      'system.notify': async (args) => {
        const title = String(args.title ?? 'Kitsune')
        const body = String(args.body ?? args.message ?? args._arg0 ?? '')
        const { Notification } = await import('electron')
        new Notification({ title, body }).show()
        return { notified: true }
      },
      'system.app.focus': async (_args) => {
        app.focus({ steal: true })
        this.win.focus()
        return { focused: true }
      },
      'system.screenshot': async (_args) => {
        // Capture the browser view as a dataURL
        const image = await this.win.webContents.capturePage()
        return { dataUrl: image.toDataURL(), size: image.getSize() }
      },
      'system.exec': async (args) => {
        // Execute a shell command (sandboxed warning in UI)
        const cmd = String(args.cmd ?? args.command ?? args._arg0 ?? '')
        if (!cmd) throw new Error('No command specified')
        const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 })
        return { stdout, stderr }
      },
      'system.idle': async (_args) => {
        const { powerMonitor } = await import('electron')
        return { idleSeconds: powerMonitor.getSystemIdleTime() }
      },
      'system.battery': async (_args) => {
        try {
          const info = await app.getGPUInfo('basic')
          return info
        } catch {
          return { available: false }
        }
      },

      // ── Settings commands ─────────────────────────────────────────
      'settings.set': async (args) => {
        const key = String(args.key ?? args._arg0 ?? '')
        const value = args.value ?? args._arg1
        if (!key) throw new Error('Key required')
        const prev = this.settings.getRaw(key)
        this.prevSettings[key] = prev
        this.settings.setRaw(key, value)
        this.win.webContents.send('settings:update', this.settings.getAll())
        return { key, value, prev }
      },
      'settings.get': async (args) => {
        const key = String(args.key ?? args._arg0 ?? '')
        if (key) return this.settings.getRaw(key)
        return this.settings.getAll()
      },
      'settings.restore': async (args) => {
        const key = String(args.key ?? args._arg0 ?? '')
        if (key && this.prevSettings[key] !== undefined) {
          this.settings.setRaw(key, this.prevSettings[key])
          this.win.webContents.send('settings:update', this.settings.getAll())
          return { key, restored: this.prevSettings[key] }
        }
        return { restored: false }
      },
      'settings.reset': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'settings.reset' })
        return { ok: true }
      },
      'settings.theme': async (args) => {
        const theme = String(args.theme ?? args._arg0 ?? 'dark')
        this.settings.setMany({ theme: theme as any, 'appearance.themeBase': theme as any })
        this.win.webContents.send('settings:update', this.settings.getAll())
        return { theme }
      },
      'settings.ai.toggle': async (_args) => {
        const current = this.settings.get('aiEnabled')
        this.settings.set('aiEnabled', !current)
        this.win.webContents.send('settings:update', this.settings.getAll())
        return { aiEnabled: !current }
      },

      // ── UI commands ───────────────────────────────────────────────
      'ui.commandPalette': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ui.commandPalette' })
        return { ok: true }
      },
      'ui.settings': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ui.settings' })
        return { ok: true }
      },
      'ui.fileSearch': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ui.fileSearch' })
        return { ok: true }
      },
      'ui.cleave': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ui.cleave' })
        return { ok: true }
      },
      'ui.focusUrlBar': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ui.focusUrlBar' })
        return { ok: true }
      },
      'ui.zoom.in': async (_args) => {
        const activeId = this.tabs.getActiveTabId()
        if (activeId) {
          const view = (this.tabs as any).views?.get(activeId)
          if (view) {
            const level = view.webContents.getZoomLevel()
            view.webContents.setZoomLevel(level + 0.5)
          }
        }
        return { ok: true }
      },
      'ui.zoom.out': async (_args) => {
        const activeId = this.tabs.getActiveTabId()
        if (activeId) {
          const view = (this.tabs as any).views?.get(activeId)
          if (view) {
            const level = view.webContents.getZoomLevel()
            view.webContents.setZoomLevel(level - 0.5)
          }
        }
        return { ok: true }
      },
      'ui.zoom.reset': async (_args) => {
        const activeId = this.tabs.getActiveTabId()
        if (activeId) {
          const view = (this.tabs as any).views?.get(activeId)
          if (view) view.webContents.setZoomLevel(0)
        }
        return { ok: true }
      },
      'ui.fullscreen': async (_args) => {
        this.win.setFullScreen(!this.win.isFullScreen())
        return { fullscreen: this.win.isFullScreen() }
      },
      'ui.sidebar.toggle': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ui.sidebar.toggle' })
        return { ok: true }
      },
      'ui.readingMode': async (_args) => {
        this.win.webContents.send('command:ui', { action: 'ui.readingMode' })
        return { ok: true }
      },

      // ── Script / eval commands ─────────────────────────────────────
      'js.eval': async (args) => {
        // Evaluate JS in the active tab's page context
        const code = String(args.code ?? args.script ?? args._arg0 ?? '')
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.evalInTab(tabId, code)
      },
      'js.inject': async (args) => {
        // Inject a script URL into the active page
        const url = String(args.url ?? args._arg0 ?? '')
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.evalInTab(tabId, `
          const s = document.createElement('script');
          s.src = ${JSON.stringify(url)};
          document.head.appendChild(s);
          true
        `)
      },
      'page.scroll': async (args) => {
        const x = Number(args.x ?? 0)
        const y = Number(args.y ?? args._arg0 ?? 0)
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.evalInTab(tabId, `window.scrollBy(${x}, ${y}); true`)
      },
      'page.scrollTop': async (args) => {
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.evalInTab(tabId, `window.scrollTo(0,0); true`)
      },
      'page.scrollBottom': async (args) => {
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.evalInTab(tabId, `window.scrollTo(0, document.body.scrollHeight); true`)
      },
      'page.getText': async (args) => {
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        const max = Number(args.maxChars ?? 8000)
        return this.tabs.getPageText(tabId, max)
      },
      'page.getTitle': async (args) => {
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.evalInTab(tabId, 'document.title')
      },
      'page.getUrl': async (_args) => {
        const tab = this.tabs.getTab(this.tabs.getActiveTabId() ?? '')
        return tab?.url ?? ''
      },
      'page.click': async (args) => {
        const selector = String(args.selector ?? args._arg0 ?? '')
        const tabId = String(args.tabId ?? this.tabs.getActiveTabId() ?? '')
        return this.tabs.evalInTab(tabId, `
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('Element not found: ${selector}');
          el.click(); true
        `)
      },
      'page.find': async (args) => {
        const text = String(args.text ?? args._arg0 ?? '')
        this.win.webContents.findInPage(text)
        return { searching: text }
      },

      // ── Macro commands (meta) ─────────────────────────────────────
      'macro.list': async (_args) => {
        // Handled by IPC layer
        return { __macro: 'list' }
      },
      'macro.run': async (args) => {
        return { __macro: 'run', name: args.name ?? args._arg0 }
      },
      'macro.alias': async (args) => {
        return { __alias: true, short: args.short ?? args._arg0, expanded: args.expanded ?? args._arg1 }
      },

      // ── Info / help commands ──────────────────────────────────────
      'help': async (_args) => {
        return {
          categories: ['tab', 'workspace', 'ai', 'privacy', 'system', 'navigation', 'ui', 'memory', 'macro', 'script'],
          hint: 'Use help.commands to list all commands',
        }
      },
      'help.commands': async (args) => {
        const cat = String(args.category ?? args._arg0 ?? '')
        const all = this.getAvailableCommands()
        return cat ? all.filter(c => c.startsWith(cat)) : all
      },
      'noop': async (_args) => {
        return { ok: true }
      },
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
