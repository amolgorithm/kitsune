// src/main/ipc/settingsIPC.ts
// ─────────────────────────────────────────────────────────────────
import type { IpcMain } from 'electron'
import type { SettingsStore } from '../services/SettingsStore'
import type { KitsuneSettings } from '../../shared/types'

export function registerSettingsIPC(ipcMain: IpcMain, settings: SettingsStore): void {
  ipcMain.handle('settings:get', () => settings.getAll())
  ipcMain.handle('settings:set', (_e, patch: Partial<KitsuneSettings>) => {
    settings.setMany(patch)
    return settings.getAll()
  })
}
