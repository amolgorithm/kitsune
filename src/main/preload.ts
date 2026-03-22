// src/main/preload.ts
// ─────────────────────────────────────────────────────────────────
// Runs in renderer process but with access to Node/Electron APIs.
// Exposes a minimal, typed surface via contextBridge — the ONLY
// way the renderer talks to the main process.
// Also injects a selection listener so highlighted text in any
// BrowserView is relayed to the AI panel.
// ─────────────────────────────────────────────────────────────────

import { contextBridge, ipcRenderer } from 'electron'
import type { IPCChannel } from '../shared/types'

const kitsuneAPI = {
  invoke: <T = unknown>(channel: IPCChannel, ...args: unknown[]): Promise<T> => {
    return ipcRenderer.invoke(channel, ...args)
  },

  on: (channel: IPCChannel, listener: (...args: unknown[]) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },

  once: (channel: IPCChannel, listener: (...args: unknown[]) => void): void => {
    ipcRenderer.once(channel, (_event, ...args) => listener(...args))
  },
}

contextBridge.exposeInMainWorld('kitsune', kitsuneAPI)

// ─── Text selection relay ─────────────────────────────────────────
// When the user selects text in a page loaded inside a BrowserView,
// relay it to the main process so the AI panel can pick it up.
// We debounce to avoid firing on every character of a drag select.

let selectionTimer: ReturnType<typeof setTimeout> | null = null

document.addEventListener('mouseup', () => {
  if (selectionTimer) clearTimeout(selectionTimer)
  selectionTimer = setTimeout(() => {
    const text = window.getSelection()?.toString().trim() ?? ''
    if (text.length > 10) {
      // Send to main process — tabIPC will forward to the shell renderer
      ipcRenderer.invoke(
        'ninetails:page-highlight' as any,
        'current',   // tabId resolved in main process
        text,
        window.location.href,
      ).catch(() => {/* ignore if tab is closing */})
    }
  }, 400)
})

declare global {
  interface Window {
    kitsune: typeof kitsuneAPI
  }
}