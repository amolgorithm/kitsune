// src/main/services/NineTailsEngine.ts
// ─────────────────────────────────────────────────────────────────
// Orchestrates all nine tail agents. Each tail runs as an independent
// sub-engine that emits events and processes rules. The engine holds
// shared state, persists to electron-store, and pushes events to
// the renderer via BrowserWindow.webContents.send.
// ─────────────────────────────────────────────────────────────────

import { BrowserWindow, Notification } from 'electron'
import { randomUUID } from 'crypto'
import type {
  TailId, TailState, TailRule, TailEvent, TailEventType,
  NineTailsState, TailSnapshot,
} from '../../shared/types'
import type { SettingsStore } from './SettingsStore'
import type { TabManager } from './TabManager'
import type { WorkspaceManager } from './WorkspaceManager'

const STORE_KEY = 'nineTailsState'
const MAX_EVENTS_PER_TAIL = 100
const MAX_SNAPSHOTS = 200

const DEFAULT_TAIL = (id: TailId): TailState => ({
  id,
  enabled: true,
  progress: 0,
  events: [],
  rules: [],
  stats: {},
})

const ALL_TAILS: TailId[] = [
  'watcher', 'courier', 'focus', 'hibernate',
  'archivist', 'shield', 'relay', 'harvest', 'mirror',
]

export class NineTailsEngine {
  private state!: NineTailsState
  private snapshots: TailSnapshot[] = []
  private timers = new Map<string, ReturnType<typeof setInterval | typeof setTimeout>>()
  private win: BrowserWindow | null = null

  constructor(
    private readonly settings: SettingsStore,
    private readonly tabManager: TabManager,
    private readonly workspaceManager: WorkspaceManager,
  ) {}

  // ─── Init ──────────────────────────────────────────────────────

  async init(win: BrowserWindow): Promise<void> {
    this.win = win
    const persisted = this.settings.getRaw(STORE_KEY) as NineTailsState | null
    if (persisted?.tails) {
      this.state = persisted
    } else {
      this.state = {
        tails: Object.fromEntries(ALL_TAILS.map(id => [id, DEFAULT_TAIL(id)])) as Record<TailId, TailState>,
        activeEvents: [],
      }
    }
    this.snapshots = (this.settings.getRaw('nineTailsSnapshots') as TailSnapshot[] | null) ?? []
    this.startArchivistTimer()
    this.startHibernateWatcher()
    this.startFocusScheduler()
    this.startPulseWatcher()
    console.log('[NineTails] engine initialized')
  }

  destroy(): void {
    for (const t of this.timers.values()) {
      clearInterval(t as any)
      clearTimeout(t as any)
    }
    this.timers.clear()
  }

  // ─── Public API ────────────────────────────────────────────────

  getState(): NineTailsState {
    return this.state
  }

  setTailEnabled(id: TailId, enabled: boolean): void {
    this.state.tails[id].enabled = enabled
    this.persist()
    this.emit(id, 'config', `${enabled ? 'Enabled' : 'Disabled'} by user`)
  }

  addRule(rule: Omit<TailRule, 'id' | 'createdAt'>): TailRule {
    const full: TailRule = { ...rule, id: randomUUID(), createdAt: Date.now() }
    this.state.tails[rule.tailId].rules.push(full)
    this.persist()
    this.emit(rule.tailId, 'config', `Rule added — ${rule.label}`)
    return full
  }

  updateRule(tailId: TailId, ruleId: string, patch: Partial<TailRule>): void {
    const tail = this.state.tails[tailId]
    const idx = tail.rules.findIndex(r => r.id === ruleId)
    if (idx < 0) return
    tail.rules[idx] = { ...tail.rules[idx]!, ...patch }
    this.persist()
  }

  deleteRule(tailId: TailId, ruleId: string): void {
    const tail = this.state.tails[tailId]
    tail.rules = tail.rules.filter(r => r.id !== ruleId)
    this.persist()
  }

  getEvents(tailId?: TailId, limit = 50): TailEvent[] {
    if (tailId) {
      return this.state.tails[tailId].events.slice(-limit).reverse()
    }
    return this.state.activeEvents.slice(-limit).reverse()
  }

  // ─── Watcher tail — page mutation observation ──────────────────
  // Called from tabIPC when a page fires a MutationObserver hit
  // that matches an injected watcher rule.

  onPageMutation(tabId: string, url: string, matchedRuleId: string): void {
    const tail = this.state.tails['watcher']
    if (!tail.enabled) return
    const rule = tail.rules.find(r => r.id === matchedRuleId)
    if (!rule || !rule.active) return

    this.emit('watcher', 'fire', `Triggered — ${this.shortUrl(url)} — ${rule.label}`)
    this.updateProgress('watcher', 10)

    if (rule.action === 'notify' || rule.action === 'notify_sidebar') {
      this.sendNotification('Watcher', rule.label, url)
    }
    if (rule.action === 'run_command' && rule.params?.command) {
      // Fire into command engine — handled by caller
      this.push('ninetails:run-command', { command: rule.params.command })
    }
  }

  // ─── Courier tail — URL routing ────────────────────────────────
  // Called from TabManager.createTab before the tab is activated.

  routeTab(tabId: string, url: string): {
    workspaceId?: string; groupId?: string; lensId?: string; deferHibernate?: number
  } | null {
    const tail = this.state.tails['courier']
    if (!tail.enabled) return null

    for (const rule of tail.rules.filter(r => r.active)) {
      if (!this.matchesPattern(url, rule.pattern)) continue

      const result: Record<string, unknown> = {}
      if (rule.action === 'route_workspace' && rule.params?.workspaceId) result.workspaceId = rule.params.workspaceId
      if (rule.action === 'route_group' && rule.params?.groupId) result.groupId = rule.params.groupId
      if (rule.action === 'set_lens' && rule.params?.lensId) result.lensId = rule.params.lensId
      if (rule.action === 'defer_hibernate' && rule.params?.deferMs) result.deferHibernate = rule.params.deferMs

      this.emit('courier', 'route', `Routed — ${this.shortUrl(url)} — ${rule.label}`)
      this.updateProgress('courier', 5)
      return result as any
    }
    return null
  }

  // ─── Focus tail — blocking ─────────────────────────────────────
  // Called from PrivacyEngine (or TabManager) before a navigation.

  shouldBlock(url: string): { block: boolean; reason?: string } {
    const tail = this.state.tails['focus']
    if (!tail.enabled) return { block: false }

    for (const rule of tail.rules.filter(r => r.active && r.trigger === 'domain_visit')) {
      if (!this.matchesPattern(url, rule.pattern)) continue
      if (rule.action === 'block' || rule.action === 'redirect') {
        this.emit('focus', 'block', `Blocked — ${this.shortUrl(url)} — ${rule.label}`)
        this.updateProgress('focus', 5)
        return { block: true, reason: rule.label }
      }
      if (rule.action === 'hibernate') {
        this.emit('focus', 'block', `Deferred — ${this.shortUrl(url)} — will hibernate in 10min`)
        return { block: false }
      }
    }
    return { block: false }
  }

  // ─── Hibernate tail — rule-based memory management ─────────────
  // Called from HibernationScheduler in addition to idle-time checks.

  shouldHibernateByRule(tabId: string, url: string, memoryBytes: number, idleMs: number): boolean {
    const tail = this.state.tails['hibernate']
    if (!tail.enabled) return false

    for (const rule of tail.rules.filter(r => r.active)) {
      if (rule.action === 'skip' && this.matchesPattern(url, rule.pattern)) return false

      if (rule.trigger === 'memory_threshold' && rule.params?.thresholdMb) {
        const mb = memoryBytes / (1024 * 1024)
        if (mb > Number(rule.params.thresholdMb) && this.matchesPattern(url, rule.pattern)) {
          this.emit('hibernate', 'sleep', `Hibernated — ${this.shortUrl(url)} — exceeded ${rule.params.thresholdMb}MB (${Math.round(mb)}MB)`)
          this.updateProgress('hibernate', 5)
          return true
        }
      }

      if (rule.trigger === 'idle_time' && rule.params?.idleMs) {
        if (idleMs > Number(rule.params.idleMs) && this.matchesPattern(url, rule.pattern)) {
          this.emit('hibernate', 'sleep', `Hibernated — ${this.shortUrl(url)} — idle ${Math.round(idleMs / 60000)}min`)
          this.updateProgress('hibernate', 5)
          return true
        }
      }
    }
    return false
  }

  // ─── Archivist tail — snapshots ────────────────────────────────

  async createSnapshot(tag = 'auto'): Promise<TailSnapshot> {
    const tabs = this.tabManager.listTabs()
    const workspaces = this.workspaceManager.listWorkspaces()

    const snap: TailSnapshot = {
      id: randomUUID(),
      index: this.snapshots.length + 1,
      label: tag,
      tabCount: tabs.length,
      workspaceIds: workspaces.map(w => w.id),
      groupIds: [],
      tabSummaries: tabs.map(t => ({ tabId: t.id, url: t.url, title: t.title })),
      createdAt: Date.now(),
      tag: tag !== 'auto' ? tag : undefined,
    }

    this.snapshots.push(snap)

    // Prune old auto snapshots beyond configured limit
    const keepDays = 7
    const cutoff = Date.now() - keepDays * 24 * 3600 * 1000
    this.snapshots = this.snapshots.filter(s => s.tag || s.createdAt > cutoff)

    this.settings.setRaw('nineTailsSnapshots', this.snapshots)
    this.emit('archivist', 'snap', `Snapshot #${snap.index} '${tag}' — ${tabs.length} tabs, ${workspaces.length} workspaces`)
    this.updateProgress('archivist', 3)

    return snap
  }

  getSnapshots(): TailSnapshot[] {
    return [...this.snapshots].reverse()
  }

  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snap = this.snapshots.find(s => s.id === snapshotId)
    if (!snap) throw new Error(`Snapshot ${snapshotId} not found`)

    for (const summary of snap.tabSummaries) {
      await this.tabManager.createTab({ url: summary.url, background: true })
    }

    this.emit('archivist', 'restore', `Restored snapshot #${snap.index} '${snap.label}' — ${snap.tabCount} tabs`)
    this.push('ninetails:snapshot-restored', { snapshotId: snap.id })
  }

  // ─── Shield tail — advanced request filtering ──────────────────
  // Called from PrivacyEngine.installRequestFilter alongside base blocklist.

  shouldBlockRequest(url: string, type: string): { block: boolean; action?: string } {
    const tail = this.state.tails['shield']
    if (!tail.enabled) return { block: false }

    for (const rule of tail.rules.filter(r => r.active)) {
      if (!this.matchesPattern(url, rule.pattern)) continue

      if (rule.action === 'block') {
        this.emit('shield', 'block', `Blocked — ${this.shortUrl(url)} — ${rule.label}`)
        this.updateProgress('shield', 2)
        return { block: true, action: 'block' }
      }
      if (rule.action === 'strip') {
        this.emit('shield', 'clean', `Stripped — ${this.shortUrl(url)} — ${rule.label}`)
        return { block: false, action: 'strip' }
      }
      if (rule.action === 'disable_api') {
        this.emit('shield', 'block', `API disabled — ${rule.label} on ${this.shortUrl(url)}`)
        return { block: false, action: 'disable_api' }
      }
    }
    return { block: false }
  }

  stripUtmParams(url: string): string {
    try {
      const u = new URL(url)
      const utmKeys = [...u.searchParams.keys()].filter(k => k.startsWith('utm_') || k === 'fbclid' || k === 'gclid')
      if (utmKeys.length === 0) return url
      utmKeys.forEach(k => u.searchParams.delete(k))
      this.emit('shield', 'clean', `Stripped ${utmKeys.length} tracking params from ${u.hostname}`)
      return u.toString()
    } catch {
      return url
    }
  }

  // ─── Relay tail — outbound webhooks ────────────────────────────

  async fireRelay(trigger: string, context: Record<string, unknown>): Promise<void> {
    const tail = this.state.tails['relay']
    if (!tail.enabled) return

    for (const rule of tail.rules.filter(r => r.active && r.trigger === trigger)) {
      try {
        if (rule.action === 'post_webhook' && rule.params?.url) {
          const res = await fetch(String(rule.params.url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trigger, context, rule: rule.label, ts: Date.now() }),
          })
          this.emit('relay', 'fire', `Fired — ${rule.label} → POST ${String(rule.params.url).slice(0, 40)} (${res.status})`)
        } else if (rule.action === 'push_slack' && rule.params?.webhookUrl) {
          const res = await fetch(String(rule.params.webhookUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: `[Kitsune Relay] ${rule.label}\n${JSON.stringify(context, null, 2)}` }),
          })
          this.emit('relay', 'fire', `Fired — ${rule.label} → Slack (${res.status})`)
        } else {
          this.emit('relay', 'fire', `Fired — ${rule.label} — ${rule.action}`)
        }
        this.updateProgress('relay', 5)
      } catch (e: any) {
        this.emit('relay', 'warn', `Error — ${rule.label} — ${e.message}`)
      }
    }
  }

  // ─── Harvest tail — AI knowledge indexing ─────────────────────
  // Called after page load if Harvest is enabled.
  // Uses AIService internally.

  async indexPage(tabId: string, url: string, title: string, pageText: string): Promise<void> {
    const tail = this.state.tails['harvest']
    if (!tail.enabled) return

    // Check rules — may be restricted to certain workspaces/patterns
    const activeRules = tail.rules.filter(r => r.active)
    const allowed = activeRules.length === 0
      || activeRules.some(r => this.matchesPattern(url, r.pattern))
    if (!allowed) return

    // Indexing is handled by AIService — we just record the event here
    this.emit('harvest', 'index', `Indexed — ${this.shortUrl(url)} — queued for semantic index`)
    this.updateProgress('harvest', 2)
    this.push('ninetails:harvest-index', { tabId, url, title, pageText: pageText.slice(0, 8000) })
  }

  // ─── Mirror tail — structured capture ─────────────────────────
  // Called when a page matching a Mirror rule finishes loading.
  // Injects a content script that runs the CSS selector schema
  // and returns structured data.

  async capturePageWithSchema(tabId: string, url: string, schema: Record<string, string>): Promise<Record<string, string> | null> {
    const tail = this.state.tails['mirror']
    if (!tail.enabled) return null

    try {
      // Build and execute selector extraction in the page
      const code = `
        (() => {
          const result = {};
          const schema = ${JSON.stringify(schema)};
          for (const [field, selector] of Object.entries(schema)) {
            const el = document.querySelector(selector);
            result[field] = el ? (el.textContent || el.getAttribute('content') || '').trim() : null;
          }
          return result;
        })()
      `
      const extracted = await this.tabManager.evalInTab(tabId, code) as Record<string, string>
      this.emit('mirror', 'capture', `Captured — ${this.shortUrl(url)} — ${Object.keys(schema).join(', ')}`)
      this.updateProgress('mirror', 5)
      return extracted
    } catch (e: any) {
      this.emit('mirror', 'warn', `Capture failed — ${this.shortUrl(url)} — ${e.message}`)
      return null
    }
  }

  syncToVault(content: string, vaultPath: string, filePath: string): void {
    // Vault sync is file-system level — handled by mirrorIPC
    this.push('ninetails:mirror-sync', { content, vaultPath, filePath })
    this.emit('mirror', 'sync', `Synced — ${filePath}`)
    this.updateProgress('mirror', 3)
  }

  onHighlight(tabId: string, text: string, url: string): void {
    const tail = this.state.tails['mirror']
    if (!tail.enabled) return

    const rules = tail.rules.filter(r => r.active && r.trigger === 'highlight')
    for (const rule of rules) {
      this.emit('mirror', 'sync', `Highlight synced — ${text.length} chars → ${rule.params?.notePath || 'daily note'}`)
      this.push('ninetails:mirror-highlight', { text, url, rule })
    }
  }

  // ─── Internal scheduling ───────────────────────────────────────

  private startArchivistTimer(): void {
    const tail = this.state.tails['archivist']
    const intervalRule = tail.rules.find(r => r.active && r.trigger === 'time_interval')
    const intervalMs = intervalRule?.params?.intervalMs
      ? Number(intervalRule.params.intervalMs)
      : 30 * 60 * 1000 // default 30min

    const timer = setInterval(async () => {
      if (!this.state.tails['archivist'].enabled) return
      await this.createSnapshot('auto')
    }, intervalMs)

    this.timers.set('archivist-interval', timer)
  }

  private startHibernateWatcher(): void {
    // Periodic sweep — supplements HibernationScheduler with rule-based checks
    const timer = setInterval(() => {
      if (!this.state.tails['hibernate'].enabled) return
      const tabs = this.tabManager.listTabs()
      const now = Date.now()
      for (const tab of tabs) {
        if (tab.hibernated || tab.isPinned) continue
        if (tab.id === this.tabManager.getActiveTabId()) continue
        const idleMs = now - tab.lastAccessedAt
        if (this.shouldHibernateByRule(tab.id, tab.url, tab.memoryBytes, idleMs)) {
          this.tabManager.hibernateTab(tab.id).catch(console.error)
        }
      }
    }, 30_000)

    this.timers.set('hibernate-watcher', timer)
  }

  private startFocusScheduler(): void {
    // Check time-based focus windows every minute
    const timer = setInterval(() => {
      const tail = this.state.tails['focus']
      if (!tail.enabled) return
      const now = new Date()
      const hhmm = now.getHours() * 100 + now.getMinutes()
      for (const rule of tail.rules.filter(r => r.active && r.trigger === 'time_window')) {
        const start = Number(rule.params?.startHHMM ?? 900)
        const end   = Number(rule.params?.endHHMM   ?? 1200)
        const dow   = Number(rule.params?.daysOfWeek ?? 0b0111110) // Mon-Fri bitmask
        const dayBit = 1 << now.getDay()
        if ((dow & dayBit) && hhmm >= start && hhmm < end) {
          if (!rule.params?._active) {
            rule.params = { ...(rule.params ?? {}), _active: true }
            this.emit('focus', 'block', `Window started — ${rule.label}`)
            this.push('ninetails:focus-window', { active: true, rule })
          }
        } else if (rule.params?._active) {
          rule.params = { ...(rule.params ?? {}), _active: false }
          this.emit('focus', 'info', `Window ended — ${rule.label}`)
          this.push('ninetails:focus-window', { active: false, rule })
        }
      }
    }, 60_000)

    this.timers.set('focus-scheduler', timer)
  }

  private startPulseWatcher(): void {
    // Relay: fire focus_start / focus_end triggers when Focus windows toggle
    window // not available in main — relay events come from focus scheduler push above
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private emit(tailId: TailId, type: TailEventType, message: string): void {
    const event: TailEvent = {
      id: randomUUID(), tailId, type, message, timestamp: Date.now(),
    }
    const tail = this.state.tails[tailId]
    tail.events.push(event)
    if (tail.events.length > MAX_EVENTS_PER_TAIL) {
      tail.events = tail.events.slice(-MAX_EVENTS_PER_TAIL)
    }
    this.state.activeEvents.push(event)
    if (this.state.activeEvents.length > 500) {
      this.state.activeEvents = this.state.activeEvents.slice(-500)
    }
    this.persist()
    this.push('ninetails:tail-event', event)
  }

  private push(channel: string, payload: unknown): void {
    this.win?.webContents.send(channel as any, payload)
  }

  private updateProgress(tailId: TailId, delta: number): void {
    const tail = this.state.tails[tailId]
    tail.progress = Math.min(100, tail.progress + delta)
    // Decay slowly toward 0 over time — handled at read time in renderer
  }

  private matchesPattern(url: string, pattern: string): boolean {
    if (!pattern || pattern === '*') return true
    try {
      const hostname = new URL(url).hostname
      const globToRegex = (g: string) =>
        new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
      const patternHost = pattern.replace(/^https?:\/\//, '').split('/')[0]!
      return globToRegex(patternHost).test(hostname)
    } catch {
      return false
    }
  }

  private shortUrl(url: string): string {
    try { return new URL(url).hostname } catch { return url.slice(0, 40) }
  }

  private sendNotification(title: string, body: string, url: string): void {
    if (Notification.isSupported()) {
      new Notification({ title: `Kitsune — ${title}`, body, urgency: 'normal' }).show()
    }
    this.push('ninetails:notification', { title, body, url })
  }

  private persist(): void {
    this.settings.setRaw(STORE_KEY, this.state)
  }
}
