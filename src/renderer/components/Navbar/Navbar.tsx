// src/renderer/components/Navbar/Navbar.tsx
import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import styles from './Navbar.module.css'

export function Navbar() {
  const activeTab      = useActiveTab()
  const activeTabId    = useBrowserStore(s => s.activeTabId)
  const urlBarValue    = useBrowserStore(s => s.urlBarValue)
  const urlBarFocused  = useBrowserStore(s => s.urlBarFocused)
  const aiPanelOpen    = useBrowserStore(s => s.aiPanelOpen)

  const navigateTab       = useBrowserStore(s => s.navigateTab)
  const createTab         = useBrowserStore(s => s.createTab)
  const toggleAIPanel     = useBrowserStore(s => s.toggleAIPanel)
  const openCommandPalette= useBrowserStore(s => s.openCommandPalette)
  const setUrlBarFocused  = useBrowserStore(s => s.setUrlBarFocused)
  const setUrlBarValue    = useBrowserStore(s => s.setUrlBarValue)

  const inputRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState(urlBarValue)

  // Sync local value when active tab changes
  useEffect(() => {
    if (!urlBarFocused) setLocalValue(urlBarValue)
  }, [urlBarValue, urlBarFocused])

  const handleFocus = () => {
    setUrlBarFocused(true)
    setLocalValue(activeTab?.url ?? '')
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleBlur = () => {
    setUrlBarFocused(false)
    setLocalValue(activeTab?.url ?? '')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeTabId) {
        navigateTab(activeTabId, localValue)
        inputRef.current?.blur()
      }
    }
    if (e.key === 'Escape') {
      setLocalValue(activeTab?.url ?? '')
      inputRef.current?.blur()
    }
  }

  const isSecure = activeTab?.url?.startsWith('https://') ?? false
  const isLoading = activeTab?.status === 'loading'
  const displayUrl = urlBarFocused ? localValue : formatDisplayUrl(activeTab?.url ?? '')

  return (
    <div className={styles.navbar}>
      {/* Navigation buttons */}
      <div className={styles.navGroup}>
        <NavBtn
          disabled
          title="Back (⌘[)"
          icon={<BackIcon />}
        />
        <NavBtn
          disabled
          title="Forward (⌘])"
          icon={<ForwardIcon />}
        />
        <NavBtn
          title="Reload (⌘R)"
          icon={isLoading ? <StopIcon /> : <ReloadIcon />}
          onClick={() => {/* TODO: invoke tab reload */}}
        />
      </div>

      {/* URL Bar */}
      <div
        className={`${styles.urlbar} ${urlBarFocused ? styles.urlbarFocused : ''}`}
        onClick={() => !urlBarFocused && inputRef.current?.focus()}
      >
        {/* Security indicator */}
        <div className={styles.urlSecurity} title={isSecure ? 'Secure connection' : 'Not secure'}>
          {isSecure
            ? <LockIcon className={styles.iconGreen} />
            : <LockOpenIcon className={styles.iconRed} />
          }
        </div>

        {/* URL input */}
        <input
          ref={inputRef}
          type="text"
          className={styles.urlInput}
          value={urlBarFocused ? localValue : displayUrl}
          onChange={e => setLocalValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          aria-label="Address bar"
          placeholder="Search or enter address…"
        />

        {/* Loading bar */}
        {isLoading && <div className={styles.loadingBar} />}

        {/* Inline actions (shown when not focused) */}
        {!urlBarFocused && (
          <div className={styles.urlActions}>
            <UrlActionBtn title="Bookmark" icon={<BookmarkIcon />} onClick={() => {}} />
            <UrlActionBtn title="Share" icon={<ShareIcon />} onClick={() => {}} />
          </div>
        )}
      </div>

      {/* Right-side controls */}
      <div className={styles.navGroup}>
        {/* Shield / privacy */}
        <PrivacyBadge tabId={activeTabId} />

        {/* AI panel toggle */}
        <button
          className={`${styles.aiBtn} ${aiPanelOpen ? styles.aiBtnActive : ''}`}
          onClick={toggleAIPanel}
          title="Toggle AI Panel (⌘⇧A)"
        >
          <AIIcon />
          Kitsune AI
        </button>

        {/* Reader mode */}
        <NavBtn title="Reading mode (⌘⇧R)" icon={<ReaderIcon />} onClick={() => {}} />

        {/* Command palette */}
        <NavBtn title="Command palette (⌘K)" icon={<CommandIcon />} onClick={openCommandPalette} />

        {/* Extensions / overflow */}
        <NavBtn title="More options" icon={<MoreIcon />} onClick={() => {}} />
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

function NavBtn({
  icon, title, onClick, disabled,
}: {
  icon: React.ReactNode
  title?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      className={`${styles.navBtn} ${disabled ? styles.navBtnDisabled : ''}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {icon}
    </button>
  )
}

function UrlActionBtn({ title, icon, onClick }: { title: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button className={styles.urlActionBtn} title={title} onClick={e => { e.stopPropagation(); onClick() }}>
      {icon}
    </button>
  )
}

function PrivacyBadge({ tabId }: { tabId: string | null }) {
  // In a real app this would read from the privacy store
  const count = 0  // TODO: connect to PrivacyIPC

  return (
    <button
      className={styles.shieldBtn}
      title="Privacy report — click to view blocked trackers"
    >
      <ShieldIcon />
      {count > 0 ? `${count} blocked` : 'Protected'}
    </button>
  )
}

// ── URL formatting ─────────────────────────────────────────────────

function formatDisplayUrl(url: string): string {
  if (!url || url.startsWith('kitsune://')) return url
  try {
    const u = new URL(url)
    return u.hostname + u.pathname + u.search
  } catch {
    return url
  }
}

// ── Icons ──────────────────────────────────────────────────────────

function BackIcon()     { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="10,4 6,8 10,12"/></svg> }
function ForwardIcon()  { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,4 10,8 6,12"/></svg> }
function ReloadIcon()   { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 3c-1.5-1.5-3.5-2-5.5-2C3.91 1 1 3.91 1 7.5S3.91 14 7.5 14c2 0 3.8-.9 5-2.3"/><polyline points="13,1 13,5 9,5"/></svg> }
function StopIcon()     { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="8" height="8" rx="1"/></svg> }
function LockIcon({ className }: { className: string }) { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}><rect x="3" y="7" width="10" height="8" rx="1"/><path d="M6 7V5a2 2 0 014 0v2"/><circle cx="8" cy="11" r="1" fill="currentColor"/></svg> }
function LockOpenIcon({ className }: { className: string }) { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}><rect x="3" y="7" width="10" height="8" rx="1"/><path d="M6 7V5a2 2 0 014 0v2" strokeDasharray="2 2"/></svg> }
function BookmarkIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h10v13l-5-3-5 3V2z"/></svg> }
function ShareIcon()    { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="13" r="1.5"/><circle cx="4" cy="8" r="1.5"/><line x1="10.5" y1="3.9" x2="5.5" y2="7.1"/><line x1="10.5" y1="12.1" x2="5.5" y2="8.9"/></svg> }
function ShieldIcon()   { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1L2 4v5c0 3.31 2.69 6 6 6s6-2.69 6-6V4L8 1z"/><polyline points="5,8 7,10 11,6" strokeWidth="1.8"/></svg> }
function AIIcon()       { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1c-.9 1.8-2.5 3-4 3.5C3.5 7.5 4 10 6 12c1 1 2 1.5 2 2s1-1 2-2c2-2 2.5-4.5 2-7.5C10.5 4 8.9 2.8 8 1z"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg> }
function ReaderIcon()   { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="14" height="10" rx="1"/><line x1="4" y1="6" x2="12" y2="6"/><line x1="4" y1="8" x2="12" y2="8"/><line x1="4" y1="10" x2="9" y2="10"/></svg> }
function CommandIcon()  { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5.5 1.5A2 2 0 003.5 3.5v1A2 2 0 001.5 6.5v1A2 2 0 003.5 9.5v1A2 2 0 005.5 12.5"/><path d="M10.5 1.5A2 2 0 0112.5 3.5v1A2 2 0 0114.5 6.5v1A2 2 0 0112.5 9.5v1A2 2 0 0110.5 12.5"/></svg> }
function MoreIcon()     { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="4" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="12" r="1" fill="currentColor"/></svg> }
