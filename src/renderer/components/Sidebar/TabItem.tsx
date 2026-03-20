// src/renderer/components/Sidebar/TabItem.tsx
import { useBrowserStore } from '../../stores/browserStore'
import type { KitsuneTab } from '../../../shared/types'
import {
  IconClose, IconSleep, IconGlobe, IconGitHub, IconPageDefault,
  IconSparkle, IconWarning, IconLoading,
} from '../Icons'
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

  const riskHigh = (tab.riskScore ?? 0) >= 0.6

  return (
    <div
      role="tab"
      aria-selected={isActive}
      className={`${styles.tab} ${isActive ? styles.active : ''} ${tab.hibernated ? styles.hibernated : ''}`}
      onClick={handleClick}
      title={tab.url}
    >
      {isActive && <div className={styles.activeBar} />}

      <div className={styles.favicon}>
        {tab.status === 'loading' ? (
          <div className={styles.spinner}>
            <IconLoading size={14} />
          </div>
        ) : tab.favicon ? (
          <img src={tab.favicon} width={14} height={14} alt="" draggable={false} />
        ) : (
          <FaviconIcon url={tab.url} />
        )}
      </div>

      <span className={styles.title}>{tab.title || new URL(tab.url.startsWith('http') ? tab.url : 'https://x.com').hostname}</span>

      <div className={styles.badges}>
        {tab.hibernated && <IconSleep size={12} className={styles.badgeSleep} />}
        {tab.aiClusterLabel && !tab.hibernated && <IconSparkle size={11} className={styles.badgeAI} />}
        {riskHigh && <IconWarning size={11} className={styles.badgeRisk} />}
      </div>

      <button
        className={styles.closeBtn}
        onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
        title="Close tab"
      >
        <IconClose size={10} />
      </button>
    </div>
  )
}

function FaviconIcon({ url }: { url: string }) {
  if (url === 'kitsune://newtab') return <IconPageDefault size={14} />
  if (url.includes('github.com'))  return <IconGitHub size={14} />
  return <IconGlobe size={14} />
}
