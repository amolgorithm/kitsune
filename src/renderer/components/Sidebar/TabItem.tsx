// src/renderer/components/Sidebar/TabItem.tsx
import { useBrowserStore } from '../../stores/browserStore'
import type { KitsuneTab } from '../../../shared/types'
import {
  IconClose, IconSleep, IconPageDefault,
  IconSparkle, IconWarning, IconLoading, IconGlobe,
} from '../Icons'
import styles from './TabItem.module.css'

interface TabItemProps {
  tab: KitsuneTab
  isActive: boolean
  indent?: boolean
}

// Google's favicon service — returns the real website icon instantly
function getFaviconUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol === 'kitsune:' || u.protocol === 'about:') return null
    // Use Google's S2 favicon service (fast, cached, 32px)
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`
  } catch {
    return null
  }
}

export function TabItem({ tab, isActive, indent }: TabItemProps) {
  const activateTab = useBrowserStore(s => s.activateTab)
  const closeTab    = useBrowserStore(s => s.closeTab)
  const wakeTab     = useBrowserStore(s => s.wakeTab)

  const handleClick = () => {
    if (tab.hibernated) wakeTab(tab.id)
    else activateTab(tab.id)
  }

  const riskHigh   = (tab.riskScore ?? 0) >= 0.6
  const ramMB      = tab.memoryBytes > 0
    ? (tab.memoryBytes / (1024 * 1024)).toFixed(0) : null
  const faviconUrl = tab.favicon ?? getFaviconUrl(tab.url)
  const isNewTab   = tab.url === 'kitsune://newtab'

  return (
    <div
      role="tab"
      aria-selected={isActive}
      className={[
        styles.tab,
        isActive      ? styles.active     : '',
        tab.hibernated ? styles.hibernated : '',
        indent         ? styles.indent    : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      title={`${tab.url}${ramMB ? ` · ${ramMB}MB` : ''}`}
    >
      {isActive && <div className={styles.activeBar} />}

      <div className={styles.favicon}>
        {tab.status === 'loading' ? (
          <div className={styles.spinner}><IconLoading size={14} className={styles.spin} /></div>
        ) : isNewTab ? (
          <IconPageDefault size={14} />
        ) : faviconUrl ? (
          <img
            src={faviconUrl}
            width={14}
            height={14}
            alt=""
            draggable={false}
            onError={e => {
              // If Google favicon fails, hide img and show globe
              const img = e.currentTarget
              img.style.display = 'none'
              const globe = img.nextElementSibling as HTMLElement | null
              if (globe) globe.style.display = 'flex'
            }}
          />
        ) : null}
        {/* Globe fallback — hidden by default, shown on img error */}
        {!isNewTab && <span style={{ display: 'none' }}><IconGlobe size={14} /></span>}
      </div>

      <span className={styles.title}>
        {tab.title || (isNewTab ? 'New Tab' : (() => {
          try { return new URL(tab.url).hostname } catch { return tab.url }
        })())}
      </span>

      <div className={styles.badges}>
        {tab.hibernated && <IconSleep size={11} className={styles.badgeSleep} />}
        {tab.aiClusterLabel && !tab.hibernated && <IconSparkle size={11} className={styles.badgeAI} />}
        {riskHigh && <IconWarning size={11} className={styles.badgeRisk} />}
        {ramMB && !tab.hibernated && (
          <span className={styles.ramBadge}>{ramMB}M</span>
        )}
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
