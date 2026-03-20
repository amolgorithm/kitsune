// src/renderer/components/StatusBar/StatusBar.tsx
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import styles from './StatusBar.module.css'

export function StatusBar() {
  const activeTab  = useActiveTab()
  const tabs       = useBrowserStore(s => s.tabs)

  const hibernated = tabs.filter(t => t.hibernated).length
  const totalMemMB = Math.round(tabs.reduce((a, t) => a + t.memoryBytes, 0) / (1024 * 1024))
  const isLoading  = activeTab?.status === 'loading'

  return (
    <div className={styles.bar}>
      {/* Left: status dot + current status */}
      <div className={styles.left}>
        <div className={`${styles.dot} ${isLoading ? styles.dotYellow : styles.dotGreen}`} />
        <span>{isLoading ? `Loading ${activeTab?.url ?? ''}` : 'Ready'}</span>
        {activeTab?.riskScore !== undefined && activeTab.riskScore > 0.15 && (
          <>
            <div className={styles.sep} />
            <span className={styles.riskBadge} style={{ color: riskColor(activeTab.riskScore) }}>
              ⚠ Risk {Math.round(activeTab.riskScore * 100)}%
            </span>
          </>
        )}
      </div>

      {/* Right: memory, tabs, AI status */}
      <div className={styles.right}>
        {hibernated > 0 && (
          <span className={styles.item}>💤 {hibernated} hibernated</span>
        )}
        {totalMemMB > 0 && (
          <span className={styles.item}>{totalMemMB} MB</span>
        )}
        <div className={styles.sep} />
        <span className={styles.item}>{tabs.length} tabs</span>
        <div className={styles.sep} />
        <span className={`${styles.item} ${styles.aiStatus}`}>✦ AI ready</span>
      </div>
    </div>
  )
}

function riskColor(score: number): string {
  if (score < 0.35) return 'var(--k-yellow)'
  if (score < 0.60) return 'var(--k-fox)'
  return 'var(--k-red)'
}


