// src/main/services/WorkspaceManager.ts
// ─────────────────────────────────────────────────────────────────
import { randomUUID } from 'crypto'
import type { Workspace, TabGroup, Bookmark } from '../../shared/types'
import type { SettingsStore } from './SettingsStore'

export class WorkspaceManager {
  private workspaces = new Map<string, Workspace>()
  private groups     = new Map<string, TabGroup>()
  public  activeId   = 'default'

  constructor(private readonly settings: SettingsStore) {}

  async init(): Promise<void> {
    // TODO: Load persisted workspaces from SettingsStore / electron-store
    // For now, create a default workspace
    const defaultWs: Workspace = {
      id: 'default',
      name: 'Research',
      icon: '🔬',
      color: '#a594ff',
      tabIds: [],
      groupIds: [],
      noteIds: [],
      bookmarks: [],
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    }
    this.workspaces.set('default', defaultWs)
  }

  createWorkspace(name: string, icon = '📁', color = '#ff6b35'): Workspace {
    const ws: Workspace = {
      id: randomUUID(),
      name, icon, color,
      tabIds: [], groupIds: [], noteIds: [], bookmarks: [],
      createdAt: Date.now(), lastOpenedAt: Date.now(),
    }
    this.workspaces.set(ws.id, ws)
    return ws
  }

  switchWorkspace(id: string): Workspace {
    const ws = this.workspaces.get(id)
    if (!ws) throw new Error(`Workspace ${id} not found`)
    ws.lastOpenedAt = Date.now()
    this.activeId = id
    return ws
  }

  listWorkspaces(): Workspace[] {
    return [...this.workspaces.values()]
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id)
  }

  createGroup(params: Partial<TabGroup> & { workspaceId: string }): TabGroup {
    const group: TabGroup = {
      id: randomUUID(),
      label: params.label ?? 'New Group',
      color: params.color ?? '#a594ff',
      tabIds: params.tabIds ?? [],
      workspaceId: params.workspaceId,
      collapsed: false,
      aiManaged: params.aiManaged ?? false,
    }
    this.groups.set(group.id, group)
    const ws = this.workspaces.get(params.workspaceId)
    if (ws) ws.groupIds.push(group.id)
    return group
  }

  listGroups(workspaceId?: string): TabGroup[] {
    const all = [...this.groups.values()]
    return workspaceId ? all.filter(g => g.workspaceId === workspaceId) : all
  }

  updateGroup(id: string, patch: Partial<TabGroup>): TabGroup {
    const group = this.groups.get(id)
    if (!group) throw new Error(`Group ${id} not found`)
    Object.assign(group, patch)
    return group
  }

  deleteGroup(id: string): void {
    this.groups.delete(id)
  }
}
