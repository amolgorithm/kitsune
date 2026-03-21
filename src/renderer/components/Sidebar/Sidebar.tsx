// src/renderer/components/Sidebar/Sidebar.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { TabItem } from './TabItem'
import { TabGroupHeader } from './TabGroupHeader'
import {
  IconSearch, IconPlus, IconSettings, IconSplitH,
  IconFile, IconUser, IconDot, IconClose, IconSparkle, IconFolder,
} from '../Icons'
import styles from './Sidebar.module.css'

const MIN_W   = 52   // collapsed — icon rail only
const MAX_W   = 400  // maximum useful width
const SNAP_W  = 100  // below this, snap to collapsed

function calcRAMStats(tabs: any[]) {
  const total    = tabs.length
  const active   = tabs.filter(t => !t.hibernated).length
  const sleeping = total - active
  const savedMB  = tabs
    .filter(t => t.hibernated && t.memoryBytes > 0)
    .reduce((acc, t) => acc + t.memoryBytes / (1024 * 1024), 0)
  const estimatedSavedMB = savedMB > 0 ? Math.round(savedMB) : sleeping * 80
  const pct = total > 0 ? Math.round((sleeping / total) * 100) : 0
  return { sleeping, estimatedSavedMB, pct, active }
}

export function Sidebar() {
  const tabs             = useBrowserStore(s => s.tabs)
  const groups           = useBrowserStore(s => s.groups)
  const workspaces       = useBrowserStore(s => s.workspaces)
  const activeWorkspace  = useBrowserStore(s => s.activeWorkspaceId)
  const activeTabId      = useBrowserStore(s => s.activeTabId)
  const activeLensId     = useBrowserStore(s => s.activeLensId)

  const switchWorkspace  = useBrowserStore(s => s.switchWorkspace)
  const createTab        = useBrowserStore(s => s.createTab)
  const openSettings     = useBrowserStore(s => s.openSettings)
  const toggleCleave     = useBrowserStore(s => s.toggleCleave)
  const toggleFileSearch = useBrowserStore(s => s.toggleFileSearch)
  const aiClusterTabs    = useBrowserStore(s => s.aiClusterTabs)
  const createWorkspace  = useBrowserStore(s => s.createWorkspace)
  const sidebarWidth     = useBrowserStore(s => s.sidebarWidth)
  const setSidebarWidth  = useBrowserStore(s => s.setSidebarWidth)

  const [searchQuery, setSearchQuery]     = useState('')
  const [collapsed, setCollapsed]         = useState<Set<string>>(new Set())
  const [searchFocused, setSearchFocused] = useState(false)
  const [newWsName, setNewWsName]         = useState('')
  const [addingWs, setAddingWs]           = useState(false)

  // ── Drag resize ──────────────────────────────────────────────────
  const isDragging    = useRef(false)
  const dragStartX    = useRef(0)
  const dragStartW    = useRef(sidebarWidth)
  const animFrame     = useRef<number>(0)
  const pendingW      = useRef(sidebarWidth)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current  = true
    dragStartX.current  = e.clientX
    dragStartW.current  = sidebarWidth
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      let next    = dragStartW.current + delta
      // Snap to collapsed below threshold
      if (next < SNAP_W) next = MIN_W
      else next = Math.min(MAX_W, Math.max(SNAP_W, next))

      pendingW.current = next
      cancelAnimationFrame(animFrame.current)
      animFrame.current = requestAnimationFrame(() => {
        setSidebarWidth(pendingW.current)
      })
    }

    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [setSidebarWidth])

  const isCollapsed = sidebarWidth <= MIN_W + 4  // true when icon-rail mode

  const toggleGroup = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const q = searchQuery.trim().toLowerCase()
  const filteredTabs = q
    ? tabs.filter(t => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
    : tabs

  const workspaceTabs = filteredTabs.filter(t => t.workspaceId === activeWorkspace)
  const groupedIds    = new Set(groups.flatMap(g => g.tabIds))
  const ungrouped     = workspaceTabs.filter(t => !groupedIds.has(t.id))

  const ramStats = calcRAMStats(tabs)

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return
    const colors = ['#ff6b35', '#a594ff', '#4cc9f0', '#4cffb0', '#ffd166']
    const color  = colors[workspaces.length % colors.length]
    await createWorkspace(newWsName.trim(), color)
    setNewWsName('')
    setAddingWs(false)
  }

  return (
    <aside
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''}`}
      style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
    >
      {/* Logo */}
      <div className={styles.logoRow}>
        <div className={styles.logoMark}>
          <KitsuneLogo />
        </div>
        {!isCollapsed && (
          <>
            <span className={styles.logoText}>Kitsune</span>
            <span className={styles.version}>v0.10.0-beta</span>
          </>
        )}
      </div>

      {/* Search — hidden when collapsed */}
      {!isCollapsed && (
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
      )}

      {/* Workspace pills */}
      {!isCollapsed && (
        <div className={styles.workspaceSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Workspaces</span>
            <button className={styles.sectionAction} onClick={() => setAddingWs(!addingWs)} title="New workspace">
              <IconPlus size={11} />
            </button>
          </div>
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
          {addingWs && (
            <div className={styles.addWsRow}>
              <input
                className={styles.addWsInput}
                placeholder="Workspace name…"
                value={newWsName}
                onChange={e => setNewWsName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateWorkspace(); if (e.key === 'Escape') setAddingWs(false) }}
                autoFocus
              />
              <button className={styles.addWsBtn} onClick={handleCreateWorkspace}>Add</button>
            </div>
          )}
        </div>
      )}

      {/* RAM bar */}
      {!isCollapsed && ramStats.sleeping > 0 && (
        <div className={styles.ramBar}>
          <div className={styles.ramBarFill} style={{ width: `${ramStats.pct}%` }} />
          <span className={styles.ramLabel}>
            {ramStats.sleeping} sleeping · ~{ramStats.estimatedSavedMB}MB saved ({ramStats.pct}%)
          </span>
        </div>
      )}

      {/* AI cluster */}
      {!isCollapsed && workspaceTabs.length >= 3 && (
        <button className={styles.aiGroupBtn} onClick={aiClusterTabs} title="Auto-group tabs by topic">
          <IconSparkle size={11} />
          Auto-group tabs
        </button>
      )}

      {/* Tab list */}
      <div className={styles.tabList} role="tablist">
        {isCollapsed ? (
          // Icon-rail mode: just show favicon dots
          workspaceTabs.map(tab => (
            <div
              key={tab.id}
              className={`${styles.iconRailItem} ${tab.id === activeTabId ? styles.iconRailItemActive : ''}`}
              onClick={() => tab.hibernated ? useBrowserStore.getState().wakeTab(tab.id) : useBrowserStore.getState().activateTab(tab.id)}
              title={tab.title}
            >
              {tab.favicon
                ? <img src={tab.favicon} width={16} height={16} style={{ borderRadius: 3 }} alt="" />
                : <div className={styles.iconRailDot} style={{ background: tab.id === activeTabId ? 'var(--k-fox)' : 'var(--k-surface-3)' }} />
              }
            </div>
          ))
        ) : (
          <>
            {groups.map(group => {
              const groupTabs = workspaceTabs.filter(t => group.tabIds.includes(t.id))
              if (groupTabs.length === 0) return null
              const isCollapsedGroup = collapsed.has(group.id)
              return (
                <div key={group.id}>
                  <TabGroupHeader
                    group={group}
                    count={groupTabs.length}
                    collapsed={isCollapsedGroup}
                    onToggle={() => toggleGroup(group.id)}
                  />
                  {!isCollapsedGroup && groupTabs.map(tab => (
                    <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} indent />
                  ))}
                  {isCollapsedGroup && (() => {
                    const saved = groupTabs.filter(t => t.hibernated && t.memoryBytes > 0)
                      .reduce((a, t) => a + t.memoryBytes / (1024 * 1024), 0)
                    const sleeping = groupTabs.filter(t => t.hibernated).length
                    return sleeping > 0 ? (
                      <div className={styles.groupRam}>
                        {sleeping} sleeping · ~{Math.max(saved, sleeping * 80).toFixed(0)}MB saved
                      </div>
                    ) : null
                  })()}
                </div>
              )
            })}

            {ungrouped.map(tab => (
              <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
            ))}

            {filteredTabs.length === 0 && searchQuery && (
              <div className={styles.emptySearch}>No tabs match "{searchQuery}"</div>
            )}
            {workspaceTabs.length === 0 && !searchQuery && (
              <div className={styles.emptyWs}>No tabs in this workspace</div>
            )}
          </>
        )}
      </div>

      {/* New tab */}
      {isCollapsed ? (
        <button
          className={styles.iconRailNewTab}
          onClick={() => createTab('kitsune://newtab')}
          title="New Tab (⌘T)"
        >
          <IconPlus size={14} />
        </button>
      ) : (
        <button className={styles.newTabBtn} onClick={() => createTab('kitsune://newtab')}>
          <IconPlus size={12} />
          New Tab
          <span className={styles.newTabKbd}>⌘T</span>
        </button>
      )}

      {/* Footer */}
      <nav className={styles.footer}>
        {isCollapsed ? (
          <>
            <button className={styles.iconRailFooterBtn} onClick={openSettings} title="Settings">
              <IconSettings size={15} />
            </button>
            <button className={styles.iconRailFooterBtn} onClick={toggleCleave} title="Cleave">
              <IconSplitH size={15} />
            </button>
            <button className={styles.iconRailFooterBtn} onClick={toggleFileSearch} title="Files">
              <IconFile size={15} />
            </button>
          </>
        ) : (
          <>
            <FooterItem icon={<IconSettings size={14} />} label="Settings" kbd="⌘," onClick={openSettings} />
            <FooterItem icon={<IconSplitH size={14} />}   label="Cleave"   kbd="⌘\" onClick={toggleCleave} />
            <FooterItem icon={<IconFile size={14} />}     label="Files"    onClick={toggleFileSearch} />
            <div className={styles.footerUser}>
              <div className={styles.userAvatar}><IconUser size={12} /></div>
              <div className={styles.lensIndicator}>
                <span className={styles.lensLabel}>Lens:</span>
                <span className={styles.lensValue}>{activeLensId}</span>
              </div>
              <IconDot size={8} className={styles.onlineDot} />
            </div>
          </>
        )}
      </nav>

      {/* ── Drag handle ──────────────────────────────────────────── */}
      <div
        className={styles.dragHandle}
        onMouseDown={onMouseDown}
        title={isCollapsed ? 'Drag to expand sidebar' : 'Drag to resize sidebar'}
      >
        <div className={styles.dragHandleLine} />
      </div>
    </aside>
  )
}

function FooterItem({ icon, label, kbd, onClick }: {
  icon: React.ReactNode; label: string; kbd?: string; onClick: () => void
}) {
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
    <img
      src={new URL('../../assets/logo.png', import.meta.url).href}
      width={30}
      height={30}
      alt="Kitsune"
      draggable={false}
      style={{ objectFit: 'contain' }}
    />
  )
}