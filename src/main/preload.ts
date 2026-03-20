// src/main/preload.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — Preload Script
// Runs in renderer process but with access to Node/Electron APIs.
// Exposes a minimal, typed surface via contextBridge — the ONLY
// way the renderer talks to the main process.
// ─────────────────────────────────────────────────────────────────

import { contextBridge, ipcRenderer } from 'electron'
import type { IPCChannel } from '../shared/types'

// ─── Type-safe IPC wrapper ────────────────────────────────────────

const kitsuneAPI = {
  /**
   * Send a message to main and await a response.
   * All renderer→main communication goes through here.
   */
  invoke: <T = unknown>(channel: IPCChannel, ...args: unknown[]): Promise<T> => {
    return ipcRenderer.invoke(channel, ...args)
  },

  /**
   * Subscribe to push events sent from main → renderer.
   * Returns an unsubscribe function.
   */
  on: (channel: IPCChannel, listener: (...args: unknown[]) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },

  /** One-time listener */
  once: (channel: IPCChannel, listener: (...args: unknown[]) => void): void => {
    ipcRenderer.once(channel, (_event, ...args) => listener(...args))
  },
}

// ─── Expose to renderer window.kitsune ───────────────────────────

contextBridge.exposeInMainWorld('kitsune', kitsuneAPI)

// ─── TypeScript declaration for renderer ─────────────────────────
// Renderer files import from '@shared/types' and use window.kitsune

declare global {
  interface Window {
    kitsune: typeof kitsuneAPI
  }
}
