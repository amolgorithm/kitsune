// src/main/ipc/cleaveIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import type { CleaveManager } from '../services/CleaveManager'
import type { TabManager } from '../services/TabManager'
import type { PaneNode } from '../../shared/types'

export function registerCleaveIPC(
  ipcMain: IpcMain,
  cm: CleaveManager,
  tabManager: TabManager,
  win: BrowserWindow,
): void {
  ipcMain.handle('cleave:get-layout', () => cm.getLayout())

  ipcMain.handle('cleave:set-layout', (_e, layout: PaneNode) => {
    cm.setLayout(layout)
    // Apply multi-pane BrowserView layout
    tabManager.applyLayout(cm.getLeafPanes())
    // Push to renderer so it can render pane borders/dividers
    win.webContents.send('cleave:set-layout', layout)
    return layout
  })

  ipcMain.handle('cleave:reset', () => {
    const layout = cm.reset()
    tabManager.applyLayout(cm.getLeafPanes())
    win.webContents.send('cleave:set-layout', layout)
    return layout
  })
}
