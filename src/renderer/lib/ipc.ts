// src/renderer/lib/ipc.ts
import type {
  KitsuneTab,
  TabGroup,
  Workspace,
  AISummary,
  CrossPageSummary,
  ChatMessage,
  TaskItem,
  BlockedTracker,
  PageRiskReport,
  PaneNode,
  KitsuneSettings,
  IPCChannel,
} from '../../shared/types'

const ipc = window.kitsune

export const TabIPC = {
  create:    (opts: { url: string; workspaceId?: string; groupId?: string; background?: boolean }) =>
               ipc.invoke<KitsuneTab>('tab:create', opts),
  close:     (id: string) => ipc.invoke<void>('tab:close', id),
  navigate:  (id: string, url: string) => ipc.invoke<void>('tab:navigate', { id, url }),
  activate:  (id: string) => ipc.invoke<void>('tab:activate', id),
  hibernate: (id: string) => ipc.invoke<void>('tab:hibernate', id),
  wake:      (id: string) => ipc.invoke<void>('tab:wake', id),
  list:      (workspaceId?: string) => ipc.invoke<KitsuneTab[]>('tab:list', workspaceId),
  setAIPanelWidth: (width: number) => ipc.invoke<void>('tab:set-ai-panel-width', width),
}

export const AIIPC = {
  summarizePage:  (tabId: string) => ipc.invoke<AISummary>('ai:summarize-page', tabId),
  summarizeCross: (topic: string, tabIds: string[]) =>
    ipc.invoke<CrossPageSummary>('ai:summarize-cross', { topic, tabIds }),
  chat:           (messages: ChatMessage[], tabId?: string) =>
    ipc.invoke<string>('ai:chat', { messages, tabId }),
  clusterTabs:    (workspaceId: string) =>
    ipc.invoke<Array<{ label: string; color: string; tabIds: string[] }>>('ai:cluster-tabs', workspaceId),
  extractTasks:   (text: string, workspaceId: string) =>
    ipc.invoke<TaskItem[]>('ai:extract-tasks', { text, workspaceId }),
  riskScore:      (url: string) => ipc.invoke<number>('ai:risk-score', url),
}

export const PrivacyIPC = {
  getReport:   (tabId: string, url: string) =>
    ipc.invoke<PageRiskReport>('privacy:get-report', { tabId, url }),
  blockedList: (tabId: string) => ipc.invoke<BlockedTracker[]>('privacy:blocked-list', tabId),
}

export const WorkspaceIPC = {
  list:        () => ipc.invoke<Workspace[]>('workspace:list'),
  switch:      (id: string) => ipc.invoke<Workspace>('workspace:switch', id),
  create:      (name: string, icon: string, color: string) =>
    ipc.invoke<Workspace>('workspace:create', { name, icon, color }),
  createGroup: (params: Partial<TabGroup> & { workspaceId: string }) =>
    ipc.invoke<TabGroup>('group:create', params),
  updateGroup: (id: string, patch: Partial<TabGroup>) =>
    ipc.invoke<TabGroup>('group:update', { id, patch }),
  deleteGroup: (id: string) => ipc.invoke<void>('group:delete', id),
  aiCluster:   (workspaceId: string) => ipc.invoke<void>('group:ai-cluster', workspaceId),
}

export const CleaveIPC = {
  getLayout: () => ipc.invoke<PaneNode>('cleave:get-layout'),
  setLayout: (layout: PaneNode) => ipc.invoke<PaneNode>('cleave:set-layout', layout),
}

export const SettingsIPC = {
  get: () => ipc.invoke<KitsuneSettings>('settings:get'),
  set: (patch: Partial<KitsuneSettings>) => ipc.invoke<KitsuneSettings>('settings:set', patch),
}

export const Push = {
  onTabUpdate:    (fn: (tab: KitsuneTab) => void) => ipc.on('tab:update', fn as any),
  onTabClose:     (fn: (id: string) => void) => ipc.on('tab:close', fn as any),
  onTabActivate:  (fn: (id: string) => void) => ipc.on('tab:activate', fn as any),
  onTabNavigate:  (fn: (data: { id: string; url: string }) => void) =>
    ipc.on('tab:navigate', fn as any),
  onLayoutUpdate: (fn: (layout: PaneNode) => void) =>
    ipc.on('cleave:set-layout', fn as any),
}
