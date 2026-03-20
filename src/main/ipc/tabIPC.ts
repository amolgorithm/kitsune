// src/main/ipc/tabIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import type { TabManager } from '../services/TabManager'

export function registerTabIPC(
  ipcMain: IpcMain,
  tabManager: TabManager,
  win: BrowserWindow,
): void {
  ipcMain.handle('tab:create', async (_e, opts) => {
    return tabManager.createTab(opts)
  })

  ipcMain.handle('tab:close', async (_e, id: string) => {
    return tabManager.closeTab(id)
  })

  ipcMain.handle('tab:navigate', async (_e, { id, url }: { id: string; url: string }) => {
    return tabManager.navigateTab(id, url)
  })

  ipcMain.handle('tab:activate', async (_e, id: string) => {
    return tabManager.activateTab(id)
  })

  ipcMain.handle('tab:hibernate', async (_e, id: string) => {
    return tabManager.hibernateTab(id)
  })

  ipcMain.handle('tab:wake', async (_e, id: string) => {
    return tabManager.wakeTab(id)
  })

  ipcMain.handle('tab:list', async (_e, workspaceId?: string) => {
    return tabManager.listTabs(workspaceId)
  })

  ipcMain.handle('tab:update', async (_e, { id, patch }: { id: string; patch: any }) => {
    tabManager.updateTabMeta(id, patch)
  })
}
