// src/renderer/components/CommandREPL/CommandREPL.tsx
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { CommandIPC, TabIPC } from '../../lib/ipc'
import type { CommandCatalogEntry } from '../../../shared/commandTypes'
import styles from './CommandREPL.module.css'

// ─── Types ────────────────────────────────────────────────────────

interface REPLEntry {
  id: string
  type: 'input' | 'output' | 'error' | 'info' | 'chain'
  content: string
  raw?: unknown
  timestamp: number
}

const MAX_HISTORY = 200
// Height threshold above which we consider the user "focused" — apply blur overlay
const FOCUS_HEIGHT_THRESHOLD = 420

// ─── Helpers ──────────────────────────────────────────────────────

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
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

// Split a space-separated list of alias/command tokens.
// A token starts with ':' (alias) OR is a known dot-command with no args.
// Quoted values inside a single command stay together.
// e.g. ":dv :ai" → [":dv", ":ai"]
//      ":hi lens.set research" → [":hi", "lens.set research"]  ← lens.set takes an arg so kept together
// Strategy: split on runs of whitespace that are followed by a ':' prefix
// or by a word that looks like a standalone alias/no-arg command.
function splitMultiCommand(input: string): string[] {
  const trimmed = input.trim()

  // Fast path: if there's only one colon-prefixed token or no colon at all
  // and no obvious multi-command pattern, treat as single command
  const tokens = trimmed.split(/\s+/)

  // Collect groups: a new group starts whenever a token begins with ':'
  // OR when we see a dot-command token (e.g. "tab.hibernateAll") after
  // another command has already been started.
  const groups: string[][] = []
  let current: string[] = []

  for (const token of tokens) {
    const isAlias     = token.startsWith(':')
    const isDotNoArg  = /^[a-z]+\.[a-zA-Z]+$/.test(token) // e.g. "tab.hibernateAll" with no =
    const startsNew   = isAlias || (isDotNoArg && current.length > 0)

    if (startsNew && current.length > 0) {
      groups.push(current)
      current = [token]
    } else {
      current.push(token)
    }
  }
  if (current.length > 0) groups.push(current)

  return groups.map(g => g.join(' ')).filter(Boolean)
}

const KITSUNE_ASCII = `  ╔═╗  ╦╔═╦╔╦╗╔═╗╦ ╦╔╗╔╔═╗
  ╠╩╗  ║╠╩╗ ║ ╚═╗║ ║║║║║╣ 
  ╚═╝  ╩╩ ╩ ╩ ╚═╝╚═╝╝╚╝╚═╝`

const HELP_TEXT = `Kitsune Command REPL

MULTI-COMMAND  (space-separated, runs left to right)
  :dv :ai              — run both aliases sequentially
  :hi :rw              — hibernate all, then open research workspace
  tab.hibernateAll memory.report  — two dot-commands in one line

META
  help [category]      This help
  clear                Clear output
  aliases              List all aliases
  macros               List all macros
  alias :short <cmd>   Create alias
  chain / :run / :cancel   Multi-step chain mode
  :dv :ai :hi              space-separate to run multiple
  :q / exit            Close REPL

COMMON COMMANDS
  tab.create url=<url>
  tab.openMany urls=a.com,b.com delay=300
  tab.hibernateAll
  workspace.program <name>
  lens.set research
  ai.summarize
  memory.report
  system.volume.set 60

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
  const [macros, setMacros]               = useState<Array<any>>([])
  const [sidebarTab, setSidebarTab]       = useState<'commands'|'macros'|'aliases'|'history'>('commands')

  // ── Height / resize state ─────────────────────────────────────
  // Default: compact inline bar (200px). User drags up to expand.
  const DEFAULT_HEIGHT = 200
  const [replHeight,      setReplHeight]      = useState(DEFAULT_HEIGHT)
  const [sidebarWidth,    setSidebarWidth]    = useState(240)
  const [draggingRepl,    setDraggingRepl]    = useState(false)
  const [draggingSidebar, setDraggingSidebar] = useState(false)
  const replDragStart    = useRef<{ y: number; h: number } | null>(null)
  const sidebarDragStart = useRef<{ x: number; w: number } | null>(null)

  // "Focus mode" = user has dragged REPL tall — apply blur overlay
  const focusMode = replHeight >= FOCUS_HEIGHT_THRESHOLD

  // ── REPL vertical drag ───────────────────────────────────────
  const onReplMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    replDragStart.current = { y: e.clientY, h: replHeight }
    setDraggingRepl(true)
    const onMove = (ev: MouseEvent) => {
      if (!replDragStart.current) return
      const delta = replDragStart.current.y - ev.clientY
      const next  = Math.max(120, Math.min(window.innerHeight * 0.92, replDragStart.current.h + delta))
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

  // ── Sidebar horizontal drag ──────────────────────────────────
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

  // Double-click resize handle: toggle compact ↔ expanded
  const onReplDoubleClick = useCallback(() => {
    setReplHeight(h => h >= FOCUS_HEIGHT_THRESHOLD ? DEFAULT_HEIGHT : Math.round(window.innerHeight * 0.65))
  }, [])

  const inputRef  = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

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

  // Pass the full REPL height to main so the BrowserView bottom edge aligns
  // exactly with the top of the REPL panel. The REPL fills the reserved space
  // so there is no visible black gap — just page above, REPL below.
  useEffect(() => {
    if (!replOpen) {
      TabIPC.setReplHeight(0).catch(console.error)
      return
    }
    TabIPC.setReplHeight(replHeight).catch(console.error)
    return () => { TabIPC.setReplHeight(0).catch(console.error) }
  }, [replOpen, replHeight])

  // Focus mode: hide the BrowserView entirely so the backdrop blur actually
  // covers the webpage. BrowserView is a native OS layer — CSS blur/z-index
  // cannot reach it. Restore on shrink back below threshold or on unmount.
  useEffect(() => {
    if (focusMode) {
      TabIPC.modalOpen().catch(console.error)
    } else {
      // Only call modalClose if we're actually open (avoid spurious close on
      // initial mount before focus mode has ever been entered).
      if (replOpen) TabIPC.modalClose().catch(console.error)
    }
    return () => { if (focusMode) TabIPC.modalClose().catch(console.error) }
  }, [focusMode, replOpen])

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries])

  const addEntry = useCallback((e: Omit<REPLEntry, 'id'|'timestamp'>) => {
    setEntries(prev => [...prev.slice(-500), { ...e, id: crypto.randomUUID(), timestamp: Date.now() }])
  }, [])

  // ── Autocomplete ─────────────────────────────────────────────
  const updateSuggestions = useCallback((val: string) => {
    // Only autocomplete the last segment after && or ;
    const segs   = splitMultiCommand(val)
    const active = segs[segs.length - 1]?.trim() ?? val.trim()
    if (!active) { setSuggestions([]); return }

    const q = active.toLowerCase()
    const aliasMatches = aliases
      .filter(a => a.short.startsWith(q))
      .map(a => ({ command: a.short, args: '', desc: `→ ${a.expanded}`, category: 'alias' as const }))
      .slice(0, 3)
    const macroMatches = macros
      .filter(m => m.name.toLowerCase().startsWith(q) || m.alias?.startsWith(q))
      .map(m => ({ command: m.alias ?? m.name, args: '', desc: `📼 ${m.description}`, category: 'macro' as const }))
      .slice(0, 3)
    const cmdMatches = catalog
      .filter(c => c.command.toLowerCase().startsWith(q) || c.command.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
      .slice(0, 7)

    setSuggestions([...aliasMatches, ...macroMatches, ...cmdMatches])
    setSuggIdx(-1)
  }, [catalog, aliases, macros])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    setHistIdx(-1)
    updateSuggestions(e.target.value)
  }, [updateSuggestions])

  // ── Expand aliases recursively ───────────────────────────────
  const expandAliasStr = useCallback((cmd: string): string => {
    const parts = cmd.trim().split(' ')
    const first = parts[0] ?? ''
    const stored = aliases.find(a => a.short === first)
    if (stored) {
      const rest = parts.slice(1).join(' ')
      return rest ? `${stored.expanded} ${rest}` : stored.expanded
    }
    const macroByAlias = macros.find(m => m.alias === first)
    if (macroByAlias) return `macro.run ${macroByAlias.name}`
    const macroByName  = macros.find(m => m.name === first)
    if (macroByName) return `macro.run ${macroByName.name}`
    return cmd
  }, [aliases, macros])

  // ── Execute a single resolved command ───────────────────────
  const executeSingle = useCallback(async (raw: string): Promise<void> => {
    let cmd = raw.trim()
    if (!cmd) return

    // Expand alias / macro shorthand
    const expanded = expandAliasStr(cmd)
    if (expanded !== cmd) {
      addEntry({ type: 'info', content: `  ↳ ${expanded}` })
      cmd = expanded
    }

    cmd = normalise(cmd)

    // Fast-path: macro.run
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

    // Fast-path: macro.list
    if (cmd === 'macro.list') {
      const mcs = await CommandIPC.listMacros()
      addEntry({ type: 'output', content: mcs.length === 0 ? '(none)' : mcs.map((m: any) => `  ${(m.alias ?? m.name).padEnd(20)} ${m.description}`).join('\n') })
      return
    }

    // Fast-path: workspace.program
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

    // General command engine
    try {
      const result = await CommandIPC.execute(cmd)
      addEntry({ type: 'output', content: formatResult(result), raw: result })
    } catch (e: any) {
      addEntry({ type: 'error', content: `✗ ${e.message}` })
    }
  }, [expandAliasStr, addEntry])

  // ── Submit ───────────────────────────────────────────────────
  const submit = useCallback(async (rawInput?: string) => {
    const raw = (rawInput ?? input).trim()
    if (!raw) return

    setSuggestions([])

    // ── Chain mode accumulation ─────────────────────────────
    if (chainMode) {
      if (raw === ':run') {
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
      if (raw === ':cancel') {
        setChainMode(false); setChainCommands([])
        addEntry({ type: 'info', content: 'Chain cancelled' })
        setInput(''); return
      }
      setChainCommands(prev => [...prev, raw])
      addEntry({ type: 'chain', content: `  + ${raw}` })
      setInput(''); return
    }

    addEntry({ type: 'input', content: `> ${raw}` })
    setInputHistory(prev => [raw, ...prev.slice(0, MAX_HISTORY)])
    setInput('')
    setHistIdx(-1)

    // ── Meta commands ───────────────────────────────────────
    if (raw === ':q' || raw === 'exit' || raw === 'quit') { toggleREPL(); return }
    if (raw === 'clear' || raw === ':clear') { setEntries([]); return }
    if (raw === 'chain' || raw === ':chain') {
      setChainMode(true); setChainCommands([])
      addEntry({ type: 'info', content: 'Chain mode — enter commands one per line, then :run or :cancel' })
      return
    }
    if (raw === 'help' || raw === '?') { addEntry({ type: 'output', content: HELP_TEXT }); return }
    if (raw.startsWith('help ') || raw.startsWith('? ')) {
      const topic = raw.slice(raw.indexOf(' ') + 1).trim()
      const matches = catalog.filter(c => c.command.startsWith(topic) || c.category === topic)
      addEntry({ type: 'output', content: matches.length > 0
        ? matches.map(m => `  ${m.command.padEnd(28)} ${m.args.padEnd(20)} — ${m.desc}`).join('\n')
        : `No commands matching '${topic}'` })
      return
    }
    if (raw === 'aliases') {
      addEntry({ type: 'output', content: aliases.length === 0 ? '(none)' : aliases.map(a => `  ${a.short.padEnd(16)} → ${a.expanded}`).join('\n') })
      return
    }
    if (raw === 'macros') {
      const mcs = await CommandIPC.listMacros()
      addEntry({ type: 'output', content: mcs.length === 0 ? '(none)' : mcs.map((m: any) => `  ${(m.alias ?? m.name).padEnd(20)} ${m.description}`).join('\n') })
      return
    }
    if (raw.startsWith('alias ')) {
      const parts = raw.slice(6).trim().split(' ')
      const short = parts[0] ?? ''; const expanded = parts.slice(1).join(' ')
      if (!short || !expanded) { addEntry({ type: 'error', content: 'Usage: alias :short macro.run <name>' }); return }
      try {
        await CommandIPC.createAlias(short, expanded)
        setAliases(prev => [...prev.filter(a => a.short !== short), { short, expanded }])
        addEntry({ type: 'output', content: `✓ Alias created: ${short} → ${expanded}` })
      } catch (e: any) { addEntry({ type: 'error', content: e.message }) }
      return
    }
    if (raw.startsWith('unalias ')) {
      const short = raw.slice(8).trim()
      try {
        await CommandIPC.deleteAlias(short)
        setAliases(prev => prev.filter(a => a.short !== short))
        addEntry({ type: 'output', content: `✓ Alias removed: ${short}` })
      } catch (e: any) { addEntry({ type: 'error', content: e.message }) }
      return
    }

    // ── MULTI-COMMAND: split on && or ; ─────────────────────
    const segments = splitMultiCommand(raw)

    if (segments.length > 1) {
      addEntry({ type: 'info', content: `Running ${segments.length} commands…` })
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!
        addEntry({ type: 'chain', content: `  [${i+1}/${segments.length}] ${seg}` })
        await executeSingle(seg)
      }
      return
    }

    // Single command
    await executeSingle(raw)
  }, [input, chainMode, chainCommands, catalog, aliases, toggleREPL, addEntry, executeSingle])

  // ── Keyboard ─────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { toggleREPL(); return }
    if (e.key === 'Tab') {
      e.preventDefault()
      if (suggestions.length > 0) {
        const idx = suggIdx < 0 ? 0 : (suggIdx + 1) % suggestions.length
        setSuggIdx(idx)
        // Replace only the last segment
        const segs = splitMultiCommand(input)
        segs[segs.length - 1] = suggestions[idx]!.command + ' '
        setInput(segs.join(' '))
        setSuggestions([])
      }
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestions.length > 0) { setSuggIdx(Math.max(0, suggIdx - 1)); return }
      const newIdx = Math.min(histIdx + 1, inputHistory.length - 1)
      setHistIdx(newIdx); setInput(inputHistory[newIdx] ?? '')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (suggestions.length > 0) { setSuggIdx(Math.min(suggestions.length - 1, suggIdx + 1)); return }
      const newIdx = Math.max(-1, histIdx - 1)
      setHistIdx(newIdx); setInput(newIdx === -1 ? '' : (inputHistory[newIdx] ?? ''))
      return
    }
    if (e.key === 'Enter') {
      if (suggIdx >= 0 && suggestions[suggIdx]) {
        const segs = splitMultiCommand(input)
        segs[segs.length - 1] = suggestions[suggIdx]!.command + ' '
        setInput(segs.join(' '))
        setSuggestions([]); setSuggIdx(-1); return
      }
      submit()
    }
  }, [suggestions, suggIdx, histIdx, inputHistory, submit, toggleREPL, input])

  if (!replOpen) return null

  const overlayClass = [
    styles.wrapper,
    focusMode ? styles.wrapperFocus : styles.wrapperInline,
    draggingRepl    ? styles.draggingGlobal  : '',
    draggingSidebar ? styles.draggingGlobalH : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={overlayClass} style={{ height: replHeight }}>
      {/* Focus-mode backdrop — only renders when tall enough */}
      {focusMode && (
        <div className={styles.backdrop} onClick={toggleREPL} />
      )}

      <div className={`${styles.repl}`} style={{ height: replHeight }}>
        {/* Resize handle */}
        <div
          className={`${styles.replResizeHandle} ${draggingRepl ? styles.dragging : ''}`}
          onMouseDown={onReplMouseDown}
          onDoubleClick={onReplDoubleClick}
          title="Drag to resize · double-click to toggle"
        />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.termIcon}>⌘_</div>
            <div>
              <span className={styles.title}>REPL</span>
              <span className={styles.subtitle}> — use single-space, <code>&&</code>, or <code>;</code> to chain commands</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            {chainMode && (
              <span className={styles.chainBadge}>
                CHAIN · {chainCommands.length} steps · <span>:run</span> · <span>:cancel</span>
              </span>
            )}
            <button className={styles.closeBtn} onClick={toggleREPL}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Sidebar */}
          <div className={styles.sidebarWrap} style={{ width: sidebarWidth }}>
            <div className={styles.sidebar}>
              <div className={styles.sidebarTabs}>
                {(['commands','macros','aliases','history'] as const).map(t => (
                  <button key={t}
                    className={`${styles.sidebarTab} ${sidebarTab === t ? styles.sidebarTabActive : ''}`}
                    onClick={() => setSidebarTab(t)}>
                    {t}
                  </button>
                ))}
              </div>
              <div className={styles.sidebarContent}>
                {sidebarTab === 'commands' && (
                  <CommandsList catalog={catalog} onInsert={cmd => { setInput(p => p ? `${p} ${cmd} ` : `${cmd} `); inputRef.current?.focus() }} />
                )}
                {sidebarTab === 'macros' && (
                  <MacrosList macros={macros} onRun={name => submit(`macro.run ${name}`)} />
                )}
                {sidebarTab === 'aliases' && (
                  <AliasesList aliases={aliases} onInsert={s => { setInput(p => p ? `${p} ${s}` : s); inputRef.current?.focus() }} />
                )}
                {sidebarTab === 'history' && (
                  <HistoryList entries={entries} onRerun={cmd => { setInput(cmd); inputRef.current?.focus() }} />
                )}
              </div>
            </div>
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
                    Chain commands: <kbd>:dv :ai</kbd> or <kbd>:hi :rw</kbd> — space-separated aliases run in order
                    <br />
                    <kbd>Tab</kbd> autocomplete · <kbd>↑↓</kbd> history · <kbd>:q</kbd> close
                    <br />
                    Drag top edge to resize · double-click to toggle compact/expanded
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
                    : ':dv :ai  ·  tab.create url=…  ·  help'}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {suggestions.length > 0 && (
                  <div className={styles.suggestions}>
                    {suggestions.map((s, i) => (
                      <button key={s.command + i}
                        className={`${styles.suggestion} ${i === suggIdx ? styles.suggestionActive : ''}`}
                        onClick={() => {
                          const segs = splitMultiCommand(input)
                          segs[segs.length - 1] = s.command + ' '
                          setInput(segs.join(' '))
                          setSuggestions([])
                          inputRef.current?.focus()
                        }}>
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
    input: styles.entryInput, output: styles.entryOutput,
    error: styles.entryError, info: styles.entryInfo, chain: styles.entryChain,
  }[entry.type]
  return (
    <div className={`${styles.entry} ${cls ?? ''}`}>
      <span className={styles.entryTime}>{formatTime(entry.timestamp)}</span>
      <pre className={styles.entryContent}>{entry.content}</pre>
    </div>
  )
}

function CommandsList({ catalog, onInsert }: { catalog: CommandCatalogEntry[]; onInsert: (cmd: string) => void }) {
  const [filter, setFilter] = useState('')
  const [cat, setCat]       = useState('all')
  const categories = useMemo(() => ['all', ...new Set(catalog.map(c => c.category))], [catalog])
  const filtered   = catalog.filter(c =>
    (cat === 'all' || c.category === cat) &&
    (!filter || c.command.includes(filter) || c.desc.toLowerCase().includes(filter.toLowerCase()))
  )
  return (
    <div className={styles.sidebarList}>
      <input className={styles.sidebarFilter} placeholder="Filter commands…"
        value={filter} onChange={e => setFilter(e.target.value)} />
      <div className={styles.catTabs}>
        {categories.map(c => (
          <button key={c}
            className={`${styles.catTab} ${cat === c ? styles.catTabActive : ''}`}
            onClick={() => setCat(c)}>{c}</button>
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
      {macros.length === 0 && <div className={styles.emptyState}>No macros yet.</div>}
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

function AliasesList({ aliases, onInsert }: { aliases: Array<{ short: string; expanded: string }>; onInsert: (s: string) => void }) {
  return (
    <div className={styles.sidebarList}>
      {aliases.length === 0 && <div className={styles.emptyState}>No aliases yet.</div>}
      {aliases.map(a => (
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