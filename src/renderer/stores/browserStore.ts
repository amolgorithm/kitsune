// src/renderer/stores/browserStore.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  KitsuneTab, TabGroup, Workspace, KitsuneSettings,
  PaneNode, AISummary, ChatMessage, LensProfile, AIPanelTab, Bookmark,
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

let sidebarIpcTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSetSidebarWidth(w: number) {
  if (sidebarIpcTimer) clearTimeout(sidebarIpcTimer)
  sidebarIpcTimer = setTimeout(() => {
    TabIPC.setSidebarWidth(w).catch(console.error)
  }, 16)
}

interface BrowserState {
  tabs: KitsuneTab[]
  activeTabId: string | null
  groups: TabGroup[]
  workspaces: Workspace[]
  activeWorkspaceId: string
  settings: KitsuneSettings
  layout: PaneNode | null
  cleaveLayout: PaneNode | null
  lenses: LensProfile[]
  activeLensId: string
  initError: string | null
  navState: Record<string, NavState>
  bookmarks: Bookmark[]
  readingMode: boolean
  sidebarHidden: boolean
  sidebarWidth: number

  aiPanelOpen: boolean
  aiPanelTab: AIPanelTab
  // FIX: was Map<string, AISummary> which requires Immer MapSet plugin — use plain Record instead
  aiSummaries: Record<string, AISummary>
  chatMessages: ChatMessage[]
  chatLoading: boolean

  commandPaletteOpen: boolean
  settingsOpen: boolean
  cleaveOpen: boolean
  fileSearchOpen: boolean
  replOpen: boolean
  nineTailsOpen: boolean
  urlBarFocused: boolean
  urlBarValue: string

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

  setSidebarWidth: (w: number) => void

  addBookmark:    (tab: KitsuneTab) => void
  removeBookmark: (url: string) => void
  isBookmarked:   (url: string) => boolean

  createGroup:       (params: Partial<TabGroup> & { workspaceId: string }) => Promise<void>
  deleteGroup:       (id: string) => Promise<void>
  aiClusterTabs:     () => Promise<void>
  setGroupsFromPush: (groups: TabGroup[]) => void

  switchWorkspace: (id: string) => Promise<void>
  createWorkspace: (name: string, color: string) => Promise<void>

  toggleAIPanel:   () => void
  setAIPanelTab:   (tab: AIPanelTab) => void
  sendChatMessage: (content: string) => Promise<void>
  cacheAISummary:  (tabId: string, summary: AISummary) => void

  setActiveLens: (id: string) => void
  toggleReadingMode: () => void

  setCleaveLayout: (layout: PaneNode | null) => void

  openCommandPalette:  () => void
  closeCommandPalette: () => void
  openSettings:        () => void
  closeSettings:       () => void
  toggleCleave:        () => void
  toggleFileSearch:    () => void
  toggleREPL:          () => void
  openREPL:            () => void
  closeREPL:           () => void
  toggleNineTails:     () => void
  openNineTails:       () => void
  closeNineTails:      () => void
  setUrlBarFocused:    (v: boolean) => void
  setUrlBarValue:      (v: string) => void

  applySettingsToDOM: () => void
  updateSettings:     (patch: Partial<KitsuneSettings>) => Promise<void>

  init: () => Promise<void>
}

export const useBrowserStore = create<BrowserState>()(
  immer((set, get) => ({
    tabs: [], activeTabId: null, groups: [], workspaces: [],
    activeWorkspaceId: 'default', settings: DEFAULT_SETTINGS,
    layout: null, cleaveLayout: null, lenses: BUILT_IN_LENSES, activeLensId: LENS_IDS.DEFAULT,
    initError: null, navState: {}, bookmarks: [], readingMode: false,
    sidebarHidden: false, sidebarWidth: 240,

    aiPanelOpen: false, aiPanelTab: 'summary',
    // FIX: plain Record, not Map — Immer handles Records without the MapSet plugin
    aiSummaries: {},
    chatMessages: [], chatLoading: false,

    commandPaletteOpen: false, settingsOpen: false, cleaveOpen: false,
    fileSearchOpen: false, replOpen: false, nineTailsOpen: false,
    urlBarFocused: false, urlBarValue: '',

    // ── Sidebar resize ─────────────────────────────────────────
    setSidebarWidth: (w) => {
      document.documentElement.style.setProperty('--k-sidebar-w', `${w}px`)
      set(s => { s.sidebarWidth = w })
      debouncedSetSidebarWidth(w)
    },

    // ── Tab actions ─────────────────────────────────────────────
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
    hibernateTab: async (id) => { try { await TabIPC.hibernate(id) } catch (e) { console.error(e) } },
    wakeTab:      async (id) => { try { await TabIPC.wake(id) }      catch (e) { console.error(e) } },
    goBack:       async (id) => { try { await TabIPC.goBack(id) }    catch (e) { console.error(e) } },
    goForward:    async (id) => { try { await TabIPC.goForward(id) } catch (e) { console.error(e) } },
    reload:       async (id) => { try { await TabIPC.reload(id) }    catch (e) { console.error(e) } },

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

    // ── Bookmarks ───────────────────────────────────────────────
    addBookmark: (tab) => {
      set(s => {
        if (s.bookmarks.some(b => b.url === tab.url)) return
        s.bookmarks.push({
          id: crypto.randomUUID(),
          url: tab.url, title: tab.title, favicon: tab.favicon,
          tags: [], addedAt: Date.now(),
        })
      })
    },
    removeBookmark: (url) => {
      set(s => { s.bookmarks = s.bookmarks.filter(b => b.url !== url) })
    },
    isBookmarked: (url) => get().bookmarks.some(b => b.url === url),

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

    setCleaveLayout: (layout) => {
      set(s => { s.cleaveLayout = layout && layout.type === 'split' ? layout : null })
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
    // FIX: Record assignment, not Map.set()
    cacheAISummary: (tabId, summary) => set(s => { s.aiSummaries[tabId] = summary }),

    sendChatMessage: async (content) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'user', content, createdAt: Date.now(),
      }
      set(s => { s.chatMessages.push(userMsg); s.chatLoading = true })
      try {
        const { AIIPC } = await import('../lib/ipc')
        const response = await AIIPC.chat([...get().chatMessages], get().activeTabId ?? undefined)
        set(s => {
          s.chatMessages.push({ id: crypto.randomUUID(), role: 'assistant', content: response, createdAt: Date.now() })
        })
      } catch (e) {
        set(s => {
          s.chatMessages.push({ id: crypto.randomUUID(), role: 'assistant',
            content: `Error: ${(e as any)?.message ?? String(e)}`, createdAt: Date.now() })
        })
      } finally { set(s => { s.chatLoading = false }) }
    },

    // ── Lens ────────────────────────────────────────────────────
    setActiveLens: (id) => {
      set(s => {
        s.activeLensId = id
        const lens = s.lenses.find(l => l.id === id)
        if (lens) s.aiPanelTab = lens.defaultAITab
      })
      SettingsIPC.set({ activeLensId: id }).catch(console.error)
    },

    toggleReadingMode: () => set(s => { s.readingMode = !s.readingMode }),

    // ── UI modals ────────────────────────────────────────────────
    openCommandPalette:  () => { TabIPC.modalOpen(); set(s => { s.commandPaletteOpen = true }) },
    closeCommandPalette: () => { TabIPC.modalClose(); set(s => { s.commandPaletteOpen = false }) },
    openSettings:        () => { TabIPC.modalOpen(); set(s => { s.settingsOpen = true }) },
    closeSettings:       () => { TabIPC.modalClose(); set(s => { s.settingsOpen = false }) },
    toggleCleave: () => {
      const next = !get().cleaveOpen
      if (next) TabIPC.modalOpen(); else TabIPC.modalClose()
      set(s => { s.cleaveOpen = next })
    },
    toggleFileSearch: () => {
      const next = !get().fileSearchOpen
      if (next) TabIPC.modalOpen(); else TabIPC.modalClose()
      set(s => { s.fileSearchOpen = next })
    },

    // ── REPL — inline, never hides BrowserView ────────────────
    toggleREPL: () => set(s => { s.replOpen = !s.replOpen }),
    openREPL:   () => set(s => { s.replOpen = true }),
    closeREPL:  () => set(s => { s.replOpen = false }),

    // ── Nine Tails ────────────────────────────────────────────
    toggleNineTails: () => {
      const next = !get().nineTailsOpen
      if (next) TabIPC.modalOpen(); else TabIPC.modalClose()
      set(s => { s.nineTailsOpen = next })
    },
    openNineTails:  () => { TabIPC.modalOpen();  set(s => { s.nineTailsOpen = true  }) },
    closeNineTails: () => { TabIPC.modalClose(); set(s => { s.nineTailsOpen = false }) },

    setUrlBarFocused: (v) => set(s => { s.urlBarFocused = v }),
    setUrlBarValue:   (v) => set(s => { s.urlBarValue = v }),

    // ── Settings side effects ────────────────────────────────────
    applySettingsToDOM: () => {
      const s = get().settings
      const root = document.documentElement

      if (s.sidebarPosition === 'right') root.classList.add('sidebar-right')
      else root.classList.remove('sidebar-right')

      import('../lib/appearance').then(({ applyAppearance }) => {
        applyAppearance(s.appearance ?? {
          themeBase: (s.theme as any) ?? 'dark', accentPreset: 'fox', accentCustom: '#ff6b35',
          backgroundStyle: 'plain', backgroundGradientFrom: '#0d0f12',
          backgroundGradientTo: '#1a1e27', textureStyle: 'smooth',
          animationStyle: 'none', animationIntensity: 50,
          sidebarBlur: false, borderRadius: 'rounded',
          fontScale: 1, sidebarWidth: 240, tabHeight: 36,
        })
      })
    },

    updateSettings: async (patch) => {
      try {
        const updated = await SettingsIPC.set(patch)
        set(s => { s.settings = updated })
      } catch (e) { console.error('updateSettings:', e) }
    },

    // ── Bootstrap ───────────────────────────────────────────────
    init: async () => {
      if (typeof window.kitsune === 'undefined') {
        set(s => { s.initError = 'IPC bridge unavailable — preload script did not run' })
        return
      }
      try {
        const [settings, workspaces, tabs, layout, groups, persistedSidebarW] = await Promise.all([
          SettingsIPC.get(),
          WorkspaceIPC.list(),
          TabIPC.list(),
          CleaveIPC.getLayout(),
          WorkspaceIPC.listGroups(),
          TabIPC.getSidebarWidth(),
        ])

        const sw = persistedSidebarW ?? 240
        document.documentElement.style.setProperty('--k-sidebar-w', `${sw}px`)

        set(s => {
          s.settings         = settings
          s.activeLensId     = settings.activeLensId ?? LENS_IDS.DEFAULT
          s.workspaces       = workspaces
          s.tabs             = tabs
          s.groups           = groups
          s.activeTabId      = tabs.find(t => !t.hibernated)?.id ?? null
          s.layout           = layout
          s.activeWorkspaceId = workspaces[0]?.id ?? 'default'
          s.sidebarWidth     = sw
        })
        get().applySettingsToDOM()
      } catch (e) {
        console.error('init failed:', e)
        set(s => { s.initError = String(e) })
        return
      }

      // ── Push subscriptions ─────────────────────────────────────
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
      Push.onLayoutUpdate(layout => set(s => {
        s.layout = layout
        s.cleaveLayout = layout?.type === 'split' ? layout : null
      }))
      Push.onGroupsUpdate(groups => get().setGroupsFromPush(groups))

      Push.onSidebarWidthUpdate(w => {
        document.documentElement.style.setProperty('--k-sidebar-w', `${w}px`)
        set(s => { s.sidebarWidth = w })
      })

      Push.onNineTailsFocusWindow(({ active }) => {
        console.log('[NineTails] focus window', active ? 'started' : 'ended')
      })

      Push.onNineTailsNotification(({ title, body, url }) => {
        console.log('[NineTails notification]', title, body, url)
      })

      // ── Highlight capture from SelectionCapture.ts ─────────────
      // When user right-clicks / uses floating toolbar → Save to Kitsune Notes,
      // SelectionCapture sends 'ninetails:mirror-highlight'.
      // We open the AI panel to Notes tab and fire a DOM event that NotesTab listens for.
      window.kitsune.on('ninetails:mirror-highlight' as any, (d: any) => {
        if (!d?.text?.trim() || d.text.trim().length < 5) return
        const store = get()
        // Open panel and switch to notes tab
        if (!store.aiPanelOpen) {
          store.toggleAIPanel()
        }
        store.setAIPanelTab('notes')
        // Fire custom DOM event after a short delay (panel needs to mount)
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('kitsune:highlight', { detail: { text: d.text.trim() } })
          )
        }, 120)
      })

      // ── Inject-chat from context menu "Summarize with AI" ───────
      window.kitsune.on('kitsune:inject-chat' as any, (...args: unknown[]) => {
        const { message } = args[0] as { message: string }
        get().sendChatMessage(message)
      })

      window.kitsune.on('settings:update' as any, (updated: unknown) => {
        set(s => { s.settings = updated as KitsuneSettings })
        get().applySettingsToDOM()
      })

      window.kitsune.on('command:ui' as any, (action: any) => {
        const store = get()
        switch (action.action) {
          case 'ai.panel.toggle':  store.toggleAIPanel(); break
          case 'ai.panel.open':
            set(s => { s.aiPanelOpen = true })
            TabIPC.setAIPanelWidth(340).catch(console.error)
            break
          case 'ai.panel.close':
            set(s => { s.aiPanelOpen = false })
            TabIPC.setAIPanelWidth(0).catch(console.error)
            break
          case 'ai.panel.tab':    set(s => { s.aiPanelTab = action.tab }); break
          case 'lens.set':        set(s => { s.activeLensId = action.id }); break
          case 'ui.commandPalette': store.openCommandPalette(); break
          case 'ui.settings':       store.openSettings(); break
          case 'ui.fileSearch':     store.toggleFileSearch(); break
          case 'ui.cleave':         store.toggleCleave(); break
          case 'ui.sidebar.toggle': set(s => { s.sidebarHidden = !s.sidebarHidden }); break
          case 'ui.readingMode':    store.toggleReadingMode(); break
          case 'ui.focusUrlBar':    set(s => { s.urlBarFocused = true }); break
          case 'workspace.switched': set(s => { s.activeWorkspaceId = action.id }); break
        }
      })

      // Always ensure the BrowserView is visible on boot
      TabIPC.modalClose().catch(console.error)
    },
  }))
)

export const useActiveTab = () =>
  useBrowserStore(s => s.tabs.find(t => t.id === s.activeTabId))
export const useActiveLens = () =>
  useBrowserStore(s => s.lenses.find(l => l.id === s.activeLensId))