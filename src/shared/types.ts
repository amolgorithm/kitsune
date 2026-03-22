// src/shared/types.ts
export type TabStatus = 'loading' | 'ready' | 'error' | 'hibernated'

export interface KitsuneTab {
  id: string; url: string; title: string; favicon?: string
  status: TabStatus; groupId?: string; workspaceId: string
  createdAt: number; lastAccessedAt: number; memoryBytes: number
  hibernated: boolean; aiClusterLabel?: string; riskScore?: number
  isPinned: boolean; isPrivate: boolean; lensId?: string
}

export interface TabGroup {
  id: string; label: string; color: string; tabIds: string[]
  workspaceId: string; collapsed: boolean; aiManaged: boolean
}

export interface Workspace {
  id: string; name: string; icon: string; color: string
  tabIds: string[]; groupIds: string[]; noteIds: string[]
  bookmarks: Bookmark[]; createdAt: number; lastOpenedAt: number
}

export interface Bookmark {
  id: string; url: string; title: string; favicon?: string
  tags: string[]; addedAt: number
}

export type AIPanelTab = 'summary' | 'research' | 'notes' | 'tasks' | 'chat'

export interface AISummary {
  tabId: string; url: string; title: string; keyPoints: string[]
  stats: string[]; links: { text: string; url: string }[]
  generatedAt: number; model: string
}

export interface CrossPageSummary {
  id: string; tabIds: string[]; topic: string; content: string
  citations: Citation[]; generatedAt: number
}

export interface Citation {
  id: string; title: string; url: string
  author?: string; publishedAt?: string; excerpt: string
}

export interface SmartNote {
  id: string; workspaceId: string; content: string
  citations: Citation[]; sourceTabId?: string; sourceUrl?: string
  createdAt: number; updatedAt: number; tags: string[]
}

export interface TaskItem {
  id: string; text: string; sourceUrl?: string; dueAt?: number
  done: boolean; createdAt: number; workspaceId: string
}

export interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string
  createdAt: number; tabContext?: string[]
}

export type TrackerCategory =
  | 'analytics' | 'advertising' | 'fingerprinting'
  | 'social' | 'crypto-mining' | 'malware'

export interface BlockedTracker {
  url: string; category: TrackerCategory; tabId: string
  blockedAt: number; method: 'known-list' | 'ai-heuristic' | 'fingerprint-guard'
}

export interface PageRiskReport {
  tabId: string; url: string; riskScore: number
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  signals: string[]; trackerCount: number; analyzedAt: number
}

export type SplitDirection = 'horizontal' | 'vertical'

export interface PaneNode {
  id: string; type: 'split' | 'leaf'; direction?: SplitDirection
  sizes?: number[]; children?: PaneNode[]
  tabId?: string; isAIPane?: boolean
}

export interface LensProfile {
  id: string; name: string; icon: string; description: string
  cssClass: string; forceReaderMode: boolean
  defaultAITab: AIPanelTab; hotkey?: string; builtIn: boolean
}

// ─── Nine Tails ───────────────────────────────────────────────────────────────
// Append to src/shared/types.ts

export type TailId =
  | 'watcher'
  | 'courier'
  | 'focus'
  | 'hibernate'
  | 'archivist'
  | 'shield'
  | 'relay'
  | 'harvest'
  | 'mirror'

export type TailEventType =
  | 'fire' | 'route' | 'block' | 'sleep' | 'skip'
  | 'snap' | 'restore' | 'clean' | 'index' | 'surface'
  | 'capture' | 'sync' | 'info' | 'config' | 'warn'

export interface TailEvent {
  id: string
  tailId: TailId
  type: TailEventType
  message: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export type TailTrigger =
  // Watcher
  | 'dom_change' | 'new_comment' | 'front_page' | 'keyword_match' | 'price_change'
  // Courier
  | 'url_open' | 'url_pattern' | 'tab_create'
  // Focus
  | 'time_window' | 'tab_open' | 'domain_visit'
  // Hibernate
  | 'memory_threshold' | 'idle_time' | 'tab_age' | 'battery_level'
  // Archivist
  | 'time_interval' | 'workspace_close' | 'manual_tag' | 'battery_warn'
  // Shield
  | 'request_type' | 'cname_detected' | 'utm_param' | 'webrtc_request'
  // Relay
  | 'bookmark_add' | 'focus_start' | 'focus_end'
  // Harvest
  | 'page_load' | 'tab_idle'
  // Mirror
  | 'highlight' | 'dom_ready'

export type TailAction =
  // Watcher
  | 'notify' | 'notify_sidebar' | 'run_command' | 'play_sound'
  // Courier
  | 'route_workspace' | 'route_group' | 'set_lens' | 'defer_hibernate'
  // Focus
  | 'block' | 'hibernate' | 'redirect' | 'allow_once'
  // Hibernate
  | 'wake_on_focus'
  // Archivist
  | 'snapshot' | 'snapshot_tagged' | 'prune_old'
  // Shield
  | 'strip' | 'disable_api' | 'log'
  // Relay
  | 'post_webhook' | 'push_slack' | 'append_notion' | 'update_gist'
  // Harvest
  | 'index' | 'index_tag' | 'surface_related'
  // Mirror
  | 'capture_schema' | 'append_note' | 'sync_vault' | 'surface_vault'

export interface TailRule {
  id: string
  tailId: TailId
  label: string
  pattern: string          // URL glob or domain pattern
  trigger: TailTrigger
  action: TailAction
  active: boolean
  params?: Record<string, unknown>   // action-specific config (webhook URL, vault path, etc.)
  createdAt: number
}

export interface TailSnapshot {
  id: string
  index: number
  label: string            // 'auto' or user tag
  tabCount: number
  workspaceIds: string[]
  groupIds: string[]
  tabSummaries: Array<{ tabId: string; url: string; title: string; summary?: string }>
  createdAt: number
  tag?: string             // manual label e.g. 'before client call'
}

export interface TailStats {
  watcher:   { fired: number; watching: number; domains: number }
  courier:   { routed: number; rules: number; conflicts: number }
  focus:     { blocked: number; window: string; nextBreak: string }
  hibernate: { hibernated: number; mbSaved: number; protected: number }
  archivist: { snapshots: number; oldestDays: number; lastRestore: string }
  shield:    { blocked: number; cleaned: number; cloaked: number }
  relay:     { fired: number; endpoints: number; errors: number }
  harvest:   { indexed: number; sessions: number; topics: number }
  mirror:    { captured: number; synced: number; vault: string }
}

export interface TailState {
  id: TailId
  enabled: boolean
  progress: number          // 0–100, activity level indicator
  events: TailEvent[]       // rolling last 100 events
  rules: TailRule[]
  stats: Partial<TailStats[TailId]>
}

export interface NineTailsState {
  tails: Record<TailId, TailState>
  activeEvents: TailEvent[] // cross-tail merged feed
}

export type IPCChannel =
  | 'tab:create' | 'tab:close' | 'tab:navigate' | 'tab:activate'
  | 'tab:hibernate' | 'tab:wake' | 'tab:update' | 'tab:list'
  | 'tab:go-back' | 'tab:go-forward' | 'tab:reload'
  | 'tab:set-ai-panel-width' | 'tab:modal-open' | 'tab:modal-close' | 'tab:nav-state'
  | 'group:create' | 'group:update' | 'group:delete' | 'group:list' | 'group:ai-cluster'
  | 'groups:update'
  | 'workspace:create' | 'workspace:switch' | 'workspace:save' | 'workspace:list'
  | 'ai:status' | 'ai:summarize-page' | 'ai:summarize-cross' | 'ai:chat'
  | 'ai:risk-score' | 'ai:cluster-tabs' | 'ai:extract-tasks' | 'ai:generate-note'
  | 'privacy:get-report' | 'privacy:blocked-list'
  | 'cleave:set-layout' | 'cleave:get-layout' | 'cleave:reset'
  | 'settings:get' | 'settings:set' | 'settings:update'
  | 'window:minimize' | 'window:maximize' | 'window:close'
  | 'cmd:execute' | 'cmd:chain.run'
  | 'cmd:macro.list' | 'cmd:macro.get' | 'cmd:macro.create' | 'cmd:macro.update' | 'cmd:macro.delete' | 'cmd:macro.run'
  | 'cmd:alias.list' | 'cmd:alias.create' | 'cmd:alias.delete' | 'cmd:alias.expand'
  | 'cmd:program.list' | 'cmd:program.create' | 'cmd:program.delete' | 'cmd:program.run'
  | 'cmd:scheduled.list' | 'cmd:scheduled.create' | 'cmd:scheduled.toggle' | 'cmd:scheduled.delete'
  | 'cmd:history.list' | 'cmd:history.clear' | 'cmd:undo'
  | 'cmd:commands.list'
  | 'command:ui'
  | 'ninetails:get-state' | 'ninetails:set-tail-enabled' | 'ninetails:add-rule' | 'ninetails:update-rule'
  | 'ninetails:delete-rule' | 'ninetails:get-events' | 'ninetails:get-snapshots' | 'ninetails:restore-snapshot'
  | 'ninetails:create-snapshot' | 'ninetails:tail-event'

  
// ─── Appearance system ────────────────────────────────────────────

export type ThemeBase = 'dark' | 'light' | 'system' | 'midnight' | 'forest' | 'volcano' | 'ocean' | 'dusk'

export type AccentPreset =
  | 'fox'       // #ff6b35 (default orange)
  | 'violet'    // #8b5cf6
  | 'cyan'      // #06b6d4
  | 'rose'      // #f43f5e
  | 'emerald'   // #10b981
  | 'amber'     // #f59e0b
  | 'indigo'    // #6366f1
  | 'pink'      // #ec4899
  | 'custom'

export type BackgroundStyle =
  | 'plain'           // solid color, default
  | 'gradient-mesh'   // radial mesh gradient blobs
  | 'gradient-linear' // simple linear gradient
  | 'noise'           // solid + noise texture (Zen-style)
  | 'dots'            // subtle dot grid
  | 'grid'            // subtle line grid
  | 'gradient-accent' // accent-colored mesh gradient

export type AnimationStyle =
  | 'none'
  | 'bubbles'
  | 'particles'
  | 'aurora'
  | 'ripple'
  | 'starfield'
  | 'lava'

export type TextureStyle = 'smooth' | 'grain-light' | 'grain-medium' | 'grain-heavy'

export interface AppearanceSettings {
  themeBase: ThemeBase
  accentPreset: AccentPreset
  accentCustom: string       // hex, only used when preset='custom'
  backgroundStyle: BackgroundStyle
  backgroundGradientFrom: string
  backgroundGradientTo: string
  textureStyle: TextureStyle
  animationStyle: AnimationStyle
  animationIntensity: number  // 0–100
  sidebarBlur: boolean        // frosted glass sidebar
  borderRadius: 'sharp' | 'rounded' | 'pill'
  fontScale: number           // 0.85–1.2
  sidebarWidth: number        // 180–320
  tabHeight: number           // 28–48
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeBase:               'dark',
  accentPreset:            'fox',
  accentCustom:            '#ff6b35',
  backgroundStyle:         'plain',
  backgroundGradientFrom:  '#0d0f12',
  backgroundGradientTo:    '#1a1e27',
  textureStyle:            'smooth',
  animationStyle:          'none',
  animationIntensity:      50,
  sidebarBlur:             false,
  borderRadius:            'rounded',
  fontScale:               1,
  sidebarWidth:            240,
  tabHeight:               36,
}

export interface KitsuneSettings {
  // AI
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
  theme: ThemeBase
  activeLensId: string

  // Appearance (full system)
  appearance: AppearanceSettings

  // Hotkeys
  hotkeys: Record<string, string>
}

export const DEFAULT_SETTINGS: KitsuneSettings = {
  hackclubApiKey: 'sk-hc-v1-dce4361dac14412aaada4c6fc55bdf3dbc7d35292247494db9f25686229cbbf2',
  aiModel:        'google/gemini-2.5-flash',
  aiEnabled:      true,

  autoHibernateEnabled:   true,
  hibernateAfterMs:       600_000,
  autoGroupTabs:          true,
  maxActiveTabMemoryMB:   300,

  trackerBlockingEnabled: true,
  adBlockingEnabled:      true,
  fingerprintProtection:  true,
  aiRiskScoringEnabled:   true,

  sidebarPosition: 'left',
  tabLayout:       'vertical',
  theme:           'dark',
  activeLensId:    'default',

  appearance: DEFAULT_APPEARANCE,

  hotkeys: {
    'ctrl+k':       'command-palette',
    'ctrl+t':       'tab:create',
    'ctrl+w':       'tab:close',
    'ctrl+\\':      'cleave:toggle',
    'ctrl+shift+a': 'ai-panel',
    'ctrl+shift+f': 'file-search',
    'ctrl+,':       'settings',
    'ctrl+1':       'lens:default',
    'ctrl+2':       'lens:research',
    'ctrl+3':       'lens:coding',
    'ctrl+4':       'lens:reading',
  },
}
