# Architecture

Kitsune is a standard Electron application split into two isolated processes. They communicate exclusively through a typed IPC bridge — the renderer has zero direct Node.js access.

## Process Model

```
┌─────────────────────────────────────────────────────────┐
│  Main Process (Node.js)                                 │
│                                                         │
│  TabManager        — BrowserView pool, tab lifecycle    │
│  HibernationScheduler — background RAM manager          │
│  PrivacyEngine     — request filter, fingerprint guard  │
│  AIService         — HackClub API calls                 │
│  WorkspaceManager  — workspaces + tab groups            │
│  CleaveManager     — split-pane layout tree             │
│  SettingsStore     — electron-store backed persistence  │
└───────────────┬─────────────────────────────────────────┘
                │  contextBridge (IPC)
                │  window.kitsune.invoke / .on
┌───────────────▼─────────────────────────────────────────┐
│  Renderer Process (React + TypeScript)                  │
│                                                         │
│  browserStore (Zustand) — all UI state                  │
│  lib/ipc.ts            — typed IPC client               │
│  lib/appearance.ts     — live DOM theming engine        │
│  components/           — React UI tree                  │
└─────────────────────────────────────────────────────────┘
```

## Folder Layout

```
kitsune/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App bootstrap, window creation
│   │   ├── preload.ts           # contextBridge IPC surface
│   │   ├── services/            # Core services (see above)
│   │   └── ipc/                 # IPC handler registration
│   │
│   ├── renderer/                # React renderer
│   │   ├── App.tsx              # Root component, hotkey wiring
│   │   ├── main.tsx             # ReactDOM entry point
│   │   ├── lib/
│   │   │   ├── ipc.ts           # Typed IPC client
│   │   │   └── appearance.ts    # Live appearance engine
│   │   ├── stores/
│   │   │   └── browserStore.ts  # Zustand store — all state
│   │   ├── components/          # React component tree
│   │   └── styles/              # CSS tokens, global, lenses
│   │
│   └── shared/                  # Used by both processes
│       ├── types.ts             # All TypeScript types
│       └── constants.ts         # App-wide constants
│
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## IPC Design

Every renderer→main call goes through `window.kitsune.invoke(channel, ...args)` and returns a Promise. Push events from main→renderer use `window.kitsune.on(channel, listener)`.

The full channel list is in `src/shared/types.ts` under `IPCChannel`. Adding a new feature means:

1. Add the channel name to `IPCChannel`
2. Register a handler in `src/main/ipc/`
3. Call it from `src/renderer/lib/ipc.ts`

## Tab Rendering

Each tab is a Chromium `BrowserView` managed entirely by the main process. The renderer has no `<webview>` element — it just renders a placeholder `<div>` that gives the main process a bounding box. `TabManager.repositionActiveView()` calls `setBounds()` on the active BrowserView to overlay it on that div.

This means:

- No iframe sandboxing issues
- Full Chromium engine per tab
- Tab memory is trackable via `getProcessMemoryInfo()`
- Hibernation is a real webContents destroy, not a CSS `display:none`

## State Management

All renderer state lives in a single Zustand store (`browserStore.ts`) using Immer for immutable updates. The store bootstraps on `init()`, fetches initial data from main via IPC, then subscribes to push events for live updates. There is no other client-side state layer.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Electron 31 |
| UI | React 18 + TypeScript |
| Build | Vite 5 + vite-plugin-electron |
| State | Zustand + Immer |
| AI | HackClub AI proxy (OpenAI-compatible) |
| Persistence | electron-store |
| Styling | CSS Modules + custom properties |
