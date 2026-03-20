// src/renderer/components/LensBar/LensBar.tsx
import { useBrowserStore } from '../../stores/browserStore'
import styles from './LensBar.module.css'

export function LensBar() {
  const lenses       = useBrowserStore(s => s.lenses)
  const activeLensId = useBrowserStore(s => s.activeLensId)
  const setActiveLens = useBrowserStore(s => s.setActiveLens)

  return (
    <div className={styles.lensBar} role="toolbar" aria-label="Lens profiles">
      {lenses.map(lens => (
        <button
          key={lens.id}
          className={`${styles.lensItem} ${lens.id === activeLensId ? styles.lensActive : ''}`}
          onClick={() => setActiveLens(lens.id)}
          title={lens.description}
        >
          <span className={styles.lensIcon}>{lens.icon}</span>
          {lens.name}
        </button>
      ))}
      <div className={styles.lensDivider} />
      <button className={styles.lensNew} title="Create custom lens">+ New Lens</button>
    </div>
  )
}
