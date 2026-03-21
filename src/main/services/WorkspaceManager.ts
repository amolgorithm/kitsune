// src/main/services/WorkspaceManager.ts
import { randomUUID } from 'crypto'
import type { Workspace, TabGroup } from '../../shared/types'
import type { SettingsStore } from './SettingsStore'

interface PersistedData {
  workspaces: Workspace[]
  groups: TabGroup[]
  activeId: string
}

export class WorkspaceManager {
  private workspaces = new Map<string, Workspace>()
  private groups     = new Map<string, TabGroup>()
  public  activeId   = 'default'

  constructor(private readonly settings: SettingsStore) {}

  async init(): Promise<void> {
    const persisted = this.settings.getRaw('workspaceData') as PersistedData | null

    if (persisted?.workspaces?.length) {
      for (const ws of persisted.workspaces) this.workspaces.set(ws.id, ws)
      for (const g of persisted.groups ?? []) this.groups.set(g.id, g)
      this.activeId = persisted.activeId ?? 'default'
      console.log(`[WorkspaceManager] loaded ${this.workspaces.size} workspaces, ${this.groups.size} groups`)
    } else {
      // First run — seed with two useful workspaces
      const ws1: Workspace = {
        id: 'default', name: 'General', icon: 'globe', color: '#ff6b35',
        tabIds: [], groupIds: [], noteIds: [], bookmarks: [],
        createdAt: Date.now(), lastOpenedAt: Date.now(),
      }
      const ws2: Workspace = {
        id: randomUUID(), name: 'Research', icon: 'research', color: '#a594ff',
        tabIds: [], groupIds: [], noteIds: [], bookmarks: [],
        createdAt: Date.now(), lastOpenedAt: Date.now(),
      }
      this.workspaces.set(ws1.id, ws1)
      this.workspaces.set(ws2.id, ws2)
      this.persist()
      console.log('[WorkspaceManager] initialized with default workspaces')
    }
  }

  createWorkspace(name: string, icon = 'folder', color = '#ff6b35'): Workspace {
    const ws: Workspace = {
      id: randomUUID(), name, icon, color,
      tabIds: [], groupIds: [], noteIds: [], bookmarks: [],
      createdAt: Date.now(), lastOpenedAt: Date.now(),
    }
    this.workspaces.set(ws.id, ws)
    this.persist()
    return ws
  }

  switchWorkspace(id: string): Workspace {
    const ws = this.workspaces.get(id)
    if (!ws) throw new Error(`Workspace ${id} not found`)
    ws.lastOpenedAt = Date.now()
    this.activeId = id
    this.persist()
    return ws
  }

  listWorkspaces(): Workspace[] {
    return [...this.workspaces.values()].sort((a, b) => a.createdAt - b.createdAt)
  }

  getWorkspace(id: string): Workspace | undefined { return this.workspaces.get(id) }

  // ─── Groups ─────────────────────────────────────────────────────

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
    if (ws && !ws.groupIds.includes(group.id)) ws.groupIds.push(group.id)
    this.persist()
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
    this.persist()
    return group
  }

  deleteGroup(id: string): void {
    const group = this.groups.get(id)
    if (group) {
      const ws = this.workspaces.get(group.workspaceId)
      if (ws) ws.groupIds = ws.groupIds.filter(gid => gid !== id)
    }
    this.groups.delete(id)
    this.persist()
  }

  // Push updated groups back to a renderer window
  pushGroups(win: Electron.BrowserWindow): void {
    win.webContents.send('groups:update', [...this.groups.values()])
  }

  private persist(): void {
    this.settings.setRaw('workspaceData', {
      workspaces: [...this.workspaces.values()],
      groups:     [...this.groups.values()],
      activeId:   this.activeId,
    })
  }
}

// Needed for pushGroups type
import type Electron from 'electron'
