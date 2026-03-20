// src/renderer/components/Cleave/CleaveOverlay.tsx
import { useState } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import { CleaveIPC } from '../../lib/ipc'
import styles from './CleaveOverlay.module.css'

type SplitMode =
  | 'split-h'       // split horizontal (side by side)
  | 'split-v'       // split vertical (top/bottom)
  | 'ai-beside'     // current tab + AI pane
  | 'workspace'     // split by workspace
  | 'group'         // split by tab group
  | 'triple'        // three-way split

const SPLIT_OPTIONS = [
  {
    id: 'split-h',
    key: 'H',
    title: 'Split Horizontally',
    desc: 'Two panes side by side',
    preview: 'horizontal',
  },
  {
    id: 'split-v',
    key: 'V',
    title: 'Split Vertically',
    desc: 'Stack panes top and bottom',
    preview: 'vertical',
  },
  {
    id: 'ai-beside',
    key: 'A',
    title: 'AI Beside',
    desc: 'Current tab + dedicated AI pane',
    preview: 'ai',
  },
  {
    id: 'triple',
    key: 'T',
    title: 'Three-Way Split',
    desc: 'Reference, work, and AI panes',
    preview: 'triple',
  },
  {
    id: 'workspace',
    key: 'W',
    title: 'By Workspace',
    desc: 'Show tabs from different workspaces',
    preview: 'workspace',
  },
  {
    id: 'group',
    key: 'G',
    title: 'By Group',
    desc: 'Expand a tab group across panes',
    preview: 'group',
  },
] as const

export function CleaveOverlay() {
  const toggleCleave  = useBrowserStore(s => s.toggleCleave)
  const activeTab     = useActiveTab()
  const tabs          = useBrowserStore(s => s.tabs)
  const [selected, setSelected] = useState<string | null>(null)
  const [applied, setApplied]   = useState(false)

  const handleApply = async (mode: string) => {
    setSelected(mode)

    // Build a PaneNode based on mode and send to main
    if (mode === 'split-h' || mode === 'split-v') {
      const otherTab = tabs.find(t => t.id !== activeTab?.id)
      const layout = {
        id: crypto.randomUUID(),
        type: 'split' as const,
        direction: (mode === 'split-h' ? 'horizontal' : 'vertical') as any,
        sizes: [50, 50],
        children: [
          { id: crypto.randomUUID(), type: 'leaf' as const, tabId: activeTab?.id },
          { id: crypto.randomUUID(), type: 'leaf' as const, tabId: otherTab?.id },
        ],
      }
      await CleaveIPC.setLayout(layout)
    }

    if (mode === 'ai-beside') {
      const layout = {
        id: crypto.randomUUID(),
        type: 'split' as const,
        direction: 'horizontal' as const,
        sizes: [65, 35],
        children: [
          { id: crypto.randomUUID(), type: 'leaf' as const, tabId: activeTab?.id },
          { id: crypto.randomUUID(), type: 'leaf' as const, isAIPane: true },
        ],
      }
      await CleaveIPC.setLayout(layout)
    }

    setApplied(true)
    setTimeout(() => toggleCleave(), 300)
  }

  const handleReset = async () => {
    await CleaveIPC.setLayout({ id: 'root', type: 'leaf' })
    toggleCleave()
  }

  return (
    <div className={styles.overlay} onClick={toggleCleave}>
      <div className={`${styles.panel} k-scale-in`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>⧉</div>
            <div>
              <h2 className={styles.title}>
                <span className={styles.titleAccent}>Cleave</span>
              </h2>
              <p className={styles.subtitle}>Split your browser into purposeful panes</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.resetBtn} onClick={handleReset}>Reset layout</button>
            <kbd className={styles.closeKbd} onClick={toggleCleave}>esc</kbd>
          </div>
        </div>

        {/* Options grid */}
        <div className={styles.grid}>
          {SPLIT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`${styles.option} ${selected === opt.id ? styles.optionSelected : ''} ${opt.id === 'ai-beside' ? styles.optionAI : ''}`}
              onClick={() => handleApply(opt.id)}
            >
              {/* Key hint */}
              <kbd className={styles.optKey}>{opt.key}</kbd>

              {/* Preview diagram */}
              <div className={styles.preview}>
                <SplitPreview type={opt.preview as any} />
              </div>

              {/* Label */}
              <div className={styles.optText}>
                <div className={styles.optTitle}>{opt.title}</div>
                <div className={styles.optDesc}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Current tab info */}
        {activeTab && (
          <div className={styles.currentTab}>
            <span className={styles.currentTabLabel}>Active tab:</span>
            <span className={styles.currentTabTitle}>{activeTab.title}</span>
          </div>
        )}

        {/* Hotkey hints */}
        <div className={styles.hotkeyHints}>
          {SPLIT_OPTIONS.map(opt => (
            <div key={opt.id} className={styles.hint}>
              <kbd className={styles.hintKey}>{opt.key}</kbd>
              <span>{opt.title}</span>
            </div>
          ))}
          <div className={styles.hint}>
            <kbd className={styles.hintKey}>R</kbd>
            <span>Reset</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Split preview SVG diagrams ────────────────────────────────────

function SplitPreview({ type }: { type: 'horizontal' | 'vertical' | 'ai' | 'triple' | 'workspace' | 'group' }) {
  const fill1 = 'var(--k-surface-3)'
  const fill2 = 'var(--k-surface-4)'
  const fillAI = 'rgba(124,110,255,0.25)'
  const stroke = 'var(--k-border-2)'
  const r = '3'

  if (type === 'horizontal') return (
    <svg viewBox="0 0 80 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="37" height="50" rx={r} fill={fill1} stroke={stroke}/>
      <rect x="42" y="1" width="37" height="50" rx={r} fill={fill2} stroke={stroke}/>
    </svg>
  )

  if (type === 'vertical') return (
    <svg viewBox="0 0 80 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="78" height="23" rx={r} fill={fill1} stroke={stroke}/>
      <rect x="1" y="28" width="78" height="23" rx={r} fill={fill2} stroke={stroke}/>
    </svg>
  )

  if (type === 'ai') return (
    <svg viewBox="0 0 80 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="48" height="50" rx={r} fill={fill1} stroke={stroke}/>
      <rect x="53" y="1" width="26" height="50" rx={r} fill={fillAI} stroke="rgba(124,110,255,0.3)"/>
      <text x="66" y="29" fontSize="10" fill="rgba(124,110,255,0.6)" textAnchor="middle">✦</text>
    </svg>
  )

  if (type === 'triple') return (
    <svg viewBox="0 0 80 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="24" height="50" rx={r} fill={fill1} stroke={stroke}/>
      <rect x="29" y="1" width="24" height="50" rx={r} fill={fill2} stroke={stroke}/>
      <rect x="57" y="1" width="22" height="50" rx={r} fill={fillAI} stroke="rgba(124,110,255,0.3)"/>
      <text x="68" y="29" fontSize="9" fill="rgba(124,110,255,0.6)" textAnchor="middle">✦</text>
    </svg>
  )

  if (type === 'workspace') return (
    <svg viewBox="0 0 80 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="37" height="50" rx={r} fill={fill1} stroke={stroke}/>
      <rect x="42" y="1" width="37" height="50" rx={r} fill={fill2} stroke={stroke}/>
      <rect x="4" y="4" width="31" height="6" rx="1" fill="rgba(255,107,53,0.3)"/>
      <rect x="45" y="4" width="31" height="6" rx="1" fill="rgba(76,201,240,0.3)"/>
    </svg>
  )

  // group
  return (
    <svg viewBox="0 0 80 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="37" height="50" rx={r} fill={fill1} stroke={stroke}/>
      <rect x="42" y="1" width="37" height="50" rx={r} fill={fill1} stroke={stroke}/>
      <rect x="4" y="4" width="6" height="6" rx="1" fill="rgba(165,148,255,0.6)"/>
      <rect x="45" y="4" width="6" height="6" rx="1" fill="rgba(165,148,255,0.6)"/>
    </svg>
  )
}
