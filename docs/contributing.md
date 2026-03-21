# Contributing

## Dev Setup

```bash
git clone https://github.com/your-org/kitsune
cd kitsune
npm install
npm run dev
```

Node 20+ required. The single `npm run dev` command starts Vite and launches Electron with hot reload for both the renderer and main process.

## Project Rules

**Never import Node modules in renderer files.** The renderer runs in a sandboxed context with context isolation on. Any Node or Electron access must go through the IPC bridge.

**Never add raw values to components.** Colors, spacing, font sizes, and radii all live in `src/renderer/styles/tokens.css` as CSS custom properties. Use the `--k-*` tokens.

**Types live in `src/shared/types.ts`.** Both processes import from there. If you need a new type that spans the IPC boundary, add it there.

## Adding a Feature

### New IPC channel

1. Add the channel string to the `IPCChannel` union in `src/shared/types.ts`
2. Register a handler in the appropriate file under `src/main/ipc/`
3. Add a typed wrapper function in `src/renderer/lib/ipc.ts`
4. Call it from a store action in `src/renderer/stores/browserStore.ts` or directly from a component

### New AI feature

1. Add a method to `AIService` in `src/main/services/AIService.ts`
2. Wire an IPC handler in `src/main/ipc/aiIPC.ts`
3. Add the IPC wrapper to `AIIPC` in `src/renderer/lib/ipc.ts`
4. Use it from a store action or component

### New settings key

1. Add the field to the `KitsuneSettings` interface in `src/shared/types.ts`
2. Add a default value in `DEFAULT_SETTINGS`
3. Render a control in `src/renderer/components/Settings/SettingsModal.tsx`
4. Apply any side effects in `applySettingsToDOM` in `browserStore.ts` or in a service constructor

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server + Electron |
| `npm run build` | Build renderer only |
| `npm run electron:build` | Full production build + installer |
| `npm run typecheck` | Run TypeScript compiler (no emit) |
| `npm run lint` | Run ESLint on src/ |

## Pull Requests

- One feature or fix per PR — keep diffs reviewable
- `npm run typecheck` must pass with no errors
- Test on your platform before submitting
- Describe what changed and why in the PR body
- Reference any related issues

## File Naming

- React components: `PascalCase.tsx` with a co-located `PascalCase.module.css`
- Services: `PascalCase.ts`
- IPC files: `camelCaseIPC.ts`
- Shared utilities: `camelCase.ts`

## Known Rough Edges

These are known issues in the current codebase that contributors should be aware of:

- `kitsune://newtab` is handled as a React page fallback — there is no native protocol handler registered yet
- The Cleave split panes use fixed 50/50 bounds — ResizablePanels drag handles are not wired yet
- `HotkeyBar` remapping is display-only — live remapping is not implemented
- `FileSearch` extracts PDF text with a basic byte-scan fallback — PDF.js integration would improve quality on complex PDFs
