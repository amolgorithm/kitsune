// src/main/services/TabManager.ts
import { BrowserView, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type { KitsuneTab } from '../../shared/types'
import type { WorkspaceManager } from './WorkspaceManager'
import type { SettingsStore } from './SettingsStore'
import type { NineTailsEngine } from './NineTailsEngine'

interface CreateTabOptions {
  url: string
  workspaceId?: string
  groupId?: string
  background?: boolean
  isPrivate?: boolean
}

interface PaneRegion {
  paneId: string
  tabId?: string
  isAIPane?: boolean
}

// Chrome heights — must match the CSS tokens exactly
const TITLEBAR_H = 32   // --k-titlebar-h
const NAVBAR_H   = 48   // --k-navbar-h
const LENSBAR_H  = 36   // --k-lensbar-h
const CHROME_TOP = TITLEBAR_H + NAVBAR_H + LENSBAR_H   // 116px total top chrome

const STATUSBAR_H  = 24   // --k-statusbar-h
const HOTKEYBAR_H  = 28   // --k-hotkeybar-h
const BOTTOM_H     = STATUSBAR_H + HOTKEYBAR_H          // 52px total bottom chrome

// Each split pane has a 28px title bar rendered by ContentArea
const PANE_TITLEBAR_H = 28

let   SIDEBAR_W     = 240
const MIN_SIDEBAR_W = 52

export class TabManager {
  public  views         = new Map<string, BrowserView>()
  private tabs          = new Map<string, KitsuneTab>()
  private activeTabId:  string | null = null
  private aiPanelWidth  = 0
  private replHeight    = 0
  private viewHidden    = false
  private currentPanes: PaneRegion[] = []
  private nineTails: NineTailsEngine | null = null

  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly settings: SettingsStore,
    private readonly window: BrowserWindow,
  ) {
    const persistedW = settings.getRaw('sidebarWidth') as number | null
    if (persistedW && persistedW >= MIN_SIDEBAR_W) SIDEBAR_W = persistedW

    window.on('resize',     () => this.repositionAll())
    window.on('maximize',   () => this.repositionAll())
    window.on('unmaximize', () => this.repositionAll())
  }

  setNineTailsEngine(engine: NineTailsEngine): void {
    this.nineTails = engine
  }

  // ─── Sidebar width ──────────────────────────────────────────────

  setSidebarWidth(w: number): void {
    SIDEBAR_W = Math.max(MIN_SIDEBAR_W, Math.min(400, w))
    this.settings.setRaw('sidebarWidth', SIDEBAR_W)
    this.repositionAll()
  }

  getSidebarWidth(): number { return SIDEBAR_W }

  // ─── REPL height ────────────────────────────────────────────────

  setReplHeight(h: number): void {
    this.replHeight = Math.max(0, h)
    this.repositionAll()
  }

  // ─── Tab lifecycle ──────────────────────────────────────────────

  async createTab(opts: CreateTabOptions): Promise<KitsuneTab> {
    const id        = randomUUID()
    let workspaceId = opts.workspaceId ?? this.workspaceManager.activeId
    const now       = Date.now()

    let lensId: string | undefined
    if (this.nineTails && opts.url !== 'kitsune://newtab') {
      const routing = this.nineTails.routeTab(id, opts.url)
      if (routing?.workspaceId) workspaceId = routing.workspaceId
      if (routing?.lensId)      lensId = routing.lensId
    }

    const tab: KitsuneTab = {
      id, url: opts.url,
      title:  opts.url === 'kitsune://newtab' ? 'New Tab' : 'Loading…',
      status: opts.url === 'kitsune://newtab' ? 'ready'  : 'loading',
      workspaceId, groupId: opts.groupId,
      createdAt: now, lastAccessedAt: now,
      memoryBytes: 0, hibernated: false, isPinned: false,
      isPrivate: opts.isPrivate ?? false,
    }

    this.tabs.set(id, tab)

    if (opts.url !== 'kitsune://newtab') {
      const view = this.createView(tab)
      this.views.set(id, view)
      this.wireViewEvents(id, view)
      view.webContents.loadURL(opts.url)
    }

    if (lensId) {
      this.window.webContents.send('command:ui', { action: 'lens.set', id: lensId })
    }

    if (!opts.background) await this.activateTab(id)
    this.pushTabUpdate(tab)
    return tab
  }

  async activateTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return
    if (tab.hibernated) await this.wakeTab(id)

    if (this.currentPanes.length === 0 && this.activeTabId && this.activeTabId !== id) {
      const prev = this.views.get(this.activeTabId)
      if (prev) this.window.removeBrowserView(prev)
    }

    this.activeTabId   = id
    tab.lastAccessedAt = Date.now()

    if (this.currentPanes.length > 0) {
      this.repositionAll()
    } else {
      const view = this.views.get(id)
      if (view && !this.viewHidden) {
        this.window.addBrowserView(view)
        this.repositionView(view, this.singlePaneBounds())
      }
    }

    this.pushTabUpdate(tab)
    this.window.webContents.send('tab:activate', id)
  }

  async closeTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return

    const view = this.views.get(id)
    if (view) {
      this.window.removeBrowserView(view)
      ;(view.webContents as any).destroy()
      this.views.delete(id)
    }

    this.tabs.delete(id)
    this.window.webContents.send('tab:close', id)

    if (this.activeTabId === id) {
      this.activeTabId = null
      const remaining = [...this.tabs.keys()]
      if (remaining.length > 0) await this.activateTab(remaining[remaining.length - 1]!)
      else await this.createTab({ url: 'kitsune://newtab' })
    }
  }

  async navigateTab(id: string, url: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return

    tab.url    = url
    tab.status = 'loading'
    tab.title  = 'Loading…'

    if (!this.views.has(id)) {
      const view = this.createView(tab)
      this.views.set(id, view)
      this.wireViewEvents(id, view)
      if (id === this.activeTabId && !this.viewHidden) {
        if (this.currentPanes.length > 0) this.repositionAll()
        else {
          this.window.addBrowserView(view)
          this.repositionView(view, this.singlePaneBounds())
        }
      }
    }

    if (tab.hibernated) await this.wakeTab(id)
    this.pushTabUpdate(tab)
    this.views.get(id)!.webContents.loadURL(url)
  }

  async hibernateTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab || tab.hibernated || id === this.activeTabId) return

    const view = this.views.get(id)
    if (!view) return

    try {
      const mem = await view.webContents
        .executeJavaScript('process.getProcessMemoryInfo ? process.getProcessMemoryInfo() : {privateBytes:0}')
        .catch(() => ({ privateBytes: 0 })) as any
      tab.memoryBytes = (mem.privateBytes ?? 0) * 1024
    } catch { /* already destroyed */ }

    this.window.removeBrowserView(view)
    ;(view.webContents as any).destroy()
    this.views.delete(id)

    tab.hibernated = true
    tab.status     = 'hibernated'
    this.pushTabUpdate(tab)
  }

  async wakeTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab || !tab.hibernated) return

    const view = this.createView(tab)
    this.views.set(id, view)
    this.wireViewEvents(id, view)
    view.webContents.loadURL(tab.url)

    tab.hibernated     = false
    tab.status         = 'loading'
    tab.lastAccessedAt = Date.now()
    this.pushTabUpdate(tab)
  }

  async evalInTab(id: string, code: string): Promise<unknown> {
    const view = this.views.get(id)
    if (!view) return null
    try { return await view.webContents.executeJavaScript(code) }
    catch (e) { throw e }
  }

  goBack(id: string):    void { const v = this.views.get(id); if (v?.webContents.canGoBack())    v.webContents.goBack() }
  goForward(id: string): void { const v = this.views.get(id); if (v?.webContents.canGoForward()) v.webContents.goForward() }
  reload(id: string):    void { this.views.get(id)?.webContents.reload() }

  hideActiveView(): void {
    this.viewHidden = true
    for (const view of this.views.values()) {
      try { this.window.removeBrowserView(view) } catch { /* ignore */ }
    }
  }

  showActiveView(): void {
    this.viewHidden = false
    this.repositionAll()
  }

  setAIPanelWidth(w: number): void {
    this.aiPanelWidth = w
    this.repositionAll()
  }

  /**
   * Apply a multi-pane layout.
   * Each non-AI leaf pane gets a BrowserView positioned in its rectangle.
   * The pane title bars (28px) are rendered by React so we must offset Y by that amount.
   */
  applyLayout(panes: PaneRegion[]): void {
    if (this.viewHidden) return

    // Remove all current BrowserViews before repositioning
    for (const view of this.views.values()) {
      try { this.window.removeBrowserView(view) } catch { /* ignore */ }
    }

    this.currentPanes = panes

    // Single pane — just show active tab normally
    if (panes.length <= 1) {
      this.currentPanes = []
      const view = this.activeTabId ? this.views.get(this.activeTabId) : null
      if (view) {
        this.window.addBrowserView(view)
        this.repositionView(view, this.singlePaneBounds())
      }
      return
    }

    const [winW, winH] = this.window.getContentSize()
    const contentLeft = SIDEBAR_W
    const contentTop  = CHROME_TOP
    const contentW    = winW - SIDEBAR_W - this.aiPanelWidth
    const contentH    = winH - CHROME_TOP - Math.max(BOTTOM_H, this.replHeight)

    // Filter to only real (non-AI) panes
    const realPanes = panes.filter(p => !p.isAIPane)
    const paneCount = realPanes.length

    if (paneCount === 0) return

    // Determine split direction from the layout context
    // We'll detect based on how many panes we have and position them accordingly
    // For now: horizontal split (side by side) by default
    // The actual direction comes from the layout tree stored in currentPanes
    // Since we only get leaf panes here, we use a simple even horizontal split
    const paneW = Math.floor(contentW / paneCount)

    realPanes.forEach((pane, i) => {
      const tabId = pane.tabId ?? this.activeTabId
      if (!tabId) return

      const tab = this.tabs.get(tabId)
      if (tab?.hibernated) {
        this.wakeTab(tabId).then(() => {
          const view = this.views.get(tabId)
          if (view) {
            this.window.addBrowserView(view)
            this.repositionView(view, {
              x:      contentLeft + i * paneW,
              // Add PANE_TITLEBAR_H offset — React renders a title bar above each pane
              y:      contentTop + PANE_TITLEBAR_H,
              width:  paneW,
              height: contentH - PANE_TITLEBAR_H,
            })
          }
        })
        return
      }

      const view = this.views.get(tabId)
      if (!view) return

      this.window.addBrowserView(view)
      this.repositionView(view, {
        x:      contentLeft + i * paneW,
        y:      contentTop + PANE_TITLEBAR_H,
        width:  paneW,
        height: contentH - PANE_TITLEBAR_H,
      })
    })
  }

  /**
   * Apply a layout from a full PaneNode tree, correctly handling
   * horizontal vs vertical splits and recursive nesting.
   */
  applyLayoutFromTree(node: any, bounds: { x: number; y: number; width: number; height: number }): void {
    if (this.viewHidden) return

    if (node.type === 'leaf') {
      if (node.isAIPane) return

      const tabId = node.tabId ?? this.activeTabId
      if (!tabId) return

      const view = this.views.get(tabId)
      if (!view) return

      // The pane has a 28px title bar rendered in React, offset BrowserView below it
      const adjusted = {
        x:      bounds.x,
        y:      bounds.y + PANE_TITLEBAR_H,
        width:  bounds.width,
        height: Math.max(0, bounds.height - PANE_TITLEBAR_H),
      }

      this.window.addBrowserView(view)
      this.repositionView(view, adjusted)
      return
    }

    // Split node — recurse into children
    const children = node.children ?? []
    const sizes = node.sizes ?? children.map(() => 100 / children.length)
    const total = sizes.reduce((a: number, b: number) => a + b, 0)
    const isH   = node.direction === 'horizontal'

    let offset = 0
    children.forEach((child: any, i: number) => {
      const ratio  = (sizes[i] ?? 1) / total
      const childW = isH ? Math.floor(bounds.width * ratio) : bounds.width
      const childH = isH ? bounds.height                    : Math.floor(bounds.height * ratio)
      const childX = isH ? bounds.x + offset : bounds.x
      const childY = isH ? bounds.y          : bounds.y + offset

      this.applyLayoutFromTree(child, { x: childX, y: childY, width: childW, height: childH })
      offset += isH ? childW : childH
    })
  }

  updateTabMeta(id: string, patch: Partial<KitsuneTab>): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    Object.assign(tab, patch)
    this.pushTabUpdate(tab)
  }

  listTabs(workspaceId?: string): KitsuneTab[] {
    const all = [...this.tabs.values()]
    return workspaceId ? all.filter(t => t.workspaceId === workspaceId) : all
  }

  getTab(id: string):   KitsuneTab | undefined { return this.tabs.get(id) }
  getActiveTabId():     string | null           { return this.activeTabId }

  async getPageText(id: string, maxChars = 8000): Promise<string> {
    const view = this.views.get(id)
    if (!view) return ''
    try {
      return await view.webContents.executeJavaScript(
        `document.body?.innerText?.slice(0, ${maxChars}) ?? ''`
      )
    } catch { return '' }
  }

  repositionActiveView(): void { this.repositionAll() }

  private repositionAll(): void {
    if (this.viewHidden) return
    if (this.currentPanes.length > 0) {
      this.applyLayout(this.currentPanes)
    } else if (this.activeTabId) {
      const view = this.views.get(this.activeTabId)
      if (view) {
        this.window.addBrowserView(view)
        this.repositionView(view, this.singlePaneBounds())
      }
    }
  }

  private singlePaneBounds() {
    const [w, h] = this.window.getContentSize()
    const bottomReserved = Math.max(BOTTOM_H, this.replHeight)
    return {
      x:      SIDEBAR_W,
      y:      CHROME_TOP,
      width:  Math.max(0, w - SIDEBAR_W - this.aiPanelWidth),
      height: Math.max(0, h - CHROME_TOP - bottomReserved),
    }
  }

  private repositionView(
    view: BrowserView,
    bounds: { x: number; y: number; width: number; height: number },
  ): void {
    view.setBounds({
      x:      Math.round(bounds.x),
      y:      Math.round(bounds.y),
      width:  Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height)),
    })
    view.setAutoResize({ width: true, height: true, horizontal: false, vertical: false })
  }

  private createView(tab: KitsuneTab): BrowserView {
    return new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        partition: tab.isPrivate ? `private-${tab.id}` : 'persist:kitsune',
      },
    })
  }

  private wireViewEvents(id: string, view: BrowserView): void {
    const wc = view.webContents

    wc.on('page-title-updated',   (_e, title)    => this.updateTabMeta(id, { title }))
    wc.on('page-favicon-updated', (_e, favicons) => {
      if (favicons[0]) this.updateTabMeta(id, { favicon: favicons[0] })
    })
    wc.on('did-start-loading', () => this.updateTabMeta(id, { status: 'loading' }))
    wc.on('did-finish-load',   () => {
      const url   = wc.getURL()
      const title = wc.getTitle() || url
      this.updateTabMeta(id, { status: 'ready', url, title, lastAccessedAt: Date.now() })

      if (id === this.activeTabId && this.viewHidden) {
        this.viewHidden = false
        this.repositionAll()
      }

      if (this.nineTails && url && !url.startsWith('kitsune://')) {
        setTimeout(async () => {
          try {
            const pageText = await this.getPageText(id, 8000)
            await this.nineTails!.indexPage(id, url, title, pageText)
          } catch { /* tab may have navigated away */ }
        }, 1500)
      }
    })
    wc.on('did-fail-load', (_e, _c, desc) => this.updateTabMeta(id, { status: 'error', title: desc }))
    wc.on('did-navigate', (_e, url) => {
      this.updateTabMeta(id, { url })
      this.window.webContents.send('tab:navigate', { id, url })
      this.window.webContents.send('tab:nav-state', {
        id, canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward(),
      })
      if (this.nineTails) {
        this.nineTails.fireRelay('url_visit', { tabId: id, url }).catch(() => {})
      }
    })
    wc.on('did-navigate-in-page', (_e, url) => {
      this.updateTabMeta(id, { url })
      this.window.webContents.send('tab:navigate', { id, url })
      this.window.webContents.send('tab:nav-state', {
        id, canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward(),
      })
    })
  }

  private pushTabUpdate(tab: KitsuneTab): void {
    this.window.webContents.send('tab:update', tab)
  }
}