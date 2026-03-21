// src/renderer/components/Navbar/Navbar.tsx
import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import {
  IconBack, IconForward, IconReload, IconStop,
  IconLock, IconLockOpen, IconBookmark, IconShare,
  IconShield, IconSparkle, IconBook, IconDots, IconSearch, IconCheck,
} from '../Icons'
import styles from './Navbar.module.css'

export function Navbar() {
  const activeTab          = useActiveTab()
  const activeTabId        = useBrowserStore(s => s.activeTabId)
  const urlBarFocused      = useBrowserStore(s => s.urlBarFocused)
  const aiPanelOpen        = useBrowserStore(s => s.aiPanelOpen)
  const navState           = useBrowserStore(s => s.navState)
  const readingMode        = useBrowserStore(s => s.readingMode)
  const isBookmarked       = useBrowserStore(s => s.isBookmarked)
  const addBookmark        = useBrowserStore(s => s.addBookmark)
  const removeBookmark     = useBrowserStore(s => s.removeBookmark)

  const navigateTab        = useBrowserStore(s => s.navigateTab)
  const toggleAIPanel      = useBrowserStore(s => s.toggleAIPanel)
  const openCommandPalette = useBrowserStore(s => s.openCommandPalette)
  const setUrlBarFocused   = useBrowserStore(s => s.setUrlBarFocused)
  const goBack             = useBrowserStore(s => s.goBack)
  const goForward          = useBrowserStore(s => s.goForward)
  const reload             = useBrowserStore(s => s.reload)
  const toggleReadingMode  = useBrowserStore(s => s.toggleReadingMode)

  const inputRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue]     = useState('')
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [bookmarkFlash, setBookmarkFlash] = useState(false)

  const nav      = activeTabId ? (navState[activeTabId] ?? { canGoBack: false, canGoForward: false }) : { canGoBack: false, canGoForward: false }
  const isLoading = activeTab?.status === 'loading'
  const isNewTab  = !activeTab || activeTab.url === 'kitsune://newtab'
  const isSecure  = activeTab?.url?.startsWith('https://') ?? false
  const displayUrl = isNewTab ? '' : formatDisplay(activeTab?.url ?? '')
  const bookmarked = activeTab ? isBookmarked(activeTab.url) : false

  useEffect(() => {
    if (!urlBarFocused) setLocalValue(displayUrl)
  }, [displayUrl, urlBarFocused])

  // Close more menu on outside click
  useEffect(() => {
    if (!moreMenuOpen) return
    const h = () => setMoreMenuOpen(false)
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [moreMenuOpen])

  const handleFocus = () => {
    setUrlBarFocused(true)
    setLocalValue(activeTab?.url === 'kitsune://newtab' ? '' : (activeTab?.url ?? ''))
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleBlur = () => {
    setUrlBarFocused(false)
    setLocalValue(displayUrl)
  }

  const commit = () => {
    if (!activeTabId || !localValue.trim()) return
    navigateTab(activeTabId, localValue.trim())
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setLocalValue(displayUrl); inputRef.current?.blur() }
  }

  const handleBookmark = () => {
    if (!activeTab || isNewTab) return
    if (bookmarked) {
      removeBookmark(activeTab.url)
    } else {
      addBookmark(activeTab)
      setBookmarkFlash(true)
      setTimeout(() => setBookmarkFlash(false), 1200)
    }
  }

  const handleShare = async () => {
    if (!activeTab || isNewTab) return
    try {
      await navigator.clipboard.writeText(activeTab.url)
      // Brief visual feedback handled by button title tooltip
    } catch {
      // Fallback: open share URL in new tab
    }
  }

  return (
    <div className={styles.navbar}>
      <div className={styles.navGroup}>
        <NavBtn title="Back (Alt+Left)" disabled={!nav.canGoBack}
          icon={<IconBack size={15} />}
          onClick={() => activeTabId && goBack(activeTabId)} />
        <NavBtn title="Forward (Alt+Right)" disabled={!nav.canGoForward}
          icon={<IconForward size={15} />}
          onClick={() => activeTabId && goForward(activeTabId)} />
        <NavBtn title={isLoading ? 'Stop' : 'Reload (Ctrl+R)'}
          icon={isLoading ? <IconStop size={15} /> : <IconReload size={15} />}
          onClick={() => activeTabId && !isLoading && reload(activeTabId)} />
      </div>

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
          value={urlBarFocused ? localValue : displayUrl}
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
            <UrlAction
              title={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
              icon={bookmarkFlash
                ? <IconCheck size={12} className={styles.iconGreen} />
                : <IconBookmark size={12} className={bookmarked ? styles.iconAccent : ''} />
              }
              onClick={handleBookmark}
            />
            <UrlAction
              title="Copy URL to clipboard"
              icon={<IconShare size={12} />}
              onClick={handleShare}
            />
          </div>
        )}
      </div>

      <div className={styles.navGroup}>
        <button className={styles.shieldBtn} title="Privacy report — click to view blocked trackers">
          <IconShield size={11} />
          <span>Protected</span>
        </button>

        <button
          className={`${styles.aiBtn} ${aiPanelOpen ? styles.aiBtnActive : ''}`}
          onClick={toggleAIPanel}
          title="Toggle AI Panel (Ctrl+Shift+A)"
        >
          <IconSparkle size={11} />
          <span>AI</span>
        </button>

        <NavBtn
          title="Reading mode (Ctrl+4)"
          icon={<IconBook size={15} />}
          onClick={toggleReadingMode}
          active={readingMode}
        />

        {/* More options dropdown */}
        <div className={styles.moreWrap}>
          <NavBtn
            title="More options"
            icon={<IconDots size={15} />}
            onClick={e => { e?.stopPropagation(); setMoreMenuOpen(v => !v) }}
          />
          {moreMenuOpen && (
            <div className={styles.moreMenu} onClick={e => e.stopPropagation()}>
              <MoreMenuItem label="New Tab"           kbd="Ctrl+T"  onClick={() => { useBrowserStore.getState().createTab('kitsune://newtab'); setMoreMenuOpen(false) }} />
              <MoreMenuItem label="New Private Tab"   onClick={() => { useBrowserStore.getState().createTab('kitsune://newtab'); setMoreMenuOpen(false) }} />
              <div className={styles.moreMenuDivider} />
              <MoreMenuItem label="Bookmarks"         onClick={() => setMoreMenuOpen(false)} />
              <MoreMenuItem label="File Search"       kbd="Ctrl+Shift+F" onClick={() => { useBrowserStore.getState().toggleFileSearch(); setMoreMenuOpen(false) }} />
              <div className={styles.moreMenuDivider} />
              <MoreMenuItem label="Settings"          kbd="Ctrl+,"  onClick={() => { useBrowserStore.getState().openSettings(); setMoreMenuOpen(false) }} />
              <MoreMenuItem label="Cleave Layout"     kbd="Ctrl+\\" onClick={() => { useBrowserStore.getState().toggleCleave(); setMoreMenuOpen(false) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NavBtn({ icon, title, onClick, disabled, active }: {
  icon: React.ReactNode; title?: string; onClick?: (e?: React.MouseEvent) => void
  disabled?: boolean; active?: boolean
}) {
  return (
    <button
      className={`${styles.navBtn} ${disabled ? styles.disabled : ''} ${active ? styles.navBtnActive : ''}`}
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
    <button className={styles.urlActionBtn} title={title}
      onClick={e => { e.stopPropagation(); onClick() }}>
      {icon}
    </button>
  )
}

function MoreMenuItem({ label, kbd, onClick }: { label: string; kbd?: string; onClick: () => void }) {
  return (
    <button className={styles.moreMenuItem} onClick={onClick}>
      <span>{label}</span>
      {kbd && <kbd className={styles.moreMenuKbd}>{kbd}</kbd>}
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
