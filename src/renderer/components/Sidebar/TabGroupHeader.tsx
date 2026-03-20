// src/renderer/components/Sidebar/TabGroupHeader.tsx
// ─────────────────────────────────────────────────────────────────
import type { TabGroup } from '../../../shared/types'
import headerStyles from './TabGroupHeader.module.css'

interface TabGroupHeaderProps {
  group: TabGroup
  count: number
  collapsed: boolean
  onToggle: () => void
}

export function TabGroupHeader({ group, count, collapsed, onToggle }: TabGroupHeaderProps) {
  return (
    <button className={headerStyles.header} onClick={onToggle} aria-expanded={!collapsed}>
      <span className={headerStyles.dot} style={{ background: group.color }} />
      <span className={headerStyles.label}>{group.label}</span>
      {group.aiManaged && (
        <span className={headerStyles.aiTag} title="AI-managed group">✦</span>
      )}
      <span className={headerStyles.count}>{count}</span>
      <svg
        className={`${headerStyles.chevron} ${collapsed ? headerStyles.chevronCollapsed : ''}`}
        width="10" height="10" viewBox="0 0 10 10" fill="none"
        stroke="currentColor" strokeWidth="1.5"
      >
        <polyline points="2,4 5,7 8,4" />
      </svg>
    </button>
  )
}
