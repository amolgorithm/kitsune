// src/main/ipc/settingsIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import { nativeTheme, session } from 'electron'
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
    if (patch.theme) {
      nativeTheme.themeSource = patch.theme as 'dark' | 'light' | 'system'
    }
    win.webContents.send('settings:update', settings.getAll())
    return settings.getAll()
  })

  // ── Clear ALL user data ────────────────────────────────────────
  // Root cause of "still has Nine Tails stuff": nineTailsState, commandEngineState,
  // workspaceData, nineTailsSnapshots are ALL stored as keys inside the SAME
  // electron-store instance via settings.setRaw(). Deleting the JSON file on disk
  // doesn't help because the live in-memory store rewrites it immediately.
  // The fix: call settings.clearAll() which calls store.clear() — this wipes
  // both the in-memory Map and the file atomically, so nothing can rewrite it.
  ipcMain.handle('data:clearAll', async () => {
    // Wipe every key in the electron-store — settings, nineTailsState,
    // commandEngineState, workspaceData, nineTailsSnapshots, sidebarWidth, all of it.
    settings.clearAll()

    // Clear Chromium session used by BrowserViews (websites' IndexedDB, cookies, cache)
    try {
      const kitsuneSession = session.fromPartition('persist:kitsune')
      await kitsuneSession.clearStorageData()
      await kitsuneSession.clearCache()
    } catch (e) {
      console.error('[settingsIPC] clearStorageData persist:kitsune:', e)
    }

    // Clear default session (renderer process localStorage also lives here)
    try {
      await session.defaultSession.clearStorageData()
      await session.defaultSession.clearCache()
    } catch (e) {
      console.error('[settingsIPC] clearStorageData default:', e)
    }

    return { ok: true }
  })
}