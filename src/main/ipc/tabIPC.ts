// src/main/ipc/tabIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import type { TabManager } from '../services/TabManager'

export function registerTabIPC(
  ipcMain: IpcMain,
  tabManager: TabManager,
  win: BrowserWindow,
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

  // Sidebar resize — updates BrowserView bounds immediately
  ipcMain.handle('tab:set-sidebar-width', async (_e, width: number) => {
    tabManager.setSidebarWidth(width)
    // Push the canonical width back so renderer CSS stays in sync
    win.webContents.send('sidebar:width-update', tabManager.getSidebarWidth())
    return tabManager.getSidebarWidth()
  })
  ipcMain.handle('tab:get-sidebar-width', async () => tabManager.getSidebarWidth())

  // Navigation controls
  ipcMain.handle('tab:go-back',    (_e, id: string) => tabManager.goBack(id))
  ipcMain.handle('tab:go-forward', (_e, id: string) => tabManager.goForward(id))
  ipcMain.handle('tab:reload',     (_e, id: string) => tabManager.reload(id))

  // Modal overlay management — hides BrowserView so React modals paint on top
  ipcMain.handle('tab:modal-open',  () => tabManager.hideActiveView())
  ipcMain.handle('tab:modal-close', () => tabManager.showActiveView())
}