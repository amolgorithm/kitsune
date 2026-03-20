// src/renderer/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { TabItem } from './TabItem'
import { TabGroupHeader } from './TabGroupHeader'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const tabs            = useBrowserStore(s => s.tabs)
  const groups          = useBrowserStore(s => s.groups)
  const workspaces      = useBrowserStore(s => s.workspaces)
  const activeWorkspace = useBrowserStore(s => s.activeWorkspaceId)
  const activeTabId     = useBrowserStore(s => s.activeTabId)
  const switchWorkspace = useBrowserStore(s => s.switchWorkspace)
  const createTab       = useBrowserStore(s => s.createTab)
  const openSettings    = useBrowserStore(s => s.openSettings)
  const toggleCleave    = useBrowserStore(s => s.toggleCleave)

  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  // Filter tabs by search
  const filteredTabs = searchQuery.trim()
    ? tabs.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.url.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabs

  // Group tabs — ungrouped tabs rendered at end
  const groupedTabIds = new Set(groups.flatMap(g => g.tabIds))
  const ungroupedTabs = filteredTabs.filter(t => !groupedTabIds.has(t.id))

  // Tab stats for status display
  const hibernatedCount = tabs.filter(t => t.hibernated).length
  const totalMemMB = Math.round(
    tabs.reduce((acc, t) => acc + t.memoryBytes, 0) / (1024 * 1024)
  )

  return (
    <aside className={styles.sidebar} aria-label="Sidebar">
      {/* Logo */}
      <div className={styles.logoRow}>
        <div className={styles.logoMark}>🦊</div>
        <span className={styles.logoText}>Kitsune</span>
        <span className={styles.version}>v0.9.4</span>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <div className={styles.searchBox}>
          <SearchIcon />
          <input
            type="text"
            placeholder="Search tabs, history…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search tabs"
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
      </div>

      {/* Workspaces */}
      <div className={styles.workspaceSection}>
        <div className={styles.sectionLabel}>Workspaces</div>
        <div className={styles.workspacePills}>
          {workspaces.map(ws => (
            <button
              key={ws.id}
              className={`${styles.wsPill} ${ws.id === activeWorkspace ? styles.wsPillActive : ''}`}
              onClick={() => switchWorkspace(ws.id)}
              title={ws.name}
            >
              <span className={styles.wsIcon}>{ws.icon}</span>
              {ws.name}
            </button>
          ))}
          <button className={styles.wsPillAdd} title="New workspace">+</button>
        </div>
      </div>

      {/* Tab memory indicator */}
      {hibernatedCount > 0 && (
        <div className={styles.memBar}>
          <span className={styles.memIcon}>💤</span>
          <span>{hibernatedCount} tabs hibernated · saving ~{hibernatedCount * 80}MB</span>
        </div>
      )}

      {/* Tab list */}
      <div className={styles.tabList} role="tablist">
        {/* Grouped tabs */}
        {groups.map(group => {
          const groupTabs = filteredTabs.filter(t => group.tabIds.includes(t.id))
          if (groupTabs.length === 0) return null
          const collapsed = collapsedGroups.has(group.id)

          return (
            <div key={group.id} className={styles.tabGroup}>
              <TabGroupHeader
                group={group}
                count={groupTabs.length}
                collapsed={collapsed}
                onToggle={() => toggleGroupCollapse(group.id)}
              />
              {!collapsed && groupTabs.map(tab => (
                <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
              ))}
            </div>
          )
        })}

        {/* Ungrouped tabs */}
        {ungroupedTabs.length > 0 && (
          <div className={styles.tabGroup}>
            {groups.length > 0 && (
              <div className={styles.groupDivider}>
                <span>Other</span>
              </div>
            )}
            {ungroupedTabs.map(tab => (
              <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
            ))}
          </div>
        )}

        {filteredTabs.length === 0 && searchQuery && (
          <div className={styles.emptySearch}>No tabs match "{searchQuery}"</div>
        )}
      </div>

      {/* New tab button */}
      <button className={styles.newTabBtn} onClick={() => createTab('kitsune://newtab')}>
        <span className={styles.newTabPlus}>+</span>
        New Tab
        <kbd className={styles.newTabKbd}>⌘T</kbd>
      </button>

      {/* Footer nav */}
      <nav className={styles.footer}>
        <SidebarFooterItem icon={<SettingsIcon />} label="Settings" kbd="⌘," onClick={openSettings} />
        <SidebarFooterItem icon={<CleaveIcon />}   label="Cleave"   kbd="⌘\" onClick={toggleCleave} />
        <SidebarFooterItem icon={<FileIcon />}     label="Files"    kbd="⌘F" onClick={() => {}} />
        <div className={styles.footerUser}>
          <div className={styles.userAvatar}>AK</div>
          <span className={styles.userName}>Alex K.</span>
          <div className={styles.onlineDot} />
        </div>
      </nav>
    </aside>
  )
}

function SidebarFooterItem({
  icon, label, kbd, onClick,
}: {
  icon: React.ReactNode
  label: string
  kbd?: string
  onClick: () => void
}) {
  return (
    <button className={styles.footerItem} onClick={onClick}>
      <span className={styles.footerIcon}>{icon}</span>
      <span className={styles.footerLabel}>{label}</span>
      {kbd && <kbd className={styles.footerKbd}>{kbd}</kbd>}
    </button>
  )
}

// ── Inline SVG icons ─────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
    </svg>
  )
}
function CleaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="14" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
}
function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 13V5l4-4h5a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
      <path d="M7 1v4H3" />
    </svg>
  )
}
