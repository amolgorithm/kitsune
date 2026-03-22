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

  // REPL height — shrinks BrowserView from the bottom so the native
  // Chromium layer never overlaps the inline REPL bar.
  // Called whenever REPL opens (with its height) or closes (with 0).
  ipcMain.handle('tab:set-repl-height', async (_e, height: number) => {
    tabManager.setReplHeight(height)
  })

  ipcMain.handle('tab:go-back',    (_e, id: string) => tabManager.goBack(id))
  ipcMain.handle('tab:go-forward', (_e, id: string) => tabManager.goForward(id))
  ipcMain.handle('tab:reload',     (_e, id: string) => tabManager.reload(id))

  ipcMain.handle('tab:modal-open',  () => tabManager.hideActiveView())
  ipcMain.handle('tab:modal-close', () => tabManager.showActiveView())

  ipcMain.handle('ninetails:page-mutation', (_e, tabId: string, url: string, ruleId: string) => {
    nineTailsEngine?.onPageMutation(tabId, url, ruleId)
  })
  ipcMain.handle('ninetails:page-highlight', (_e, tabId: string, text: string, url: string) => {
    nineTailsEngine?.onHighlight(tabId, text, url)
  })
}