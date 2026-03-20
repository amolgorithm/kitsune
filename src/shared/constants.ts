// src/shared/constants.ts

export const KITSUNE_VERSION = '0.9.4'

export const HIBERNATE_CHECK_INTERVAL_MS = 30_000   // check every 30s
export const DEFAULT_HIBERNATE_AFTER_MS  = 600_000  // 10 minutes idle

export const MAX_TABS_PER_WORKSPACE = 200
export const MAX_WORKSPACES = 20

export const AI_CONTEXT_MAX_CHARS = 8_000  // chars sent to AI per page

// Built-in lens profile IDs
export const LENS_IDS = {
  DEFAULT:  'default',
  RESEARCH: 'research',
  CODING:   'coding',
  READING:  'reading',
  CREATIVE: 'creative',
} as const

// Tab group auto-colors (cycling)
export const GROUP_COLORS = [
  '#a594ff', '#ff6b35', '#4cc9f0', '#4cffb0',
  '#ffd166', '#ff4d6d', '#06d6a0', '#118ab2',
]

// Risk level thresholds
export const RISK_THRESHOLDS = {
  SAFE:     0.15,
  LOW:      0.35,
  MEDIUM:   0.60,
  HIGH:     0.80,
  // above 0.80 = critical
} as const

// Tracker block-list sources (fetched at startup, cached)
export const BLOCKLIST_URLS = [
  'https://raw.githubusercontent.com/nicehash/NiceHashQuickMiner/master/dist/tools/miners/minerd/xmrig.sig',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
  'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt',
  'https://raw.githubusercontent.com/nicehash/NiceHashQuickMiner/master/dist/tools/miners/minerd/xmrig.sig',
] as const

// IPC timeout (ms) — renderer waits this long for main to respond
export const IPC_TIMEOUT_MS = 10_000
