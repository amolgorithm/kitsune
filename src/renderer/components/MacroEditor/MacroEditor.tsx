// src/renderer/components/MacroEditor/MacroEditor.tsx
// UI for creating, editing, and running macros + workspace programs
import { useState, useEffect } from 'react'
import { CommandIPC } from '../../lib/commandIpc'
import styles from './MacroEditor.module.css'

interface Macro {
  id: string
  name: string
  alias?: string
  description: string
  steps: MacroStep[]
  tags: string[]
  runCount: number
  lastRun?: number
}

interface MacroStep {
  id: string
  command: string
  args: Record<string, unknown>
  delay?: number
  continueOnError?: boolean
  comment?: string
}

interface Program {
  id: string
  name: string
  description: string
  tabs: Array<{ url: string; title?: string; groupLabel?: string; groupColor?: string }>
  createdAt: number
}

type EditorTab = 'macros' | 'programs' | 'scheduled' | 'aliases'

export function MacroEditor() {
  const [tab, setTab] = useState<EditorTab>('macros')
  const [macros, setMacros] = useState<Macro[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [aliases, setAliases] = useState<any[]>([])
  const [scheduled, setScheduled] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Macro> | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [newAlias, setNewAlias] = useState({ short: '', expanded: '' })
  const [newProgTab, setNewProgTab] = useState({ url: '', groupLabel: '' })

  useEffect(() => {
    refresh()
  }, [tab])

  const refresh = async () => {
    try {
      const [mcs, prgs, als, sched] = await Promise.all([
        CommandIPC.listMacros(),
        CommandIPC.listPrograms(),
        CommandIPC.listAliases(),
        CommandIPC.listScheduled(),
      ])
      setMacros(mcs)
      setPrograms(prgs)
      setAliases(als)
      setScheduled(sched)
    } catch (e) { console.error(e) }
  }

  const runMacro = async (name: string) => {
    setRunning(name)
    setResult(null)
    try {
      const res = await CommandIPC.runMacro(name)
      setResult(`✓ Completed in ${res.durationMs}ms · ${res.results.length} steps`)
    } catch (e: any) {
      setResult(`✗ ${e.message}`)
    } finally {
      setRunning(null)
    }
  }

  const deleteMacro = async (id: string) => {
    await CommandIPC.deleteMacro(id)
    setMacros(prev => prev.filter(m => m.id !== id))
    if (selected === id) setSelected(null)
  }

  const deleteAlias = async (short: string) => {
    await CommandIPC.deleteAlias(short)
    setAliases(prev => prev.filter((a: any) => a.short !== short))
  }

  const createAlias = async () => {
    if (!newAlias.short || !newAlias.expanded) return
    await CommandIPC.createAlias(newAlias.short, newAlias.expanded)
    setNewAlias({ short: '', expanded: '' })
    await refresh()
  }

  const saveMacro = async () => {
    if (!editing) return
    if (editing.id) {
      await CommandIPC.updateMacro(editing.id, editing)
    } else {
      await CommandIPC.createMacro({ ...editing, steps: editing.steps ?? [] })
    }
    setEditing(null)
    await refresh()
  }

  const TABS: Array<{ id: EditorTab; label: string }> = [
    { id: 'macros',    label: 'Macros' },
    { id: 'programs',  label: 'Workspace Programs' },
    { id: 'aliases',   label: 'Aliases' },
    { id: 'scheduled', label: 'Scheduled' },
  ]

  return (
    <div className={styles.editor}>
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => { setTab(t.id); setSelected(null); setEditing(null) }}>
            {t.label}
          </button>
        ))}
      </div>

      {result && (
        <div className={`${styles.result} ${result.startsWith('✓') ? styles.resultOk : styles.resultErr}`}>
          {result}
          <button className={styles.resultClose} onClick={() => setResult(null)}>✕</button>
        </div>
      )}

      {tab === 'macros' && (
        <div className={styles.content}>
          {/* Macro list */}
          <div className={styles.list}>
            <div className={styles.listHeader}>
              <span className={styles.listTitle}>Macros</span>
              <button className={styles.addBtn} onClick={() => setEditing({ name: '', description: '', steps: [], tags: [] })}>
                + New Macro
              </button>
            </div>
            {macros.length === 0 && (
              <div className={styles.empty}>No macros yet. Create one to automate repetitive workflows.</div>
            )}
            {macros.map(m => (
              <div key={m.id}
                className={`${styles.macroItem} ${selected === m.id ? styles.macroItemActive : ''}`}
                onClick={() => setSelected(m.id)}>
                <div className={styles.macroHeader}>
                  {m.alias && <kbd className={styles.alias}>{m.alias}</kbd>}
                  <span className={styles.macroName}>{m.name}</span>
                  <span className={styles.macroSteps}>{m.steps.length} steps</span>
                </div>
                <div className={styles.macroDesc}>{m.description}</div>
                <div className={styles.macroMeta}>
                  Run {m.runCount}×
                  {m.lastRun && ` · last: ${new Date(m.lastRun).toLocaleString()}`}
                  {m.tags.length > 0 && ` · ${m.tags.join(', ')}`}
                </div>
                <div className={styles.macroActions}>
                  <button
                    className={styles.runBtn}
                    disabled={running === m.name}
                    onClick={e => { e.stopPropagation(); runMacro(m.name) }}>
                    {running === m.name ? '…' : '▶ Run'}
                  </button>
                  <button className={styles.editBtn}
                    onClick={e => { e.stopPropagation(); setEditing({ ...m }) }}>
                    Edit
                  </button>
                  <button className={styles.deleteBtn}
                    onClick={e => { e.stopPropagation(); deleteMacro(m.id) }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Macro editor panel */}
          {editing !== null && (
            <div className={styles.editPanel}>
              <div className={styles.editHeader}>
                <span>{editing.id ? 'Edit Macro' : 'New Macro'}</span>
                <button className={styles.cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
              </div>
              <label className={styles.label}>Name</label>
              <input className={styles.field} value={editing.name ?? ''}
                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                placeholder="my-workflow" />
              <label className={styles.label}>Alias (optional, e.g. :mw)</label>
              <input className={styles.field} value={editing.alias ?? ''}
                onChange={e => setEditing(p => ({ ...p, alias: e.target.value }))}
                placeholder=":mw" />
              <label className={styles.label}>Description</label>
              <input className={styles.field} value={editing.description ?? ''}
                onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                placeholder="What does this macro do?" />
              <label className={styles.label}>Steps (one command per line)</label>
              <textarea className={styles.stepsArea}
                value={(editing.steps ?? []).map((s: MacroStep) =>
                  `${s.command}${Object.entries(s.args).map(([k,v]) => ` ${k}=${v}`).join('')}${s.delay ? ` delay=${s.delay}` : ''}${s.comment ? ` # ${s.comment}` : ''}`
                ).join('\n')}
                onChange={e => {
                  const lines = e.target.value.split('\n').filter(Boolean)
                  const steps: MacroStep[] = lines.map(line => {
                    const commentParts = line.split(' # ')
                    const comment = commentParts[1]
                    const parts = (commentParts[0] ?? line).trim().split(/\s+/)
                    const command = parts[0] ?? ''
                    const args: Record<string, unknown> = {}
                    let delay: number | undefined
                    for (const p of parts.slice(1)) {
                      if (p.startsWith('delay=')) { delay = parseInt(p.slice(6)); continue }
                      const [k, ...v] = p.split('=')
                      if (k) args[k] = v.join('=')
                    }
                    return { id: crypto.randomUUID(), command, args, delay, comment }
                  })
                  setEditing(p => ({ ...p, steps }))
                }}
                rows={8}
                placeholder={`tab.create url=https://github.com\ntab.create url=https://mail.google.com delay=300\nai.panel.open # Open AI panel\nlens.set research`}
              />
              <div className={styles.editActions}>
                <button className={styles.saveBtn} onClick={saveMacro}>Save Macro</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'programs' && (
        <div className={styles.content}>
          <div className={styles.list}>
            <div className={styles.listHeader}>
              <span className={styles.listTitle}>Workspace Programs</span>
            </div>
            <div className={styles.progHint}>
              Programs open a set of tabs in a new or existing workspace, optionally with grouping and AI clustering.
              Run via: <kbd>workspace.program my-program-name</kbd> or from the REPL.
            </div>
            {programs.map(p => (
              <div key={p.id} className={styles.progItem}>
                <div className={styles.progHeader}>
                  <span className={styles.progName}>{p.name}</span>
                  <span className={styles.progTabCount}>{p.tabs.length} tabs</span>
                </div>
                <div className={styles.progDesc}>{p.description}</div>
                <div className={styles.progTabs}>
                  {p.tabs.slice(0, 5).map((t, i) => (
                    <span key={i} className={styles.progTabUrl}>{t.url}</span>
                  ))}
                  {p.tabs.length > 5 && <span className={styles.progMore}>+{p.tabs.length - 5} more</span>}
                </div>
                <div className={styles.progActions}>
                  <button className={styles.runBtn}
                    onClick={() => CommandIPC.runProgram(p.name)}>
                    ▶ Launch
                  </button>
                  <button className={styles.deleteBtn}
                    onClick={async () => { await CommandIPC.deleteProgram(p.id); refresh() }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'aliases' && (
        <div className={styles.content}>
          <div className={styles.list}>
            <div className={styles.listHeader}>
              <span className={styles.listTitle}>Command Aliases</span>
            </div>
            <div className={styles.aliasForm}>
              <input className={styles.field} placeholder=":short  (e.g. :gh)"
                value={newAlias.short}
                onChange={e => setNewAlias(p => ({ ...p, short: e.target.value }))} />
              <input className={styles.field} placeholder="expanded command (e.g. tab.create url=https://github.com)"
                value={newAlias.expanded}
                onChange={e => setNewAlias(p => ({ ...p, expanded: e.target.value }))} />
              <button className={styles.saveBtn} onClick={createAlias}>Add Alias</button>
            </div>
            {aliases.map((a: any) => (
              <div key={a.short} className={styles.aliasItem}>
                <kbd className={styles.aliasKey}>{a.short}</kbd>
                <span className={styles.aliasExpanded}>→ {a.expanded}</span>
                {a.description && <span className={styles.aliasDesc}>{a.description}</span>}
                <button className={styles.deleteBtn} onClick={() => deleteAlias(a.short)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'scheduled' && (
        <div className={styles.content}>
          <div className={styles.list}>
            <div className={styles.listHeader}>
              <span className={styles.listTitle}>Scheduled Commands</span>
            </div>
            <div className={styles.schedHint}>
              Schedule macros or commands to run automatically at intervals.
            </div>
            {scheduled.length === 0 && (
              <div className={styles.empty}>No scheduled commands. Create one via the REPL or settings.</div>
            )}
            {scheduled.map((s: any) => (
              <div key={s.id} className={styles.schedItem}>
                <div className={styles.schedHeader}>
                  <span className={styles.schedName}>{s.name}</span>
                  <button
                    className={`${styles.toggleBtn} ${s.enabled ? styles.toggleOn : styles.toggleOff}`}
                    onClick={async () => { await CommandIPC.toggleScheduled(s.id, !s.enabled); refresh() }}>
                    {s.enabled ? 'On' : 'Off'}
                  </button>
                </div>
                <div className={styles.schedMeta}>
                  {s.schedule.type === 'interval' && `Every ${Math.round(s.schedule.intervalMs / 60000)}min`}
                  {s.schedule.type === 'once' && `Once at ${new Date(s.schedule.runAt).toLocaleString()}`}
                  {` · run ${s.runCount}×`}
                  {s.lastRun && ` · last: ${new Date(s.lastRun).toLocaleTimeString()}`}
                </div>
                <button className={styles.deleteBtn}
                  onClick={async () => { await CommandIPC.deleteScheduled(s.id); refresh() }}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
