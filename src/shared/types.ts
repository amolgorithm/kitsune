// src/shared/types.ts

export type TabStatus = 'loading' | 'ready' | 'error' | 'hibernated'

export interface KitsuneTab {
  id: string
  url: string
  title: string
  favicon?: string
  status: TabStatus
  groupId?: string
  workspaceId: string
  createdAt: number
  lastAccessedAt: number
  memoryBytes: number
  hibernated: boolean
  aiClusterLabel?: string
  riskScore?: number
  isPinned: boolean
  isPrivate: boolean
  lensId?: string
}

export interface TabGroup {
  id: string
  label: string
  color: string
  tabIds: string[]
  workspaceId: string
  collapsed: boolean
  aiManaged: boolean
}

export interface Workspace {
  id: string
  name: string
  icon: string
  color: string
  tabIds: string[]
  groupIds: string[]
  noteIds: string[]
  bookmarks: Bookmark[]
  createdAt: number
  lastOpenedAt: number
}

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon?: string
  tags: string[]
  addedAt: number
}

export type AIPanelTab = 'summary' | 'research' | 'notes' | 'tasks' | 'chat'

export interface AISummary {
  tabId: string
  url: string
  title: string
  keyPoints: string[]
  stats: string[]
  links: { text: string; url: string }[]
  generatedAt: number
  model: string
}

export interface CrossPageSummary {
  id: string
  tabIds: string[]
  topic: string
  content: string
  citations: Citation[]
  generatedAt: number
}

export interface Citation {
  id: string
  title: string
  url: string
  author?: string
  publishedAt?: string
  excerpt: string
}

export interface SmartNote {
  id: string
  workspaceId: string
  content: string
  citations: Citation[]
  sourceTabId?: string
  sourceUrl?: string
  createdAt: number
  updatedAt: number
  tags: string[]
}

export interface TaskItem {
  id: string
  text: string
  sourceUrl?: string
  dueAt?: number
  done: boolean
  createdAt: number
  workspaceId: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  tabContext?: string[]
}

export type TrackerCategory =
  | 'analytics'
  | 'advertising'
  | 'fingerprinting'
  | 'social'
  | 'crypto-mining'
  | 'malware'

export interface BlockedTracker {
  url: string
  category: TrackerCategory
  tabId: string
  blockedAt: number
  method: 'known-list' | 'ai-heuristic' | 'fingerprint-guard'
}

export interface PageRiskReport {
  tabId: string
  url: string
  riskScore: number
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  signals: string[]
  trackerCount: number
  analyzedAt: number
}

export type SplitDirection = 'horizontal' | 'vertical'

export interface PaneNode {
  id: string
  type: 'split' | 'leaf'
  direction?: SplitDirection
  sizes?: number[]
  children?: PaneNode[]
  tabId?: string
  isAIPane?: boolean
}

export interface LensProfile {
  id: string
  name: string
  icon: string
  description: string
  cssClass: string
  forceReaderMode: boolean
  defaultAITab: AIPanelTab
  hotkey?: string
  builtIn: boolean
}

export type IPCChannel =
  | 'tab:create' | 'tab:close' | 'tab:navigate' | 'tab:activate'
  | 'tab:hibernate' | 'tab:wake' | 'tab:update' | 'tab:list'
  | 'tab:go-back' | 'tab:go-forward' | 'tab:reload'
  | 'tab:set-ai-panel-width' | 'tab:modal-open' | 'tab:modal-close'
  | 'tab:nav-state'
  | 'group:create' | 'group:update' | 'group:delete' | 'group:list'
  | 'workspace:create' | 'workspace:switch' | 'workspace:save' | 'workspace:list'
  | 'ai:status' | 'ai:summarize-page' | 'ai:summarize-cross' | 'ai:chat'
  | 'ai:risk-score' | 'ai:cluster-tabs' | 'ai:extract-tasks' | 'ai:generate-note'
  | 'privacy:get-report' | 'privacy:blocked-list'
  | 'cleave:set-layout' | 'cleave:get-layout'
  | 'settings:get' | 'settings:set'
  | 'window:minimize' | 'window:maximize' | 'window:close'

export interface KitsuneSettings {
  // AI — using HackClub free API
  hackclubApiKey: string
  aiModel: string
  aiEnabled: boolean

  // Tab management
  autoHibernateEnabled: boolean
  hibernateAfterMs: number
  autoGroupTabs: boolean
  maxActiveTabMemoryMB: number

  // Privacy
  trackerBlockingEnabled: boolean
  adBlockingEnabled: boolean
  fingerprintProtection: boolean
  aiRiskScoringEnabled: boolean

  // UI
  sidebarPosition: 'left' | 'right'
  tabLayout: 'vertical' | 'horizontal'
  theme: 'dark' | 'light' | 'system'
  activeLensId: string

  // Hotkeys
  hotkeys: Record<string, string>
}

export const DEFAULT_SETTINGS: KitsuneSettings = {
  hackclubApiKey: 'sk-hc-v1-dce4361dac14412aaada4c6fc55bdf3dbc7d35292247494db9f25686229cbbf2',
  aiModel: 'google/gemini-2.5-flash',
  aiEnabled: true,

  autoHibernateEnabled: true,
  hibernateAfterMs: 600_000,
  autoGroupTabs: true,
  maxActiveTabMemoryMB: 300,

  trackerBlockingEnabled: true,
  adBlockingEnabled: true,
  fingerprintProtection: true,
  aiRiskScoringEnabled: true,

  sidebarPosition: 'left',
  tabLayout: 'vertical',
  theme: 'dark',
  activeLensId: 'default',

  hotkeys: {
    'ctrl+k': 'command-palette',
    'ctrl+t': 'tab:create',
    'ctrl+w': 'tab:close',
    'ctrl+\\': 'cleave:toggle',
    'ctrl+shift+a': 'ai-panel',
    'ctrl+,': 'settings',
    'ctrl+1': 'lens:default',
    'ctrl+2': 'lens:research',
    'ctrl+3': 'lens:coding',
    'ctrl+4': 'lens:reading',
  },
}
