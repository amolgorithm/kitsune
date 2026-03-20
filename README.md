<<<<<<< HEAD
# 🦊 Kitsune Browser

> An AI-native, RAM-efficient browser built on Electron + React + TypeScript.  
> Designed with the philosophy: **fast by default, intelligent when you need it, private always.**

---

## Architecture Overview

```
kitsune/
├── src/
│   ├── main/                        # Electron main process (Node.js)
│   │   ├── index.ts                 # App bootstrap, window creation
│   │   ├── preload.ts               # Secure contextBridge (IPC surface)
│   │   ├── services/
│   │   │   ├── TabManager.ts        # BrowserView pool, tab lifecycle
│   │   │   ├── HibernationScheduler.ts  # Background RAM manager
│   │   │   ├── PrivacyEngine.ts     # Tracker/ad blocking, fingerprint guard
│   │   │   ├── AIService.ts         # Anthropic SDK: summaries, chat, clustering
│   │   │   ├── WorkspaceManager.ts  # Workspaces + tab groups
│   │   │   ├── CleaveManager.ts     # Split-pane layout tree
│   │   │   └── SettingsStore.ts     # electron-store backed persistent settings
│   │   └── ipc/
│   │       ├── tabIPC.ts            # Tab lifecycle handlers
│   │       ├── aiIPC.ts             # AI feature handlers
│   │       ├── privacyIPC.ts        # Privacy report handlers
│   │       ├── workspaceIPC.ts      # Workspace + group handlers
│   │       ├── cleaveIPC.ts         # Layout handlers
│   │       └── settingsIPC.ts       # Settings read/write handlers
│   │
│   ├── renderer/                    # React renderer process
│   │   ├── App.tsx                  # Root component, hotkey wiring
│   │   ├── main.tsx                 # ReactDOM entry
│   │   ├── lib/
│   │   │   └── ipc.ts               # Typed IPC client (window.kitsune)
│   │   ├── stores/
│   │   │   └── browserStore.ts      # Zustand store — all renderer state
│   │   ├── styles/
│   │   │   ├── tokens.css           # Design system CSS custom properties
│   │   │   ├── global.css           # Resets, animations, utilities
│   │   │   └── lenses.css           # Per-lens CSS overrides
│   │   └── components/
│   │       ├── Sidebar/             # Vertical tab list, workspaces, groups
│   │       │   ├── Sidebar.tsx
│   │       │   ├── TabItem.tsx      # Single tab row with badges, close btn
│   │       │   └── TabGroupHeader.tsx
│   │       ├── Navbar/              # URL bar, nav buttons, security badge
│   │       │   └── Navbar.tsx
│   │       ├── LensBar/             # Lens profile switcher
│   │       │   └── LensBar.tsx
│   │       ├── ContentArea/         # WebView bounds + NewTabPage
│   │       │   ├── ContentArea.tsx
│   │       │   └── NewTabPage.tsx
│   │       ├── AIPanel/             # AI sidebar: summary/research/notes/tasks/chat
│   │       │   └── AIPanel.tsx
│   │       ├── CommandPalette/      # ⌘K fuzzy command & tab search
│   │       │   └── CommandPalette.tsx
│   │       ├── Cleave/              # ⌘\ split-pane layout manager
│   │       │   └── CleaveOverlay.tsx
│   │       ├── Settings/            # Full settings modal
│   │       │   └── SettingsModal.tsx
│   │       ├── StatusBar/           # Memory, tab count, AI, risk
│   │       │   └── StatusBar.tsx
│   │       └── HotkeyBar/           # Always-visible hotkey reference
│   │           └── HotkeyBar.tsx
│   │
│   └── shared/                      # Isomorphic — used by both processes
│       ├── types.ts                 # All TypeScript types and interfaces
│       └── constants.ts             # App-wide constants
│
├── index.html                       # Vite HTML entry point
├── vite.config.ts                   # Vite + Electron plugin config
├── tsconfig.json
└── package.json
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | **Electron 31** | Chromium engine, cross-platform, BrowserView API |
| UI Framework | **React 18** + TypeScript | Component model, concurrent rendering |
| Build | **Vite 5** + vite-plugin-electron | Fast HMR, ESM, tree-shaking |
| State | **Zustand** + Immer | Minimal, fast, no boilerplate |
| AI | **@anthropic-ai/sdk** (Claude) | Streaming, tool use, best reasoning |
| Persistence | **electron-store** | Typed, schema-validated settings |
| Styling | **CSS Modules** + custom properties | Zero runtime, scoped, themeable |

---

## Features Implemented

### 🗂 Smart Tab Manager
- **BrowserView pool** — each tab is a real Chromium `BrowserView`, not an iframe
- **Hibernation Scheduler** — background timer checks idle time every 30s; discards webContents to free RAM while preserving tab state
- **Memory pressure mode** — if total tab memory exceeds threshold, hibernation threshold halves
- **Wake on activate** — tabs reload transparently when clicked
- **Tab groups** — color-coded, collapsible; AI-managed groups tagged with `✦`

### 🤖 AI Panel (Anthropic Claude)
- **Page Summarizer** — auto-triggers on page load; returns key points, stats, and reference links as structured JSON
- **Cross-page Research** — synthesizes N open tabs into a single cited document
- **Chat** — full conversation with page context injected; streaming-ready API
- **Task Extractor** — parses highlighted text into structured to-dos
- **Tab Clusterer** — asks Claude to group all open tabs into labelled categories
- **Pre-load Risk Scorer** — URL-only heuristic using `claude-haiku` before navigation

### 🛡 Privacy Engine
- **Request filter** — `session.webRequest.onBeforeRequest` intercepts all network requests
- **Domain blocklist** — seeded with common trackers; designed to fetch EasyList/uBlock at startup
- **AI heuristic patterns** — regex matching for novel trackers not on any list
- **Fingerprint guard** — `Permissions-Policy` headers; canvas/WebGL injection points wired
- **Per-tab block reports** — track what was blocked per tab for the UI shield badge

### ⧉ Cleave
- **Split modes**: horizontal, vertical, AI-beside, triple, by-workspace, by-group
- **PaneNode tree** — recursive layout structure; serialize/deserialize for persistence
- **Preview SVGs** — every mode has a visual diagram before you apply it
- **Hotkey-driven** — full keyboard support, single key per split mode

### 🎨 Lens Profiles
- 5 built-in lenses: Default, Research, Coding, Reading, Creative
- Each lens sets: accent color, default AI tab, reader mode, font override
- CSS-based overrides — zero JS overhead at runtime
- Custom lens creation scaffolded (UI in Settings, creation flow TBD)

### ⌨ Command Palette (⌘K)
- Fuzzy search across: commands, open tabs, lens profiles, AI actions
- Keyboard navigation: ↑↓ to move, ↵ to execute, esc to dismiss
- Grouped by category with hotkey hints

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- An Anthropic API key (for AI features): https://console.anthropic.com

### Install

```bash
cd kitsune
npm install
```

### Development

```bash
npm run electron:dev
```

This starts Vite dev server + Electron simultaneously with hot reload.

### Build

```bash
npm run electron:build
```

Produces a native installer in `release/`.

### Configure AI

Open Settings (⌘,) → AI & Intelligence → paste your Anthropic API key.

Or set it via environment variable before launching:
```bash
ANTHROPIC_API_KEY=sk-ant-... npm run electron:dev
```

---

## Hotkeys

| Hotkey | Action |
|---|---|
| `⌘K` | Command palette |
| `⌘T` | New tab |
| `⌘W` | Close active tab |
| `⌘\` | Cleave (split layout) |
| `⌘⇧A` | Toggle AI panel |
| `⌘⇧R` | Reading mode |
| `⌘,` | Settings |
| `⌃1` | Default lens |
| `⌃2` | Research lens |
| `⌃3` | Coding lens |
| `⌃4` | Reading lens |

---

## Roadmap / TODO

- [ ] `kitsune://newtab` internal page renderer (protocol handler)
- [ ] Horizontal tab bar mode (toggle in settings)
- [ ] ResizablePanels integration for live Cleave layouts
- [ ] Universal File Search (PDF/DOCX/email indexing with local embeddings)
- [ ] AI Humanizer extension (human-like typing automation)
- [ ] Meeting Prep: email + calendar + tab synthesis
- [ ] Developer Lens: integrated DevTools panel, console in sidebar
- [ ] AI Workflow Chains: multi-step automation with visible "trail"
- [ ] Sync (encrypted) across devices
- [ ] Extension support (Manifest V3 compatible)
- [ ] LibreWolf-equivalent: integrate uBlock Origin engine natively

---

## Security Model

- **Context isolation**: renderer has zero Node.js access; all syscalls go through `contextBridge`
- **Sandboxed webContents**: every tab runs in a sandboxed BrowserView
- **Private tabs**: ephemeral `partition` sessions, never touch disk
- **No remote content in chrome UI**: the browser shell itself loads only local assets
- **Tracker blocking at network layer**: `session.webRequest` blocks before TCP connects
- **CSP on chrome window**: strict Content-Security-Policy header on the renderer HTML

---

## License

MIT — build on it, ship it, make it yours.
