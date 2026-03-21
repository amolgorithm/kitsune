// src/main/ipc/workspaceIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import type { WorkspaceManager } from '../services/WorkspaceManager'
import type { TabManager } from '../services/TabManager'
import type { AIService } from '../services/AIService'

export function registerWorkspaceIPC(
  ipcMain: IpcMain,
  wm: WorkspaceManager,
  tabManager: TabManager,
  ai: AIService,
  win: BrowserWindow,
): void {
  ipcMain.handle('workspace:list',   () => wm.listWorkspaces())
  ipcMain.handle('workspace:switch', (_e, id: string) => wm.switchWorkspace(id))
  ipcMain.handle('workspace:create', (_e, { name, icon, color }: any) =>
    wm.createWorkspace(name, icon, color))

  ipcMain.handle('group:list',   (_e, workspaceId?: string) => wm.listGroups(workspaceId))
  ipcMain.handle('group:create', (_e, params: any) => {
    const group = wm.createGroup(params)
    wm.pushGroups(win)
    return group
  })
  ipcMain.handle('group:update', (_e, { id, patch }: any) => {
    const group = wm.updateGroup(id, patch)
    wm.pushGroups(win)
    return group
  })
  ipcMain.handle('group:delete', (_e, id: string) => {
    wm.deleteGroup(id)
    wm.pushGroups(win)
  })

  // AI auto-cluster tabs into groups
  ipcMain.handle('group:ai-cluster', async (_e, workspaceId: string) => {
    const tabs = tabManager.listTabs(workspaceId).map(t => ({
      id: t.id, title: t.title, url: t.url,
    }))
    const clusters = await ai.clusterTabs(tabs)

    // Delete old AI-managed groups for this workspace
    for (const g of wm.listGroups(workspaceId)) {
      if (g.aiManaged) wm.deleteGroup(g.id)
    }

    // Create new groups from clusters
    for (const cluster of clusters) {
      wm.createGroup({
        label: cluster.label,
        color: cluster.color,
        tabIds: cluster.tabIds,
        workspaceId,
        aiManaged: true,
      })
    }

    wm.pushGroups(win)
    return wm.listGroups(workspaceId)
  })
}
