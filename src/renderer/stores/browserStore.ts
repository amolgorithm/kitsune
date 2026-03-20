// src/renderer/stores/browserStore.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  KitsuneTab, TabGroup, Workspace, KitsuneSettings,
  PaneNode, AISummary, ChatMessage, LensProfile, AIPanelTab,
} from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'
import { LENS_IDS } from '../../shared/constants'
import { TabIPC, WorkspaceIPC, SettingsIPC, Push, CleaveIPC } from '../lib/ipc'

const BUILT_IN_LENSES: LensProfile[] = [
  {
    id: LENS_IDS.DEFAULT,  name: 'Default',  icon: 'globe',   description: 'Standard browsing',
    cssClass: 'lens-default',  forceReaderMode: false, defaultAITab: 'summary',  hotkey: 'ctrl+1', builtIn: true,
  },
  {
    id: LENS_IDS.RESEARCH, name: 'Research', icon: 'research', description: 'AI summaries, citations, cross-tab synthesis',
    cssClass: 'lens-research', forceReaderMode: false, defaultAITab: 'research', hotkey: 'ctrl+2', builtIn: true,
  },
  {
    id: LENS_IDS.CODING,   name: 'Coding',   icon: 'code',    description: 'DevTools, syntax highlighting',
    cssClass: 'lens-coding',   forceReaderMode: false, defaultAITab: 'chat',     hotkey: 'ctrl+3', builtIn: true,
  },
  {
    id: LENS_IDS.READING,  name: 'Reading',  icon: 'book',    description: 'Distraction-free reading',
    cssClass: 'lens-reading',  forceReaderMode: true,  defaultAITab: 'notes',    hotkey: 'ctrl+4', builtIn: true,
  },
  {
    id: LENS_IDS.CREATIVE, name: 'Creative', icon: 'palette', description: 'Inspiration mode',
    cssClass: 'lens-creative', forceReaderMode: false, defaultAITab: 'chat',     builtIn: true,
  },
]

interface BrowserState {
  tabs: KitsuneTab[]
  activeTabId: string | null
  groups: TabGroup[]
  workspaces: Workspace[]
  activeWorkspaceId: string
  settings: KitsuneSettings
  layout: PaneNode | null
  lenses: LensProfile[]
  activeLensId: string
  initError: string | null

  aiPanelOpen: boolean
  aiPanelTab: AIPanelTab
  aiSummaries: Map<string, AISummary>
  chatMessages: ChatMessage[]
  chatLoading: boolean

  commandPaletteOpen: boolean
  settingsOpen: boolean
  cleaveOpen: boolean
  urlBarFocused: boolean
  urlBarValue: string

  createTab: (url: string) => Promise<void>
  closeTab: (id: string) => Promise<void>
  activateTab: (id: string) => Promise<void>
  navigateTab: (id: string, url: string) => Promise<void>
  hibernateTab: (id: string) => Promise<void>
  wakeTab: (id: string) => Promise<void>
  updateTabFromPush: (tab: KitsuneTab) => void
  removeTabFromPush: (id: string) => void

  switchWorkspace: (id: string) => Promise<void>

  toggleAIPanel: () => void
  setAIPanelTab: (tab: AIPanelTab) => void
  sendChatMessage: (content: string) => Promise<void>
  cacheAISummary: (tabId: string, summary: AISummary) => void

  setActiveLens: (id: string) => void

  openCommandPalette: () => void
  closeCommandPalette: () => void
  openSettings: () => void
  closeSettings: () => void
  toggleCleave: () => void
  setUrlBarFocused: (v: boolean) => void
  setUrlBarValue: (v: string) => void

  init: () => Promise<void>
}

export const useBrowserStore = create<BrowserState>()(
  immer((set, get) => ({
    tabs: [], activeTabId: null, groups: [], workspaces: [],
    activeWorkspaceId: 'default', settings: DEFAULT_SETTINGS,
    layout: null, lenses: BUILT_IN_LENSES, activeLensId: LENS_IDS.DEFAULT,
    initError: null,

    aiPanelOpen: false, aiPanelTab: 'summary',
    aiSummaries: new Map(), chatMessages: [], chatLoading: false,

    commandPaletteOpen: false, settingsOpen: false, cleaveOpen: false,
    urlBarFocused: false, urlBarValue: '',

    createTab: async (url) => {
      try {
        const tab = await TabIPC.create({ url, workspaceId: get().activeWorkspaceId })
        set(s => { s.tabs.push(tab); s.activeTabId = tab.id })
      } catch (e) { console.error('createTab failed', e) }
    },

    closeTab: async (id) => {
      try {
        await TabIPC.close(id)
        set(s => {
          s.tabs = s.tabs.filter(t => t.id !== id)
          if (s.activeTabId === id) s.activeTabId = s.tabs[s.tabs.length - 1]?.id ?? null
        })
      } catch (e) { console.error('closeTab failed', e) }
    },

    activateTab: async (id) => {
      try {
        await TabIPC.activate(id)
        set(s => {
          s.activeTabId = id
          const tab = s.tabs.find(t => t.id === id)
          if (tab) s.urlBarValue = tab.url === 'kitsune://newtab' ? '' : tab.url
        })
      } catch (e) { console.error('activateTab failed', e) }
    },

    navigateTab: async (id, url) => {
      let normalized = url.trim()
      if (!normalized.startsWith('http') && !normalized.startsWith('kitsune://')) {
        normalized = normalized.includes('.')
          ? `https://${normalized}`
          : `https://www.google.com/search?q=${encodeURIComponent(normalized)}`
      }
      set(s => {
        const tab = s.tabs.find(t => t.id === id)
        if (tab) { tab.url = normalized; tab.status = 'loading'; tab.title = 'Loading…' }
        s.urlBarValue = normalized
      })
      try { await TabIPC.navigate(id, normalized) }
      catch (e) { console.error('navigateTab failed', e) }
    },

    hibernateTab: async (id) => {
      try {
        await TabIPC.hibernate(id)
        set(s => { const t = s.tabs.find(t => t.id === id); if (t) t.hibernated = true })
      } catch (e) { console.error('hibernateTab failed', e) }
    },

    wakeTab: async (id) => {
      try {
        await TabIPC.wake(id)
        set(s => { const t = s.tabs.find(t => t.id === id); if (t) t.hibernated = false })
      } catch (e) { console.error('wakeTab failed', e) }
    },

    updateTabFromPush: (tab) => {
      set(s => {
        const i = s.tabs.findIndex(t => t.id === tab.id)
        if (i >= 0) s.tabs[i] = tab
        else s.tabs.push(tab)
        if (s.activeTabId === tab.id && tab.url !== 'kitsune://newtab') s.urlBarValue = tab.url
      })
    },

    removeTabFromPush: (id) => set(s => { s.tabs = s.tabs.filter(t => t.id !== id) }),

    switchWorkspace: async (id) => {
      try {
        await WorkspaceIPC.switch(id)
        const tabs = await TabIPC.list(id)
        set(s => { s.activeWorkspaceId = id; s.tabs = tabs; s.activeTabId = tabs[0]?.id ?? null })
      } catch (e) { console.error('switchWorkspace failed', e) }
    },

    toggleAIPanel: () => set(s => { s.aiPanelOpen = !s.aiPanelOpen }),
    setAIPanelTab: (tab) => set(s => { s.aiPanelTab = tab }),
    cacheAISummary: (tabId, summary) => set(s => { s.aiSummaries.set(tabId, summary) }),

    sendChatMessage: async (content) => {
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content, createdAt: Date.now() }
      set(s => { s.chatMessages.push(userMsg); s.chatLoading = true })
      try {
        const { AIIPC } = await import('../lib/ipc')
        const response = await AIIPC.chat([...get().chatMessages], get().activeTabId ?? undefined)
        const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: response, createdAt: Date.now() }
        set(s => { s.chatMessages.push(assistantMsg) })
      } catch (e) {
        console.error('chat failed', e)
      } finally {
        set(s => { s.chatLoading = false })
      }
    },

    setActiveLens: (id) => set(s => {
      s.activeLensId = id
      const lens = s.lenses.find(l => l.id === id)
      if (lens) s.aiPanelTab = lens.defaultAITab
    }),

    openCommandPalette: () => set(s => { s.commandPaletteOpen = true }),
    closeCommandPalette: () => set(s => { s.commandPaletteOpen = false }),
    openSettings: () => set(s => { s.settingsOpen = true }),
    closeSettings: () => set(s => { s.settingsOpen = false }),
    toggleCleave: () => set(s => { s.cleaveOpen = !s.cleaveOpen }),
    setUrlBarFocused: (v) => set(s => { s.urlBarFocused = v }),
    setUrlBarValue: (v) => set(s => { s.urlBarValue = v }),

    init: async () => {
      // Check IPC bridge exists before calling anything
      if (typeof window.kitsune === 'undefined') {
        console.error('window.kitsune not found — preload did not run')
        set(s => { s.initError = 'IPC bridge not available. Check preload script.' })
        return
      }

      try {
        const [settings, workspaces, tabs, layout] = await Promise.all([
          SettingsIPC.get(),
          WorkspaceIPC.list(),
          TabIPC.list(),
          CleaveIPC.getLayout(),
        ])
        set(s => {
          s.settings = settings
          s.activeLensId = settings.activeLensId
          s.workspaces = workspaces
          s.tabs = tabs
          s.activeTabId = tabs.find(t => !t.hibernated)?.id ?? null
          s.layout = layout
        })
      } catch (e) {
        console.error('init failed:', e)
        set(s => { s.initError = String(e) })
      }

      // Push subscriptions (safe even if init partially failed)
      try {
        Push.onTabUpdate(tab => get().updateTabFromPush(tab))
        Push.onTabClose(id => get().removeTabFromPush(id))
        Push.onTabActivate(id => set(s => { s.activeTabId = id }))
        Push.onTabNavigate(({ id, url }) => set(s => {
          const tab = s.tabs.find(t => t.id === id)
          if (tab) tab.url = url
          if (s.activeTabId === id && url !== 'kitsune://newtab') s.urlBarValue = url
        }))
        Push.onLayoutUpdate(layout => set(s => { s.layout = layout }))
      } catch (e) {
        console.error('push subscription failed:', e)
      }
    },
  }))
)

export const useActiveTab = () =>
  useBrowserStore(s => s.tabs.find(t => t.id === s.activeTabId))

export const useActiveLens = () =>
  useBrowserStore(s => s.lenses.find(l => l.id === s.activeLensId))
