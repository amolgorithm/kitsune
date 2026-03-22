// src/main/ipc/aiIPC.ts
import type { IpcMain } from 'electron'
import type { AIService } from '../services/AIService'
import type { TabManager } from '../services/TabManager'

const HACKCLUB_BASE = 'https://ai.hackclub.com/proxy/v1'

export function registerAIIPC(
  ipcMain: IpcMain,
  ai: AIService,
  tabManager: TabManager,
): void {
  // Status check
  ipcMain.handle('ai:status', () => ai.getStatus())

  // Test connection — runs from main process using electron.net
  // so it bypasses renderer fetch restrictions
  ipcMain.handle('ai:test-connection', async (_e, { apiKey, model }: { apiKey: string; model: string }) => {
    try {
      const { net } = require('electron')
      if (!net?.fetch) throw new Error('electron.net.fetch not available')

      const res = await net.fetch(`${HACKCLUB_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
          max_tokens: 5,
        }),
      })

      const body = await res.text()
      console.log('[aiIPC] test-connection status:', res.status, 'body:', body.slice(0, 100))

      if (res.ok) {
        return { ok: true, status: res.status, body }
      } else {
        return { ok: false, status: res.status, body }
      }
    } catch (err: any) {
      const cause = err?.cause?.message ?? String(err?.cause ?? '')
      console.error('[aiIPC] test-connection error:', err.message, cause)
      return { ok: false, error: `${err.message}${cause ? ` — ${cause}` : ''}` }
    }
  })

  ipcMain.handle('ai:summarize-page', async (_e, tabId: string) => {
    const tab = tabManager.getTab(tabId)
    if (!tab) throw new Error('Tab not found')
    const pageText = await tabManager.getPageText(tabId)
    return ai.summarizePage({ tabId, url: tab.url, title: tab.title, pageText })
  })

  ipcMain.handle('ai:summarize-cross', async (_e, { topic, tabIds }: { topic: string; tabIds: string[] }) => {
    const pages = await Promise.all(
      tabIds.map(async (id) => {
        const tab = tabManager.getTab(id)
        return { tabId: id, url: tab?.url ?? '', title: tab?.title ?? '', text: await tabManager.getPageText(id) }
      })
    )
    return ai.summarizeCrossPage({ topic, pages })
  })

  ipcMain.handle('ai:chat', async (_e, { messages, tabId }: { messages: any[]; tabId?: string }) => {
    const pageContext = tabId ? await tabManager.getPageText(tabId, 3000) : undefined
    return ai.chat({ messages, pageContext })
  })

  ipcMain.handle('ai:cluster-tabs', async (_e, workspaceId: string) => {
    const tabs = tabManager.listTabs(workspaceId).map(t => ({ id: t.id, title: t.title, url: t.url }))
    return ai.clusterTabs(tabs)
  })

  ipcMain.handle('ai:extract-tasks', async (_e, { text, workspaceId }: { text: string; workspaceId: string }) => {
    return ai.extractTasks(text, workspaceId)
  })

  ipcMain.handle('ai:risk-score', async (_e, url: string) => {
    return ai.scorePageRisk(url)
  })

  ipcMain.handle('ai:generate-note', async (_e, params: any) => {
    return ai.generateNote(params)
  })
}