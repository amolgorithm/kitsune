// src/renderer/components/HotkeyBar/HotkeyBar.tsx
// ─────────────────────────────────────────────────────────────────
import hotkeyStyles from './HotkeyBar.module.css'

const HINTS = [
  { key: '⌘K',  label: 'Commands' },
  { key: '⌘T',  label: 'New Tab' },
  { key: '⌘W',  label: 'Close' },
  { key: '⌘\\', label: 'Cleave' },
  { key: '⌘⇧A', label: 'AI Panel' },
  { key: '⌘⇧R', label: 'Reader' },
  { key: '⌘,',  label: 'Settings' },
  { key: '⌃1',  label: 'Default Lens' },
  { key: '⌃2',  label: 'Research' },
  { key: '⌃3',  label: 'Coding' },
  { key: '⌃4',  label: 'Reading' },
]

export function HotkeyBar() {
  return (
    <div className={hotkeyStyles.bar}>
      {HINTS.map(h => (
        <div key={h.key} className={hotkeyStyles.hint}>
          <kbd className={hotkeyStyles.key}>{h.key}</kbd>
          <span className={hotkeyStyles.label}>{h.label}</span>
        </div>
      ))}
    </div>
  )
}
