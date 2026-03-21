# Kitsune Browser

> An AI-native, RAM-efficient browser built on Electron + React + TS.  
> Developed for absolutely no purpose.

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
│   │   │   ├── CommandEngine.ts     # Macro/alias/program/scheduled command system
│   │   │   ├── CommandExecutorImpl.ts  # All executable command implementations
│   │   │   └── SettingsStore.ts     # electron-store backed persistent settings
│   │   └── ipc/
│   │       ├── tabIPC.ts            # Tab lifecycle handlers
│   │       ├── aiIPC.ts             # AI feature handlers
│   │       ├── privacyIPC.ts        # Privacy report handlers
│   │       ├── workspaceIPC.ts      # Workspace + group handlers
│   │       ├── cleaveIPC.ts         # Layout handlers
│   │       ├── commandIPC.ts        # Command engine handlers
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
│   │       ├── CommandREPL/         # ⌘` programmable browser console
│   │       │   └── CommandREPL.tsx
│   │       ├── MacroEditor/         # Macro/alias/program/scheduler UI
│   │       │   └── MacroEditor.tsx
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
│       ├── commandTypes.ts          # Command catalog types
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
| AI | **HackClub AI proxy** (OpenAI-compatible) | Free, no account, frontier models |
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
- **Resizable sidebar** — drag the right edge to resize; snaps to icon-rail mode at minimum width, persisted across sessions

### 🤖 AI Panel (HackClub AI proxy)
- **Page Summarizer** — auto-triggers on page load; returns key points, stats, and reference links as structured JSON
- **Cross-page Research** — synthesizes N open tabs into a single cited document
- **Chat** — full conversation with page context injected; streaming-ready API
- **Task Extractor** — parses highlighted text into structured to-dos
- **Tab Clusterer** — asks AI to group all open tabs into labelled categories
- **Pre-load Risk Scorer** — URL-only heuristic before navigation

### ⌨️ Command REPL
See the [full REPL documentation](#-command-repl) below.

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

## 🖥 Command REPL

Open with **⌘`** (or `Ctrl+Shift+;`). Kitsune ships a full programmable console — think Neovim's command mode but for your browser. Every browser action is a typed command you can invoke, automate, and chain.

### Opening the REPL

| Method | Shortcut |
|---|---|
| Keyboard | `⌘\`` / `Ctrl+\`` |
| Keyboard (alt) | `⌘⇧;` / `Ctrl+Shift+;` |
| Settings → Macros | Click "open REPL" link |

### Command Syntax

Commands follow a simple `command.subcommand key=value` format:

```
tab.create url=https://github.com
tab.openMany urls=https://a.com,https://b.com delay=300
ai.chat message="Summarize this page"
lens.set research
memory.hibernate.threshold minutes=5
system.volume.set 50
js.eval code="document.title"
```

Positional arguments also work for simple commands:

```
workspace.switch research
tab.closeMatching pattern=stackoverflow
```

### Built-in Aliases

Aliases expand short strings into full commands before execution. Several are seeded by default:

| Alias | Expands to |
|---|---|
| `:nt` | `tab.create url=kitsune://newtab` |
| `:ct` | `tab.close` |
| `:hi` | `tab.hibernateAll` |
| `:ai` | `ai.panel.toggle` |
| `:rw` | `workspace.program research-workspace` |
| `:fs` | `ui.fileSearch` |
| `:cp` | `ui.commandPalette` |

Create your own:

```
alias :gh tab.create url=https://github.com
alias :morning macro run morning-session
```

### Command Categories

**Tabs** — `tab.create`, `tab.close`, `tab.restore`, `tab.navigate`, `tab.activate`, `tab.hibernate`, `tab.hibernateAll`, `tab.wake`, `tab.wakeAll`, `tab.list`, `tab.reload`, `tab.reloadAll`, `tab.pin`, `tab.unpin`, `tab.duplicate`, `tab.openMany`, `tab.closeMatching`, `tab.focusMatching`, `tab.memory`, `tab.goBack`, `tab.goForward`

**Workspaces** — `workspace.create`, `workspace.switch`, `workspace.list`, `workspace.program`, `workspace.closeAll`, `group.create`, `group.delete`, `group.aiCluster`

**AI** — `ai.summarize`, `ai.chat`, `ai.cluster`, `ai.riskScore`, `ai.extractTasks`, `ai.panel.toggle`, `ai.panel.open`, `ai.panel.close`, `ai.panel.tab`

**Lenses** — `lens.set`, `lens.restore`, `lens.list`

**Privacy** — `privacy.report`, `privacy.blocklist`, `privacy.enable`, `privacy.disable`

**Memory** — `memory.report`, `memory.save`, `memory.threshold.set`, `memory.hibernate.threshold`

**System (OS-level)** — `system.volume.set`, `system.volume.mute`, `system.volume.unmute`, `system.notify`, `system.app.focus`, `system.screenshot`, `system.exec`, `system.idle`

**UI** — `ui.commandPalette`, `ui.settings`, `ui.fileSearch`, `ui.cleave`, `ui.focusUrlBar`, `ui.zoom.in`, `ui.zoom.out`, `ui.zoom.reset`, `ui.fullscreen`, `ui.sidebar.toggle`, `ui.readingMode`

**Page / JS** — `js.eval`, `js.inject`, `page.scroll`, `page.scrollTop`, `page.scrollBottom`, `page.getText`, `page.getTitle`, `page.getUrl`, `page.click`, `page.find`

**Settings** — `settings.set`, `settings.get`, `settings.reset`, `settings.theme`, `settings.ai.toggle`

### Chain Mode

Chain multiple commands together into a single execution:

```
chain
  tab.create url=https://google.com
  tab.create url=https://github.com
  ai.panel.open
  lens.set research
:run
```

Type `:cancel` to abort a chain in progress.

You can also run chains directly from the IPC layer:

```javascript
CommandIPC.runChain([
  'tab.create url=https://news.ycombinator.com',
  'ai.summarize',
])
```

### Macros

Macros are named sequences of commands that can be saved, edited, and run by name or alias. They support per-step delays, conditions, and error handling.

**Running a macro:**

```
macro run morning-session
:morning          ← via alias
```

**Built-in macros:**

| Name | Alias | What it does |
|---|---|---|
| `morning-session` | `:morning` | Opens email, calendar, HN, AI panel |
| `hibernate-and-save` | `:save` | Hibernates background tabs, shows memory report |
| `ai-research-mode` | `:research` | Switches to Research lens, opens AI panel on Research tab |

**Creating a macro** — open Settings → Macros & Automation, click "+ New Macro", and write steps one per line in command syntax. Or use the REPL sidebar's Macros tab to run, edit, and delete them.

### Workspace Programs

Programs open a curated set of tabs in a new or existing workspace, optionally with pre-defined groups and AI clustering after load.

```
workspace.program research-workspace
workspace.program dev-workspace
```

**Built-in programs:**

`research-workspace` — creates a "Research" workspace with Scholar, Semantic Scholar, arXiv, Connected Papers, and a scratch tab. AI-clusters after load.

`dev-workspace` — creates a "Dev" workspace with GitHub, MDN, Stack Overflow, and a scratch tab.

### Scheduled Commands

Commands can run automatically on a timer. Create them in Settings → Macros & Automation → Scheduled, or via the IPC:

```javascript
CommandIPC.createScheduled({
  name: 'hourly-hibernation',
  command: 'tab.hibernateAll',
  schedule: { type: 'interval', intervalMs: 3600000 },
  enabled: true,
})
```

### History and Undo

The REPL keeps a rolling history of the last 500 commands. Navigate with ↑/↓ in the input. The Undo system (`cmd:undo`) reverses the last undoable action by mapping commands to their anti-commands (e.g. `tab.create` → `tab.close`, `lens.set` → `lens.restore`).

### Autocomplete

Press **Tab** to cycle through suggestions. The autocomplete engine searches across all registered commands, user-defined aliases, and saved macros simultaneously, ranked by prefix match. Suggestions display category, argument signature, and description in a compact overlay above the input.

### REPL Sidebar

The left panel has four tabs:

- **Commands** — filterable, categorized list of every available command; click to insert into the input
- **Macros** — all saved macros with run/edit actions
- **Aliases** — all current aliases; click to insert the short form
- **History** — input history in reverse chronological order; click to re-run

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Install

```bash
cd kitsune
npm install
```

### Development

```bash
npm run dev
```

This starts Vite dev server + Electron simultaneously with hot reload.

### Build

```bash
npm run electron:build
```

Produces a native installer in `release/`.

### Configure AI

Open Settings (⌘,) → AI & Intelligence → paste a HackClub API key from [ai.hackclub.com](https://ai.hackclub.com).

Or set it via environment variable before launching:

```bash
ANTHROPIC_API_KEY=sk-hc-v1-... npm run dev
```

---

## Hotkeys

| Hotkey | Action |
|---|---|
| `⌘K` | Command palette |
| `⌘\`` | Command REPL |
| `⌘T` | New tab |
| `⌘W` | Close active tab |
| `⌘\` | Cleave (split layout) |
| `⌘⇧A` | Toggle AI panel |
| `⌘⇧F` | File search |
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
- [ ] REPL hotkey remapping
- [ ] Macro import/export (JSON)

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