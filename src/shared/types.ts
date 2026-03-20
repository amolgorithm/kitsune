// src/shared/types.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — Shared Type Definitions
// Used by both main process and renderer. Never import Electron
// APIs here; this file must be isomorphic.
// ─────────────────────────────────────────────────────────────────

// ─── Tabs ────────────────────────────────────────────────────────

export type TabStatus = 'loading' | 'ready' | 'error' | 'hibernated'

export interface KitsuneTab {
  id: string
  url: string
  title: string
  favicon?: string          // data URI or https URL
  status: TabStatus
  groupId?: string
  workspaceId: string
  createdAt: number
  lastAccessedAt: number
  /** Bytes of memory consumed when active; 0 when hibernated */
  memoryBytes: number
  /** Whether the webContents has been discarded to save RAM */
  hibernated: boolean
  /** AI-assigned topic cluster label */
  aiClusterLabel?: string
  /** Risk score 0–1 assigned before page load */
  riskScore?: number
  isPinned: boolean
  isPrivate: boolean
  lensId?: string
}

export interface TabGroup {
  id: string
  label: string
  color: string             // hex
  tabIds: string[]
  workspaceId: string
  collapsed: boolean
  /** true = auto-created by AI clustering, false = user-created */
  aiManaged: boolean
}

// ─── Workspaces ──────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  icon: string              // emoji or URL
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

// ─── AI Panel ────────────────────────────────────────────────────

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
  content: string           // markdown
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
  tabContext?: string[]    // tab IDs included as context
}

// ─── Privacy / Security ──────────────────────────────────────────

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
  riskScore: number         // 0–1
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  signals: string[]         // human-readable reasons
  trackerCount: number
  analyzedAt: number
}

// ─── Cleave (split-pane layout) ──────────────────────────────────

export type SplitDirection = 'horizontal' | 'vertical'

export interface PaneNode {
  id: string
  type: 'split' | 'leaf'
  direction?: SplitDirection
  sizes?: number[]          // percentage, must sum to 100
  children?: PaneNode[]
  // leaf only:
  tabId?: string
  isAIPane?: boolean
}

// ─── Lens Profiles ───────────────────────────────────────────────

export interface LensProfile {
  id: string
  name: string
  icon: string
  description: string
  /** CSS class applied to page wrapper */
  cssClass: string
  /** Reader mode forced on? */
  forceReaderMode: boolean
  /** AI panel default tab when lens is active */
  defaultAITab: AIPanelTab
  /** Hotkey to activate e.g. "ctrl+shift+1" */
  hotkey?: string
  builtIn: boolean
}

// ─── IPC Channel Map ─────────────────────────────────────────────
// Keep channel names as typed string literals to prevent typos.

export type IPCChannel =
  // Tab lifecycle
  | 'tab:create'
  | 'tab:close'
  | 'tab:navigate'
  | 'tab:activate'
  | 'tab:hibernate'
  | 'tab:wake'
  | 'tab:update'
  | 'tab:list'
  // Groups
  | 'group:create'
  | 'group:update'
  | 'group:delete'
  | 'group:ai-cluster'
  // Workspaces
  | 'workspace:create'
  | 'workspace:switch'
  | 'workspace:save'
  | 'workspace:list'
  // AI
  | 'ai:summarize-page'
  | 'ai:summarize-cross'
  | 'ai:chat'
  | 'ai:risk-score'
  | 'ai:cluster-tabs'
  | 'ai:extract-tasks'
  // Privacy
  | 'privacy:get-report'
  | 'privacy:blocked-list'
  // Cleave
  | 'cleave:set-layout'
  | 'cleave:get-layout'
  // Settings
  | 'settings:get'
  | 'settings:set'

// ─── Settings ────────────────────────────────────────────────────

export interface KitsuneSettings {
  // AI
  aiProvider: 'anthropic' | 'local'
  anthropicApiKey: string
  aiEnabled: boolean
  aiRunLocal: boolean

  // Tab management
  autoHibernateEnabled: boolean
  hibernateAfterMs: number          // default 600_000 (10 min)
  autoGroupTabs: boolean
  maxActiveTabMemoryMB: number      // soft cap before hibernation

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
  aiProvider: 'anthropic',
  anthropicApiKey: '',
  aiEnabled: true,
  aiRunLocal: false,

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
    'cmd+t': 'tab:create',
    'cmd+w': 'tab:close',
    'cmd+k': 'command-palette',
    'cmd+\\': 'cleave:toggle',
    'cmd+shift+r': 'reader-mode',
    'cmd+shift+a': 'ai-panel',
    'ctrl+1': 'lens:default',
    'ctrl+2': 'lens:research',
    'ctrl+3': 'lens:coding',
    'ctrl+4': 'lens:reading',
  },
}
