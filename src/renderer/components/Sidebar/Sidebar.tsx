// src/renderer/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { TabItem } from './TabItem'
import { TabGroupHeader } from './TabGroupHeader'
import {
  IconSearch, IconPlus, IconSettings, IconSplitH,
  IconFile, IconUser, IconDot, IconClose,
} from '../Icons'
import styles from './Sidebar.module.css'

export function Sidebar() {
  const tabs             = useBrowserStore(s => s.tabs)
  const groups           = useBrowserStore(s => s.groups)
  const workspaces       = useBrowserStore(s => s.workspaces)
  const activeWorkspace  = useBrowserStore(s => s.activeWorkspaceId)
  const activeTabId      = useBrowserStore(s => s.activeTabId)
  const switchWorkspace  = useBrowserStore(s => s.switchWorkspace)
  const createTab        = useBrowserStore(s => s.createTab)
  const openSettings     = useBrowserStore(s => s.openSettings)
  const toggleCleave     = useBrowserStore(s => s.toggleCleave)

  const [searchQuery, setSearchQuery]     = useState('')
  const [collapsed, setCollapsed]         = useState<Set<string>>(new Set())
  const [searchFocused, setSearchFocused] = useState(false)

  const toggleGroup = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const q = searchQuery.trim().toLowerCase()
  const filteredTabs = q
    ? tabs.filter(t =>
        t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)
      )
    : tabs

  const groupedIds = new Set(groups.flatMap(g => g.tabIds))
  const ungrouped  = filteredTabs.filter(t => !groupedIds.has(t.id))

  const hibernatedCount = tabs.filter(t => t.hibernated).length

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoRow}>
        <div className={styles.logoMark}>
          <KitsuneLogo />
        </div>
        <span className={styles.logoText}>Kitsune</span>
        <span className={styles.version}>0.9.4</span>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <div className={`${styles.searchBox} ${searchFocused ? styles.searchFocused : ''}`}>
          <IconSearch size={13} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search tabs…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button className={styles.searchClear} onClick={() => setSearchQuery('')}>
              <IconClose size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Workspaces */}
      {workspaces.length > 0 && (
        <div className={styles.workspaceSection}>
          <div className={styles.sectionLabel}>Workspaces</div>
          <div className={styles.workspacePills}>
            {workspaces.map(ws => (
              <button
                key={ws.id}
                className={`${styles.wsPill} ${ws.id === activeWorkspace ? styles.wsPillActive : ''}`}
                onClick={() => switchWorkspace(ws.id)}
              >
                {ws.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hibernate notice */}
      {hibernatedCount > 0 && (
        <div className={styles.hibernateBar}>
          <span className={styles.hibernateDot} />
          {hibernatedCount} tab{hibernatedCount > 1 ? 's' : ''} hibernated
        </div>
      )}

      {/* Tab list */}
      <div className={styles.tabList} role="tablist">
        {groups.map(group => {
          const groupTabs = filteredTabs.filter(t => group.tabIds.includes(t.id))
          if (groupTabs.length === 0) return null
          const isCollapsed = collapsed.has(group.id)
          return (
            <div key={group.id}>
              <TabGroupHeader
                group={group}
                count={groupTabs.length}
                collapsed={isCollapsed}
                onToggle={() => toggleGroup(group.id)}
              />
              {!isCollapsed && groupTabs.map(tab => (
                <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
              ))}
            </div>
          )
        })}

        {ungrouped.map(tab => (
          <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
        ))}

        {filteredTabs.length === 0 && searchQuery && (
          <div className={styles.emptySearch}>No tabs match "{searchQuery}"</div>
        )}
      </div>

      {/* New tab */}
      <button className={styles.newTabBtn} onClick={() => createTab('kitsune://newtab')}>
        <IconPlus size={12} />
        New Tab
        <span className={styles.newTabKbd}>⌘T</span>
      </button>

      {/* Footer */}
      <nav className={styles.footer}>
        <FooterItem icon={<IconSettings size={14} />} label="Settings" kbd="⌘," onClick={openSettings} />
        <FooterItem icon={<IconSplitH size={14} />}  label="Cleave"   kbd="⌘\" onClick={toggleCleave} />
        <FooterItem icon={<IconFile size={14} />}    label="Files"    onClick={() => {}} />
        <div className={styles.footerUser}>
          <div className={styles.userAvatar}><IconUser size={12} /></div>
          <span className={styles.userName}>You</span>
          <IconDot size={8} className={styles.onlineDot} />
        </div>
      </nav>
    </aside>
  )
}

function FooterItem({
  icon, label, kbd, onClick,
}: { icon: React.ReactNode; label: string; kbd?: string; onClick: () => void }) {
  return (
    <button className={styles.footerItem} onClick={onClick}>
      <span className={styles.footerIcon}>{icon}</span>
      <span className={styles.footerLabel}>{label}</span>
      {kbd && <span className={styles.footerKbd}>{kbd}</span>}
    </button>
  )
}

function KitsuneLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1L4 4 2 8l2 3 4 1 4-1 2-3-2-4z" fill="#ff6b35" />
      <path d="M4 4L2 2M12 4l2-2" stroke="#ff6b35" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="6" cy="8" r="1" fill="white" />
      <circle cx="10" cy="8" r="1" fill="white" />
    </svg>
  )
}
