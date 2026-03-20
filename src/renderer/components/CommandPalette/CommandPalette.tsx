// src/renderer/components/CommandPalette/CommandPalette.tsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import {
  IconSearch, IconPlus, IconSettings, IconSplitH, IconSparkle,
  IconBook, IconSleep, IconShield, IconGlobe, IconResearch,
  IconCode, IconPalette, IconTask, IconClose,
} from '../Icons'
import styles from './CommandPalette.module.css'

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  kbd?: string
  category: string
  action: () => void
}

export function CommandPalette() {
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  const closeCommandPalette = useBrowserStore(s => s.closeCommandPalette)
  const createTab           = useBrowserStore(s => s.createTab)
  const toggleAIPanel       = useBrowserStore(s => s.toggleAIPanel)
  const toggleCleave        = useBrowserStore(s => s.toggleCleave)
  const openSettings        = useBrowserStore(s => s.openSettings)
  const tabs                = useBrowserStore(s => s.tabs)
  const activateTab         = useBrowserStore(s => s.activateTab)
  const setActiveLens       = useBrowserStore(s => s.setActiveLens)
  const lenses              = useBrowserStore(s => s.lenses)

  useEffect(() => { inputRef.current?.focus() }, [])

  const LENS_ICONS: Record<string, React.ReactNode> = {
    default:  <IconGlobe size={14} />,
    research: <IconResearch size={14} />,
    coding:   <IconCode size={14} />,
    reading:  <IconBook size={14} />,
    creative: <IconPalette size={14} />,
  }

  const allCommands = useMemo<Command[]>(() => [
    {
      id: 'new-tab', label: 'New Tab', icon: <IconPlus size={14} />,
      kbd: '⌘T', category: 'Navigation',
      action: () => { createTab('kitsune://newtab'); closeCommandPalette() },
    },
    {
      id: 'settings', label: 'Settings', description: 'Configure Kitsune',
      icon: <IconSettings size={14} />, kbd: '⌘,', category: 'Navigation',
      action: () => { openSettings(); closeCommandPalette() },
    },
    {
      id: 'ai-panel', label: 'Toggle AI Panel',
      icon: <IconSparkle size={14} />, kbd: '⌘⇧A', category: 'AI',
      action: () => { toggleAIPanel(); closeCommandPalette() },
    },
    {
      id: 'cleave', label: 'Cleave — Split Layout',
      icon: <IconSplitH size={14} />, kbd: '⌘\\', category: 'Layout',
      action: () => { toggleCleave(); closeCommandPalette() },
    },
    {
      id: 'reader', label: 'Toggle Reading Mode',
      icon: <IconBook size={14} />, kbd: '⌘⇧R', category: 'View',
      action: () => { closeCommandPalette() },
    },
    {
      id: 'hibernate-all', label: 'Hibernate Background Tabs',
      description: 'Free memory by suspending inactive tabs',
      icon: <IconSleep size={14} />, category: 'Tabs',
      action: () => { closeCommandPalette() },
    },
    {
      id: 'privacy-report', label: 'View Privacy Report',
      icon: <IconShield size={14} />, category: 'Privacy',
      action: () => { closeCommandPalette() },
    },
    {
      id: 'ai-summarize', label: 'Summarize Current Page',
      icon: <IconSparkle size={14} />, category: 'AI',
      action: () => { toggleAIPanel(); closeCommandPalette() },
    },
    {
      id: 'ai-tasks', label: 'Extract Tasks from Page',
      icon: <IconTask size={14} />, category: 'AI',
      action: () => { toggleAIPanel(); closeCommandPalette() },
    },
    ...lenses.map(lens => ({
      id: `lens-${lens.id}`,
      label: `Switch to ${lens.name} Lens`,
      description: lens.description,
      icon: LENS_ICONS[lens.id] ?? <IconGlobe size={14} />,
      kbd: lens.hotkey,
      category: 'Lens',
      action: () => { setActiveLens(lens.id); closeCommandPalette() },
    })),
    ...tabs.map(tab => ({
      id: `tab-${tab.id}`,
      label: tab.title || tab.url,
      description: tab.url,
      icon: tab.hibernated ? <IconSleep size={14} /> : <IconGlobe size={14} />,
      category: 'Open Tabs',
      action: () => { activateTab(tab.id); closeCommandPalette() },
    })),
  ], [tabs, lenses])

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    )
  }, [query, allCommands])

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const cmd of filtered) {
      if (!map.has(cmd.category)) map.set(cmd.category, [])
      map.get(cmd.category)!.push(cmd)
    }
    return map
  }, [filtered])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCommandPalette()
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter')     { e.preventDefault(); filtered[selected]?.action() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, selected, closeCommandPalette])

  useEffect(() => { setSelected(0) }, [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  let idx = 0

  return (
    <div className={styles.overlay} onClick={closeCommandPalette}>
      <div className={`${styles.box} k-scale-in`} onClick={e => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <IconSearch size={15} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Search commands, tabs…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className={styles.escBtn} onClick={closeCommandPalette}>
            <kbd>esc</kbd>
          </button>
        </div>

        <div className={styles.list} ref={listRef}>
          {filtered.length === 0 && (
            <div className={styles.empty}>No results for "{query}"</div>
          )}
          {[...grouped.entries()].map(([category, cmds]) => (
            <div key={category}>
              <div className={styles.categoryLabel}>{category}</div>
              {cmds.map(cmd => {
                const i = idx++
                return (
                  <div
                    key={cmd.id}
                    data-index={i}
                    className={`${styles.item} ${i === selected ? styles.itemSelected : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <div className={styles.itemIcon}>{cmd.icon}</div>
                    <div className={styles.itemText}>
                      <div className={styles.itemLabel}>{cmd.label}</div>
                      {cmd.description && <div className={styles.itemDesc}>{cmd.description}</div>}
                    </div>
                    {cmd.kbd && <kbd className={styles.itemKbd}>{cmd.kbd}</kbd>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
          <span className={styles.footerRight}>{filtered.length} results</span>
        </div>
      </div>
    </div>
  )
}
