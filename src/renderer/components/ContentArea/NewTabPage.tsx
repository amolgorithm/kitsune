// src/renderer/components/ContentArea/NewTabPage.tsx
import { useState } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import styles from './NewTabPage.module.css'

const QUICK_LINKS = [
  { icon: '🐙', label: 'GitHub',    url: 'https://github.com' },
  { icon: '📰', label: 'HN',        url: 'https://news.ycombinator.com' },
  { icon: '🤖', label: 'Claude',    url: 'https://claude.ai' },
  { icon: '📦', label: 'npm',       url: 'https://npmjs.com' },
  { icon: '🗺️', label: 'Maps',      url: 'https://maps.google.com' },
  { icon: '📊', label: 'Linear',    url: 'https://linear.app' },
]

export function NewTabPage() {
  const [query, setQuery] = useState('')
  const createTab    = useBrowserStore(s => s.createTab)
  const activeTabId  = useBrowserStore(s => s.activeTabId)
  const navigateTab  = useBrowserStore(s => s.navigateTab)
  const tabs         = useBrowserStore(s => s.tabs)

  const hibernated = tabs.filter(t => t.hibernated).length
  const totalMB    = Math.round(tabs.reduce((a, t) => a + t.memoryBytes, 0) / (1024 * 1024))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || !activeTabId) return
    navigateTab(activeTabId, query)
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Greeting */}
        <div className={styles.greeting}>
          <span className={styles.greetingFox}>🦊</span>
          <h1 className={styles.greetingText}>Good afternoon.</h1>
          <p className={styles.greetingSub}>What are we researching today?</p>
        </div>

        {/* Search bar */}
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <div className={styles.searchBox}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchIcon}>
              <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search or enter a URL…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            <kbd className={styles.searchKbd}>↵</kbd>
          </div>
        </form>

        {/* Quick links */}
        <div className={styles.quickLinks}>
          {QUICK_LINKS.map(link => (
            <button
              key={link.url}
              className={styles.quickLink}
              onClick={() => activeTabId && navigateTab(activeTabId, link.url)}
            >
              <span className={styles.quickLinkIcon}>{link.icon}</span>
              <span className={styles.quickLinkLabel}>{link.label}</span>
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statVal}>{tabs.length}</span>
            <span className={styles.statLabel}>open tabs</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statVal}>{hibernated}</span>
            <span className={styles.statLabel}>hibernated</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statVal}>{totalMB > 0 ? `${totalMB}MB` : '—'}</span>
            <span className={styles.statLabel}>memory used</span>
          </div>
        </div>
      </div>
    </div>
  )
}
