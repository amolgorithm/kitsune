// src/main/services/PrivacyEngine.ts
import { Session } from 'electron'
import type { BlockedTracker, TrackerCategory, PageRiskReport } from '../../shared/types'
import type { SettingsStore } from './SettingsStore'
import type { NineTailsEngine } from './NineTailsEngine'

const TRACKER_HEURISTIC_PATTERNS: Array<{ re: RegExp; category: TrackerCategory }> = [
  { re: /google-analytics|ga\.js|gtag/i,          category: 'analytics' },
  { re: /doubleclick|googlesyndication|adnxs/i,    category: 'advertising' },
  { re: /facebook\.net\/tr|pixel\.facebook/i,      category: 'advertising' },
  { re: /hotjar|fullstory|logrocket|clarity/i,     category: 'analytics' },
  { re: /coinhive|cryptonight|miner\.js/i,         category: 'crypto-mining' },
  { re: /fingerprintjs|fp2\.|fingerprint2/i,       category: 'fingerprinting' },
  { re: /twitter\.com\/i\/jot|t\.co\/track/i,      category: 'social' },
]

const SEED_BLOCKED_DOMAINS = new Set([
  'google-analytics.com', 'doubleclick.net', 'googlesyndication.com',
  'facebook.net', 'connect.facebook.net', 'hotjar.com', 'fullstory.com',
  'coinhive.com', 'bat.bing.com', 'scorecardresearch.com', 'quantserve.com',
  'adnxs.com', 'moatads.com', 'criteo.com', 'taboola.com', 'outbrain.com',
  'rubiconproject.com', 'pubmatic.com', 'cdn.mouseflow.com',
])

// These domains must never be blocked — AI services, app fonts, etc.
const ALLOWLISTED_DOMAINS = [
  'ai.hackclub.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.google.com',       // favicons (s2 service)
]

export class PrivacyEngine {
  private blockLog = new Map<string, BlockedTracker[]>()
  private blockedDomains: Set<string>
  private totalBlocked = 0
  private nineTails: NineTailsEngine | null = null

  constructor(
    private readonly sess: Session,
    private readonly settings: SettingsStore,
  ) {
    this.blockedDomains = new Set(SEED_BLOCKED_DOMAINS)
  }

  setNineTailsEngine(engine: NineTailsEngine): void {
    this.nineTails = engine
  }

  async init(): Promise<void> {
    await this.loadRemoteBlocklists()
    this.installRequestFilter()
    this.installFingerprintGuard()
    console.log(`[PrivacyEngine] ready — ${this.blockedDomains.size} domains blocked`)
  }

  getBlockReport(tabId: string): BlockedTracker[] {
    return this.blockLog.get(tabId) ?? []
  }

  getRiskReport(tabId: string, url: string): PageRiskReport {
    const blocks = this.blockLog.get(tabId) ?? []
    let score = 0
    for (const b of blocks) {
      if (b.category === 'malware')             score += 0.4
      else if (b.category === 'crypto-mining')  score += 0.3
      else if (b.category === 'fingerprinting') score += 0.15
      else if (b.category === 'advertising')    score += 0.05
      else                                       score += 0.03
    }
    score = Math.min(1, score)
    const riskLevel =
      score < 0.15 ? 'safe' : score < 0.35 ? 'low' : score < 0.60 ? 'medium' : score < 0.80 ? 'high' : 'critical'
    return {
      tabId, url, riskScore: score, riskLevel,
      signals: blocks.map(b => `${b.category}: ${new URL(b.url).hostname}`).slice(0, 10),
      trackerCount: blocks.length,
      analyzedAt: Date.now(),
    }
  }

  getTotalBlocked(): number { return this.totalBlocked }

  private isAllowlisted(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '')
      for (const allowed of ALLOWLISTED_DOMAINS) {
        const allowedHost = allowed.replace(/^www\./, '')
        if (hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)) return true
      }
    } catch { /* malformed URL — don't block */ return true }
    return false
  }

  private installRequestFilter(): void {
    this.sess.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      if (!this.settings.get('trackerBlockingEnabled') && !this.settings.get('adBlockingEnabled')) {
        return callback({ cancel: false })
      }

      // Never block local Vite dev server
      if (details.url.startsWith('http://localhost') || details.url.startsWith('ws://localhost')) {
        return callback({ cancel: false })
      }

      // Never block allowlisted domains (AI endpoint, fonts, etc.)
      if (this.isAllowlisted(details.url)) {
        return callback({ cancel: false })
      }

      // Shield tail — custom rules before built-in blocklist
      if (this.nineTails) {
        const shield = this.nineTails.shouldBlockRequest(details.url, details.resourceType ?? '')
        if (shield.block) {
          this.totalBlocked++
          const tabId = String(details.webContentsId ?? 'unknown')
          if (!this.blockLog.has(tabId)) this.blockLog.set(tabId, [])
          this.blockLog.get(tabId)!.push({
            url: details.url, category: 'advertising', tabId, blockedAt: Date.now(), method: 'known-list',
          })
          return callback({ cancel: true })
        }
        if (shield.action === 'strip') {
          const cleaned = this.nineTails.stripUtmParams(details.url)
          if (cleaned !== details.url) return callback({ redirectURL: cleaned })
        }
      }

      let blocked = false
      let category: TrackerCategory = 'analytics'

      try {
        const hostname = new URL(details.url).hostname.replace(/^www\./, '')
        if (this.blockedDomains.has(hostname)) {
          blocked = true
        }
        if (!blocked) {
          for (const { re, category: cat } of TRACKER_HEURISTIC_PATTERNS) {
            if (re.test(details.url)) { blocked = true; category = cat; break }
          }
        }
      } catch { /* malformed URL */ }

      if (blocked) {
        this.totalBlocked++
        const tabId = String(details.webContentsId ?? 'unknown')
        if (!this.blockLog.has(tabId)) this.blockLog.set(tabId, [])
        this.blockLog.get(tabId)!.push({
          url: details.url, category, tabId, blockedAt: Date.now(), method: 'known-list',
        })
        return callback({ cancel: true })
      }

      callback({ cancel: false })
    })
  }

  private installFingerprintGuard(): void {
    if (!this.settings.get('fingerprintProtection')) return
    this.sess.webRequest.onHeadersReceived((details, callback) => {
      if (details.url.startsWith('http://localhost') || details.url.startsWith('ws://localhost')) {
        return callback({ cancel: false })
      }
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Permissions-Policy': ['camera=(), microphone=(), geolocation=()'],
        },
      })
    })
  }

  private async loadRemoteBlocklists(): Promise<void> {
    console.log('[PrivacyEngine] remote blocklists would be fetched here')
  }
}