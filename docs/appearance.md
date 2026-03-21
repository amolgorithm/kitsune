# Appearance

All appearance settings are in Settings (`Ctrl+,`) → Appearance. Every change applies instantly with no restart required.

## Themes

Controls the base color palette for backgrounds, surfaces, borders, and text.

| Theme | Character |
|-------|-----------|
| Dark | Default — deep charcoal |
| Light | White surfaces, dark text |
| System | Follows OS dark/light preference |
| Midnight | Deep indigo-tinted dark |
| Forest | Dark green-tinted |
| Volcano | Dark warm brown-red |
| Ocean | Deep blue-tinted dark |
| Dusk | Dark purple-tinted |

## Accent Color

The accent color drives the fox-orange brand color used for active states, the URL bar focus ring, active tab indicators, AI panel elements, and hover states throughout the UI.

| Preset | Hex |
|--------|-----|
| Fox (default) | `#ff6b35` |
| Violet | `#8b5cf6` |
| Cyan | `#06b6d4` |
| Rose | `#f43f5e` |
| Emerald | `#10b981` |
| Amber | `#f59e0b` |
| Indigo | `#6366f1` |
| Pink | `#ec4899` |
| Custom | Any hex via color picker |

## Background Style

Applied to the `.app` root element, behind all chrome panels.

| Style | Description |
|-------|-------------|
| Plain | Solid theme background color |
| Linear Gradient | Two-stop diagonal gradient — colors are configurable |
| Mesh Gradient | Two overlapping radial blobs — colors configurable |
| Accent Glow | Subtle radial glow using the current accent color |
| Dots | Repeating dot grid over the background |
| Grid | Repeating line grid over the background |
| Noise | Solid background — pairs well with grain texture |

For Linear and Mesh gradients a color picker row appears below to set the from/to colors.

## Background Animation

When active, chrome panels (sidebar, navbar, lens bar, status bar) become semi-transparent so the canvas bleeds through. Intensity controls opacity and speed.

| Style | Description |
|-------|-------------|
| None | No animation — fully opaque panels |
| Bubbles | Rising glass orbs with specular highlights |
| Aurora | Flowing northern-lights bands |
| Particles | Connected particle network |
| Ripple | Expanding concentric rings |
| Warp | Starfield / hyperspace streaks |
| Lava Lamp | Slow morphing color blobs |

The Intensity slider (10–100%) controls how strong and fast the effect is.

## Surface Texture

Applies a grain overlay on top of all surfaces using an SVG fractal noise filter.

| Option | Opacity |
|--------|---------|
| Smooth | None |
| Light Grain | ~2.5% |
| Medium Grain | ~5.5% |
| Heavy Grain | ~11% |

## Shape & Layout

**Corners** — Sharp (2px radius), Rounded (default, 10px), or Pill (99px) — applies to all cards, buttons, inputs, and panels.

**Sidebar width** — 180px to 320px. Affects `--k-sidebar-w` which the main process also reads to size BrowserView bounds.

**Tab height** — 28px to 48px. Controls the sidebar tab row height.

**Font scale** — 85% to 120%. Scales the base font size from 11px to 15.6px.

**Sidebar glass blur** — Enables `backdrop-filter: blur(28px)` on the sidebar, creating a frosted glass effect when combined with any animation.

## Sidebar Position

Move the sidebar to the left (default) or right side of the window. The BrowserView layout adjusts automatically.

## How It Works Internally

The appearance engine lives in `src/renderer/lib/appearance.ts`. It is called via `applyAppearance(settings.appearance)` from the Zustand store whenever settings change. It:

1. Resolves the theme palette and writes all color tokens as inline CSS custom properties on `:root`
2. Sets accent color tokens
3. Adjusts `--k-panel-bg` and `--k-panel-surface` opacity when animation is active
4. Applies the background style to the `.app` element
5. Sets `data-texture`, `data-animated`, and `data-sidebar-blur` attributes on `:root` which drive CSS rules in `appearance.css`
6. Starts or stops the canvas animation

The canvas is inserted as the first child of `.app` at `z-index: 0`. All chrome components have higher z-indices so they always sit above the canvas.
