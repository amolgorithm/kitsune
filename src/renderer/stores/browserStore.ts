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
  { id: LENS_IDS.DEFAULT,  name: 'Default',  icon: 'globe',    description: 'Standard browsing',             cssClass: 'lens-default',  forceReaderMode: false, defaultAITab: 'summary',  hotkey: 'ctrl+1', builtIn: true },
  { id: LENS_IDS.RESEARCH, name: 'Research', icon: 'research', description: 'AI summaries, citations',       cssClass: 'lens-research', forceReaderMode: false, defaultAITab: 'research', hotkey: 'ctrl+2', builtIn: true },
  { id: LENS_IDS.CODING,   name: 'Coding',   icon: 'code',     description: 'DevTools, syntax highlighting', cssClass: 'lens-coding',   forceReaderMode: false, defaultAITab: 'chat',     hotkey: 'ctrl+3', builtIn: true },
  { id: LENS_IDS.READING,  name: 'Reading',  icon: 'book',     description: 'Distraction-free reading',      cssClass: 'lens-reading',  forceReaderMode: true,  defaultAITab: 'notes',    hotkey: 'ctrl+4', builtIn: true },
  { id: LENS_IDS.CREATIVE, name: 'Creative', icon: 'palette',  description: 'Inspiration mode',              cssClass: 'lens-creative', forceReaderMode: false, defaultAITab: 'chat',     builtIn: true },
]

interface NavState { canGoBack: boolean; canGoForward: boolean }

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
  navState: Record<string, NavState>

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

  // Tab actions
  createTab:         (url: string) => Promise<void>
  closeTab:          (id: string) => Promise<void>
  activateTab:       (id: string) => Promise<void>
  navigateTab:       (id: string, url: string) => Promise<void>
  hibernateTab:      (id: string) => Promise<void>
  wakeTab:           (id: string) => Promise<void>
  goBack:            (id: string) => Promise<void>
  goForward:         (id: string) => Promise<void>
  reload:            (id: string) => Promise<void>
  updateTabFromPush: (tab: KitsuneTab) => void
  removeTabFromPush: (id: string) => void

  // Groups
  createGroup:    (params: Partial<TabGroup> & { workspaceId: string }) => Promise<void>
  deleteGroup:    (id: string) => Promise<void>
  aiClusterTabs:  () => Promise<void>
  setGroupsFromPush: (groups: TabGroup[]) => void

  // Workspace
  switchWorkspace: (id: string) => Promise<void>
  createWorkspace: (name: string, color: string) => Promise<void>

  // AI
  toggleAIPanel:   () => void
  setAIPanelTab:   (tab: AIPanelTab) => void
  sendChatMessage: (content: string) => Promise<void>
  cacheAISummary:  (tabId: string, summary: AISummary) => void

  // Lens
  setActiveLens: (id: string) => void

  // UI
  openCommandPalette:  () => void
  closeCommandPalette: () => void
  openSettings:        () => void
  closeSettings:       () => void
  toggleCleave:        () => void
  setUrlBarFocused:    (v: boolean) => void
  setUrlBarValue:      (v: string) => void

  init: () => Promise<void>
}

export const useBrowserStore = create<BrowserState>()(
  immer((set, get) => ({
    tabs: [], activeTabId: null, groups: [], workspaces: [],
    activeWorkspaceId: 'default', settings: DEFAULT_SETTINGS,
    layout: null, lenses: BUILT_IN_LENSES, activeLensId: LENS_IDS.DEFAULT,
    initError: null, navState: {},

    aiPanelOpen: false, aiPanelTab: 'summary',
    aiSummaries: new Map(), chatMessages: [], chatLoading: false,

    commandPaletteOpen: false, settingsOpen: false, cleaveOpen: false,
    urlBarFocused: false, urlBarValue: '',

    // ── Tab actions ─────────────────────────────────────────────
    // Do NOT push tab locally — pushTabUpdate in main is single source of truth
    createTab: async (url) => {
      try { await TabIPC.create({ url, workspaceId: get().activeWorkspaceId }) }
      catch (e) { console.error('createTab:', e) }
    },
    closeTab: async (id) => {
      try { await TabIPC.close(id) }
      catch (e) { console.error('closeTab:', e) }
    },
    activateTab: async (id) => {
      try { await TabIPC.activate(id) }
      catch (e) { console.error('activateTab:', e) }
    },
    navigateTab: async (id, url) => {
      let normalized = url.trim()
      if (!normalized.startsWith('http') && !normalized.startsWith('kitsune://')) {
        normalized = normalized.includes('.')
          ? `https://${normalized}`
          : `https://www.google.com/search?q=${encodeURIComponent(normalized)}`
      }
      set(s => { s.urlBarValue = normalized })
      try { await TabIPC.navigate(id, normalized) }
      catch (e) { console.error('navigateTab:', e) }
    },
    hibernateTab: async (id) => {
      try { await TabIPC.hibernate(id) }
      catch (e) { console.error('hibernateTab:', e) }
    },
    wakeTab: async (id) => {
      try { await TabIPC.wake(id) }
      catch (e) { console.error('wakeTab:', e) }
    },
    goBack:    async (id) => { try { await TabIPC.goBack(id) }    catch (e) { console.error(e) } },
    goForward: async (id) => { try { await TabIPC.goForward(id) } catch (e) { console.error(e) } },
    reload:    async (id) => { try { await TabIPC.reload(id) }    catch (e) { console.error(e) } },

    updateTabFromPush: (tab) => {
      set(s => {
        const i = s.tabs.findIndex(t => t.id === tab.id)
        if (i >= 0) s.tabs[i] = tab
        else s.tabs.push(tab)
        if (s.activeTabId === tab.id && tab.url !== 'kitsune://newtab') s.urlBarValue = tab.url
      })
    },
    removeTabFromPush: (id) => {
      set(s => {
        s.tabs = s.tabs.filter(t => t.id !== id)
        if (s.activeTabId === id) s.activeTabId = null
      })
    },

    // ── Groups ──────────────────────────────────────────────────
    createGroup: async (params) => {
      try { await WorkspaceIPC.createGroup(params) }
      catch (e) { console.error('createGroup:', e) }
    },
    deleteGroup: async (id) => {
      try { await WorkspaceIPC.deleteGroup(id) }
      catch (e) { console.error('deleteGroup:', e) }
    },
    aiClusterTabs: async () => {
      const workspaceId = get().activeWorkspaceId
      try {
        const groups = await WorkspaceIPC.aiCluster(workspaceId)
        set(s => { s.groups = groups })
      } catch (e) { console.error('aiClusterTabs:', e) }
    },
    setGroupsFromPush: (groups) => {
      set(s => { s.groups = groups.filter(g => g.workspaceId === s.activeWorkspaceId) })
    },

    // ── Workspaces ──────────────────────────────────────────────
    switchWorkspace: async (id) => {
      try {
        await WorkspaceIPC.switch(id)
        const [tabs, groups] = await Promise.all([
          TabIPC.list(id),
          WorkspaceIPC.listGroups(id),
        ])
        set(s => {
          s.activeWorkspaceId = id
          s.tabs   = tabs
          s.groups = groups
          s.activeTabId = tabs.find(t => !t.hibernated)?.id ?? null
        })
      } catch (e) { console.error('switchWorkspace:', e) }
    },
    createWorkspace: async (name, color) => {
      try {
        const ws = await WorkspaceIPC.create(name, 'folder', color)
        set(s => { s.workspaces.push(ws) })
      } catch (e) { console.error('createWorkspace:', e) }
    },

    // ── AI ──────────────────────────────────────────────────────
    toggleAIPanel: () => {
      const next = !get().aiPanelOpen
      set(s => { s.aiPanelOpen = next })
      TabIPC.setAIPanelWidth(next ? 340 : 0).catch(console.error)
    },
    setAIPanelTab:  (tab)  => set(s => { s.aiPanelTab = tab }),
    cacheAISummary: (tabId, summary) => set(s => { s.aiSummaries.set(tabId, summary) }),

    sendChatMessage: async (content) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'user', content, createdAt: Date.now(),
      }
      set(s => { s.chatMessages.push(userMsg); s.chatLoading = true })
      try {
        const { AIIPC } = await import('../lib/ipc')
        const response = await AIIPC.chat([...get().chatMessages], get().activeTabId ?? undefined)
        set(s => {
          s.chatMessages.push({
            id: crypto.randomUUID(), role: 'assistant', content: response, createdAt: Date.now(),
          })
        })
      } catch (e) {
        const msg = (e as any)?.message ?? String(e)
        set(s => {
          s.chatMessages.push({
            id: crypto.randomUUID(), role: 'assistant',
            content: `Error: ${msg}`, createdAt: Date.now(),
          })
        })
      } finally {
        set(s => { s.chatLoading = false })
      }
    },

    // ── Lens ────────────────────────────────────────────────────
    setActiveLens: (id) => {
      set(s => {
        s.activeLensId = id
        const lens = s.lenses.find(l => l.id === id)
        if (lens) s.aiPanelTab = lens.defaultAITab
      })
      // Persist lens choice
      SettingsIPC.set({ activeLensId: id }).catch(console.error)
    },

    // ── UI ──────────────────────────────────────────────────────
    openCommandPalette:  () => { TabIPC.modalOpen(); set(s => { s.commandPaletteOpen = true }) },
    closeCommandPalette: () => { TabIPC.modalClose(); set(s => { s.commandPaletteOpen = false }) },
    openSettings:        () => { TabIPC.modalOpen(); set(s => { s.settingsOpen = true }) },
    closeSettings:       () => { TabIPC.modalClose(); set(s => { s.settingsOpen = false }) },
    toggleCleave: () => {
      const next = !get().cleaveOpen
      if (next) TabIPC.modalOpen(); else TabIPC.modalClose()
      set(s => { s.cleaveOpen = next })
    },
    setUrlBarFocused: (v) => set(s => { s.urlBarFocused = v }),
    setUrlBarValue:   (v) => set(s => { s.urlBarValue = v }),

    // ── Bootstrap ───────────────────────────────────────────────
    init: async () => {
      if (typeof window.kitsune === 'undefined') {
        set(s => { s.initError = 'IPC bridge unavailable — preload script did not run' })
        return
      }
      try {
        const [settings, workspaces, tabs, layout, groups] = await Promise.all([
          SettingsIPC.get(),
          WorkspaceIPC.list(),
          TabIPC.list(),
          CleaveIPC.getLayout(),
          WorkspaceIPC.listGroups(),
        ])
        set(s => {
          s.settings         = settings
          s.activeLensId     = settings.activeLensId ?? LENS_IDS.DEFAULT
          s.workspaces       = workspaces
          s.tabs             = tabs
          s.groups           = groups
          s.activeTabId      = tabs.find(t => !t.hibernated)?.id ?? null
          s.layout           = layout
          s.activeWorkspaceId = workspaces[0]?.id ?? 'default'
        })
      } catch (e) {
        console.error('init failed:', e)
        set(s => { s.initError = String(e) })
        return
      }

      Push.onTabUpdate(tab => get().updateTabFromPush(tab))
      Push.onTabClose(id  => get().removeTabFromPush(id))
      Push.onTabActivate(id => set(s => {
        s.activeTabId = id
        const tab = s.tabs.find(t => t.id === id)
        if (tab && tab.url !== 'kitsune://newtab') s.urlBarValue = tab.url
        else s.urlBarValue = ''
      }))
      Push.onTabNavigate(({ id, url }) => set(s => {
        const tab = s.tabs.find(t => t.id === id)
        if (tab) tab.url = url
        if (s.activeTabId === id && url !== 'kitsune://newtab') s.urlBarValue = url
      }))
      Push.onTabNavState(({ id, canGoBack, canGoForward }) => set(s => {
        s.navState[id] = { canGoBack, canGoForward }
      }))
      Push.onLayoutUpdate(layout => set(s => { s.layout = layout }))
      Push.onGroupsUpdate(groups => get().setGroupsFromPush(groups))
    },
  }))
)

export const useActiveTab = () =>
  useBrowserStore(s => s.tabs.find(t => t.id === s.activeTabId))
export const useActiveLens = () =>
  useBrowserStore(s => s.lenses.find(l => l.id === s.activeLensId))
