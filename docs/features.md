# Features

## Smart Tab Manager

Each tab is a real Chromium `BrowserView` — not an iframe, not a webview element. This means full browser engine fidelity, accurate memory tracking, and real process isolation per tab.

**Hibernation** suspends idle background tabs by destroying their webContents while preserving all tab metadata (URL, title, favicon, scroll position on wake). A background scheduler checks every 30 seconds. Under memory pressure (configurable cap in Settings → Tabs) the idle threshold halves automatically. Pinned tabs and the active tab are never hibernated.

**Tab groups** are color-coded and collapsible. Groups tagged with ✦ were created by AI clustering. Each collapsed group shows an estimated MB saved from sleeping tabs inside it.

**Workspaces** are isolated tab namespaces. Switch between them from the sidebar pill row. Each workspace has its own tab list, groups, notes, and bookmarks. You can create new workspaces inline from the sidebar.

## AI Panel

Open with `Ctrl+Shift+A` or the AI button in the navbar. The panel has five tabs:

**Summary** — auto-triggers when you navigate to a page. Returns key points, notable stats, and reference links as structured output. Summaries are cached per tab for the session so navigating back doesn't re-trigger.

**Research** — cross-page synthesis. Select multiple open tabs on a topic and AI produces a single cited document pulling from all of them.

**Notes** — highlight text on any page, AI converts it into a structured Markdown note with a title, organized content, and a citation back to the source URL.

**Tasks** — highlight action items on any page, AI extracts them as structured to-dos with optional due dates.

**Chat** — full conversation with the current page's content injected as context. Quick-prompt buttons for common queries. Streaming-ready (currently returns full response).

## Universal File Search

Open with `Ctrl+Shift+F`. Upload any combination of PDFs, text files, code, CSVs, emails, or logs. Ask questions in natural language across all uploaded files simultaneously.

- AI searches the full corpus and returns a synthesized answer with relevance-scored source excerpts
- Answers are linked to whatever page you are currently browsing when relevant
- Per-file AI summary available with one click
- Drag-and-drop or click-to-upload
- Files stay in memory for the session only — nothing is written to disk

Supported formats: `.pdf`, `.txt`, `.md`, `.csv`, `.json`, `.js`, `.ts`, `.tsx`, `.jsx`, `.py`, `.rb`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.h`, `.cs`, `.eml`, `.log`, `.xml`, `.html`, `.css`

## Cleave (Split Layout)

Open with `Ctrl+\`. Choose a split mode:

| Mode | Description |
|------|-------------|
| Split Horizontal | Two panes side by side |
| Split Vertical | Two panes stacked |
| AI Beside | Active tab + AI panel in a 65/35 split |
| Three-Way | Reference, work, and AI pane |
| By Workspace | Tabs from different workspaces |
| By Group | Expand a tab group across panes |

Each mode has a visual SVG preview before you apply it. Press Reset to return to single-pane mode.

## Command Palette

Open with `Ctrl+K`. Fuzzy search across all commands, open tabs, lens profiles, and AI actions. Keyboard navigation with arrow keys, Enter to execute, Escape to close. Results are grouped by category with hotkey hints shown inline.

## Lens Profiles

Lenses are named browsing contexts that restyle the UI and set AI defaults.

| Lens | Accent | Default AI Tab | Notes |
|------|--------|----------------|-------|
| Default | Fox orange | Summary | Standard mode |
| Research | AI purple | Research | Cross-page synthesis focus |
| Coding | Cyan | Chat | Mono font throughout |
| Reading | Muted | Notes | Minimal sidebar, no lens bar |
| Creative | Pink | Chat | Warm accent |

Switch with `Ctrl+1` through `Ctrl+4` or via the lens bar below the navbar.

## Privacy Engine

All network requests pass through `session.webRequest.onBeforeRequest` before any TCP connection is made.

- Seed blocklist of ~25 known tracker and ad domains active from first launch
- Heuristic regex patterns catch analytics, advertising, fingerprinting, social pixels, and crypto miners not on the list
- Per-tab block log — every blocked request is recorded with its category and timestamp
- Risk report available per tab combining blocked tracker categories into a 0–1 score
- Fingerprint guard adds `Permissions-Policy` headers to external responses (camera, microphone, geolocation denied)
- Private tabs use ephemeral `partition` sessions that never touch disk

## Settings

Open with `Ctrl+,`. Sections:

- **AI & Intelligence** — API key, model selection, enable/disable features
- **Tabs & Memory** — hibernation threshold, memory cap per tab
- **Privacy & Security** — toggle each protection independently
- **Appearance** — full live-preview customization (see [Appearance docs](./appearance.md))
- **Hotkeys** — full keyboard reference (read-only in this release)
- **About** — version info
