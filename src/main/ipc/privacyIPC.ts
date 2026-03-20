// src/main/ipc/privacyIPC.ts
// ─────────────────────────────────────────────────────────────────
import type { IpcMain } from 'electron'
import type { PrivacyEngine } from '../services/PrivacyEngine'

export function registerPrivacyIPC(ipcMain: IpcMain, privacy: PrivacyEngine): void {
  ipcMain.handle('privacy:get-report', (_e, { tabId, url }: { tabId: string; url: string }) => {
    return privacy.getRiskReport(tabId, url)
  })

  ipcMain.handle('privacy:blocked-list', (_e, tabId: string) => {
    return privacy.getBlockReport(tabId)
  })
}


