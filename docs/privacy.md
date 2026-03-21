# Privacy & Security

## Overview

Kitsune blocks trackers and ads at the network layer before any TCP connection is made. No page content is needed — requests are intercepted by `session.webRequest.onBeforeRequest` in the main process and cancelled if they match.

Everything runs locally. No telemetry is sent anywhere.

## What Gets Blocked

**Known domain blocklist** — a seed list of ~25 high-traffic tracker and ad domains is active from first launch. Designed to grow: the architecture supports fetching EasyList and uBlock Origin filter lists at startup.

**Heuristic regex patterns** — catches trackers not on any list by matching URL patterns:

| Pattern | Category |
|---------|----------|
| Google Analytics, gtag | Analytics |
| DoubleClick, AdSense, AppNexus | Advertising |
| Facebook Pixel | Advertising |
| Hotjar, FullStory, LogRocket, Clarity | Analytics |
| CoinHive, cryptonight, miner.js | Crypto mining |
| FingerprintJS | Fingerprinting |
| Twitter jot endpoint | Social |

## Fingerprint Guard

When enabled, `session.webRequest.onHeadersReceived` appends `Permissions-Policy: camera=(), microphone=(), geolocation=()` to all external responses. This prevents sites from silently accessing device APIs used for fingerprinting.

Localhost responses (Vite dev server) are explicitly excluded so development is not affected.

## Per-Tab Block Reports

Every blocked request is logged with:
- The full URL
- Category (`analytics`, `advertising`, `fingerprinting`, `social`, `crypto-mining`, `malware`)
- Tab ID
- Timestamp
- Method (`known-list` or `ai-heuristic` or `fingerprint-guard`)

Access reports via `PrivacyIPC.blockedList(tabId)` or `PrivacyIPC.getReport(tabId, url)`.

## Risk Scoring

The privacy engine calculates a 0–1 risk score per tab by weighing blocked tracker categories:

| Category | Score contribution |
|----------|--------------------|
| Malware | +0.40 |
| Crypto mining | +0.30 |
| Fingerprinting | +0.15 |
| Advertising | +0.05 |
| Other | +0.03 |

Score is capped at 1.0. Risk levels: `safe` (<0.15), `low` (<0.35), `medium` (<0.60), `high` (<0.80), `critical` (≥0.80).

A separate AI-based pre-load risk scorer in `AIService.scorePageRisk()` uses the model to rate a URL before navigation, using URL structure alone (no page content). This runs only when enabled in Settings → Privacy.

## Private Tabs

Private tabs use an ephemeral Electron `partition` session keyed to the tab ID (`private-{id}`). These sessions never write cookies, cache, or storage to disk. When the tab is closed the partition is gone.

## Settings

All privacy features can be toggled independently in Settings → Privacy & Security:

- Block Trackers
- Block Ads
- Fingerprint Protection
- AI Threat Detection (pre-load URL risk scoring)

None of these affect localhost or `kitsune://` internal URLs.

## Security Model

- **Context isolation on** — renderer has zero Node.js access
- **Sandboxed BrowserViews** — each tab runs in a sandboxed context
- **No remote content in browser chrome** — the shell loads only local assets
- **IPC surface is minimal** — only explicitly named channels are bridged via contextBridge
- **CSP** — the renderer HTML enforces a Content-Security-Policy
