# Kitsune — Setup & Run Guide

## Prerequisites
- Node.js **v20 or later** (`node --version`)
- npm **v10 or later** (`npm --version`)

## Install

```bash
npm install
```

> If you see peer dependency warnings, they're safe to ignore.
> The `.npmrc` already sets `legacy-peer-deps=true`.

## Run in Development

```bash
npm run dev
```

This single command starts Vite (which builds the main process, preload, 
and renderer simultaneously) and launches Electron automatically via 
`vite-plugin-electron/simple`.

**Do NOT run `electron .` manually** — the plugin handles that.

## Configure AI (optional)

1. Launch the app with `npm run dev`
2. Press `⌘,` (or `Ctrl+,`) to open Settings
3. Go to **AI & Intelligence**
4. Paste your Anthropic API key (`sk-ant-...`)

Or set via env var before running:
```bash
# macOS/Linux
ANTHROPIC_API_KEY=sk-ant-... npm run dev

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."; npm run dev

# Windows CMD
set ANTHROPIC_API_KEY=sk-ant-... && npm run dev
```

## Build for Distribution

```bash
npm run electron:build
```

Output goes to `release/`.

## Troubleshooting

### "Cannot find module dist-electron/main/index.js"
Run `npm run dev` (not `electron .`). The plugin must build first.

### "Failed to load module script" MIME type error  
Delete `dist-electron/` and `dist/` folders then re-run `npm run dev`.

### electron-store errors
Make sure you're on Node 20+. Run `node --version` to check.

### npm install fails
Run `npm install --legacy-peer-deps` manually.

## Key Hotkeys

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘T` / `Ctrl+T` | New tab |
| `⌘W` / `Ctrl+W` | Close tab |
| `⌘\` / `Ctrl+\` | Cleave split layout |
| `⌘⇧A` / `Ctrl+Shift+A` | Toggle AI panel |
| `⌘,` / `Ctrl+,` | Settings |
