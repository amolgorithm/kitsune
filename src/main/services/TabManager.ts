// src/main/services/TabManager.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — Tab Manager
// Owns the pool of Electron BrowserViews (one per tab).
// Handles create/close/navigate/activate/hibernate/wake.
// ─────────────────────────────────────────────────────────────────

import { BrowserView, BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import type { KitsuneTab, TabStatus } from '../../shared/types'
import type { WorkspaceManager } from './WorkspaceManager'
import type { SettingsStore } from './SettingsStore'

interface CreateTabOptions {
  url: string
  workspaceId?: string
  groupId?: string
  background?: boolean   // don't switch to this tab immediately
  isPrivate?: boolean
}

// Chrome UI height — how much vertical space the BrowserView must leave
const CHROME_HEIGHT = 32 + 48 + 36  // titlebar + navbar + lens bar

export class TabManager {
  private views = new Map<string, BrowserView>()
  private tabs  = new Map<string, KitsuneTab>()
  private activeTabId: string | null = null
  private window: BrowserWindow | null = null

  constructor(
    private readonly workspaceManager: WorkspaceManager,
    private readonly settings: SettingsStore,
  ) {}

  setWindow(win: BrowserWindow): void {
    this.window = win
    // Resize all views when window resizes
    win.on('resize', () => this.repositionActiveView())
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
      status: 'loading',
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

    // Create the BrowserView (Chromium webContents for this tab)
    const view = this.createView(tab)
    this.views.set(id, view)

    // Navigate
    if (opts.url !== 'kitsune://newtab') {
      view.webContents.loadURL(opts.url)
    }

    // Wire tab title + status updates back through IPC push
    this.wireViewEvents(id, view)

    if (!opts.background) {
      await this.activateTab(id)
    }

    // Notify renderer of new tab state
    this.pushTabUpdate(tab)

    return tab
  }

  async activateTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) throw new Error(`Tab ${id} not found`)

    // Wake from hibernation if needed
    if (tab.hibernated) {
      await this.wakeTab(id)
    }

    // Hide previously active view
    if (this.activeTabId && this.activeTabId !== id) {
      const prev = this.views.get(this.activeTabId)
      if (prev && this.window) {
        this.window.removeBrowserView(prev)
      }
    }

    this.activeTabId = id
    tab.lastAccessedAt = Date.now()

    // Attach view to window
    const view = this.views.get(id)
    if (view && this.window) {
      this.window.addBrowserView(view)
      this.repositionView(view)
    }

    this.pushTabUpdate(tab)
    this.window?.webContents.send('tab:activate', id)
  }

  async closeTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return

    const view = this.views.get(id)
    if (view) {
      if (this.window) this.window.removeBrowserView(view)
      view.webContents.close()
    }

    this.views.delete(id)
    this.tabs.delete(id)

    // Activate previous tab if this was active
    if (this.activeTabId === id) {
      this.activeTabId = null
      const remaining = [...this.tabs.keys()]
      if (remaining.length > 0) {
        await this.activateTab(remaining[remaining.length - 1])
      }
    }

    this.window?.webContents.send('tab:close', id)
  }

  async navigateTab(id: string, url: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab) return

    const view = this.views.get(id)
    if (!view) return

    if (tab.hibernated) await this.wakeTab(id)

    tab.url = url
    tab.status = 'loading'
    this.pushTabUpdate(tab)

    view.webContents.loadURL(url)
  }

  async hibernateTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab || tab.hibernated || id === this.activeTabId) return

    const view = this.views.get(id)
    if (!view) return

    // Capture memory snapshot before discarding
    const memInfo = await view.webContents.getProcessMemoryInfo()
    tab.memoryBytes = (memInfo.privateBytes ?? 0) * 1024

    // Discard the webContents — this releases RAM while keeping tab state
    // In production: use webContents.forcefullyCrashRenderer() + reload on wake
    // For now we destroy the view and recreate on wake
    if (this.window) this.window.removeBrowserView(view)
    view.webContents.destroy()
    this.views.delete(id)

    tab.hibernated = true
    tab.status = 'hibernated'
    this.pushTabUpdate(tab)
  }

  async wakeTab(id: string): Promise<void> {
    const tab = this.tabs.get(id)
    if (!tab || !tab.hibernated) return

    // Re-create the view and navigate back to last URL
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

  listTabs(workspaceId?: string): KitsuneTab[] {
    const all = [...this.tabs.values()]
    return workspaceId ? all.filter(t => t.workspaceId === workspaceId) : all
  }

  getTab(id: string): KitsuneTab | undefined {
    return this.tabs.get(id)
  }

  getActiveTabId(): string | null {
    return this.activeTabId
  }

  /** Returns raw page text for AI context (up to limit chars) */
  async getPageText(id: string, maxChars = 8000): Promise<string> {
    const view = this.views.get(id)
    if (!view || view.webContents.isDestroyed()) return ''

    try {
      const text: string = await view.webContents.executeJavaScript(
        `document.body?.innerText?.slice(0, ${maxChars}) ?? ''`
      )
      return text
    } catch {
      return ''
    }
  }

  // ─── Private helpers ───────────────────────────────────────────

  private createView(tab: KitsuneTab): BrowserView {
    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // Private tabs get a fresh, non-persistent session
        partition: tab.isPrivate ? `private-${tab.id}` : 'persist:kitsune',
        allowRunningInsecureContent: false,
      },
    })
    return view
  }

  private wireViewEvents(id: string, view: BrowserView): void {
    const wc = view.webContents

    wc.on('page-title-updated', (_e, title) => {
      this.updateTabMeta(id, { title })
    })

    wc.on('page-favicon-updated', (_e, favicons) => {
      if (favicons[0]) this.updateTabMeta(id, { favicon: favicons[0] })
    })

    wc.on('did-start-loading', () => {
      this.updateTabMeta(id, { status: 'loading' })
    })

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

    // Forward nav events so renderer URL bar stays in sync
    wc.on('did-navigate', (_e, url) => {
      this.updateTabMeta(id, { url })
      this.window?.webContents.send('tab:navigate', { id, url })
    })
  }

  private repositionActiveView(): void {
    if (!this.activeTabId) return
    const view = this.views.get(this.activeTabId)
    if (view) this.repositionView(view)
  }

  private repositionView(view: BrowserView): void {
    if (!this.window) return
    const [w, h] = this.window.getContentSize()
    const sidebarWidth = 240 // must match CSS --sidebar-w
    const aiPanelWidth = 0   // TODO: read from CleaveManager state
    view.setBounds({
      x: sidebarWidth,
      y: CHROME_HEIGHT,
      width: w - sidebarWidth - aiPanelWidth,
      height: h - CHROME_HEIGHT - 24, // 24 = statusbar
    })
    view.setAutoResize({ width: true, height: true })
  }

  private pushTabUpdate(tab: KitsuneTab): void {
    this.window?.webContents.send('tab:update', tab)
  }
}
