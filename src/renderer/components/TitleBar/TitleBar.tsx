// src/renderer/components/TitleBar/TitleBar.tsx
// On Windows/Linux the window is frameless so we render the titlebar ourselves.
// On macOS hiddenInset gives us native traffic lights; we just need the drag region.
import styles from './TitleBar.module.css'

const IS_MAC = navigator.userAgent.includes('Macintosh')

export function TitleBar() {
  const invoke = (ch: string) => window.kitsune.invoke(ch as any)

  return (
    <div className={styles.titlebar}>
      {IS_MAC && <div className={styles.trafficLightSpace} />}

      <span className={styles.title}>Kitsune</span>

      {!IS_MAC && (
        <div className={styles.winControls}>
          <button className={styles.winBtn} onClick={() => invoke('window:minimize')} title="Minimize">
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
          </button>
          <button className={styles.winBtn} onClick={() => invoke('window:maximize')} title="Maximize">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="9" height="9"/></svg>
          </button>
          <button className={`${styles.winBtn} ${styles.winClose}`} onClick={() => invoke('window:close')} title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      )}
    </div>
  )
}
