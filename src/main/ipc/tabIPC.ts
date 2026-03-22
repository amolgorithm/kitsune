// src/main/ipc/tabIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import type { TabManager } from '../services/TabManager'
import type { NineTailsEngine } from '../services/NineTailsEngine'

export function registerTabIPC(
  ipcMain: IpcMain,
  tabManager: TabManager,
  win: BrowserWindow,
  nineTailsEngine?: NineTailsEngine,
): void {
  ipcMain.handle('tab:create',    async (_e, opts) => tabManager.createTab(opts))
  ipcMain.handle('tab:close',     async (_e, id: string) => tabManager.closeTab(id))
  ipcMain.handle('tab:navigate',  async (_e, { id, url }: { id: string; url: string }) =>
    tabManager.navigateTab(id, url))
  ipcMain.handle('tab:activate',  async (_e, id: string) => tabManager.activateTab(id))
  ipcMain.handle('tab:hibernate', async (_e, id: string) => tabManager.hibernateTab(id))
  ipcMain.handle('tab:wake',      async (_e, id: string) => tabManager.wakeTab(id))
  ipcMain.handle('tab:list',      async (_e, workspaceId?: string) => tabManager.listTabs(workspaceId))
  ipcMain.handle('tab:set-ai-panel-width', async (_e, width: number) =>
    tabManager.setAIPanelWidth(width))

  // Sidebar resize
  ipcMain.handle('tab:set-sidebar-width', async (_e, width: number) => {
    tabManager.setSidebarWidth(width)
    win.webContents.send('sidebar:width-update', tabManager.getSidebarWidth())
    return tabManager.getSidebarWidth()
  })
  ipcMain.handle('tab:get-sidebar-width', async () => tabManager.getSidebarWidth())

  ipcMain.handle('tab:set-repl-height', async (_e, height: number) => {
    tabManager.setReplHeight(height)
  })

  ipcMain.handle('tab:go-back',    (_e, id: string) => tabManager.goBack(id))
  ipcMain.handle('tab:go-forward', (_e, id: string) => tabManager.goForward(id))
  ipcMain.handle('tab:reload',     (_e, id: string) => tabManager.reload(id))

  ipcMain.handle('tab:modal-open',  () => tabManager.hideActiveView())
  ipcMain.handle('tab:modal-close', () => tabManager.showActiveView())

  // ── Text selection relay ──────────────────────────────────────
  // The preload script fires this when the user selects text inside
  // any BrowserView page. We resolve the real tabId from the
  // webContents that sent the event, then forward to the shell
  // renderer so the AI panel can react.
  ipcMain.handle('ninetails:page-highlight', (event, _rawTabId: string, text: string, url: string) => {
    // Resolve which tab this came from by matching webContents id
    const senderId   = event.sender.id
    const allTabs    = tabManager.listTabs()
    const matchedTab = allTabs.find(t => {
      const view = (tabManager as any).views?.get(t.id)
      return view?.webContents?.id === senderId
    })
    const tabId = matchedTab?.id ?? tabManager.getActiveTabId() ?? 'unknown'

    // Forward to the shell renderer (AI panel listens here)
    win.webContents.send('ninetails:page-highlight', tabId, text, url)

    // Also notify NineTails engine if available
    nineTailsEngine?.onHighlight(tabId, text, url)
  })

  ipcMain.handle('ninetails:page-mutation', (_e, tabId: string, url: string, ruleId: string) => {
    nineTailsEngine?.onPageMutation(tabId, url, ruleId)
  })
}