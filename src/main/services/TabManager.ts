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

// Heights of the chrome UI rows — must match CSS tokens exactly
// titlebar(32) + navbar(48) + lensbar(36) = 116
// On Windows we also draw the titlebar in renderer so same height applies
const CHROME_TOP    = 116
const SIDEBAR_W     = 240
const STATUSBAR_H   = 24
const HOTKEYBAR_H   = 28

export class TabManager {
  private views     = new Map<string, BrowserView>()
  private tabs      = new Map<string, KitsuneTab>()
  private activeTabId: string | null = null
  private aiPanelWidth = 0  // updated by IPC when AI panel opens/closes

  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly settings: SettingsStore,
    private readonly window: BrowserWindow,
  ) {
    window.on('resize', () => this.repositionActiveView())
  }

  // ─── Public API ────────────────────────────────────────────────

  async createTab(opts: CreateTabOptions): Promise<KitsuneTab> {
    const id = randomUUID()
    const workspaceId = opts.workspaceId ?? this.workspaceManager.activeId
    const now = Date.now()

    const tab: KitsuneTab = {
      id,
      url: opts.url,
      title: 'New Tab',
      status: opts.url === 'kitsune://newtab' ? 'ready' : 'loading',
      workspaceId,
      groupId: opts.groupId,
      createdAt: now,
      lastAccessedAt: now,
      memoryBytes: 0,
      hibernated: false,
      isPinned: false,
      isPrivate: opts.isPrivate ?? false,
    }

    this.tabs.set(id, tab)

    // kitsune://newtab is handled entirely by React — no BrowserView needed
    if (opts.url !== 'kitsune://newtab') {
      const view = this.createView(tab)
      this.views.set(id, view)
      this.wireViewEvents(id, view)
      view.webContents.loadURL(opts.url)
    }

    if (!opts.background) {
      await this.activateTab(id)
    }

    this.pushTabUpdate(tab)
    return tab
  }

  async activateTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return

    if (tab.hibernated) await this.wakeTab(id)

    // Remove previously active view from window
    if (this.activeTabId && this.activeTabId !== id) {
      const prev = this.views.get(this.activeTabId)
      if (prev) this.window.removeBrowserView(prev)
    }

    this.activeTabId = id
    tab.lastAccessedAt = Date.now()

    const view = this.views.get(id)
    if (view) {
      this.window.addBrowserView(view)
      this.repositionView(view)
    } else {
      // This is a newtab — remove any previously shown view
      const prev = this.activeTabId ? this.views.get(this.activeTabId) : null
      if (prev) this.window.removeBrowserView(prev)
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
      // destroy() is the correct way to free the webContents
      ;(view.webContents as any).destroy()
      this.views.delete(id)
    }

    this.tabs.delete(id)

    if (this.activeTabId === id) {
      this.activeTabId = null
      const remaining = [...this.tabs.keys()]
      if (remaining.length > 0) {
        await this.activateTab(remaining[remaining.length - 1])
      }
    }

    this.window.webContents.send('tab:close', id)
  }

  async navigateTab(id: string, url: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return

    tab.url = url
    tab.status = 'loading'

    // If previously a newtab with no BrowserView, create one now
    if (!this.views.has(id)) {
      const view = this.createView(tab)
      this.views.set(id, view)
      this.wireViewEvents(id, view)
      if (id === this.activeTabId) {
        this.window.addBrowserView(view)
        this.repositionView(view)
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
      const memInfo = await view.webContents.getProcessMemoryInfo()
      tab.memoryBytes = (memInfo.privateBytes ?? 0) * 1024
    } catch { /* view may already be destroyed */ }

    this.window.removeBrowserView(view)
    ;(view.webContents as any).destroy()
    this.views.delete(id)

    tab.hibernated = true
    tab.status = 'hibernated'
    this.pushTabUpdate(tab)
  }

  async wakeTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab || !tab.hibernated) return

    const view = this.createView(tab)
    this.views.set(id, view)
    this.wireViewEvents(id, view)
    view.webContents.loadURL(tab.url)

    tab.hibernated = false
    tab.status = 'loading'
    tab.lastAccessedAt = Date.now()
    this.pushTabUpdate(tab)
  }

  updateTabMeta(id: string, patch: Partial<KitsuneTab>): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    Object.assign(tab, patch)
    this.pushTabUpdate(tab)
  }

  setAIPanelWidth(w: number): void {
    this.aiPanelWidth = w
    this.repositionActiveView()
  }

  listTabs(workspaceId?: string): KitsuneTab[] {
    const all = [...this.tabs.values()]
    return workspaceId ? all.filter(t => t.workspaceId === workspaceId) : all
  }

  getTab(id: string): KitsuneTab | undefined { return this.tabs.get(id) }
  getActiveTabId(): string | null { return this.activeTabId }

  async getPageText(id: string, maxChars = 8000): Promise<string> {
    const view = this.views.get(id)
    if (!view) return ''
    try {
      return await view.webContents.executeJavaScript(
        `document.body?.innerText?.slice(0, ${maxChars}) ?? ''`
      )
    } catch { return '' }
  }

  repositionActiveView(): void {
    if (!this.activeTabId) return
    const view = this.views.get(this.activeTabId)
    if (view) this.repositionView(view)
  }

  // ─── Private ───────────────────────────────────────────────────

  private createView(tab: KitsuneTab): BrowserView {
    return new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: tab.isPrivate ? `private-${tab.id}` : 'persist:kitsune',
        allowRunningInsecureContent: false,
      },
    })
  }

  private wireViewEvents(id: string, view: BrowserView): void {
    const wc = view.webContents

    wc.on('page-title-updated', (_e, title) => this.updateTabMeta(id, { title }))
    wc.on('page-favicon-updated', (_e, favicons) => {
      if (favicons[0]) this.updateTabMeta(id, { favicon: favicons[0] })
    })
    wc.on('did-start-loading', () => this.updateTabMeta(id, { status: 'loading' }))
    wc.on('did-finish-load', () => {
      this.updateTabMeta(id, {
        status: 'ready',
        url: wc.getURL(),
        title: wc.getTitle() || wc.getURL(),
        lastAccessedAt: Date.now(),
      })
    })
    wc.on('did-fail-load', (_e, _code, desc) => {
      this.updateTabMeta(id, { status: 'error', title: desc })
    })
    wc.on('did-navigate', (_e, url) => {
      this.updateTabMeta(id, { url })
      this.window.webContents.send('tab:navigate', { id, url })
    })
    wc.on('did-navigate-in-page', (_e, url) => {
      this.updateTabMeta(id, { url })
      this.window.webContents.send('tab:navigate', { id, url })
    })
  }

  private repositionView(view: BrowserView): void {
    const [w, h] = this.window.getContentSize()
    view.setBounds({
      x: SIDEBAR_W,
      y: CHROME_TOP,
      width: Math.max(0, w - SIDEBAR_W - this.aiPanelWidth),
      height: Math.max(0, h - CHROME_TOP - STATUSBAR_H - HOTKEYBAR_H),
    })
    view.setAutoResize({ width: true, height: true, horizontal: false, vertical: false })
  }

  private pushTabUpdate(tab: KitsuneTab): void {
    this.window.webContents.send('tab:update', tab)
  }
}
