// src/renderer/components/LensBar/LensBar.tsx
import { useBrowserStore } from '../../stores/browserStore'
import { IconGlobe, IconResearch, IconCode, IconBook, IconPalette, IconPlus } from '../Icons'
import styles from './LensBar.module.css'

const LENS_ICONS: Record<string, React.ReactNode> = {
  default:  <IconGlobe    size={12} />,
  research: <IconResearch size={12} />,
  coding:   <IconCode     size={12} />,
  reading:  <IconBook     size={12} />,
  creative: <IconPalette  size={12} />,
}

export function LensBar() {
  const lenses        = useBrowserStore(s => s.lenses)
  const activeLensId  = useBrowserStore(s => s.activeLensId)
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
          {LENS_ICONS[lens.id]}
          <span>{lens.name}</span>
        </button>
      ))}
      <div className={styles.lensDivider} />
      <button className={styles.lensNew} title="Create lens">
        <IconPlus size={11} />
        New Lens
      </button>
    </div>
  )
}
