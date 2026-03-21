# Getting Started

## Prerequisites

- Node.js **v20 or later** — check with `node --version`
- npm **v10 or later** — check with `npm --version`

## Install

```bash
git clone https://github.com/your-org/kitsune
cd kitsune
npm install
```

If you see peer dependency warnings they are safe to ignore. The `.npmrc` already sets `legacy-peer-deps=true`.

## Run in Development

```bash
npm run dev
```

This starts Vite (which builds the main process, preload script, and renderer simultaneously) and launches Electron automatically via `vite-plugin-electron`. **Do not run `electron .` directly** — the plugin handles that.

## Build for Distribution

```bash
npm run electron:build
```

Output goes to `release/`. Produces platform-native installers:

| Platform | Format |
|----------|--------|
| macOS | `.dmg` + `.zip` |
| Windows | `.exe` (NSIS) + portable |
| Linux | `.AppImage` + `.deb` |

## Configure AI

AI works out of the box — a shared HackClub API key is bundled in the default settings. To use your own:

**Option 1 — In the app:**
1. Launch with `npm run dev`
2. Press `Ctrl+,` to open Settings
3. Go to **AI & Intelligence**
4. Paste your key from [ai.hackclub.com](https://ai.hackclub.com)

**Option 2 — Environment variable:**

```bash
# macOS / Linux
ANTHROPIC_API_KEY=sk-ant-... npm run dev

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."; npm run dev

# Windows CMD
set ANTHROPIC_API_KEY=sk-ant-... && npm run dev
```

## Troubleshooting

**"Cannot find module dist-electron/main/index.js"**
Run `npm run dev`, not `electron .`. The plugin must build first.

**"Failed to load module script" MIME type error**
Delete `dist-electron/` and `dist/` then re-run `npm run dev`.

**electron-store errors**
Make sure you are on Node 20+.

**npm install fails**
Run `npm install --legacy-peer-deps` manually.
