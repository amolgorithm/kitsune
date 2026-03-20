// src/main/ipc/cleaveIPC.ts
// ─────────────────────────────────────────────────────────────────
import type { IpcMain, BrowserWindow as BW } from 'electron'
import type { CleaveManager } from '../services/CleaveManager'
import type { PaneNode, SplitDirection } from '../../shared/types'

export function registerCleaveIPC(ipcMain: IpcMain, cm: CleaveManager, win: BW): void {
  ipcMain.handle('cleave:get-layout', () => cm.getLayout())

  ipcMain.handle('cleave:set-layout', (_e, layout: PaneNode) => {
    cm.setLayout(layout)
    win.webContents.send('cleave:set-layout', layout)
    return layout
  })
}


