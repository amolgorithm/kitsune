// src/main/ipc/settingsIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import { nativeTheme } from 'electron'
import type { SettingsStore } from '../services/SettingsStore'
import type { KitsuneSettings } from '../../shared/types'

export function registerSettingsIPC(
  ipcMain: IpcMain,
  settings: SettingsStore,
  win: BrowserWindow,
): void {
  ipcMain.handle('settings:get', () => settings.getAll())

  ipcMain.handle('settings:set', (_e, patch: Partial<KitsuneSettings>) => {
    settings.setMany(patch)

    // Apply side effects immediately
    if (patch.theme) {
      nativeTheme.themeSource = patch.theme as 'dark' | 'light' | 'system'
    }

    // Push full settings to renderer so UI updates reactively
    win.webContents.send('settings:update', settings.getAll())

    return settings.getAll()
  })
}
