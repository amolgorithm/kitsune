// src/main/ipc/workspaceIPC.ts
// ─────────────────────────────────────────────────────────────────
import type { IpcMain } from 'electron'
import type { WorkspaceManager } from '../services/WorkspaceManager'

export function registerWorkspaceIPC(ipcMain: IpcMain, wm: WorkspaceManager): void {
  ipcMain.handle('workspace:list', () => wm.listWorkspaces())
  ipcMain.handle('workspace:switch', (_e, id: string) => wm.switchWorkspace(id))
  ipcMain.handle('workspace:create', (_e, { name, icon, color }: { name: string; icon: string; color: string }) =>
    wm.createWorkspace(name, icon, color)
  )
  ipcMain.handle('group:create', (_e, params: any) => wm.createGroup(params))
  ipcMain.handle('group:update', (_e, { id, patch }: { id: string; patch: any }) => wm.updateGroup(id, patch))
  ipcMain.handle('group:delete', (_e, id: string) => wm.deleteGroup(id))
  ipcMain.handle('group:ai-cluster', async (_e, _workspaceId: string) => {
    // AI clustering is initiated from aiIPC and then workspaces are updated here
    return { success: true }
  })
}


