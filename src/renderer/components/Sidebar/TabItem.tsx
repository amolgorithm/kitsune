// src/renderer/components/Sidebar/TabItem.tsx
import { useBrowserStore } from '../../stores/browserStore'
import type { KitsuneTab } from '../../../shared/types'
import styles from './TabItem.module.css'

interface TabItemProps {
  tab: KitsuneTab
  isActive: boolean
}

export function TabItem({ tab, isActive }: TabItemProps) {
  const activateTab = useBrowserStore(s => s.activateTab)
  const closeTab    = useBrowserStore(s => s.closeTab)
  const wakeTab     = useBrowserStore(s => s.wakeTab)

  const handleClick = () => {
    if (tab.hibernated) wakeTab(tab.id)
    else activateTab(tab.id)
  }

  const riskColor =
    !tab.riskScore            ? undefined
    : tab.riskScore < 0.15    ? undefined          // safe — no badge
    : tab.riskScore < 0.35    ? 'var(--k-yellow)'
    : tab.riskScore < 0.60    ? 'var(--k-fox)'
    :                            'var(--k-red)'

  return (
    <div
      role="tab"
      aria-selected={isActive}
      className={`${styles.tab} ${isActive ? styles.tabActive : ''} ${tab.hibernated ? styles.tabHibernated : ''}`}
      onClick={handleClick}
      title={tab.url}
    >
      {/* Active indicator */}
      {isActive && <div className={styles.activeBar} />}

      {/* Favicon */}
      <div className={styles.favicon}>
        {tab.favicon
          ? <img src={tab.favicon} width={14} height={14} alt="" />
          : <FaviconFallback url={tab.url} />
        }
        {tab.status === 'loading' && <div className={styles.loadingRing} />}
      </div>

      {/* Title */}
      <span className={styles.title}>{tab.title || tab.url}</span>

      {/* Badges (hidden on hover — close button shows instead) */}
      <div className={styles.badges}>
        {tab.hibernated && (
          <span className={styles.badge} style={{ background: 'var(--k-yellow-dim)', color: 'var(--k-yellow)' }}>
            💤
          </span>
        )}
        {tab.aiClusterLabel && !tab.hibernated && (
          <span className={styles.badge} style={{ background: 'var(--k-ai-dim)', color: 'var(--k-ai-2)' }}>
            ✦
          </span>
        )}
        {riskColor && (
          <span className={styles.riskDot} style={{ background: riskColor }} title={`Risk score: ${Math.round((tab.riskScore ?? 0) * 100)}%`} />
        )}
        {tab.isPinned && <span className={styles.pinIcon}>📌</span>}
      </div>

      {/* Close button — shown on hover */}
      <button
        className={styles.closeBtn}
        onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
        title="Close tab"
        aria-label="Close tab"
      >
        ×
      </button>
    </div>
  )
}

function FaviconFallback({ url }: { url: string }) {
  // Pick an emoji based on URL pattern
  if (url.startsWith('kitsune://')) return <span>🦊</span>
  if (url.includes('github'))       return <span>🐙</span>
  if (url.includes('google'))       return <span>🔍</span>
  if (url.includes('youtube'))      return <span>▶</span>
  if (url.includes('twitter') || url.includes('x.com')) return <span>✕</span>
  return <span>🌐</span>
}


