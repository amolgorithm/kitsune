// src/renderer/components/Navbar/Navbar.tsx
import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import { TabIPC } from '../../lib/ipc'
import {
  IconBack, IconForward, IconReload, IconStop,
  IconLock, IconLockOpen, IconBookmark, IconShare,
  IconShield, IconSparkle, IconBook, IconDots,
  IconSearch,
} from '../Icons'
import styles from './Navbar.module.css'

export function Navbar() {
  const activeTab          = useActiveTab()
  const activeTabId        = useBrowserStore(s => s.activeTabId)
  const urlBarValue        = useBrowserStore(s => s.urlBarValue)
  const urlBarFocused      = useBrowserStore(s => s.urlBarFocused)
  const aiPanelOpen        = useBrowserStore(s => s.aiPanelOpen)

  const navigateTab        = useBrowserStore(s => s.navigateTab)
  const toggleAIPanel      = useBrowserStore(s => s.toggleAIPanel)
  const openCommandPalette = useBrowserStore(s => s.openCommandPalette)
  const setUrlBarFocused   = useBrowserStore(s => s.setUrlBarFocused)
  const setUrlBarValue     = useBrowserStore(s => s.setUrlBarValue)

  const inputRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState('')

  // Sync local value with active tab URL when not focused
  useEffect(() => {
    if (!urlBarFocused) {
      setLocalValue(formatDisplay(activeTab?.url ?? ''))
    }
  }, [activeTab?.url, urlBarFocused])

  const handleFocus = () => {
    setUrlBarFocused(true)
    setLocalValue(activeTab?.url ?? '')
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleBlur = () => {
    setUrlBarFocused(false)
    setLocalValue(formatDisplay(activeTab?.url ?? ''))
  }

  const commit = () => {
    if (!activeTabId || !localValue.trim()) return
    navigateTab(activeTabId, localValue.trim())
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') {
      setLocalValue(formatDisplay(activeTab?.url ?? ''))
      inputRef.current?.blur()
    }
  }

  const isSecure  = activeTab?.url?.startsWith('https://') ?? false
  const isLoading = activeTab?.status === 'loading'
  const isNewTab  = !activeTab || activeTab.url === 'kitsune://newtab'

  // When AI panel opens/closes, tell main process to resize BrowserView
  useEffect(() => {
    TabIPC.setAIPanelWidth(aiPanelOpen ? 340 : 0)
  }, [aiPanelOpen])

  return (
    <div className={styles.navbar}>
      {/* Nav buttons */}
      <div className={styles.navGroup}>
        <NavBtn title="Back" disabled icon={<IconBack size={15} />} />
        <NavBtn title="Forward" disabled icon={<IconForward size={15} />} />
        <NavBtn
          title={isLoading ? 'Stop' : 'Reload'}
          icon={isLoading ? <IconStop size={15} /> : <IconReload size={15} />}
          onClick={() => {}}
        />
      </div>

      {/* URL bar */}
      <div
        className={`${styles.urlbar} ${urlBarFocused ? styles.urlbarFocused : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <span className={styles.secureIcon}>
          {isNewTab
            ? <IconSearch size={12} className={styles.iconMuted} />
            : isSecure
              ? <IconLock size={11} className={styles.iconGreen} />
              : <IconLockOpen size={11} className={styles.iconRed} />
          }
        </span>

        <input
          ref={inputRef}
          type="text"
          className={styles.urlInput}
          value={urlBarFocused ? localValue : formatDisplay(activeTab?.url ?? '')}
          onChange={e => setLocalValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={isNewTab ? 'Search or enter address…' : ''}
          spellCheck={false}
          aria-label="Address bar"
        />

        {isLoading && <div className={styles.loadingBar} />}

        {!urlBarFocused && !isNewTab && (
          <div className={styles.urlActions}>
            <UrlAction title="Bookmark" icon={<IconBookmark size={12} />} onClick={() => {}} />
            <UrlAction title="Share"    icon={<IconShare size={12} />}    onClick={() => {}} />
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className={styles.navGroup}>
        <button className={styles.shieldBtn} title="Privacy & security">
          <IconShield size={11} />
          <span>Protected</span>
        </button>

        <button
          className={`${styles.aiBtn} ${aiPanelOpen ? styles.aiBtnActive : ''}`}
          onClick={toggleAIPanel}
          title="Toggle AI Panel (⌘⇧A)"
        >
          <IconSparkle size={11} />
          <span>AI</span>
        </button>

        <NavBtn title="Reading mode" icon={<IconBook size={15} />} onClick={() => {}} />
        <NavBtn title="More options"  icon={<IconDots size={15} />} onClick={() => {}} />
      </div>
    </div>
  )
}

function NavBtn({
  icon, title, onClick, disabled,
}: { icon: React.ReactNode; title?: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      className={`${styles.navBtn} ${disabled ? styles.disabled : ''}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {icon}
    </button>
  )
}

function UrlAction({ title, icon, onClick }: { title: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button className={styles.urlActionBtn} title={title} onClick={e => { e.stopPropagation(); onClick() }}>
      {icon}
    </button>
  )
}

function formatDisplay(url: string): string {
  if (!url || url === 'kitsune://newtab') return ''
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname !== '/' ? u.pathname : '') + u.search
  } catch { return url }
}
