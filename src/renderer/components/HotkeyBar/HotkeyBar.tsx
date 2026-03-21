// src/renderer/components/HotkeyBar/HotkeyBar.tsx
import styles from './HotkeyBar.module.css'

const HINTS = [
  { key: '⌘K',  label: 'Commands' },
  { key: '⌘T',  label: 'New Tab'  },
  { key: '⌘W',  label: 'Close'    },
  { key: '⌘\\', label: 'Cleave'   },
  { key: '⌘⇧A', label: 'AI'       },
  { key: '⌘,',  label: 'Settings' },
  { key: '⌘⇧F', label: 'Files'    },
  { key: '⌃1',  label: 'Default'  },
  { key: '⌃2',  label: 'Research' },
  { key: '⌃3',  label: 'Code'     },
  { key: '⌃4',  label: 'Read'     },
]

export function HotkeyBar() {
  return (
    <div className={styles.bar}>
      {HINTS.map(h => (
        <div key={h.key} className={styles.hint}>
          <kbd className={styles.key}>{h.key}</kbd>
          <span className={styles.label}>{h.label}</span>
        </div>
      ))}
    </div>
  )
}
