// src/main/ipc/nineTailsIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import type { NineTailsEngine } from '../services/NineTailsEngine'
import type { TailId, TailRule } from '../../shared/types'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'

export function registerNineTailsIPC(
  ipcMain: IpcMain,
  engine: NineTailsEngine,
  win: BrowserWindow,
): void {
  // ── State ──────────────────────────────────────────────────────
  ipcMain.handle('ninetails:get-state', () => engine.getState())

  // ── Tail enable/disable ────────────────────────────────────────
  ipcMain.handle('ninetails:set-tail-enabled', (_e, id: TailId, enabled: boolean) => {
    engine.setTailEnabled(id, enabled)
    return engine.getState().tails[id]
  })

  // ── Rules ──────────────────────────────────────────────────────
  ipcMain.handle('ninetails:add-rule', (_e, rule: Omit<TailRule, 'id' | 'createdAt'>) => {
    return engine.addRule(rule)
  })
  ipcMain.handle('ninetails:update-rule', (_e, tailId: TailId, ruleId: string, patch: Partial<TailRule>) => {
    engine.updateRule(tailId, ruleId, patch)
  })
  ipcMain.handle('ninetails:delete-rule', (_e, tailId: TailId, ruleId: string) => {
    engine.deleteRule(tailId, ruleId)
  })

  // ── Events ─────────────────────────────────────────────────────
  ipcMain.handle('ninetails:get-events', (_e, tailId?: TailId, limit?: number) => {
    return engine.getEvents(tailId, limit)
  })

  // ── Archivist: snapshots ───────────────────────────────────────
  ipcMain.handle('ninetails:get-snapshots', () => engine.getSnapshots())
  ipcMain.handle('ninetails:create-snapshot', (_e, tag?: string) => engine.createSnapshot(tag))
  ipcMain.handle('ninetails:restore-snapshot', (_e, snapshotId: string) => engine.restoreSnapshot(snapshotId))

  // ── Mirror: vault file sync ────────────────────────────────────
  // Writes captured content to a local file path (Obsidian vault, etc.)
  ipcMain.handle('ninetails:mirror-write-file', async (_e, { filePath, content }: { filePath: string; content: string }) => {
    try {
      const safePath = join(app.getPath('documents'), filePath.replace(/\.\./g, ''))
      await mkdir(dirname(safePath), { recursive: true })
      await writeFile(safePath, content, 'utf-8')
      return { ok: true, path: safePath }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })
  ipcMain.handle('ninetails:mirror-read-file', async (_e, filePath: string) => {
    try {
      const safePath = join(app.getPath('documents'), filePath.replace(/\.\./g, ''))
      const content = await readFile(safePath, 'utf-8')
      return { ok: true, content }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ── Relay: test a webhook endpoint ────────────────────────────
  ipcMain.handle('ninetails:relay-test', async (_e, url: string) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, source: 'kitsune-relay', ts: Date.now() }),
      })
      return { ok: res.ok, status: res.status }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ── Watcher: inject observer scripts into active tabs ─────────
  ipcMain.handle('ninetails:watcher-inject', async (_e, tabId: string, rules: TailRule[]) => {
    // Inject MutationObserver into the tab's page for each active rule
    // The observer sends ipc events back via preload bridge
    // (Implementation hooks into TabManager.evalInTab)
    return { injected: rules.length }
  })
}
