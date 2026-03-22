// src/renderer/components/Cleave/CleaveOverlay.tsx
import { useState, useEffect } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import { CleaveIPC, TabIPC } from '../../lib/ipc'
import { IconClose } from '../Icons'
import styles from './CleaveOverlay.module.css'

type Mode = 'split-h' | 'split-v' | 'ai-beside' | 'triple' | 'workspace' | 'group'

const OPTIONS: Array<{ id: Mode; key: string; title: string; desc: string }> = [
  { id: 'split-h',   key: 'H', title: 'Split Horizontal', desc: 'Two panes side by side' },
  { id: 'split-v',   key: 'V', title: 'Split Vertical',   desc: 'Stack panes top and bottom' },
  { id: 'ai-beside', key: 'A', title: 'AI Beside',        desc: 'Current tab + AI pane' },
  { id: 'triple',    key: 'T', title: 'Three-Way',        desc: 'Reference, work, and AI' },
  { id: 'workspace', key: 'W', title: 'By Workspace',     desc: 'Tabs from different workspaces' },
  { id: 'group',     key: 'G', title: 'By Group',         desc: 'Expand a tab group across panes' },
]

export function CleaveOverlay() {
  const toggleCleave    = useBrowserStore(s => s.toggleCleave)
  const activeTab       = useActiveTab()
  const tabs            = useBrowserStore(s => s.tabs)
  const activeWorkspace = useBrowserStore(s => s.activeWorkspaceId)
  const aiPanelOpen     = useBrowserStore(s => s.aiPanelOpen)
  const toggleAIPanel   = useBrowserStore(s => s.toggleAIPanel)
  const setCleaveLayout = useBrowserStore(s => s.setCleaveLayout)
  const [selected, setSelected] = useState<Mode | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase()
      if (key === 'ESCAPE') { toggleCleave(); return }
      if (key === 'R') { reset(); return }
      const opt = OPTIONS.find(o => o.key === key)
      if (opt) apply(opt.id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tabs, activeTab])

  const workspaceTabs = tabs.filter(t => t.workspaceId === activeWorkspace && !t.hibernated)
  const otherTab = workspaceTabs.find(t => t.id !== activeTab?.id)

  const apply = async (mode: Mode) => {
    setSelected(mode)

    // Close AI panel if open — it conflicts with split layout
    if (aiPanelOpen && mode !== 'ai-beside') {
      toggleAIPanel()
    }

    let layout: any

    if (mode === 'split-h') {
      layout = {
        id: crypto.randomUUID(), type: 'split',
        direction: 'horizontal', sizes: [50, 50],
        children: [
          { id: crypto.randomUUID(), type: 'leaf', tabId: activeTab?.id },
          { id: crypto.randomUUID(), type: 'leaf', tabId: otherTab?.id ?? activeTab?.id },
        ],
      }
    } else if (mode === 'split-v') {
      layout = {
        id: crypto.randomUUID(), type: 'split',
        direction: 'vertical', sizes: [50, 50],
        children: [
          { id: crypto.randomUUID(), type: 'leaf', tabId: activeTab?.id },
          { id: crypto.randomUUID(), type: 'leaf', tabId: otherTab?.id ?? activeTab?.id },
        ],
      }
    } else if (mode === 'ai-beside') {
      // Open AI panel if not already open
      if (!aiPanelOpen) toggleAIPanel()
      layout = {
        id: crypto.randomUUID(), type: 'split',
        direction: 'horizontal', sizes: [65, 35],
        children: [
          { id: crypto.randomUUID(), type: 'leaf', tabId: activeTab?.id },
          { id: crypto.randomUUID(), type: 'leaf', isAIPane: true },
        ],
      }
    } else if (mode === 'triple') {
      const tab2 = workspaceTabs.find(t => t.id !== activeTab?.id)
      if (!aiPanelOpen) toggleAIPanel()
      layout = {
        id: crypto.randomUUID(), type: 'split',
        direction: 'horizontal', sizes: [33, 34, 33],
        children: [
          { id: crypto.randomUUID(), type: 'leaf', tabId: tab2?.id ?? activeTab?.id },
          { id: crypto.randomUUID(), type: 'leaf', tabId: activeTab?.id },
          { id: crypto.randomUUID(), type: 'leaf', isAIPane: true },
        ],
      }
    } else if (mode === 'workspace') {
      // Two tabs from current workspace side by side
      const tab1 = workspaceTabs[0]
      const tab2 = workspaceTabs[1] ?? workspaceTabs[0]
      layout = {
        id: crypto.randomUUID(), type: 'split',
        direction: 'horizontal', sizes: [50, 50],
        children: [
          { id: crypto.randomUUID(), type: 'leaf', tabId: tab1?.id },
          { id: crypto.randomUUID(), type: 'leaf', tabId: tab2?.id },
        ],
      }
    } else if (mode === 'group') {
      // Expand two tabs from same group
      const tab1 = workspaceTabs[0]
      const tab2 = workspaceTabs[1] ?? workspaceTabs[0]
      layout = {
        id: crypto.randomUUID(), type: 'split',
        direction: 'horizontal', sizes: [50, 50],
        children: [
          { id: crypto.randomUUID(), type: 'leaf', tabId: tab1?.id },
          { id: crypto.randomUUID(), type: 'leaf', tabId: tab2?.id },
        ],
      }
    }

    if (layout) {
      // Send to main process — this repositions the BrowserViews
      await CleaveIPC.setLayout(layout)
      // Update renderer state so ContentArea renders the split dividers
      setCleaveLayout(layout)
    }

    toggleCleave()
  }

  const reset = async () => {
    const singleLayout = { id: 'root', type: 'leaf' } as any
    await CleaveIPC.setLayout(singleLayout)
    setCleaveLayout(null)
    toggleCleave()
  }

  return (
    <div className={styles.overlay} onClick={toggleCleave}>
      <div className={`${styles.panel} k-scale-in`} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrap}>
              <SplitIcon />
            </div>
            <div>
              <h2 className={styles.title}>Cleave</h2>
              <p className={styles.subtitle}>Split your workspace into purposeful panes</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.resetBtn} onClick={reset}>Reset</button>
            <button className={styles.closeBtn} onClick={toggleCleave}><IconClose size={13} /></button>
          </div>
        </div>

        <div className={styles.grid}>
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`${styles.option} ${selected === opt.id ? styles.optionSelected : ''} ${opt.id === 'ai-beside' ? styles.optionAI : ''}`}
              onClick={() => apply(opt.id)}
            >
              <kbd className={styles.optKey}>{opt.key}</kbd>
              <div className={styles.preview}>
                <Preview type={opt.id} />
              </div>
              <div className={styles.optLabel}>{opt.title}</div>
              <div className={styles.optDesc}>{opt.desc}</div>
            </button>
          ))}
        </div>

        {activeTab && (
          <div className={styles.currentTab}>
            <span className={styles.currentTabLabel}>Active:</span>
            <span className={styles.currentTabTitle}>{activeTab.title}</span>
            {workspaceTabs.length > 1 && (
              <span className={styles.currentTabLabel} style={{ marginLeft: 12 }}>
                {workspaceTabs.length} tabs available for split
              </span>
            )}
          </div>
        )}

        <div className={styles.hints}>
          {OPTIONS.map(o => (
            <span key={o.id} className={styles.hint}>
              <kbd>{o.key}</kbd>{o.title}
            </span>
          ))}
          <span className={styles.hint}><kbd>R</kbd>Reset</span>
          <span className={styles.hint}><kbd>Esc</kbd>Close</span>
        </div>
      </div>
    </div>
  )
}

function Preview({ type }: { type: Mode }) {
  const s1 = 'var(--k-surface-3)'
  const s2 = 'var(--k-surface-4)'
  const ai = 'rgba(124,110,255,0.2)'
  const r  = '3'

  const views: Record<Mode, React.ReactNode> = {
    'split-h': (
      <>
        <rect x="1" y="1" width="37" height="50" rx={r} fill={s1} stroke="var(--k-border-2)" />
        <rect x="42" y="1" width="37" height="50" rx={r} fill={s2} stroke="var(--k-border-2)" />
      </>
    ),
    'split-v': (
      <>
        <rect x="1" y="1" width="78" height="23" rx={r} fill={s1} stroke="var(--k-border-2)" />
        <rect x="1" y="28" width="78" height="23" rx={r} fill={s2} stroke="var(--k-border-2)" />
      </>
    ),
    'ai-beside': (
      <>
        <rect x="1" y="1" width="48" height="50" rx={r} fill={s1} stroke="var(--k-border-2)" />
        <rect x="53" y="1" width="26" height="50" rx={r} fill={ai} stroke="rgba(124,110,255,0.3)" />
        <text x="66" y="30" fontSize="9" fill="rgba(124,110,255,0.7)" textAnchor="middle">AI</text>
      </>
    ),
    'triple': (
      <>
        <rect x="1" y="1" width="24" height="50" rx={r} fill={s1} stroke="var(--k-border-2)" />
        <rect x="29" y="1" width="22" height="50" rx={r} fill={s2} stroke="var(--k-border-2)" />
        <rect x="55" y="1" width="24" height="50" rx={r} fill={ai} stroke="rgba(124,110,255,0.3)" />
        <text x="67" y="30" fontSize="9" fill="rgba(124,110,255,0.7)" textAnchor="middle">AI</text>
      </>
    ),
    'workspace': (
      <>
        <rect x="1" y="1" width="37" height="50" rx={r} fill={s1} stroke="var(--k-border-2)" />
        <rect x="42" y="1" width="37" height="50" rx={r} fill={s2} stroke="var(--k-border-2)" />
        <rect x="4" y="4" width="31" height="5" rx="1" fill="rgba(255,107,53,0.35)" />
        <rect x="45" y="4" width="31" height="5" rx="1" fill="rgba(76,201,240,0.35)" />
      </>
    ),
    'group': (
      <>
        <rect x="1" y="1" width="37" height="50" rx={r} fill={s1} stroke="var(--k-border-2)" />
        <rect x="42" y="1" width="37" height="50" rx={r} fill={s1} stroke="var(--k-border-2)" />
        <rect x="4" y="4" width="6" height="6" rx="1" fill="rgba(165,148,255,0.6)" />
        <rect x="45" y="4" width="6" height="6" rx="1" fill="rgba(165,148,255,0.6)" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 80 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
      {views[type]}
    </svg>
  )
}

function SplitIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="2" width="8" height="20" rx="2" />
      <rect x="14" y="2" width="8" height="9" rx="2" />
      <rect x="14" y="13" width="8" height="9" rx="2" />
    </svg>
  )
}