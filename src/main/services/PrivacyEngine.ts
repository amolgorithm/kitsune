// src/main/services/PrivacyEngine.ts
import { Session } from 'electron'
import type { BlockedTracker, TrackerCategory, PageRiskReport } from '../../shared/types'
import type { SettingsStore } from './SettingsStore'

const FINGERPRINT_DOMAINS = [
  'fingerprintjs.com', 'fingerprint2.com',
]

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

export class PrivacyEngine {
  private blockLog = new Map<string, BlockedTracker[]>()
  private blockedDomains: Set<string>
  private totalBlocked = 0

  constructor(
    private readonly sess: Session,
    private readonly settings: SettingsStore,
  ) {
    this.blockedDomains = new Set(SEED_BLOCKED_DOMAINS)
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
      if (b.category === 'malware')          score += 0.4
      else if (b.category === 'crypto-mining') score += 0.3
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

  private installRequestFilter(): void {
    this.sess.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      if (!this.settings.get('trackerBlockingEnabled') && !this.settings.get('adBlockingEnabled')) {
        return callback({ cancel: false })
      }

      // Never block local Vite dev server
      if (details.url.startsWith('http://localhost') || details.url.startsWith('ws://localhost')) {
        return callback({ cancel: false })
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

    // FIXED: merge with existing headers instead of replacing them entirely
    // Previously this replaced ALL headers including Content-Type, breaking Vite's module serving
    this.sess.webRequest.onHeadersReceived((details, callback) => {
      // Never modify localhost responses (Vite dev server)
      if (details.url.startsWith('http://localhost') || details.url.startsWith('ws://localhost')) {
        return callback({ cancel: false })
      }

      callback({
        responseHeaders: {
          // Spread existing headers first, then add/override ours
          ...details.responseHeaders,
          'Permissions-Policy': [
            'camera=(), microphone=(), geolocation=()',
          ],
        },
      })
    })
  }

  private async loadRemoteBlocklists(): Promise<void> {
    console.log('[PrivacyEngine] remote blocklists would be fetched here')
  }
}
