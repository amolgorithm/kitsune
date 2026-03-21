// src/renderer/components/CommandREPL/CommandREPL.tsx
// ─────────────────────────────────────────────────────────────────
// Kitsune Command REPL — Neovim-level programmable browser control
//
// `:` prefix → command mode
// Tab → autocomplete
// Up/Down → history navigation
// Ctrl+Enter → chain mode
// ─────────────────────────────────────────────────────────────────
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

export function CommandREPL() {
  const toggleREPL      = useBrowserStore(s => s.toggleREPL)
  const replOpen        = useBrowserStore(s => s.replOpen)
  const [input, setInput]       = useState('')
  const [entries, setEntries]   = useState<REPLEntry[]>([])
  const [histIdx, setHistIdx]   = useState(-1)
  const [inputHistory, setInputHistory] = useState<string[]>([])
  const [suggestions, setSuggestions]   = useState<CommandCatalogEntry[]>([])
  const [suggIdx, setSuggIdx]   = useState(-1)
  const [catalog, setCatalog]   = useState<CommandCatalogEntry[]>([])
  const [aliases, setAliases]   = useState<Array<{ short: string; expanded: string }>>([])
  const [chainMode, setChainMode] = useState(false)
  const [chainCommands, setChainCommands] = useState<string[]>([])
  const [macros, setMacros]     = useState<Array<{ name: string; alias?: string; description: string }>>([])
  const [sidebarTab, setSidebarTab] = useState<'commands' | 'macros' | 'aliases' | 'history'>('commands')

  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (replOpen) {
      inputRef.current?.focus()
      // Load catalog and aliases on open
      Promise.all([
        CommandIPC.listCommands(),
        CommandIPC.listAliases(),
        CommandIPC.listMacros(),
      ]).then(([cmds, als, mcs]) => {
        setCatalog(cmds)
        setAliases(als)
        setMacros(mcs)
      }).catch(console.error)
    }
  }, [replOpen])

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries])

  // ── Autocomplete ──────────────────────────────────────────────────
  const updateSuggestions = useCallback((val: string) => {
    if (!val.trim()) { setSuggestions([]); return }

    const q = val.toLowerCase()
    const cmdMatches = catalog.filter(c =>
      c.command.toLowerCase().startsWith(q) ||
      c.command.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q)
    ).slice(0, 8)

    const aliasMatches = aliases
      .filter(a => a.short.startsWith(q))
      .map(a => ({
        command: a.short,
        args: '',
        desc: `→ ${a.expanded}`,
        category: 'alias' as const,
      }))
      .slice(0, 4)

    const macroMatches = macros
      .filter(m => m.name.toLowerCase().startsWith(q) || m.alias?.startsWith(q))
      .map(m => ({
        command: m.alias ?? m.name,
        args: '',
        desc: `📼 ${m.description}`,
        category: 'macro' as const,
      }))
      .slice(0, 4)

    setSuggestions([...aliasMatches, ...macroMatches, ...cmdMatches])
    setSuggIdx(-1)
  }, [catalog, aliases, macros])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    setHistIdx(-1)
    updateSuggestions(val)
  }, [updateSuggestions])

  // ── Submit command ────────────────────────────────────────────────
  const submit = useCallback(async (rawInput?: string) => {
    const cmd = (rawInput ?? input).trim()
    if (!cmd) return

    setSuggestions([])

    if (chainMode) {
      // Accumulate chain steps
      setChainCommands(prev => [...prev, cmd])
      addEntry({ type: 'chain', content: `  + ${cmd}` })
      setInput('')
      return
    }

    // Log input
    addEntry({ type: 'input', content: `> ${cmd}` })
    setInputHistory(prev => [cmd, ...prev.slice(0, MAX_HISTORY)])
    setInput('')
    setHistIdx(-1)

    // Handle built-in REPL meta-commands
    if (cmd === ':q' || cmd === 'exit' || cmd === 'quit') { toggleREPL(); return }
    if (cmd === 'clear' || cmd === ':clear') { setEntries([]); return }
    if (cmd === 'chain' || cmd === ':chain') {
      setChainMode(true)
      setChainCommands([])
      addEntry({ type: 'info', content: 'Chain mode: enter commands, then type :run to execute' })
      return
    }
    if (cmd === ':run' && chainMode) {
      setChainMode(false)
      const chain = [...chainCommands]
      setChainCommands([])
      addEntry({ type: 'info', content: `Running chain of ${chain.length} commands…` })
      try {
        const result = await CommandIPC.runChain(chain)
        addEntry({ type: 'output', content: formatResult(result), raw: result })
      } catch (e: any) {
        addEntry({ type: 'error', content: `Chain error: ${e.message}` })
      }
      return
    }
    if (cmd === ':cancel' && chainMode) {
      setChainMode(false)
      setChainCommands([])
      addEntry({ type: 'info', content: 'Chain cancelled' })
      return
    }
    if (cmd === 'help' || cmd === '?') {
      addEntry({ type: 'output', content: HELP_TEXT })
      return
    }
    if (cmd.startsWith('help ') || cmd.startsWith('? ')) {
      const topic = cmd.slice(cmd.indexOf(' ') + 1).trim()
      const matches = catalog.filter(c => c.command.startsWith(topic) || c.category === topic)
      if (matches.length > 0) {
        addEntry({ type: 'output', content: matches.map(m => `  ${m.command.padEnd(28)} ${m.args.padEnd(24)} — ${m.desc}`).join('\n') })
      } else {
        addEntry({ type: 'error', content: `No commands matching '${topic}'` })
      }
      return
    }
    if (cmd.startsWith('alias ')) {
      // alias :short expanded command string
      const parts = cmd.slice(6).split(' ')
      const short = parts[0]!
      const expanded = parts.slice(1).join(' ')
      try {
        await CommandIPC.createAlias(short, expanded)
        setAliases(prev => [...prev.filter(a => a.short !== short), { short, expanded }])
        addEntry({ type: 'output', content: `Alias created: ${short} → ${expanded}` })
      } catch (e: any) {
        addEntry({ type: 'error', content: e.message })
      }
      return
    }
    if (cmd.startsWith('macro ')) {
      const args = cmd.slice(6).trim()
      if (args.startsWith('run ')) {
        const name = args.slice(4).trim()
        try {
          addEntry({ type: 'info', content: `Running macro: ${name}…` })
          const result = await CommandIPC.runMacro(name)
          addEntry({ type: 'output', content: formatResult(result), raw: result })
        } catch (e: any) {
          addEntry({ type: 'error', content: `Macro error: ${e.message}` })
        }
      } else if (args === 'list') {
        const mcs = await CommandIPC.listMacros()
        addEntry({ type: 'output', content: mcs.map((m: any) => `  ${(m.alias ?? m.name).padEnd(20)} ${m.description}`).join('\n') || '(no macros)' })
      }
      return
    }

    // Execute via command engine
    try {
      const result = await CommandIPC.execute(cmd)
      addEntry({ type: 'output', content: formatResult(result), raw: result })
    } catch (e: any) {
      addEntry({ type: 'error', content: `✗ ${e.message}` })
    }
  }, [input, chainMode, chainCommands, catalog, toggleREPL])

  // ── Keyboard handler ──────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { toggleREPL(); return }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (suggestions.length > 0) {
        const idx = (suggIdx + 1) % suggestions.length
        setSuggIdx(idx)
        setInput(suggestions[idx]!.command + ' ')
        setSuggestions([])
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestions.length > 0) {
        setSuggIdx(Math.max(0, suggIdx - 1))
        return
      }
      const newIdx = Math.min(histIdx + 1, inputHistory.length - 1)
      setHistIdx(newIdx)
      setInput(inputHistory[newIdx] ?? '')
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (suggestions.length > 0) {
        setSuggIdx(Math.min(suggestions.length - 1, suggIdx + 1))
        return
      }
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
      return
    }
  }, [suggestions, suggIdx, histIdx, inputHistory, submit, toggleREPL])

  const addEntry = useCallback((e: Omit<REPLEntry, 'id' | 'timestamp'>) => {
    setEntries(prev => [...prev.slice(-500), { ...e, id: crypto.randomUUID(), timestamp: Date.now() }])
  }, [])

  if (!replOpen) return null

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) toggleREPL() }}>
      <div className={`${styles.repl} k-scale-in`}>
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
                CHAIN MODE · {chainCommands.length} steps · <span>:run</span> to execute · <span>:cancel</span>
              </span>
            )}
            <button className={styles.closeBtn} onClick={toggleREPL}>✕</button>
          </div>
        </div>

        <div className={styles.body}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarTabs}>
              {(['commands', 'macros', 'aliases', 'history'] as const).map(t => (
                <button key={t}
                  className={`${styles.sidebarTab} ${sidebarTab === t ? styles.sidebarTabActive : ''}`}
                  onClick={() => setSidebarTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            <div className={styles.sidebarContent}>
              {sidebarTab === 'commands' && (
                <CommandsList catalog={catalog} onInsert={(cmd) => { setInput(cmd + ' '); inputRef.current?.focus() }} />
              )}
              {sidebarTab === 'macros' && (
                <MacrosList macros={macros} onRun={(name) => submit(`macro run ${name}`)} />
              )}
              {sidebarTab === 'aliases' && (
                <AliasesList aliases={aliases} onInsert={(s) => { setInput(s + ' '); inputRef.current?.focus() }} />
              )}
              {sidebarTab === 'history' && (
                <HistoryList entries={entries} onRerun={(cmd) => { setInput(cmd); inputRef.current?.focus() }} />
              )}
            </div>
          </div>

          {/* Main terminal */}
          <div className={styles.terminal}>
            {/* Output */}
            <div ref={outputRef} className={styles.output}>
              {entries.length === 0 && (
                <div className={styles.welcome}>
                  <div className={styles.welcomeArt}>{KITSUNE_ASCII}</div>
                  <div className={styles.welcomeText}>
                    Type <kbd>help</kbd> or <kbd>?</kbd> for commands · <kbd>Tab</kbd> for autocomplete · <kbd>:q</kbd> to close
                  </div>
                </div>
              )}
              {entries.map(entry => (
                <OutputEntry key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Input row */}
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
                  placeholder={chainMode ? 'Add command to chain…' : 'command args… or :alias :macro run chain'}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <div className={styles.suggestions}>
                    {suggestions.map((s, i) => (
                      <button
                        key={s.command}
                        className={`${styles.suggestion} ${i === suggIdx ? styles.suggestionActive : ''}`}
                        onClick={() => { setInput(s.command + ' '); setSuggestions([]); inputRef.current?.focus() }}
                      >
                        <span className={`${styles.suggCategory} ${styles[`cat_${s.category}`] ?? ''}`}>
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
              <button
                className={styles.submitBtn}
                onClick={() => submit()}
                title="Execute (Enter)"
              >↵</button>
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
    input: styles.entryInput,
    output: styles.entryOutput,
    error: styles.entryError,
    info: styles.entryInfo,
    chain: styles.entryChain,
  }[entry.type]

  return (
    <div className={`${styles.entry} ${cls}`}>
      <span className={styles.entryTime}>{formatTime(entry.timestamp)}</span>
      <pre className={styles.entryContent}>{entry.content}</pre>
    </div>
  )
}

function CommandsList({ catalog, onInsert }: { catalog: CommandCatalogEntry[]; onInsert: (cmd: string) => void }) {
  const [filter, setFilter] = useState('')
  const [cat, setCat] = useState<string>('all')
  const categories = useMemo(() => ['all', ...new Set(catalog.map(c => c.category))], [catalog])
  const filtered = catalog.filter(c =>
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
          <button key={c} className={`${styles.catTab} ${cat === c ? styles.catTabActive : ''}`}
            onClick={() => setCat(c)}>
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

function MacrosList({ macros, onRun }: { macros: any[]; onRun: (name: string) => void }) {
  return (
    <div className={styles.sidebarList}>
      {macros.length === 0 && <div className={styles.emptyState}>No macros yet. Create one in Settings → Macros.</div>}
      {macros.map((m: any) => (
        <button key={m.id} className={styles.macroItem} onClick={() => onRun(m.name)}>
          <div className={styles.macroName}>
            {m.alias && <kbd className={styles.macroAlias}>{m.alias}</kbd>}
            {m.name}
          </div>
          <div className={styles.macroDesc}>{m.description}</div>
          <div className={styles.macroMeta}>{m.steps?.length ?? 0} steps · run {m.runCount ?? 0}×</div>
        </button>
      ))}
    </div>
  )
}

function AliasesList({ aliases, onInsert }: { aliases: any[]; onInsert: (s: string) => void }) {
  return (
    <div className={styles.sidebarList}>
      {aliases.length === 0 && <div className={styles.emptyState}>No aliases yet. Type: alias :short expanded command</div>}
      {aliases.map((a: any) => (
        <button key={a.short} className={styles.aliasItem} onClick={() => onInsert(a.short)}>
          <kbd className={styles.aliasShort}>{a.short}</kbd>
          <span className={styles.aliasExpanded}>{a.expanded}</span>
        </button>
      ))}
    </div>
  )
}

function HistoryList({ entries, onRerun }: { entries: REPLEntry[]; onRerun: (cmd: string) => void }) {
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

// ─── Helpers ──────────────────────────────────────────────────────
function formatResult(result: unknown): string {
  if (result === undefined || result === null) return '(null)'
  if (typeof result === 'string') return result
  if (typeof result === 'number' || typeof result === 'boolean') return String(result)
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

const KITSUNE_ASCII = `  ╔═╗  ╦╔═╦╔╦╗╔═╗╦ ╦╔╗╔╔═╗
  ╠╩╗  ║╠╩╗ ║ ╚═╗║ ║║║║║╣ 
  ╚═╝  ╩╩ ╩ ╩ ╚═╝╚═╝╝╚╝╚═╝`

const HELP_TEXT = `Kitsune Command REPL — Neovim-level browser control

BUILT-IN
  help [category]      Show this help or filter by category
  clear                Clear output
  chain                Start chain mode (multi-command)
  :run                 Execute current chain
  :cancel              Cancel chain
  :q / exit / quit     Close REPL
  alias :short cmd     Create alias

QUICK ALIASES (built-in)
  :nt                  New tab
  :ct                  Close tab
  :hi                  Hibernate all background tabs
  :ai                  Toggle AI panel
  :rw                  Launch research workspace
  :morning             Morning session macro

EXAMPLES
  tab.create url=https://github.com
  tab.openMany urls=https://a.com,https://b.com delay=300
  ai.chat message="Summarize this page"
  workspace.program dev-workspace
  lens.set research
  memory.hibernate.threshold minutes=5
  system.volume.set 50
  js.eval code="document.title"
  chain
    tab.create url=https://google.com
    tab.create url=https://github.com
    ai.panel.open
  :run

Press Tab for autocomplete · Up/Down for history`
