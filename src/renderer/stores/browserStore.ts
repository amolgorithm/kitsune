// src/renderer/stores/browserStore.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — Primary Browser Store (Zustand)
// Single store for all renderer state. Mirrors main process data
// and handles optimistic updates.
// ─────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  KitsuneTab,
  TabGroup,
  Workspace,
  KitsuneSettings,
  PaneNode,
  AISummary,
  ChatMessage,
  LensProfile,
  AIPanelTab,
} from '../../shared/types'
import { DEFAULT_SETTINGS, LENS_IDS } from '../../shared/types'
import { TabIPC, WorkspaceIPC, SettingsIPC, Push, CleaveIPC } from '../lib/ipc'

// ─── Built-in Lens Profiles ──────────────────────────────────────

const BUILT_IN_LENSES: LensProfile[] = [
  {
    id: LENS_IDS.DEFAULT,
    name: 'Default',
    icon: '🌐',
    description: 'Standard browsing experience',
    cssClass: 'lens-default',
    forceReaderMode: false,
    defaultAITab: 'summary',
    hotkey: 'ctrl+1',
    builtIn: true,
  },
  {
    id: LENS_IDS.RESEARCH,
    name: 'Research',
    icon: '🔬',
    description: 'AI summaries, citations, cross-tab synthesis',
    cssClass: 'lens-research',
    forceReaderMode: false,
    defaultAITab: 'research',
    hotkey: 'ctrl+2',
    builtIn: true,
  },
  {
    id: LENS_IDS.CODING,
    name: 'Coding',
    icon: '⚡',
    description: 'DevTools integration, syntax highlighting, console panel',
    cssClass: 'lens-coding',
    forceReaderMode: false,
    defaultAITab: 'chat',
    hotkey: 'ctrl+3',
    builtIn: true,
  },
  {
    id: LENS_IDS.READING,
    name: 'Reading',
    icon: '📖',
    description: 'Distraction-free reader mode with typography control',
    cssClass: 'lens-reading',
    forceReaderMode: true,
    defaultAITab: 'notes',
    hotkey: 'ctrl+4',
    builtIn: true,
  },
  {
    id: LENS_IDS.CREATIVE,
    name: 'Creative',
    icon: '🎨',
    description: 'Inspiration mode with image search and mood board',
    cssClass: 'lens-creative',
    forceReaderMode: false,
    defaultAITab: 'chat',
    builtIn: true,
  },
]

// ─── Store Types ─────────────────────────────────────────────────

interface BrowserState {
  // Data
  tabs: KitsuneTab[]
  activeTabId: string | null
  groups: TabGroup[]
  workspaces: Workspace[]
  activeWorkspaceId: string
  settings: KitsuneSettings
  layout: PaneNode | null
  lenses: LensProfile[]
  activeLensId: string

  // AI Panel
  aiPanelOpen: boolean
  aiPanelTab: AIPanelTab
  aiSummaries: Map<string, AISummary>       // tabId → summary
  chatMessages: ChatMessage[]
  chatLoading: boolean

  // UI
  commandPaletteOpen: boolean
  settingsOpen: boolean
  cleaveOpen: boolean
  urlBarFocused: boolean
  urlBarValue: string

  // Actions — Tabs
  createTab: (url: string) => Promise<void>
  closeTab: (id: string) => Promise<void>
  activateTab: (id: string) => Promise<void>
  navigateTab: (id: string, url: string) => Promise<void>
  hibernateTab: (id: string) => Promise<void>
  wakeTab: (id: string) => Promise<void>
  updateTabFromPush: (tab: KitsuneTab) => void
  removeTabFromPush: (id: string) => void

  // Actions — Workspaces
  switchWorkspace: (id: string) => Promise<void>
  loadWorkspaces: () => Promise<void>

  // Actions — AI Panel
  toggleAIPanel: () => void
  setAIPanelTab: (tab: AIPanelTab) => void
  sendChatMessage: (content: string) => Promise<void>
  cacheAISummary: (tabId: string, summary: AISummary) => void

  // Actions — Lens
  setActiveLens: (id: string) => void

  // Actions — UI
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openSettings: () => void
  closeSettings: () => void
  toggleCleave: () => void
  setUrlBarFocused: (v: boolean) => void
  setUrlBarValue: (v: string) => void

  // Bootstrap
  init: () => Promise<void>
}

// ─── Store ───────────────────────────────────────────────────────

export const useBrowserStore = create<BrowserState>()(
  immer((set, get) => ({
    // ── Initial state ─────────────────────────────────────────────
    tabs: [],
    activeTabId: null,
    groups: [],
    workspaces: [],
    activeWorkspaceId: 'default',
    settings: DEFAULT_SETTINGS,
    layout: null,
    lenses: BUILT_IN_LENSES,
    activeLensId: LENS_IDS.DEFAULT,

    aiPanelOpen: false,
    aiPanelTab: 'summary',
    aiSummaries: new Map(),
    chatMessages: [],
    chatLoading: false,

    commandPaletteOpen: false,
    settingsOpen: false,
    cleaveOpen: false,
    urlBarFocused: false,
    urlBarValue: '',

    // ── Tab actions ───────────────────────────────────────────────

    createTab: async (url) => {
      const tab = await TabIPC.create({ url, workspaceId: get().activeWorkspaceId })
      set(s => { s.tabs.push(tab); s.activeTabId = tab.id })
    },

    closeTab: async (id) => {
      await TabIPC.close(id)
      set(s => {
        s.tabs = s.tabs.filter(t => t.id !== id)
        if (s.activeTabId === id) {
          s.activeTabId = s.tabs[s.tabs.length - 1]?.id ?? null
        }
      })
    },

    activateTab: async (id) => {
      await TabIPC.activate(id)
      set(s => {
        s.activeTabId = id
        const tab = s.tabs.find(t => t.id === id)
        if (tab) {
          s.urlBarValue = tab.url
        }
      })
    },

    navigateTab: async (id, url) => {
      let normalized = url
      if (!url.startsWith('http') && !url.startsWith('kitsune://')) {
        normalized = url.includes('.') ? `https://${url}` : `https://www.google.com/search?q=${encodeURIComponent(url)}`
      }
      set(s => {
        const tab = s.tabs.find(t => t.id === id)
        if (tab) { tab.url = normalized; tab.status = 'loading' }
        s.urlBarValue = normalized
      })
      await TabIPC.navigate(id, normalized)
    },

    hibernateTab: async (id) => {
      await TabIPC.hibernate(id)
      set(s => {
        const tab = s.tabs.find(t => t.id === id)
        if (tab) tab.hibernated = true
      })
    },

    wakeTab: async (id) => {
      await TabIPC.wake(id)
      set(s => {
        const tab = s.tabs.find(t => t.id === id)
        if (tab) tab.hibernated = false
      })
    },

    updateTabFromPush: (tab) => {
      set(s => {
        const i = s.tabs.findIndex(t => t.id === tab.id)
        if (i >= 0) {
          s.tabs[i] = tab
        } else {
          s.tabs.push(tab)
        }
        if (s.activeTabId === tab.id) {
          s.urlBarValue = tab.url
        }
      })
    },

    removeTabFromPush: (id) => {
      set(s => { s.tabs = s.tabs.filter(t => t.id !== id) })
    },

    // ── Workspace actions ─────────────────────────────────────────

    switchWorkspace: async (id) => {
      await WorkspaceIPC.switch(id)
      const tabs = await TabIPC.list(id)
      set(s => {
        s.activeWorkspaceId = id
        s.tabs = tabs
        s.activeTabId = tabs[0]?.id ?? null
      })
    },

    loadWorkspaces: async () => {
      const workspaces = await WorkspaceIPC.list()
      set(s => { s.workspaces = workspaces })
    },

    // ── AI Panel ──────────────────────────────────────────────────

    toggleAIPanel: () => {
      set(s => { s.aiPanelOpen = !s.aiPanelOpen })
    },

    setAIPanelTab: (tab) => {
      set(s => { s.aiPanelTab = tab })
    },

    cacheAISummary: (tabId, summary) => {
      set(s => { s.aiSummaries.set(tabId, summary) })
    },

    sendChatMessage: async (content) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: Date.now(),
      }
      set(s => {
        s.chatMessages.push(userMsg)
        s.chatLoading = true
      })

      try {
        const { AIIPC } = await import('../lib/ipc')
        const response = await AIIPC.chat(
          [...get().chatMessages],
          get().activeTabId ?? undefined
        )
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response,
          createdAt: Date.now(),
        }
        set(s => { s.chatMessages.push(assistantMsg) })
      } finally {
        set(s => { s.chatLoading = false })
      }
    },

    // ── Lens ─────────────────────────────────────────────────────

    setActiveLens: (id) => {
      set(s => {
        s.activeLensId = id
        const lens = s.lenses.find(l => l.id === id)
        if (lens) s.aiPanelTab = lens.defaultAITab
      })
    },

    // ── UI ────────────────────────────────────────────────────────

    openCommandPalette: () => set(s => { s.commandPaletteOpen = true }),
    closeCommandPalette: () => set(s => { s.commandPaletteOpen = false }),
    openSettings: () => set(s => { s.settingsOpen = true }),
    closeSettings: () => set(s => { s.settingsOpen = false }),
    toggleCleave: () => set(s => { s.cleaveOpen = !s.cleaveOpen }),
    setUrlBarFocused: (v) => set(s => { s.urlBarFocused = v }),
    setUrlBarValue: (v) => set(s => { s.urlBarValue = v }),

    // ── Bootstrap ─────────────────────────────────────────────────

    init: async () => {
      // Load settings
      const settings = await SettingsIPC.get()
      set(s => { s.settings = settings; s.activeLensId = settings.activeLensId })

      // Load workspaces
      const workspaces = await WorkspaceIPC.list()
      set(s => { s.workspaces = workspaces })

      // Load initial tabs
      const tabs = await TabIPC.list()
      set(s => {
        s.tabs = tabs
        s.activeTabId = tabs.find(t => !t.hibernated)?.id ?? null
      })

      // Load cleave layout
      const layout = await CleaveIPC.getLayout()
      set(s => { s.layout = layout })

      // Subscribe to push updates from main
      Push.onTabUpdate(tab => get().updateTabFromPush(tab))
      Push.onTabClose(id => get().removeTabFromPush(id))
      Push.onTabActivate(id => set(s => { s.activeTabId = id }))
      Push.onTabNavigate(({ id, url }) => {
        set(s => {
          const tab = s.tabs.find(t => t.id === id)
          if (tab) tab.url = url
          if (s.activeTabId === id) s.urlBarValue = url
        })
      })
      Push.onLayoutUpdate(layout => set(s => { s.layout = layout }))
    },
  }))
)

// Convenience selectors
export const useActiveTab = () =>
  useBrowserStore(s => s.tabs.find(t => t.id === s.activeTabId))

export const useActiveLens = () =>
  useBrowserStore(s => s.lenses.find(l => l.id === s.activeLensId))
