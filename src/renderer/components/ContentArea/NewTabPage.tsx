// src/renderer/components/ContentArea/NewTabPage.tsx
import { useState } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { IconSearch, IconGlobe, IconCode, IconBook, IconGitHub, IconFile } from '../Icons'
import styles from './NewTabPage.module.css'

const QUICK_LINKS = [
  { icon: <IconGitHub size={18} />,  label: 'GitHub',    url: 'https://github.com' },
  { icon: <IconGlobe size={18} />,   label: 'HN',        url: 'https://news.ycombinator.com' },
  { icon: <IconCode size={18} />,    label: 'MDN',       url: 'https://developer.mozilla.org' },
  { icon: <IconFile size={18} />,    label: 'Docs',      url: 'https://docs.anthropic.com' },
  { icon: <IconBook size={18} />,    label: 'Wikipedia', url: 'https://wikipedia.org' },
  { icon: <IconSearch size={18} />,  label: 'Search',    url: 'https://google.com' },
]

export function NewTabPage() {
  const [query, setQuery]  = useState('')
  const activeTabId        = useBrowserStore(s => s.activeTabId)
  const navigateTab        = useBrowserStore(s => s.navigateTab)
  const tabs               = useBrowserStore(s => s.tabs)

  const hibernated = tabs.filter(t => t.hibernated).length
  const totalMB    = Math.round(tabs.reduce((a, t) => a + t.memoryBytes, 0) / (1024 * 1024))

  const navigate = (url: string) => {
    if (activeTabId) navigateTab(activeTabId, url)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    const url = query.includes('.')
      ? query.startsWith('http') ? query : `https://${query}`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`
    navigate(url)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.greeting}>
          <h1 className={styles.greetingText}>{greeting}.</h1>
          <p className={styles.greetingSub}>Where are we going?</p>
        </div>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <div className={styles.searchBox}>
            <IconSearch size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search or enter URL…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button type="submit" className={styles.searchSubmit}>
                Go
              </button>
            )}
          </div>
        </form>

        <div className={styles.quickLinks}>
          {QUICK_LINKS.map(link => (
            <button
              key={link.url}
              className={styles.quickLink}
              onClick={() => navigate(link.url)}
            >
              <span className={styles.quickLinkIcon}>{link.icon}</span>
              <span className={styles.quickLinkLabel}>{link.label}</span>
            </button>
          ))}
        </div>

        {(tabs.length > 1 || hibernated > 0) && (
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statVal}>{tabs.length}</span>
              <span className={styles.statLabel}>tabs open</span>
            </div>
            {hibernated > 0 && (
              <>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statVal}>{hibernated}</span>
                  <span className={styles.statLabel}>hibernated</span>
                </div>
              </>
            )}
            {totalMB > 0 && (
              <>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                  <span className={styles.statVal}>{totalMB}MB</span>
                  <span className={styles.statLabel}>memory</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
