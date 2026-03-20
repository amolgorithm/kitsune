// src/renderer/components/Sidebar/TabGroupHeader.tsx
import type { TabGroup } from '../../../shared/types'
import { IconChevronDown, IconChevronRight, IconSparkle } from '../Icons'
import styles from './TabGroupHeader.module.css'

interface TabGroupHeaderProps {
  group: TabGroup
  count: number
  collapsed: boolean
  onToggle: () => void
}

export function TabGroupHeader({ group, count, collapsed, onToggle }: TabGroupHeaderProps) {
  return (
    <button className={styles.header} onClick={onToggle} aria-expanded={!collapsed}>
      <span className={styles.dot} style={{ background: group.color }} />
      <span className={styles.label}>{group.label}</span>
      {group.aiManaged && <IconSparkle size={10} className={styles.aiTag} />}
      <span className={styles.count}>{count}</span>
      {collapsed
        ? <IconChevronRight size={10} className={styles.chevron} />
        : <IconChevronDown  size={10} className={styles.chevron} />
      }
    </button>
  )
}
