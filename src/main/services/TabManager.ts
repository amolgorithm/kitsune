// src/main/services/TabManager.ts
import { BrowserView, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type { KitsuneTab } from '../../shared/types'
import type { WorkspaceManager } from './WorkspaceManager'
import type { SettingsStore } from './SettingsStore'

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

const CHROME_TOP = 32 + 48 + 36   // titlebar(32) + navbar(48) + lensbar(36)
const SIDEBAR_W  = 240
const BOTTOM_H   = 24 + 28         // statusbar(24) + hotkeybar(28)

export class TabManager {
  public views       = new Map<string, BrowserView>()
  private tabs        = new Map<string, KitsuneTab>()
  private activeTabId: string | null = null
  private aiPanelWidth = 0
  private viewHidden   = false
  private currentPanes: PaneRegion[] = []  // null = single pane mode

  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly settings: SettingsStore,
    private readonly window: BrowserWindow,
  ) {
    window.on('resize',     () => this.repositionAll())
    window.on('maximize',   () => this.repositionAll())
    window.on('unmaximize', () => this.repositionAll())
  }

  // ─── Tab lifecycle ──────────────────────────────────────────────

  async createTab(opts: CreateTabOptions): Promise<KitsuneTab> {
    const id          = randomUUID()
    const workspaceId = opts.workspaceId ?? this.workspaceManager.activeId
    const now         = Date.now()

    const tab: KitsuneTab = {
      id, url: opts.url,
      title: opts.url === 'kitsune://newtab' ? 'New Tab' : 'Loading…',
      status: opts.url === 'kitsune://newtab' ? 'ready' : 'loading',
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

    if (!opts.background) await this.activateTab(id)
    this.pushTabUpdate(tab)
    return tab
  }

  async activateTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return
    if (tab.hibernated) await this.wakeTab(id)

    // Remove previous active BrowserView (unless in split pane mode)
    if (this.currentPanes.length === 0 && this.activeTabId && this.activeTabId !== id) {
      const prev = this.views.get(this.activeTabId)
      if (prev) this.window.removeBrowserView(prev)
    }

    this.activeTabId   = id
    tab.lastAccessedAt = Date.now()

    if (this.currentPanes.length > 0) {
      // In split mode — reapply layout with updated active tab
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
      if (remaining.length > 0) await this.activateTab(remaining[remaining.length - 1])
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
        if (this.currentPanes.length > 0) {
          this.repositionAll()
        } else {
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
      const mem = await view.webContents.executeJavaScript('process.getProcessMemoryInfo ? process.getProcessMemoryInfo() : {privateBytes:0}').catch(() => ({ privateBytes: 0 })) as any
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
    try {
      return await view.webContents.executeJavaScript(code)
    } catch (e) { throw e }
  }

  // ─── Navigation ────────────────────────────────────────────────

  goBack(id: string):    void { const v = this.views.get(id); if (v?.webContents.canGoBack())    v.webContents.goBack() }
  goForward(id: string): void { const v = this.views.get(id); if (v?.webContents.canGoForward()) v.webContents.goForward() }
  reload(id: string):    void { this.views.get(id)?.webContents.reload() }

  // ─── Modal overlay ──────────────────────────────────────────────

  hideActiveView(): void {
    this.viewHidden = true
    // Remove all visible BrowserViews
    for (const view of this.views.values()) {
      try { this.window.removeBrowserView(view) } catch { /* ignore */ }
    }
  }

  showActiveView(): void {
    this.viewHidden = false
    this.repositionAll()
  }

  // ─── AI panel width ─────────────────────────────────────────────

  setAIPanelWidth(w: number): void {
    this.aiPanelWidth = w
    this.repositionAll()
  }

  // ─── Cleave split layout ────────────────────────────────────────

  applyLayout(panes: PaneRegion[]): void {
    if (this.viewHidden) return

    // Reset all views from window
    for (const view of this.views.values()) {
      try { this.window.removeBrowserView(view) } catch { /* ignore */ }
    }

    this.currentPanes = panes

    if (panes.length <= 1) {
      // Single pane — use active tab
      this.currentPanes = []
      const view = this.activeTabId ? this.views.get(this.activeTabId) : null
      if (view) {
        this.window.addBrowserView(view)
        this.repositionView(view, this.singlePaneBounds())
      }
      return
    }

    // Multi-pane — calculate bounds for each pane
    const [w, h] = this.window.getContentSize()
    const contentW = w - SIDEBAR_W - this.aiPanelWidth
    const contentH = h - CHROME_TOP - BOTTOM_H

    const paneCount   = panes.filter(p => !p.isAIPane).length
    const paneWidth   = Math.floor(contentW / paneCount)

    panes.forEach((pane, i) => {
      if (pane.isAIPane) return  // AI pane is React, not BrowserView

      const tabId = pane.tabId ?? this.activeTabId
      if (!tabId) return

      // Wake the tab if hibernated
      const tab = this.tabs.get(tabId)
      if (tab?.hibernated) {
        this.wakeTab(tabId).then(() => {
          const view = this.views.get(tabId)
          if (view) {
            this.window.addBrowserView(view)
            this.repositionView(view, {
              x: SIDEBAR_W + i * paneWidth,
              y: CHROME_TOP,
              width: paneWidth,
              height: contentH,
            })
          }
        })
        return
      }

      const view = this.views.get(tabId)
      if (!view) return

      this.window.addBrowserView(view)
      this.repositionView(view, {
        x: SIDEBAR_W + i * paneWidth,
        y: CHROME_TOP,
        width: paneWidth,
        height: contentH,
      })
    })
  }

  // ─── Accessors ──────────────────────────────────────────────────

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

  getTab(id: string):         KitsuneTab | undefined { return this.tabs.get(id) }
  getActiveTabId():           string | null           { return this.activeTabId }

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

  // ─── Private ───────────────────────────────────────────────────

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
    return {
      x:      SIDEBAR_W,
      y:      CHROME_TOP,
      width:  Math.max(0, w - SIDEBAR_W - this.aiPanelWidth),
      height: Math.max(0, h - CHROME_TOP - BOTTOM_H),
    }
  }

  private repositionView(view: BrowserView, bounds: { x: number; y: number; width: number; height: number }): void {
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
    wc.on('did-start-loading',    ()             => this.updateTabMeta(id, { status: 'loading' }))
    wc.on('did-finish-load',      ()             => {
      this.updateTabMeta(id, {
        status: 'ready', url: wc.getURL(),
        title: wc.getTitle() || wc.getURL(), lastAccessedAt: Date.now(),
      })
    })
    wc.on('did-fail-load', (_e, _c, desc)  => this.updateTabMeta(id, { status: 'error', title: desc }))
    wc.on('did-navigate',          (_e, url) => {
      this.updateTabMeta(id, { url })
      this.window.webContents.send('tab:navigate', { id, url })
      this.window.webContents.send('tab:nav-state', {
        id, canGoBack: wc.canGoBack(), canGoForward: wc.canGoForward(),
      })
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
