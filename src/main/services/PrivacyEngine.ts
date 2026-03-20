// src/main/services/PrivacyEngine.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — Privacy Engine
// Hooks into Electron's session.webRequest API to:
//   1. Block known trackers and ad servers (list-based)
//   2. Block fingerprinting JS APIs via content scripts
//   3. Run AI heuristic on unknown requests (pattern scoring)
//   4. Collect per-tab block reports for the UI
// ─────────────────────────────────────────────────────────────────

import { Session, net } from 'electron'
import type { BlockedTracker, TrackerCategory, PageRiskReport } from '../../shared/types'
import type { SettingsStore } from './SettingsStore'

// Fingerprinting API patterns detected in request URLs / headers
const FINGERPRINT_PATTERNS = [
  /canvas2d/i,
  /webgl/i,
  /battery/i,
  /deviceorientation/i,
  /navigator\.plugins/i,
  /screen\.width/i,
  /fingerprintjs/i,
  /fp2\.min/i,
  /clientrects/i,
]

// AI heuristic signals for trackers (simple pattern matching — no LLM call needed)
const TRACKER_HEURISTIC_PATTERNS: Array<{ re: RegExp; category: TrackerCategory }> = [
  { re: /google-analytics|ga\.js|gtag/i,          category: 'analytics' },
  { re: /doubleclick|googlesyndication|adnxs/i,    category: 'advertising' },
  { re: /facebook\.net\/tr|pixel\.facebook/i,      category: 'advertising' },
  { re: /hotjar|fullstory|logrocket|clarity/i,     category: 'analytics' },
  { re: /coinhive|cryptonight|miner\.js/i,         category: 'crypto-mining' },
  { re: /fingerprintjs|fp2\.|fingerprint2/i,       category: 'fingerprinting' },
  { re: /twitter\.com\/i\/jot|t\.co\/track/i,      category: 'social' },
  { re: /malware|phishing|ransomware/i,            category: 'malware' },
]

// Simple domain blocklist (seed — production fetches real lists)
const SEED_BLOCKED_DOMAINS = new Set([
  'google-analytics.com',
  'doubleclick.net',
  'googlesyndication.com',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'fullstory.com',
  'coinhive.com',
  'cdn.mouseflow.com',
  'bat.bing.com',
  'scorecardresearch.com',
  'quantserve.com',
  'adnxs.com',
  'moatads.com',
  'criteo.com',
  'taboola.com',
  'outbrain.com',
  'rubiconproject.com',
  'pubmatic.com',
])

export class PrivacyEngine {
  /** Per-tab block reports: tabId → list of blocked items */
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
    const trackerCount = blocks.length

    // Score based on what was found
    let score = 0
    for (const b of blocks) {
      if (b.category === 'malware')         score += 0.4
      else if (b.category === 'crypto-mining') score += 0.3
      else if (b.category === 'fingerprinting') score += 0.15
      else if (b.category === 'advertising')    score += 0.05
      else                                       score += 0.03
    }
    score = Math.min(1, score)

    const riskLevel =
      score < 0.15 ? 'safe'
      : score < 0.35 ? 'low'
      : score < 0.60 ? 'medium'
      : score < 0.80 ? 'high'
      : 'critical'

    const signals = blocks
      .map(b => `${b.category}: ${new URL(b.url).hostname}`)
      .slice(0, 10)

    return {
      tabId,
      url,
      riskScore: score,
      riskLevel,
      signals,
      trackerCount,
      analyzedAt: Date.now(),
    }
  }

  getTotalBlocked(): number {
    return this.totalBlocked
  }

  // ─── Private ───────────────────────────────────────────────────

  private installRequestFilter(): void {
    this.sess.webRequest.onBeforeRequest(
      { urls: ['<all_urls>'] },
      (details, callback) => {
        if (!this.settings.get('trackerBlockingEnabled') &&
            !this.settings.get('adBlockingEnabled')) {
          return callback({ cancel: false })
        }

        const url = details.url
        let blocked = false
        let category: TrackerCategory = 'analytics'

        try {
          const hostname = new URL(url).hostname.replace(/^www\./, '')

          // 1. Domain blocklist
          if (this.blockedDomains.has(hostname)) {
            blocked = true
          }

          // 2. AI heuristic patterns (applied even to unknown domains)
          if (!blocked) {
            for (const { re, category: cat } of TRACKER_HEURISTIC_PATTERNS) {
              if (re.test(url)) {
                blocked = true
                category = cat
                break
              }
            }
          }
        } catch {
          // malformed URL — allow
        }

        if (blocked) {
          this.totalBlocked++
          const tabId = String(details.webContentsId ?? 'unknown')
          const entry: BlockedTracker = {
            url,
            category,
            tabId,
            blockedAt: Date.now(),
            method: 'known-list',
          }
          if (!this.blockLog.has(tabId)) this.blockLog.set(tabId, [])
          this.blockLog.get(tabId)!.push(entry)

          return callback({ cancel: true })
        }

        callback({ cancel: false })
      }
    )
  }

  private installFingerprintGuard(): void {
    if (!this.settings.get('fingerprintProtection')) return

    // Inject script into every page that neutralizes fingerprinting APIs
    this.sess.webRequest.onHeadersReceived((_details, callback) => {
      callback({
        responseHeaders: {
          // Prevent iframe-based fingerprinting via permissions
          'Permissions-Policy': [
            'camera=(), microphone=(), geolocation=(), battery=()',
          ],
        },
      })
    })

    // TODO: sess.webContents content script injection for Canvas/WebGL noise
    // This would use Protocol handlers to inject JS that spoofs
    // canvas.toDataURL, navigator.plugins, screen dimensions, etc.
  }

  private async loadRemoteBlocklists(): Promise<void> {
    // In production: fetch easylist, uBlock filter lists, etc.
    // For scaffold: we extend from the seed list.
    // Example structure:
    //
    // const res = await net.fetch(BLOCKLIST_URLS[0])
    // const text = await res.text()
    // this.parseFilterList(text)
    //
    // For now just log intent
    console.log('[PrivacyEngine] remote blocklists would be fetched here')
  }
}
