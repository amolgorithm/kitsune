// src/main/services/CommandEngine.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune Command Engine — Neovim-level programmable browser control
//
// Features:
//  - Named macros (sequences of commands with args)
//  - Aliases (short → full command strings)
//  - Chains (pipe output / run in sequence)
//  - Anti-commands (undo-aware actions)
//  - Workspace programs (open multiple tabs, groups, settings)
//  - Scheduled / repeating commands
//  - System commands (volume, memory, hibernation)
//  - AI-powered commands
//  - Persistent storage via electron-store
// ─────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto'
import type { SettingsStore } from './SettingsStore'

// ─── Types ────────────────────────────────────────────────────────

export interface KitsuneCommand {
  id: string
  name: string                   // e.g. 'tab.create'
  description: string
  category: CommandCategory
  params: CommandParam[]
  antiCommand?: string           // command name that undoes this
  tags: string[]
}

export type CommandCategory =
  | 'tab' | 'workspace' | 'ai' | 'privacy' | 'system'
  | 'navigation' | 'ui' | 'memory' | 'macro' | 'script'

export interface CommandParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'url' | 'tabId' | 'workspaceId' | 'enum'
  required: boolean
  default?: unknown
  enum?: string[]
  description?: string
}

export interface Macro {
  id: string
  name: string
  alias?: string                 // short invocation e.g. ':rw' → 'workspace.research'
  description: string
  steps: MacroStep[]
  tags: string[]
  createdAt: number
  runCount: number
  lastRun?: number
}

export interface MacroStep {
  id: string
  command: string                // command name
  args: Record<string, unknown>
  condition?: string             // JS expression evaluated before step
  delay?: number                 // ms to wait before this step
  continueOnError?: boolean
  comment?: string
}

export interface Alias {
  id: string
  short: string                  // e.g. ':rw'
  expanded: string               // full command string e.g. 'workspace.switch research'
  description?: string
  createdAt: number
}

export interface WorkspaceProgram {
  id: string
  name: string
  description: string
  workspaceId?: string           // create in this workspace, or new one
  newWorkspaceName?: string
  tabs: Array<{
    url: string
    title?: string
    groupLabel?: string
    groupColor?: string
    background?: boolean
  }>
  settings?: Record<string, unknown>  // settings patches to apply
  ai?: {
    clusterAfterLoad?: boolean
    summarizeFirst?: boolean
  }
  createdAt: number
}

export interface ScheduledCommand {
  id: string
  name: string
  macroId?: string
  command?: string
  args?: Record<string, unknown>
  schedule: {
    type: 'interval' | 'cron' | 'once'
    intervalMs?: number
    cronExpr?: string
    runAt?: number
  }
  enabled: boolean
  lastRun?: number
  runCount: number
  createdAt: number
}

export interface CommandHistory {
  id: string
  command: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
  executedAt: number
  durationMs: number
  undone?: boolean
}

export interface CommandEngineState {
  macros: Macro[]
  aliases: Alias[]
  programs: WorkspaceProgram[]
  scheduled: ScheduledCommand[]
  history: CommandHistory[]
}

// ─── Persisted data key ───────────────────────────────────────────
const STORE_KEY = 'commandEngineState'
const MAX_HISTORY = 500

// ─── CommandEngine class ──────────────────────────────────────────
export class CommandEngine {
  private state: CommandEngineState
  private scheduledTimers = new Map<string, ReturnType<typeof setInterval | typeof setTimeout>>()
  private executor: CommandExecutor | null = null

  constructor(private readonly settings: SettingsStore) {
    this.state = this.loadState()
    this.seedDefaults()
  }

  setExecutor(executor: CommandExecutor): void {
    this.executor = executor
  }

  startScheduler(): void {
    for (const sc of this.state.scheduled) {
      if (sc.enabled) this.scheduleCommand(sc)
    }
    console.log(`[CommandEngine] scheduler started with ${this.state.scheduled.length} jobs`)
  }

  stopScheduler(): void {
    for (const timer of this.scheduledTimers.values()) {
      clearInterval(timer as any)
      clearTimeout(timer as any)
    }
    this.scheduledTimers.clear()
  }

  // ─── Macro management ────────────────────────────────────────────

  getMacros(): Macro[] { return this.state.macros }

  getMacro(idOrName: string): Macro | undefined {
    return this.state.macros.find(m => m.id === idOrName || m.name === idOrName || m.alias === idOrName)
  }

  createMacro(params: Omit<Macro, 'id' | 'createdAt' | 'runCount'>): Macro {
    const macro: Macro = {
      ...params,
      id: randomUUID(),
      createdAt: Date.now(),
      runCount: 0,
    }
    this.state.macros.push(macro)
    this.persist()
    return macro
  }

  updateMacro(id: string, patch: Partial<Macro>): Macro {
    const m = this.state.macros.find(m => m.id === id)
    if (!m) throw new Error(`Macro ${id} not found`)
    Object.assign(m, patch)
    this.persist()
    return m
  }

  deleteMacro(id: string): void {
    this.state.macros = this.state.macros.filter(m => m.id !== id)
    this.persist()
  }

  async runMacro(idOrName: string, overrideArgs?: Record<string, unknown>): Promise<MacroResult> {
    const macro = this.getMacro(idOrName)
    if (!macro) throw new Error(`Macro '${idOrName}' not found`)
    if (!this.executor) throw new Error('No executor registered')

    const results: StepResult[] = []
    const startTime = Date.now()

    for (const step of macro.steps) {
      if (step.delay) await sleep(step.delay)

      // Evaluate condition
      if (step.condition) {
        try {
          const ok = new Function('results', `return (${step.condition})`)(results)
          if (!ok) { results.push({ step, skipped: true }); continue }
        } catch (e) {
          if (!step.continueOnError) throw e
        }
      }

      const args = { ...step.args, ...(overrideArgs ?? {}) }
      const t0 = Date.now()
      try {
        const result = await this.executor.execute(step.command, args)
        results.push({ step, result, durationMs: Date.now() - t0 })
      } catch (error: any) {
        results.push({ step, error: error.message, durationMs: Date.now() - t0 })
        if (!step.continueOnError) {
          this.logHistory(macro.name, {}, null, error.message)
          return { macro, results, success: false, error: error.message, durationMs: Date.now() - startTime }
        }
      }
    }

    macro.runCount++
    macro.lastRun = Date.now()
    this.persist()

    this.logHistory(`macro:${macro.name}`, overrideArgs ?? {}, results)
    return { macro, results, success: true, durationMs: Date.now() - startTime }
  }

  // ─── Chain commands ───────────────────────────────────────────────

  async runChain(commands: string[], globalArgs?: Record<string, unknown>): Promise<ChainResult> {
    if (!this.executor) throw new Error('No executor registered')
    const results: ChainStepResult[] = []

    for (const cmdStr of commands) {
      const { command, args } = parseCommandString(cmdStr)
      const mergedArgs = { ...args, ...globalArgs }
      const t0 = Date.now()
      try {
        const result = await this.executor.execute(command, mergedArgs)
        results.push({ command, args: mergedArgs, result, durationMs: Date.now() - t0 })
      } catch (error: any) {
        results.push({ command, args: mergedArgs, error: error.message, durationMs: Date.now() - t0 })
        return { results, success: false, error: error.message }
      }
    }

    return { results, success: true }
  }

  // ─── Alias management ─────────────────────────────────────────────

  getAliases(): Alias[] { return this.state.aliases }

  getAlias(short: string): Alias | undefined {
    return this.state.aliases.find(a => a.short === short)
  }

  createAlias(short: string, expanded: string, description?: string): Alias {
    const existing = this.getAlias(short)
    if (existing) {
      existing.expanded = expanded
      existing.description = description
      this.persist()
      return existing
    }
    const alias: Alias = { id: randomUUID(), short, expanded, description, createdAt: Date.now() }
    this.state.aliases.push(alias)
    this.persist()
    return alias
  }

  deleteAlias(short: string): void {
    this.state.aliases = this.state.aliases.filter(a => a.short !== short)
    this.persist()
  }

  expandAlias(input: string): string {
    const alias = this.getAlias(input.split(' ')[0]!)
    if (!alias) return input
    const rest = input.slice(input.split(' ')[0]!.length)
    return alias.expanded + rest
  }

  // ─── Workspace programs ───────────────────────────────────────────

  getPrograms(): WorkspaceProgram[] { return this.state.programs }

  getProgram(idOrName: string): WorkspaceProgram | undefined {
    return this.state.programs.find(p => p.id === idOrName || p.name === idOrName)
  }

  createProgram(params: Omit<WorkspaceProgram, 'id' | 'createdAt'>): WorkspaceProgram {
    const prog: WorkspaceProgram = { ...params, id: randomUUID(), createdAt: Date.now() }
    this.state.programs.push(prog)
    this.persist()
    return prog
  }

  deleteProgram(id: string): void {
    this.state.programs = this.state.programs.filter(p => p.id !== id)
    this.persist()
  }

  // ─── Scheduled commands ───────────────────────────────────────────

  getScheduled(): ScheduledCommand[] { return this.state.scheduled }

  createScheduled(params: Omit<ScheduledCommand, 'id' | 'createdAt' | 'runCount'>): ScheduledCommand {
    const sc: ScheduledCommand = { ...params, id: randomUUID(), createdAt: Date.now(), runCount: 0 }
    this.state.scheduled.push(sc)
    if (sc.enabled) this.scheduleCommand(sc)
    this.persist()
    return sc
  }

  toggleScheduled(id: string, enabled: boolean): void {
    const sc = this.state.scheduled.find(s => s.id === id)
    if (!sc) return
    sc.enabled = enabled
    if (enabled) this.scheduleCommand(sc)
    else {
      const timer = this.scheduledTimers.get(id)
      if (timer) { clearInterval(timer as any); clearTimeout(timer as any) }
      this.scheduledTimers.delete(id)
    }
    this.persist()
  }

  deleteScheduled(id: string): void {
    this.toggleScheduled(id, false)
    this.state.scheduled = this.state.scheduled.filter(s => s.id !== id)
    this.persist()
  }

  // ─── Command history ──────────────────────────────────────────────

  getHistory(limit = 50): CommandHistory[] {
    return this.state.history.slice(-limit).reverse()
  }

  clearHistory(): void {
    this.state.history = []
    this.persist()
  }

  // ─── Anti-command (undo) ─────────────────────────────────────────

  async undoLast(): Promise<{ command: string; undone: boolean } | null> {
    const last = [...this.state.history].reverse().find(h => !h.undone)
    if (!last) return null

    // Look up anti-command mapping
    const antiMap = ANTI_COMMAND_MAP[last.command]
    if (!antiMap || !this.executor) return null

    await this.executor.execute(antiMap, last.args)
    last.undone = true
    this.persist()
    return { command: last.command, undone: true }
  }

  // ─── Parse and execute a raw command string ───────────────────────

  async execute(input: string, extraArgs?: Record<string, unknown>): Promise<unknown> {
    if (!this.executor) throw new Error('No executor registered')

    // Check alias expansion
    const expanded = this.expandAlias(input)
    const { command, args } = parseCommandString(expanded)
    const finalArgs = { ...args, ...extraArgs }

    const t0 = Date.now()
    try {
      const result = await this.executor.execute(command, finalArgs)
      this.logHistory(command, finalArgs, result)
      return result
    } catch (e: any) {
      this.logHistory(command, finalArgs, null, e.message)
      throw e
    }
  }

  // ─── Private ─────────────────────────────────────────────────────

  private scheduleCommand(sc: ScheduledCommand): void {
    if (sc.schedule.type === 'interval' && sc.schedule.intervalMs) {
      const timer = setInterval(() => this.runScheduled(sc), sc.schedule.intervalMs)
      this.scheduledTimers.set(sc.id, timer)
    } else if (sc.schedule.type === 'once' && sc.schedule.runAt) {
      const delay = Math.max(0, sc.schedule.runAt - Date.now())
      const timer = setTimeout(() => this.runScheduled(sc), delay)
      this.scheduledTimers.set(sc.id, timer)
    }
  }

  private async runScheduled(sc: ScheduledCommand): Promise<void> {
    if (!this.executor) return
    try {
      if (sc.macroId) await this.runMacro(sc.macroId)
      else if (sc.command) await this.executor.execute(sc.command, sc.args ?? {})
      sc.runCount++
      sc.lastRun = Date.now()
      this.persist()
    } catch (e) {
      console.error(`[CommandEngine] scheduled command '${sc.name}' failed:`, e)
    }
  }

  private logHistory(command: string, args: Record<string, unknown>, result: unknown, error?: string): void {
    const entry: CommandHistory = {
      id: randomUUID(),
      command,
      args,
      result,
      error,
      executedAt: Date.now(),
      durationMs: 0,
    }
    this.state.history.push(entry)
    if (this.state.history.length > MAX_HISTORY) {
      this.state.history = this.state.history.slice(-MAX_HISTORY)
    }
    this.persist()
  }

  private loadState(): CommandEngineState {
    const raw = this.settings.getRaw(STORE_KEY) as CommandEngineState | null
    return raw ?? { macros: [], aliases: [], programs: [], scheduled: [], history: [] }
  }

  private persist(): void {
    this.settings.setRaw(STORE_KEY, this.state)
  }

  private seedDefaults(): void {
    // Only seed if completely empty — don't override user data
    if (this.state.aliases.length > 0 || this.state.macros.length > 0) return

    // Built-in aliases
    const builtinAliases: Array<[string, string, string]> = [
      [':nt',    'tab.create url=kitsune://newtab',          'New tab'],
      [':ct',    'tab.close',                                'Close active tab'],
      [':hi',    'tab.hibernateAll',                         'Hibernate all background tabs'],
      [':ai',    'ai.panel.toggle',                          'Toggle AI panel'],
      [':rw',    'workspace.program research-workspace',     'Load research workspace'],
      [':fs',    'ui.fileSearch',                            'Open file search'],
      [':cp',    'ui.commandPalette',                        'Open command palette'],
      [':set',   'settings.set',                             'Set a setting'],
      [':alias', 'macro.alias',                              'Create alias'],
      [':run',   'macro.run',                                'Run a macro'],
      [':chain', 'chain.run',                                'Run command chain'],
    ]
    for (const [short, expanded, desc] of builtinAliases) {
      this.createAlias(short, expanded, desc)
    }

    // Built-in workspace programs
    this.createProgram({
      name: 'research-workspace',
      description: 'Open a full research workspace with common tabs',
      newWorkspaceName: 'Research',
      tabs: [
        { url: 'https://scholar.google.com', title: 'Scholar', groupLabel: 'Search', groupColor: '#a594ff' },
        { url: 'https://www.semanticscholar.org', title: 'Semantic Scholar', groupLabel: 'Search', groupColor: '#a594ff' },
        { url: 'https://arxiv.org', title: 'arXiv', groupLabel: 'Papers', groupColor: '#4cc9f0' },
        { url: 'https://www.connectedpapers.com', title: 'Connected Papers', groupLabel: 'Papers', groupColor: '#4cc9f0' },
        { url: 'kitsune://newtab', title: 'Notes', groupLabel: 'Work', groupColor: '#4cffb0', background: true },
      ],
      ai: { clusterAfterLoad: true, summarizeFirst: false },
    })

    this.createProgram({
      name: 'dev-workspace',
      description: 'Developer workspace with docs and tools',
      newWorkspaceName: 'Dev',
      tabs: [
        { url: 'https://github.com', title: 'GitHub', groupLabel: 'Code', groupColor: '#4cc9f0' },
        { url: 'https://developer.mozilla.org', title: 'MDN', groupLabel: 'Docs', groupColor: '#ff6b35' },
        { url: 'https://stackoverflow.com', title: 'Stack Overflow', groupLabel: 'Docs', groupColor: '#ff6b35' },
        { url: 'kitsune://newtab', title: 'Scratch', groupLabel: 'Work', groupColor: '#4cffb0', background: true },
      ],
    })

    // Built-in macros
    this.createMacro({
      name: 'morning-session',
      alias: ':morning',
      description: 'Open daily standup tabs',
      tags: ['productivity', 'daily'],
      steps: [
        { id: randomUUID(), command: 'tab.create', args: { url: 'https://mail.google.com' }, comment: 'Email' },
        { id: randomUUID(), command: 'tab.create', args: { url: 'https://calendar.google.com' }, delay: 300, comment: 'Calendar' },
        { id: randomUUID(), command: 'tab.create', args: { url: 'https://news.ycombinator.com' }, delay: 300, comment: 'HN' },
        { id: randomUUID(), command: 'ai.panel.open', args: {}, delay: 500, comment: 'Open AI for summaries' },
      ],
    })

    this.createMacro({
      name: 'hibernate-and-save',
      alias: ':save',
      description: 'Hibernate all background tabs and save memory',
      tags: ['memory', 'performance'],
      steps: [
        { id: randomUUID(), command: 'tab.hibernateAll', args: {} },
        { id: randomUUID(), command: 'memory.report', args: {} },
      ],
    })

    this.createMacro({
      name: 'ai-research-mode',
      alias: ':research',
      description: 'Switch to Research lens, open AI panel on Research tab, summarize current page',
      tags: ['ai', 'research'],
      steps: [
        { id: randomUUID(), command: 'lens.set', args: { id: 'research' } },
        { id: randomUUID(), command: 'ai.panel.open', args: {} },
        { id: randomUUID(), command: 'ai.panel.tab', args: { tab: 'research' } },
        { id: randomUUID(), command: 'ai.summarize', args: {}, delay: 200 },
      ],
    })

    this.persist()
  }
}

// ─── Anti-command map ──────────────────────────────────────────────
// Maps command → its undo command
const ANTI_COMMAND_MAP: Record<string, string> = {
  'tab.create':      'tab.close',
  'tab.close':       'tab.restore',
  'tab.hibernate':   'tab.wake',
  'settings.set':    'settings.restore',
  'lens.set':        'lens.restore',
  'ai.panel.open':   'ai.panel.close',
  'ai.panel.close':  'ai.panel.open',
  'workspace.create':'workspace.delete',
  'group.create':    'group.delete',
}

// ─── Executor interface ───────────────────────────────────────────
export interface CommandExecutor {
  execute(command: string, args: Record<string, unknown>): Promise<unknown>
}

// ─── Result types ─────────────────────────────────────────────────
export interface MacroResult {
  macro: Macro
  results: StepResult[]
  success: boolean
  error?: string
  durationMs: number
}

export interface StepResult {
  step: MacroStep
  result?: unknown
  error?: string
  skipped?: boolean
  durationMs?: number
}

export interface ChainResult {
  results: ChainStepResult[]
  success: boolean
  error?: string
}

export interface ChainStepResult {
  command: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
  durationMs: number
}

// ─── Utilities ────────────────────────────────────────────────────
export function parseCommandString(input: string): {
  command: string
  args: Record<string, string>
} {
  const parts = input.trim().split(/\s+/)
  const command = parts[0] ?? ''
  const args: Record<string, string> = {}

  for (const part of parts.slice(1)) {
    if (part.includes('=')) {
      const [k, ...v] = part.split('=')
      if (k) args[k] = v.join('=')
    } else {
      // Positional arg becomes '_arg0', '_arg1', etc.
      const idx = Object.keys(args).filter(k => k.startsWith('_arg')).length
      args[`_arg${idx}`] = part
    }
  }

  return { command, args }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
