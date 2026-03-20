// src/renderer/components/StatusBar/StatusBar.tsx
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import { IconShield, IconSparkle, IconCircleFill } from '../Icons'
import styles from './StatusBar.module.css'

export function StatusBar() {
  const activeTab  = useActiveTab()
  const tabs       = useBrowserStore(s => s.tabs)

  const hibernated = tabs.filter(t => t.hibernated).length
  const totalMemMB = Math.round(tabs.reduce((a, t) => a + t.memoryBytes, 0) / (1024 * 1024))
  const isLoading  = activeTab?.status === 'loading'

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <IconCircleFill
          size={6}
          className={isLoading ? styles.dotLoading : styles.dotReady}
        />
        <span className={styles.item}>
          {isLoading ? `Loading…` : activeTab?.url === 'kitsune://newtab' ? 'New Tab' : 'Ready'}
        </span>
        {activeTab?.riskScore !== undefined && activeTab.riskScore > 0.35 && (
          <>
            <div className={styles.sep} />
            <span className={styles.riskItem} style={{ color: riskColor(activeTab.riskScore) }}>
              Risk {Math.round(activeTab.riskScore * 100)}%
            </span>
          </>
        )}
      </div>

      <div className={styles.right}>
        <span className={styles.item}>
          <IconShield size={10} className={styles.iconGreen} />
          {hibernated > 0 ? `${hibernated} sleeping` : 'Protected'}
        </span>
        <div className={styles.sep} />
        <span className={styles.item}>{tabs.length} tab{tabs.length !== 1 ? 's' : ''}</span>
        {totalMB > 0 && (
          <>
            <div className={styles.sep} />
            <span className={styles.item}>{totalMB}MB</span>
          </>
        )}
        <div className={styles.sep} />
        <span className={`${styles.item} ${styles.aiItem}`}>
          <IconSparkle size={10} />
          AI
        </span>
      </div>
    </div>
  )

  function totalMB() { return totalMemMB }
}

function riskColor(score: number) {
  if (score < 0.6) return 'var(--k-yellow)'
  return 'var(--k-red)'
}
