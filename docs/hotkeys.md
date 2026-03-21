# Hotkeys

All hotkeys use `Ctrl` on Windows/Linux and `Cmd` on macOS.

## Global

| Hotkey | Action |
|--------|--------|
| `Ctrl+K` | Open Command Palette |
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close active tab |
| `Ctrl+\` | Open Cleave split layout |
| `Ctrl+Shift+A` | Toggle AI panel |
| `Ctrl+Shift+F` | Toggle File Search |
| `Ctrl+Shift+R` | Toggle reading mode |
| `Ctrl+,` | Open Settings |

## Lens Profiles

| Hotkey | Lens |
|--------|------|
| `Ctrl+1` | Default |
| `Ctrl+2` | Research |
| `Ctrl+3` | Coding |
| `Ctrl+4` | Reading |

## Navigation

| Hotkey | Action |
|--------|--------|
| `Alt+Left` | Go back |
| `Alt+Right` | Go forward |
| `Ctrl+R` | Reload |

## Command Palette

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Execute selected command |
| `Escape` | Close |

## Cleave Overlay

| Key | Action |
|-----|--------|
| `H` | Split Horizontal |
| `V` | Split Vertical |
| `A` | AI Beside |
| `T` | Three-Way |
| `W` | By Workspace |
| `G` | By Group |
| `R` | Reset layout |
| `Escape` | Close |

## URL Bar

| Key | Action |
|-----|--------|
| `Enter` | Navigate to URL or search |
| `Escape` | Cancel and restore previous URL |

## AI Chat

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |

## Customization

Hotkeys are stored in `settings.hotkeys` (a `Record<string, string>` in `KitsuneSettings`). UI for remapping is on the roadmap — for now edit the defaults in `src/shared/types.ts` under `DEFAULT_SETTINGS.hotkeys`.
