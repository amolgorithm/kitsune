// src/renderer/components/CommandREPL/CommandREPL.tsx
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { CommandIPC } from '../../lib/ipc'
import type { CommandCatalogEntry } from '../../../shared/commandTypes'
import styles from './CommandREPL.module.css'

interface REPLEntry {
  id: string
  type: 'input' | 'output' | 'error' | 'info' | 'chain'
  content: string
  raw?: unknown
  timestamp: number
}

const MAX_HISTORY = 200

function normalise(cmd: string): string {
  const parts = cmd.trim().split(' ')
  const first = parts[0] ?? ''
  if (first.includes('.')) return cmd
  const sub = parts[1] ?? ''
  const isSubCmd = sub.length > 0 && !sub.includes('=') && !sub.includes('://') && !/^\d/.test(sub) && !sub.startsWith(':')
  if (isSubCmd) {
    return `${first}.${sub}${parts.slice(2).length ? ' ' + parts.slice(2).join(' ') : ''}`
  }
  return cmd
}

function formatResult(result: unknown): string {
  if (result === undefined || result === null) return '(null)'
  if (typeof result === 'string') return result
  if (typeof result === 'number' || typeof result === 'boolean') return String(result)
  try { return JSON.stringify(result, null, 2) } catch { return String(result) }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

const KITSUNE_ASCII = `  ╔═╗  ╦╔═╦╔╦╗╔═╗╦ ╦╔╗╔╔═╗
  ╠╩╗  ║╠╩╗ ║ ╚═╗║ ║║║║║╣ 
  ╚═╝  ╩╩ ╩ ╩ ╚═╝╚═╝╝╚╝╚═╝`

const HELP_TEXT = `Kitsune Command REPL

META
  help [category]          This help
  clear                    Clear output
  aliases                  List all aliases
  macros                   List all macros
  alias :short <cmd>       Create alias  e.g. alias :dv macro.run dev-session
  unalias :short           Remove alias
  chain / :run / :cancel   Multi-step chain mode
  :q / exit                Close REPL

MACROS
  macro.run <name>         Run a macro by name or alias
  macro.list               List all macros

COMMON COMMANDS
  tab.create url=<url>
  tab.openMany urls=a.com,b.com delay=300
  tab.closeMatching pattern=<regex>
  tab.hibernateAll
  tab.focusMatching pattern=github
  workspace.program <name>
  lens.set research
  ai.summarize
  ai.chat message="..."
  memory.report
  system.volume.set 60
  js.eval code="document.title"
  settings.theme midnight

BUILT-IN ALIASES
  :nt  new tab    :ct  close tab    :hi  hibernate all
  :ai  AI panel   :rw  research workspace`

// ─── Main component ────────────────────────────────────────────────

export function CommandREPL() {
  const toggleREPL = useBrowserStore(s => s.toggleREPL)
  const replOpen   = useBrowserStore(s => s.replOpen)

  const [input, setInput]                 = useState('')
  const [entries, setEntries]             = useState<REPLEntry[]>([])
  const [histIdx, setHistIdx]             = useState(-1)
  const [inputHistory, setInputHistory]   = useState<string[]>([])
  const [suggestions, setSuggestions]     = useState<CommandCatalogEntry[]>([])
  const [suggIdx, setSuggIdx]             = useState(-1)
  const [catalog, setCatalog]             = useState<CommandCatalogEntry[]>([])
  const [aliases, setAliases]             = useState<Array<{ short: string; expanded: string }>>([])
  const [chainMode, setChainMode]         = useState(false)
  const [chainCommands, setChainCommands] = useState<string[]>([])
  const [macros, setMacros]               = useState<Array<{ id: string; name: string; alias?: string; description: string; steps: unknown[]; runCount: number }>>([])
  const [sidebarTab, setSidebarTab]       = useState<'commands' | 'macros' | 'aliases' | 'history'>('commands')

  // ── Resize state ────────────────────────────────────────────────
  const [replHeight,      setReplHeight]      = useState(() => Math.round(window.innerHeight * 0.72))
  const [sidebarWidth,    setSidebarWidth]    = useState(260)
  const [draggingRepl,    setDraggingRepl]    = useState(false)
  const [draggingSidebar, setDraggingSidebar] = useState(false)
  const replDragStart    = useRef<{ y: number; h: number } | null>(null)
  const sidebarDragStart = useRef<{ x: number; w: number } | null>(null)

  const inputRef  = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  // ── REPL vertical drag ───────────────────────────────────────────
  const onReplMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    replDragStart.current = { y: e.clientY, h: replHeight }
    setDraggingRepl(true)
    const onMove = (ev: MouseEvent) => {
      if (!replDragStart.current) return
      const delta = replDragStart.current.y - ev.clientY
      const next  = Math.max(200, Math.min(window.innerHeight * 0.95, replDragStart.current.h + delta))
      setReplHeight(Math.round(next))
    }
    const onUp = () => {
      setDraggingRepl(false)
      replDragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [replHeight])

  // ── Sidebar horizontal drag ──────────────────────────────────────
  const onSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    sidebarDragStart.current = { x: e.clientX, w: sidebarWidth }
    setDraggingSidebar(true)
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragStart.current) return
      const delta = ev.clientX - sidebarDragStart.current.x
      const next  = Math.max(140, Math.min(480, sidebarDragStart.current.w + delta))
      setSidebarWidth(Math.round(next))
    }
    const onUp = () => {
      setDraggingSidebar(false)
      sidebarDragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  useEffect(() => {
    if (!replOpen) return
    inputRef.current?.focus()
    Promise.all([
      CommandIPC.listCommands(),
      CommandIPC.listAliases(),
      CommandIPC.listMacros(),
    ]).then(([cmds, als, mcs]) => {
      setCatalog(cmds)
      setAliases(als)
      setMacros(mcs)
    }).catch(console.error)
  }, [replOpen])

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries])

  const addEntry = useCallback((e: Omit<REPLEntry, 'id' | 'timestamp'>) => {
    setEntries(prev => [...prev.slice(-500), { ...e, id: crypto.randomUUID(), timestamp: Date.now() }])
  }, [])

  // ── Autocomplete ─────────────────────────────────────────────────
  const updateSuggestions = useCallback((val: string) => {
    if (!val.trim()) { setSuggestions([]); return }
    const q = val.toLowerCase()

    const aliasMatches = aliases
      .filter(a => a.short.startsWith(q))
      .map(a => ({ command: a.short, args: '', desc: `→ ${a.expanded}`, category: 'alias' as const }))
      .slice(0, 4)

    const macroMatches = macros
      .filter(m => m.name.toLowerCase().startsWith(q) || m.alias?.startsWith(q))
      .map(m => ({ command: m.alias ?? m.name, args: '', desc: `📼 ${m.description}`, category: 'macro' as const }))
      .slice(0, 4)

    const cmdMatches = catalog
      .filter(c => c.command.toLowerCase().startsWith(q) || c.command.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
      .slice(0, 8)

    setSuggestions([...aliasMatches, ...macroMatches, ...cmdMatches])
    setSuggIdx(-1)
  }, [catalog, aliases, macros])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    setHistIdx(-1)
    updateSuggestions(e.target.value)
  }, [updateSuggestions])

  // ── Core dispatcher ──────────────────────────────────────────────
  const executeCommand = useCallback(async (raw: string) => {
    let cmd = raw.trim()
    const firstWord = cmd.split(' ')[0] ?? ''

    // 1. Stored aliases
    const storedAlias = aliases.find(a => a.short === firstWord)
    if (storedAlias) {
      const rest = cmd.slice(firstWord.length).trim()
      cmd = rest ? `${storedAlias.expanded} ${rest}` : storedAlias.expanded
      addEntry({ type: 'info', content: `  ↳ ${cmd}` })
    } else {
      // 2. Macro alias field (e.g. :morning, :save baked into macro object)
      const macroByAlias = macros.find(m => m.alias === firstWord)
      if (macroByAlias) {
        addEntry({ type: 'info', content: `Running macro: ${macroByAlias.name}…` })
        try {
          const result = await CommandIPC.runMacro(macroByAlias.name)
          addEntry({ type: 'output', content: formatResult(result), raw: result })
        } catch (e: any) {
          addEntry({ type: 'error', content: `✗ ${e.message}` })
        }
        return
      }

      // 3. Macro by full name
      const macroByName = macros.find(m => m.name === firstWord)
      if (macroByName) {
        addEntry({ type: 'info', content: `Running macro: ${macroByName.name}…` })
        try {
          const result = await CommandIPC.runMacro(macroByName.name)
          addEntry({ type: 'output', content: formatResult(result), raw: result })
        } catch (e: any) {
          addEntry({ type: 'error', content: `✗ ${e.message}` })
        }
        return
      }
    }

    // 4. Normalise space → dot notation
    cmd = normalise(cmd)

    // 5. Fast-path: macro.run
    if (cmd.startsWith('macro.run')) {
      const name = cmd.slice('macro.run'.length).trim()
      if (!name) { addEntry({ type: 'error', content: 'Usage: macro.run <name>' }); return }
      addEntry({ type: 'info', content: `Running macro: ${name}…` })
      try {
        const result = await CommandIPC.runMacro(name)
        addEntry({ type: 'output', content: formatResult(result), raw: result })
      } catch (e: any) {
        addEntry({ type: 'error', content: `✗ ${e.message}` })
      }
      return
    }

    // 6. Fast-path: macro.list
    if (cmd === 'macro.list') {
      const mcs = await CommandIPC.listMacros()
      addEntry({ type: 'output', content: mcs.length === 0 ? '(none)' : mcs.map((m: any) => `  ${(m.alias ?? m.name).padEnd(20)} ${m.description}`).join('\n') })
      return
    }

    // 7. Fast-path: workspace.program
    if (cmd.startsWith('workspace.program') || cmd.startsWith('program.run')) {
      const name = cmd.split(' ').slice(1).join(' ').trim()
      if (!name) { addEntry({ type: 'error', content: 'Usage: workspace.program <name>' }); return }
      addEntry({ type: 'info', content: `Launching program: ${name}…` })
      try {
        const result = await CommandIPC.runProgram(name)
        addEntry({ type: 'output', content: formatResult(result), raw: result })
      } catch (e: any) {
        addEntry({ type: 'error', content: `✗ ${e.message}` })
      }
      return
    }

    // 8. General command engine
    try {
      const result = await CommandIPC.execute(cmd)
      addEntry({ type: 'output', content: formatResult(result), raw: result })
    } catch (e: any) {
      addEntry({ type: 'error', content: `✗ ${e.message}` })
    }
  }, [aliases, macros, addEntry])

  // ── Submit ───────────────────────────────────────────────────────
  const submit = useCallback(async (rawInput?: string) => {
    const cmd = (rawInput ?? input).trim()
    if (!cmd) return

    setSuggestions([])

    // Chain accumulation
    if (chainMode) {
      if (cmd === ':run') {
        setChainMode(false)
        const chain = [...chainCommands]
        setChainCommands([])
        addEntry({ type: 'input', content: `> :run  (${chain.length} steps)` })
        setInput('')
        addEntry({ type: 'info', content: `Executing chain of ${chain.length} commands…` })
        try {
          const result = await CommandIPC.runChain(chain.map(normalise))
          addEntry({ type: 'output', content: formatResult(result), raw: result })
        } catch (e: any) {
          addEntry({ type: 'error', content: `Chain error: ${e.message}` })
        }
        return
      }
      if (cmd === ':cancel') {
        setChainMode(false)
        setChainCommands([])
        addEntry({ type: 'info', content: 'Chain cancelled' })
        setInput('')
        return
      }
      setChainCommands(prev => [...prev, cmd])
      addEntry({ type: 'chain', content: `  + ${cmd}` })
      setInput('')
      return
    }

    addEntry({ type: 'input', content: `> ${cmd}` })
    setInputHistory(prev => [cmd, ...prev.slice(0, MAX_HISTORY)])
    setInput('')
    setHistIdx(-1)

    // Meta commands
    if (cmd === ':q' || cmd === 'exit' || cmd === 'quit') { toggleREPL(); return }
    if (cmd === 'clear' || cmd === ':clear') { setEntries([]); return }

    if (cmd === 'chain' || cmd === ':chain') {
      setChainMode(true)
      setChainCommands([])
      addEntry({ type: 'info', content: 'Chain mode — enter commands one per line, then :run or :cancel' })
      return
    }

    if (cmd === 'help' || cmd === '?') { addEntry({ type: 'output', content: HELP_TEXT }); return }

    if (cmd.startsWith('help ') || cmd.startsWith('? ')) {
      const topic = cmd.slice(cmd.indexOf(' ') + 1).trim()
      const matches = catalog.filter(c => c.command.startsWith(topic) || c.category === topic)
      addEntry({ type: 'output', content: matches.length > 0
        ? matches.map(m => `  ${m.command.padEnd(28)} ${m.args.padEnd(20)} — ${m.desc}`).join('\n')
        : `No commands matching '${topic}'` })
      return
    }

    if (cmd === 'aliases') {
      addEntry({ type: 'output', content: aliases.length === 0 ? '(none)' : aliases.map(a => `  ${a.short.padEnd(16)} → ${a.expanded}`).join('\n') })
      return
    }

    if (cmd === 'macros') {
      const mcs = await CommandIPC.listMacros()
      addEntry({ type: 'output', content: mcs.length === 0 ? '(none)' : mcs.map((m: any) => `  ${(m.alias ?? m.name).padEnd(20)} ${m.description}`).join('\n') })
      return
    }

    if (cmd.startsWith('alias ')) {
      const parts = cmd.slice(6).trim().split(' ')
      const short = parts[0] ?? ''
      const expanded = parts.slice(1).join(' ')
      if (!short || !expanded) { addEntry({ type: 'error', content: 'Usage: alias :short macro.run <name>' }); return }
      try {
        await CommandIPC.createAlias(short, expanded)
        setAliases(prev => [...prev.filter(a => a.short !== short), { short, expanded }])
        addEntry({ type: 'output', content: `✓ Alias created: ${short} → ${expanded}` })
      } catch (e: any) { addEntry({ type: 'error', content: e.message }) }
      return
    }

    if (cmd.startsWith('unalias ')) {
      const short = cmd.slice(8).trim()
      try {
        await CommandIPC.deleteAlias(short)
        setAliases(prev => prev.filter(a => a.short !== short))
        addEntry({ type: 'output', content: `✓ Alias removed: ${short}` })
      } catch (e: any) { addEntry({ type: 'error', content: e.message }) }
      return
    }

    await executeCommand(cmd)
  }, [input, chainMode, chainCommands, catalog, aliases, toggleREPL, addEntry, executeCommand])

  // ── Keyboard ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { toggleREPL(); return }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (suggestions.length > 0) {
        const idx = suggIdx < 0 ? 0 : (suggIdx + 1) % suggestions.length
        setSuggIdx(idx)
        setInput(suggestions[idx]!.command + ' ')
        setSuggestions([])
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestions.length > 0) { setSuggIdx(Math.max(0, suggIdx - 1)); return }
      const newIdx = Math.min(histIdx + 1, inputHistory.length - 1)
      setHistIdx(newIdx)
      setInput(inputHistory[newIdx] ?? '')
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (suggestions.length > 0) { setSuggIdx(Math.min(suggestions.length - 1, suggIdx + 1)); return }
      const newIdx = Math.max(-1, histIdx - 1)
      setHistIdx(newIdx)
      setInput(newIdx === -1 ? '' : (inputHistory[newIdx] ?? ''))
      return
    }

    if (e.key === 'Enter') {
      if (suggIdx >= 0 && suggestions[suggIdx]) {
        setInput(suggestions[suggIdx]!.command + ' ')
        setSuggestions([])
        setSuggIdx(-1)
        return
      }
      submit()
    }
  }, [suggestions, suggIdx, histIdx, inputHistory, submit, toggleREPL])

  if (!replOpen) return null

  const overlayClass = [
    styles.overlay,
    draggingRepl    ? styles.draggingGlobal  : '',
    draggingSidebar ? styles.draggingGlobalH : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={overlayClass}
      onClick={(e) => { if (e.target === e.currentTarget && !draggingRepl && !draggingSidebar) toggleREPL() }}
    >
      <div className={`${styles.repl} k-scale-in`} style={{ height: replHeight }}>

        {/* REPL vertical resize handle — drag up/down to resize */}
        <div
          className={`${styles.replResizeHandle} ${draggingRepl ? styles.dragging : ''}`}
          onMouseDown={onReplMouseDown}
          title="Drag to resize"
        />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.termIcon}>⌘_</div>
            <div>
              <span className={styles.title}>Kitsune REPL</span>
              <span className={styles.subtitle}> — programmable browser console</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            {chainMode && (
              <span className={styles.chainBadge}>
                CHAIN MODE · {chainCommands.length} steps · <span>:run</span> · <span>:cancel</span>
              </span>
            )}
            <button className={styles.closeBtn} onClick={toggleREPL}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* Sidebar with horizontal resize handle */}
          <div className={styles.sidebarWrap} style={{ width: sidebarWidth }}>
            <div className={styles.sidebar}>
              <div className={styles.sidebarTabs}>
                {(['commands', 'macros', 'aliases', 'history'] as const).map(t => (
                  <button
                    key={t}
                    className={`${styles.sidebarTab} ${sidebarTab === t ? styles.sidebarTabActive : ''}`}
                    onClick={() => setSidebarTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className={styles.sidebarContent}>
                {sidebarTab === 'commands' && (
                  <CommandsList catalog={catalog} onInsert={(cmd) => { setInput(cmd + ' '); inputRef.current?.focus() }} />
                )}
                {sidebarTab === 'macros' && (
                  <MacrosList macros={macros} onRun={(name) => submit(`macro.run ${name}`)} />
                )}
                {sidebarTab === 'aliases' && (
                  <AliasesList aliases={aliases} onInsert={(s) => { setInput(s); inputRef.current?.focus() }} />
                )}
                {sidebarTab === 'history' && (
                  <HistoryList entries={entries} onRerun={(cmd) => { setInput(cmd); inputRef.current?.focus() }} />
                )}
              </div>
            </div>
            {/* Sidebar horizontal resize handle — drag left/right */}
            <div
              className={`${styles.sidebarResizeHandle} ${draggingSidebar ? styles.dragging : ''}`}
              onMouseDown={onSidebarMouseDown}
              title="Drag to resize sidebar"
            />
          </div>

          {/* Terminal */}
          <div className={styles.terminal}>
            <div ref={outputRef} className={styles.output}>
              {entries.length === 0 && (
                <div className={styles.welcome}>
                  <div className={styles.welcomeArt}>{KITSUNE_ASCII}</div>
                  <div className={styles.welcomeText}>
                    <kbd>help</kbd> for commands · <kbd>Tab</kbd> autocomplete · <kbd>↑↓</kbd> history · <kbd>:q</kbd> close
                    <br />
                    Run a macro: <kbd>macro.run my-macro</kbd> · or its alias: <kbd>:morning</kbd>
                    <br />
                    Create alias: <kbd>alias :xx macro.run my-macro</kbd>
                    <br />
                    Drag top edge to resize · drag sidebar edge to resize sidebar
                  </div>
                </div>
              )}
              {entries.map(entry => (
                <OutputEntry key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Input */}
            <div className={styles.inputRow}>
              <span className={styles.prompt}>{chainMode ? '⋮' : '›'}</span>
              <div className={styles.inputWrap}>
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.input}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder={chainMode
                    ? 'Add step… (:run to execute · :cancel to abort)'
                    : ':morning  · macro.run my-macro  · tab.create url=…  · help'}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {suggestions.length > 0 && (
                  <div className={styles.suggestions}>
                    {suggestions.map((s, i) => (
                      <button
                        key={s.command + i}
                        className={`${styles.suggestion} ${i === suggIdx ? styles.suggestionActive : ''}`}
                        onClick={() => { setInput(s.command + ' '); setSuggestions([]); inputRef.current?.focus() }}
                      >
                        <span className={`${styles.suggCategory} ${(styles as any)[`cat_${s.category}`] ?? ''}`}>
                          {s.category}
                        </span>
                        <span className={styles.suggCommand}>{s.command}</span>
                        {s.args && <span className={styles.suggArgs}>{s.args}</span>}
                        <span className={styles.suggDesc}>{s.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className={styles.submitBtn} onClick={() => submit()} title="Execute (Enter)">↵</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function OutputEntry({ entry }: { entry: REPLEntry }) {
  const cls = {
    input:  styles.entryInput,
    output: styles.entryOutput,
    error:  styles.entryError,
    info:   styles.entryInfo,
    chain:  styles.entryChain,
  }[entry.type]

  return (
    <div className={`${styles.entry} ${cls ?? ''}`}>
      <span className={styles.entryTime}>{formatTime(entry.timestamp)}</span>
      <pre className={styles.entryContent}>{entry.content}</pre>
    </div>
  )
}

function CommandsList({ catalog, onInsert }: {
  catalog: CommandCatalogEntry[]
  onInsert: (cmd: string) => void
}) {
  const [filter, setFilter] = useState('')
  const [cat, setCat]       = useState('all')
  const categories = useMemo(() => ['all', ...new Set(catalog.map(c => c.category))], [catalog])
  const filtered   = catalog.filter(c =>
    (cat === 'all' || c.category === cat) &&
    (!filter || c.command.includes(filter) || c.desc.toLowerCase().includes(filter.toLowerCase()))
  )
  return (
    <div className={styles.sidebarList}>
      <input
        className={styles.sidebarFilter}
        placeholder="Filter commands…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <div className={styles.catTabs}>
        {categories.map(c => (
          <button
            key={c}
            className={`${styles.catTab} ${cat === c ? styles.catTabActive : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className={styles.cmdList}>
        {filtered.map(c => (
          <button key={c.command} className={styles.cmdItem} onClick={() => onInsert(c.command)}>
            <span className={styles.cmdName}>{c.command}</span>
            <span className={styles.cmdDesc}>{c.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MacrosList({ macros, onRun }: {
  macros: Array<{ id: string; name: string; alias?: string; description: string; steps: unknown[]; runCount: number }>
  onRun: (name: string) => void
}) {
  return (
    <div className={styles.sidebarList}>
      {macros.length === 0 && (
        <div className={styles.emptyState}>No macros yet.<br />Create one in Settings → Macros.</div>
      )}
      {macros.map(m => (
        <button key={m.id} className={styles.macroItem} onClick={() => onRun(m.name)}>
          <div className={styles.macroName}>
            {m.alias && <kbd className={styles.macroAlias}>{m.alias}</kbd>}
            {m.name}
          </div>
          <div className={styles.macroDesc}>{m.description}</div>
          <div className={styles.macroMeta}>{m.steps.length} steps · run {m.runCount}×</div>
        </button>
      ))}
    </div>
  )
}

function AliasesList({ aliases, onInsert }: {
  aliases: Array<{ short: string; expanded: string }>
  onInsert: (s: string) => void
}) {
  return (
    <div className={styles.sidebarList}>
      {aliases.length === 0 && (
        <div className={styles.emptyState}>No aliases yet.<br />Type: <code>alias :xx macro.run name</code></div>
      )}
      {aliases.map(a => (
        <button key={a.short} className={styles.aliasItem} onClick={() => onInsert(a.short)}>
          <kbd className={styles.aliasShort}>{a.short}</kbd>
          <span className={styles.aliasExpanded}>{a.expanded}</span>
        </button>
      ))}
    </div>
  )
}

function HistoryList({ entries, onRerun }: {
  entries: REPLEntry[]
  onRerun: (cmd: string) => void
}) {
  const inputs = entries.filter(e => e.type === 'input').reverse()
  return (
    <div className={styles.sidebarList}>
      {inputs.length === 0 && <div className={styles.emptyState}>No history yet.</div>}
      {inputs.map(e => (
        <button key={e.id} className={styles.histItem} onClick={() => onRerun(e.content.slice(2))}>
          <span className={styles.histCmd}>{e.content.slice(2)}</span>
          <span className={styles.histTime}>{formatTime(e.timestamp)}</span>
        </button>
      ))}
    </div>
  )
}