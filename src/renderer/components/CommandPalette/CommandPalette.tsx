// src/renderer/components/CommandPalette/CommandPalette.tsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import styles from './CommandPalette.module.css'

interface Command {
  id: string
  label: string
  description?: string
  icon: string
  kbd?: string
  category: string
  action: () => void
}

export function CommandPalette() {
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef                = useRef<HTMLInputElement>(null)
  const listRef                 = useRef<HTMLDivElement>(null)

  const closeCommandPalette = useBrowserStore(s => s.closeCommandPalette)
  const createTab           = useBrowserStore(s => s.createTab)
  const toggleAIPanel       = useBrowserStore(s => s.toggleAIPanel)
  const toggleCleave        = useBrowserStore(s => s.toggleCleave)
  const openSettings        = useBrowserStore(s => s.openSettings)
  const tabs                = useBrowserStore(s => s.tabs)
  const activateTab         = useBrowserStore(s => s.activateTab)
  const activeTabId         = useBrowserStore(s => s.activeTabId)
  const setActiveLens       = useBrowserStore(s => s.setActiveLens)
  const lenses              = useBrowserStore(s => s.lenses)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // All available commands
  const allCommands = useMemo<Command[]>(() => [
    // Navigation
    {
      id: 'new-tab',
      label: 'New Tab',
      description: 'Open a blank new tab',
      icon: '＋',
      kbd: '⌘T',
      category: 'Navigation',
      action: () => { createTab('kitsune://newtab'); closeCommandPalette() },
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure Kitsune',
      icon: '⚙',
      kbd: '⌘,',
      category: 'Navigation',
      action: () => { openSettings(); closeCommandPalette() },
    },
    {
      id: 'toggle-ai',
      label: 'Toggle AI Panel',
      description: 'Show or hide the Kitsune AI sidebar',
      icon: '✦',
      kbd: '⌘⇧A',
      category: 'AI',
      action: () => { toggleAIPanel(); closeCommandPalette() },
    },
    {
      id: 'cleave',
      label: 'Open Cleave',
      description: 'Split and arrange your browser layout',
      icon: '⧉',
      kbd: '⌘\\',
      category: 'Layout',
      action: () => { toggleCleave(); closeCommandPalette() },
    },
    // Lenses
    ...lenses.map(lens => ({
      id: `lens-${lens.id}`,
      label: `Switch to ${lens.name} Lens`,
      description: lens.description,
      icon: lens.icon,
      kbd: lens.hotkey,
      category: 'Lens',
      action: () => { setActiveLens(lens.id); closeCommandPalette() },
    })),
    // Open tabs
    ...tabs.map(tab => ({
      id: `tab-${tab.id}`,
      label: tab.title || tab.url,
      description: tab.url,
      icon: tab.hibernated ? '💤' : '🌐',
      category: 'Open Tabs',
      action: () => { activateTab(tab.id); closeCommandPalette() },
    })),
    // AI commands
    {
      id: 'ai-summarize',
      label: 'Summarize Current Page',
      description: 'Generate an AI summary of this page',
      icon: '📄',
      category: 'AI',
      action: () => { toggleAIPanel(); closeCommandPalette() },
    },
    {
      id: 'ai-cluster',
      label: 'Auto-Group Tabs with AI',
      description: 'Let AI cluster your open tabs by topic',
      icon: '🗂',
      category: 'AI',
      action: () => { closeCommandPalette() },
    },
    {
      id: 'ai-research',
      label: 'Start Cross-Page Research',
      description: 'Synthesize multiple tabs into one research doc',
      icon: '🔬',
      category: 'AI',
      action: () => { toggleAIPanel(); closeCommandPalette() },
    },
    // Utility
    {
      id: 'hibernate-all',
      label: 'Hibernate Background Tabs',
      description: 'Free memory by hibernating all inactive tabs now',
      icon: '💤',
      category: 'Utility',
      action: () => { closeCommandPalette() },
    },
    {
      id: 'reader-mode',
      label: 'Toggle Reader Mode',
      description: 'Distraction-free reading on the current page',
      icon: '📖',
      kbd: '⌘⇧R',
      category: 'Utility',
      action: () => { closeCommandPalette() },
    },
    {
      id: 'file-search',
      label: 'Universal File Search',
      description: 'Search across your connected files and documents',
      icon: '🗂',
      category: 'Utility',
      action: () => { closeCommandPalette() },
    },
  ], [tabs, lenses])

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter(
      c =>
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    )
  }, [query, allCommands])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const cmd of filtered) {
      if (!map.has(cmd.category)) map.set(cmd.category, [])
      map.get(cmd.category)!.push(cmd)
    }
    return map
  }, [filtered])

  // All items in order (for keyboard nav)
  const flatItems = filtered

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCommandPalette()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, flatItems.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        flatItems[selected]?.action()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flatItems, selected, closeCommandPalette])

  // Reset selection when query changes
  useEffect(() => { setSelected(0) }, [query])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  let globalIndex = 0

  return (
    <div className={styles.overlay} onClick={closeCommandPalette}>
      <div className={`${styles.box} k-scale-in`} onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className={styles.inputRow}>
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Search commands, tabs, and more…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className={styles.escHint}>esc</kbd>
        </div>

        {/* Results */}
        <div className={styles.list} ref={listRef}>
          {filtered.length === 0 && (
            <div className={styles.empty}>No results for "{query}"</div>
          )}
          {[...grouped.entries()].map(([category, commands]) => (
            <div key={category}>
              <div className={styles.categoryLabel}>{category}</div>
              {commands.map(cmd => {
                const idx = globalIndex++
                return (
                  <div
                    key={cmd.id}
                    data-index={idx}
                    className={`${styles.item} ${idx === selected ? styles.itemSelected : ''}`}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelected(idx)}
                  >
                    <div className={styles.itemIcon}>{cmd.icon}</div>
                    <div className={styles.itemText}>
                      <div className={styles.itemLabel}>{cmd.label}</div>
                      {cmd.description && (
                        <div className={styles.itemDesc}>{cmd.description}</div>
                      )}
                    </div>
                    {cmd.kbd && <kbd className={styles.itemKbd}>{cmd.kbd}</kbd>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
    </svg>
  )
}
