// src/main/ipc/aiIPC.ts
import type { IpcMain } from 'electron'
import type { AIService } from '../services/AIService'
import type { TabManager } from '../services/TabManager'

export function registerAIIPC(
  ipcMain: IpcMain,
  ai: AIService,
  tabManager: TabManager,
): void {
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
        return {
          tabId: id,
          url: tab?.url ?? '',
          title: tab?.title ?? '',
          text: await tabManager.getPageText(id),
        }
      })
    )
    return ai.summarizeCrossPage({ topic, pages })
  })

  ipcMain.handle('ai:chat', async (_e, { messages, tabId }: { messages: any[]; tabId?: string }) => {
    let pageContext: string | undefined
    if (tabId) {
      pageContext = await tabManager.getPageText(tabId, 3000)
    }
    return ai.chat({ messages, pageContext })
  })

  ipcMain.handle('ai:cluster-tabs', async (_e, workspaceId: string) => {
    const tabs = tabManager.listTabs(workspaceId).map(t => ({
      id: t.id,
      title: t.title,
      url: t.url,
    }))
    return ai.clusterTabs(tabs)
  })

  ipcMain.handle('ai:extract-tasks', async (_e, { text, workspaceId }: { text: string; workspaceId: string }) => {
    return ai.extractTasks(text, workspaceId)
  })

  ipcMain.handle('ai:risk-score', async (_e, url: string) => {
    return ai.scorePageRisk(url)
  })
}


