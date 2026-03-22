// src/renderer/components/NineTails/NineTails.tsx
// Full Nine Tails UI — orbital selector, tail detail panel,
// activity feed, rule builder, presets.
// See widget output for visual reference — this is the production
// React component version wired to real IPC.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { NineTailsIPC, Push } from '../../lib/ipc'
import type { TailId, TailState, TailEvent, TailRule, NineTailsState } from '../../../shared/types'
import styles from './NineTails.module.css'

// ─── Tail metadata (static, display-only) ─────────────────────────────────────

const TAIL_META: Record<TailId, {
  name: string; glyph: string; color: string; glow: string; dim: string; border: string
  tagline: string; ai: boolean; description: string
  triggers: string[]; actions: string[]
  presets: Array<{ label: string; trigger: string; action: string; pattern: string; params?: Record<string, unknown> }>
}> = {
  watcher: {
    name: 'Watcher', glyph: '◉', color: '#ff6b35', glow: 'rgba(255,107,53,0.35)',
    dim: 'rgba(255,107,53,0.1)', border: 'rgba(255,107,53,0.25)',
    tagline: 'Programmable notifications', ai: false,
    description: 'Define triggers on any site or pattern. Get notified when the right thing happens — price changes, new comments, keyword hits, DOM mutations. Not everything. Only what you define.',
    triggers: ['dom_change','new_comment','front_page','keyword_match','price_change'],
    actions: ['notify','notify_sidebar','run_command','play_sound'],
    presets: [
      { label: 'Price drop on product page', trigger: 'price_change', action: 'notify', pattern: '*' },
      { label: 'New comment on GitHub issue', trigger: 'new_comment', action: 'notify_sidebar', pattern: 'github.com' },
      { label: 'Job posting keyword match', trigger: 'keyword_match', action: 'notify', pattern: '*', params: { keyword: 'engineer' } },
      { label: 'Reddit thread reply', trigger: 'new_comment', action: 'notify', pattern: 'reddit.com' },
      { label: 'HN front page hit', trigger: 'front_page', action: 'notify_sidebar', pattern: 'news.ycombinator.com' },
    ],
  },
  courier: {
    name: 'Courier', glyph: '→', color: '#4cc9f0', glow: 'rgba(76,201,240,0.35)',
    dim: 'rgba(76,201,240,0.1)', border: 'rgba(76,201,240,0.25)',
    tagline: 'URL routing and tab rules', ai: false,
    description: 'URLs matching a pattern auto-route to the right workspace, group, or lens the moment they open. Define once, never manually sort tabs again.',
    triggers: ['url_open','url_pattern','tab_create'],
    actions: ['route_workspace','route_group','set_lens','defer_hibernate'],
    presets: [
      { label: 'github.com → Dev workspace', trigger: 'url_open', action: 'route_workspace', pattern: 'github.com', params: { workspaceName: 'Dev' } },
      { label: 'notion.so → Work workspace', trigger: 'url_open', action: 'route_workspace', pattern: '*.notion.so', params: { workspaceName: 'Work' } },
      { label: 'twitter.com → Social group', trigger: 'url_open', action: 'route_group', pattern: 'twitter.com', params: { groupLabel: 'Social' } },
      { label: 'localhost:* → Coding lens', trigger: 'url_open', action: 'set_lens', pattern: 'localhost', params: { lensId: 'coding' } },
      { label: 'news.ycombinator.com → Reading lens', trigger: 'url_open', action: 'set_lens', pattern: 'news.ycombinator.com', params: { lensId: 'reading' } },
    ],
  },
  focus: {
    name: 'Focus', glyph: '⌖', color: '#f72585', glow: 'rgba(247,37,133,0.35)',
    dim: 'rgba(247,37,133,0.1)', border: 'rgba(247,37,133,0.25)',
    tagline: 'Distraction blocking with schedules', ai: false,
    description: 'Block or hibernate distraction sites on a schedule. Deep work windows, meeting mode, or custom time-based rules. Context aware — not a blunt content blocker.',
    triggers: ['time_window','tab_open','domain_visit'],
    actions: ['block','hibernate','redirect','allow_once'],
    presets: [
      { label: 'Deep work — weekdays 9am–12pm', trigger: 'time_window', action: 'block', pattern: '*', params: { startHHMM: 900, endHHMM: 1200, daysOfWeek: 0b0111110 } },
      { label: 'No social after 10pm', trigger: 'time_window', action: 'hibernate', pattern: 'twitter.com,reddit.com,instagram.com', params: { startHHMM: 2200, endHHMM: 2359 } },
      { label: 'Pomodoro — 25min focus 5min free', trigger: 'time_window', action: 'block', pattern: '*', params: { pomodoro: true } },
      { label: 'Meeting mode — block news sites', trigger: 'domain_visit', action: 'block', pattern: 'news.ycombinator.com,techcrunch.com' },
      { label: 'Weekend reading only', trigger: 'time_window', action: 'block', pattern: '*', params: { daysOfWeek: 0b1000001 } },
    ],
  },
  hibernate: {
    name: 'Hibernate', glyph: '❄', color: '#90e0ef', glow: 'rgba(144,224,239,0.35)',
    dim: 'rgba(144,224,239,0.1)', border: 'rgba(144,224,239,0.25)',
    tagline: 'Rule-based memory management', ai: false,
    description: 'Hibernate tabs by domain, memory threshold, tab age, or workspace context — not just idle time. Protect specific workspaces. Aggressively clear everything else.',
    triggers: ['memory_threshold','idle_time','tab_age','battery_level'],
    actions: ['hibernate','warn','skip','wake_on_focus'],
    presets: [
      { label: 'Hibernate tabs over 300MB', trigger: 'memory_threshold', action: 'hibernate', pattern: '*', params: { thresholdMb: 300 } },
      { label: 'Hibernate social after 30min idle', trigger: 'idle_time', action: 'hibernate', pattern: 'twitter.com,reddit.com', params: { idleMs: 1800000 } },
      { label: 'Hibernate pinned after 2h', trigger: 'idle_time', action: 'hibernate', pattern: '*', params: { idleMs: 7200000, includePinned: true } },
      { label: 'Hibernate all on battery < 20%', trigger: 'battery_level', action: 'hibernate', pattern: '*', params: { threshold: 20 } },
      { label: 'Keep Dev workspace always warm', trigger: 'memory_threshold', action: 'skip', pattern: 'github.com,localhost' },
    ],
  },
  archivist: {
    name: 'Archivist', glyph: '▣', color: '#ffd166', glow: 'rgba(255,209,102,0.35)',
    dim: 'rgba(255,209,102,0.1)', border: 'rgba(255,209,102,0.25)',
    tagline: 'Session time machine', ai: false,
    description: 'Full snapshots of session state — workspace layout, groups, notes, tab summaries. Scrub a visual timeline. Restore a single tab, a workspace, or everything. Tag checkpoints manually.',
    triggers: ['time_interval','workspace_close','manual_tag','battery_warn'],
    actions: ['snapshot','snapshot_tagged','prune_old'],
    presets: [
      { label: 'Auto-snapshot every 30 minutes', trigger: 'time_interval', action: 'snapshot', pattern: '*', params: { intervalMs: 1800000 } },
      { label: 'Snapshot before workspace close', trigger: 'workspace_close', action: 'snapshot_tagged', pattern: '*' },
      { label: 'Snapshot on manual tag', trigger: 'manual_tag', action: 'snapshot_tagged', pattern: '*' },
      { label: 'Keep 7 days of history', trigger: 'time_interval', action: 'prune_old', pattern: '*', params: { keepDays: 7 } },
      { label: 'Snapshot on battery warning', trigger: 'battery_warn', action: 'snapshot', pattern: '*' },
    ],
  },
  shield: {
    name: 'Shield', glyph: '⬡', color: '#7209b7', glow: 'rgba(114,9,183,0.35)',
    dim: 'rgba(114,9,183,0.1)', border: 'rgba(114,9,183,0.25)',
    tagline: 'Advanced privacy sentinel', ai: false,
    description: 'Custom rules beyond the blocklist. Block by content type, CNAME cloaking, cookie sync patterns, fingerprinting vectors, and data exfiltration signatures.',
    triggers: ['request_type','cname_detected','utm_param','webrtc_request'],
    actions: ['block','strip','disable_api','log'],
    presets: [
      { label: 'Block all third-party fonts', trigger: 'request_type', action: 'block', pattern: 'fonts.googleapis.com,fonts.gstatic.com' },
      { label: 'Block CNAME cloaked trackers', trigger: 'cname_detected', action: 'block', pattern: '*' },
      { label: 'Strip UTM params from all URLs', trigger: 'utm_param', action: 'strip', pattern: '*' },
      { label: 'Block WebRTC on untrusted sites', trigger: 'webrtc_request', action: 'disable_api', pattern: '*' },
      { label: 'Block all cookie sync pixels', trigger: 'request_type', action: 'block', pattern: '*', params: { requestType: 'image', maxSize: 2 } },
    ],
  },
  relay: {
    name: 'Relay', glyph: '⟁', color: '#06d6a0', glow: 'rgba(6,214,160,0.35)',
    dim: 'rgba(6,214,160,0.1)', border: 'rgba(6,214,160,0.25)',
    tagline: 'Browser-to-world automation', ai: false,
    description: 'Connect browser events to the outside world. POST to webhooks, push to Slack, trigger GitHub Actions, append to Notion — all from defined browser triggers. No extensions, no IFTTT.',
    triggers: ['workspace_close','url_visit','bookmark_add','focus_start','focus_end'],
    actions: ['post_webhook','push_slack','append_notion','update_gist','run_command'],
    presets: [
      { label: 'Close PR workspace → POST webhook', trigger: 'workspace_close', action: 'post_webhook', pattern: '*' },
      { label: 'Visit job board → append Notion DB', trigger: 'url_visit', action: 'append_notion', pattern: 'linkedin.com/jobs,greenhouse.io' },
      { label: 'Bookmark added → sync GitHub gist', trigger: 'bookmark_add', action: 'update_gist', pattern: '*' },
      { label: 'Focus window start → set Slack status', trigger: 'focus_start', action: 'push_slack', pattern: '*' },
      { label: 'Tab content → push Slack channel', trigger: 'url_visit', action: 'push_slack', pattern: '*' },
    ],
  },
  harvest: {
    name: 'Harvest', glyph: '✦', color: '#a594ff', glow: 'rgba(165,148,255,0.4)',
    dim: 'rgba(165,148,255,0.1)', border: 'rgba(165,148,255,0.25)',
    tagline: 'AI knowledge indexer', ai: true,
    description: 'Every page you visit gets silently summarized and added to a local semantic index. Later, query your browsing history by meaning — not URL. "What did I read about edge compute last week" becomes answerable.',
    triggers: ['page_load','bookmark_add','tab_idle'],
    actions: ['index','index_tag','surface_related'],
    presets: [
      { label: 'Index all visited pages', trigger: 'page_load', action: 'index', pattern: '*' },
      { label: 'Index bookmarked pages only', trigger: 'bookmark_add', action: 'index', pattern: '*' },
      { label: 'Research workspace only', trigger: 'page_load', action: 'index', pattern: '*', params: { workspaceFilter: 'research' } },
      { label: 'Auto-tag by topic', trigger: 'page_load', action: 'index_tag', pattern: '*' },
      { label: 'Surface related past pages', trigger: 'page_load', action: 'surface_related', pattern: '*' },
    ],
  },
  mirror: {
    name: 'Mirror', glyph: '◈', color: '#ff9a6c', glow: 'rgba(255,154,108,0.35)',
    dim: 'rgba(255,154,108,0.1)', border: 'rgba(255,154,108,0.25)',
    tagline: 'Structured capture and sync', ai: false,
    description: 'Capture page content into your notes vault using CSS selector rules. Define schemas per URL pattern. Highlight appends directly. Sync bidirectionally with Obsidian, Notion, or local markdown — automatically, without clipboard.',
    triggers: ['page_load','highlight','bookmark_add','dom_ready'],
    actions: ['capture_schema','append_note','sync_vault','surface_vault'],
    presets: [
      { label: 'arxiv.org — title + abstract + authors', trigger: 'page_load', action: 'capture_schema', pattern: 'arxiv.org', params: { schema: { title: 'h1.title', abstract: '.abstract', authors: '.authors' } } },
      { label: 'GitHub issues — title + labels + body', trigger: 'page_load', action: 'capture_schema', pattern: 'github.com', params: { schema: { title: '.js-issue-title', labels: '.labels', body: '.comment-body' } } },
      { label: 'Highlight → append daily note', trigger: 'highlight', action: 'append_note', pattern: '*', params: { notePath: 'daily/${date}.md' } },
      { label: 'Bookmark → sync Obsidian vault', trigger: 'bookmark_add', action: 'sync_vault', pattern: '*', params: { vaultPath: '~/Documents/vault' } },
      { label: 'Product page — price + title + URL', trigger: 'page_load', action: 'capture_schema', pattern: '*', params: { schema: { title: 'h1', price: '[class*="price"]', url: 'window.location.href' } } },
    ],
  },
}

const TAIL_ORDER: TailId[] = ['watcher','courier','focus','hibernate','archivist','shield','relay','harvest','mirror']

const TYPE_DOT_COLOR: Record<string, string> = {
  fire:'#ff6b35', route:'#4cc9f0', block:'#f72585', sleep:'#90e0ef', skip:'#444',
  snap:'#ffd166', restore:'#ffd166', clean:'#06d6a0', index:'#a594ff', surface:'#a594ff',
  capture:'#ff9a6c', sync:'#ff9a6c', info:'#444', config:'#555', warn:'#ffd166',
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ProgressRing({ value, color, size = 44, stroke = 2.5 }: {
  value: number; color: string; size?: number; stroke?: number
}) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <svg width={size} height={size} className={styles.progressRing}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}/>
    </svg>
  )
}

function ActivityFeed({ events }: { events: TailEvent[] }) {
  const displayed = [...events].reverse().slice(0, 30)
  return (
    <div className={styles.activityFeed}>
      {displayed.map((ev, i) => (
        <div key={ev.id} className={styles.feedRow} style={{ animationDelay: `${i * 0.04}s` }}>
          <span className={styles.feedTime}>{new Date(ev.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
          <div className={styles.feedDot} style={{ background: TYPE_DOT_COLOR[ev.type] || '#444', boxShadow: `0 0 5px ${TYPE_DOT_COLOR[ev.type] || '#444'}` }}/>
          <span className={styles.feedMsg}>{ev.message}</span>
        </div>
      ))}
      {displayed.length === 0 && (
        <div className={styles.emptyFeed}>No activity yet — tail is watching</div>
      )}
    </div>
  )
}

function RuleList({
  rules, tailId, meta, onAdd, onToggle, onDelete,
}: {
  rules: TailRule[]
  tailId: TailId
  meta: typeof TAIL_META[TailId]
  onAdd: (rule: Omit<TailRule, 'id' | 'createdAt'>) => void
  onToggle: (ruleId: string, active: boolean) => void
  onDelete: (ruleId: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ label: '', pattern: '', trigger: meta.triggers[0] ?? '', action: meta.actions[0] ?? '' })

  return (
    <div className={styles.ruleList}>
      {rules.map(rule => (
        <div key={rule.id} className={`${styles.ruleRow} ${rule.active ? styles.ruleRowActive : ''}`}
          style={rule.active ? { background: meta.dim, borderColor: meta.border } : {}}>
          <button
            className={styles.ruleToggle}
            style={{ background: rule.active ? meta.color : 'rgba(255,255,255,0.1)' }}
            onClick={() => onToggle(rule.id, !rule.active)}
          >
            <div className={styles.ruleToggleThumb} style={{ left: rule.active ? 14 : 2 }}/>
          </button>
          <div className={styles.ruleMeta}>
            <span className={styles.ruleLabel}>{rule.label}</span>
            <span className={styles.ruleDetail}>{rule.pattern} · {rule.trigger} → {rule.action}</span>
          </div>
          <button className={styles.ruleDelete} onClick={() => onDelete(rule.id)}>×</button>
        </div>
      ))}

      {adding ? (
        <div className={styles.ruleForm} style={{ borderColor: meta.border }}>
          <div className={styles.ruleFormGrid}>
            {[
              { key: 'label', label: 'Label', placeholder: 'My rule', mono: false },
              { key: 'pattern', label: 'URL Pattern', placeholder: 'github.com/*', mono: true },
            ].map(f => (
              <div key={f.key}>
                <div className={styles.formLabel}>{f.label}</div>
                <input
                  value={(draft as any)[f.key]}
                  onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className={styles.formInput}
                  style={{ fontFamily: f.mono ? "'DM Mono', monospace" : undefined }}
                />
              </div>
            ))}
            <div>
              <div className={styles.formLabel}>Trigger</div>
              <select value={draft.trigger} onChange={e => setDraft(d => ({ ...d, trigger: e.target.value }))} className={styles.formSelect}>
                {meta.triggers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div className={styles.formLabel}>Action</div>
              <select value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))} className={styles.formSelect}>
                {meta.actions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.ruleFormActions}>
            <button
              className={styles.btnPrimary}
              style={{ background: meta.color, color: '#080a0f' }}
              onClick={() => {
                if (!draft.label) return
                onAdd({ tailId, label: draft.label, pattern: draft.pattern || '*', trigger: draft.trigger as any, action: draft.action as any, active: true })
                setDraft({ label: '', pattern: '', trigger: meta.triggers[0] ?? '', action: meta.actions[0] ?? '' })
                setAdding(false)
              }}
            >Add rule</button>
            <button className={styles.btnSecondary} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          className={styles.addRuleBtn}
          style={{ borderColor: meta.border, background: meta.dim, color: meta.color }}
          onClick={() => setAdding(true)}
        >+ Custom rule</button>
      )}
    </div>
  )
}

function PresetList({
  meta, tailId, onEnable,
}: {
  meta: typeof TAIL_META[TailId]
  tailId: TailId
  onEnable: (preset: typeof meta.presets[0]) => void
}) {
  return (
    <div className={styles.presetList}>
      {meta.presets.map((p, i) => (
        <div key={i} className={styles.presetRow}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = meta.dim; (e.currentTarget as HTMLElement).style.borderColor = meta.border }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)' }}>
          <div className={styles.presetDot} style={{ background: meta.color }}/>
          <span className={styles.presetLabel}>{p.label}</span>
          <button
            className={styles.presetBtn}
            style={{ borderColor: meta.border, background: meta.dim, color: meta.color }}
            onClick={() => onEnable(p)}
          >Enable</button>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function NineTails() {
  const closePanelFn = useBrowserStore(s => s.closeNineTails)
  const [ntState, setNtState] = useState<NineTailsState | null>(null)
  const [sel, setSel] = useState<TailId>('watcher')
  const [tab, setTab] = useState<'activity' | 'rules' | 'presets'>('activity')
  const [loading, setLoading] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)

  // Load initial state
  useEffect(() => {
    NineTailsIPC.getState().then(state => {
      setNtState(state)
      setLoading(false)
    }).catch(console.error)
  }, [])

  // Subscribe to live events
  useEffect(() => {
    const unsub = Push.onNineTailsEvent((event: TailEvent) => {
      setNtState(prev => {
        if (!prev) return prev
        const tails = { ...prev.tails }
        const tail = { ...tails[event.tailId] }
        tail.events = [...tail.events, event].slice(-100)
        tails[event.tailId] = tail
        return { ...prev, tails, activeEvents: [...prev.activeEvents, event].slice(-500) }
      })
    })
    return unsub
  }, [])

  const tailMeta = TAIL_META[sel]
  const tailState = ntState?.tails[sel]

  const handleToggleEnabled = useCallback(async (id: TailId, enabled: boolean) => {
    await NineTailsIPC.setTailEnabled(id, enabled)
    setNtState(prev => prev ? {
      ...prev, tails: { ...prev.tails, [id]: { ...prev.tails[id], enabled } }
    } : prev)
  }, [])

  const handleAddRule = useCallback(async (rule: Omit<TailRule, 'id' | 'createdAt'>) => {
    const added = await NineTailsIPC.addRule(rule)
    setNtState(prev => {
      if (!prev) return prev
      const tail = prev.tails[rule.tailId]
      return { ...prev, tails: { ...prev.tails, [rule.tailId]: { ...tail, rules: [...tail.rules, added] } } }
    })
  }, [])

  const handleUpdateRule = useCallback(async (tailId: TailId, ruleId: string, patch: Partial<TailRule>) => {
    await NineTailsIPC.updateRule(tailId, ruleId, patch)
    setNtState(prev => {
      if (!prev) return prev
      const tail = prev.tails[tailId]
      return { ...prev, tails: { ...prev.tails, [tailId]: { ...tail, rules: tail.rules.map(r => r.id === ruleId ? { ...r, ...patch } : r) } } }
    })
  }, [])

  const handleDeleteRule = useCallback(async (tailId: TailId, ruleId: string) => {
    await NineTailsIPC.deleteRule(tailId, ruleId)
    setNtState(prev => {
      if (!prev) return prev
      const tail = prev.tails[tailId]
      return { ...prev, tails: { ...prev.tails, [tailId]: { ...tail, rules: tail.rules.filter(r => r.id !== ruleId) } } }
    })
  }, [])

  // Orbital positions
  const orbPos = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2
    return { x: 175 + 130 * Math.cos(angle), y: 130 + 100 * Math.sin(angle) }
  }

  const activeCount = ntState ? Object.values(ntState.tails).filter(t => t.enabled).length : 0

  if (loading) return <div className={styles.loading}>Summoning tails…</div>
  if (!ntState) return null

  return (
    <div className={styles.root}>
      {/* Ambient blobs */}
      <div className={styles.blob1} style={{ background: `radial-gradient(circle,${tailMeta.glow} 0%,transparent 65%)`, transition: 'background 1s ease' }}/>
      <div className={styles.blob2}/>

      <div className={styles.layout}>
        {/* ── LEFT ── */}
        <div className={styles.left}>
          <div className={styles.header}>
            <div className={styles.headerLogo}>
              <div className={styles.logoMark}>九</div>
              <span className={styles.logoText}>Nine Tails</span>
              <div className={styles.activeBadge}>
                <div className={styles.activeDot}/>
                <span>{activeCount} ACTIVE</span>
              </div>
            </div>
            <div className={styles.headerSub}>Background agent system</div>
          </div>

          {/* Orbital */}
          <div className={styles.orbitalWrap}>
            <svg ref={svgRef} viewBox="0 0 350 265" className={styles.orbitalSvg}>
              <ellipse cx={175} cy={130} rx={130} ry={100} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="3 7"/>
              {tailState && (() => {
                const { x, y } = orbPos(TAIL_ORDER.indexOf(sel), TAIL_ORDER.length)
                return <line x1={175} y1={130} x2={x} y2={y} stroke={tailMeta.color} strokeWidth={0.75} opacity={0.3} strokeDasharray="3 5" className={styles.connLine}/>
              })()}
              <circle cx={175} cy={130} r={18} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth={1}/>
              <text x={175} y={131} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.25)" fontSize={15} fontFamily="serif">狐</text>
              {TAIL_ORDER.map((id, i) => {
                const { x, y } = orbPos(i, TAIL_ORDER.length)
                const meta = TAIL_META[id]
                const isSel = id === sel
                const state = ntState.tails[id]
                return (
                  <g key={id} onClick={() => { setSel(id); setTab('activity') }} style={{ cursor: 'pointer' }}>
                    {isSel && <circle cx={x} cy={y} r={26} fill="none" stroke={meta.color} strokeWidth={1} opacity={0.25} className={styles.orbPulse}/>}
                    <circle cx={x} cy={y} r={isSel ? 17 : 12}
                      fill={isSel ? meta.color : 'rgba(255,255,255,0.04)'}
                      stroke={isSel ? meta.color : 'rgba(255,255,255,0.12)'}
                      strokeWidth={isSel ? 0 : 1}
                      style={{ transition: 'all 0.3s ease', filter: isSel ? `drop-shadow(0 0 10px ${meta.glow})` : 'none' }}/>
                    {meta.ai && <circle cx={x + (isSel ? 12 : 8)} cy={y - (isSel ? 12 : 8)} r={3.5} fill="#a594ff" stroke="#080a0f" strokeWidth={1.5}/>}
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                      fill={isSel ? '#080a0f' : meta.color} fontSize={isSel ? 11 : 8}
                      fontFamily="'DM Mono', monospace"
                      style={{ pointerEvents: 'none', transition: 'all 0.3s ease' }}>{meta.glyph}</text>
                    <text x={x} y={y + (isSel ? 28 : 23)} textAnchor="middle"
                      fill={isSel ? meta.color : 'rgba(255,255,255,0.35)'} fontSize={8}
                      fontFamily="'Sora', sans-serif"
                      style={{ pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.name}</text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Tail list */}
          <div className={styles.tailList}>
            {TAIL_ORDER.map(id => {
              const meta = TAIL_META[id]
              const state = ntState.tails[id]
              const isSel = id === sel
              return (
                <div key={id}
                  className={styles.tailRow}
                  onClick={() => { setSel(id); setTab('activity') }}
                  style={isSel ? { background: meta.dim, borderColor: meta.border } : {}}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <ProgressRing value={state.progress} color={meta.color} size={34} stroke={2}/>
                    <div className={styles.tailRowGlyph} style={{ color: meta.color }}>{meta.glyph}</div>
                  </div>
                  <div className={styles.tailRowInfo}>
                    <div className={styles.tailRowName}>
                      <span style={{ color: isSel ? '#fff' : 'rgba(255,255,255,0.75)' }}>{meta.name}</span>
                      {meta.ai && <span className={styles.aiBadge}>AI</span>}
                    </div>
                    <div className={styles.tailRowTagline}>{meta.tagline}</div>
                  </div>
                  <div className={styles.tailRowRight}>
                    <span className={styles.tailRowPct} style={{ color: meta.color }}>{state.progress}%</span>
                    <button
                      className={styles.miniToggle}
                      style={{ background: state.enabled ? meta.color : 'rgba(255,255,255,0.1)' }}
                      onClick={e => { e.stopPropagation(); handleToggleEnabled(id, !state.enabled) }}>
                      <div className={styles.miniToggleThumb} style={{ left: state.enabled ? 12 : 1.5 }}/>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT ── */}
        {tailState && (
          <div className={styles.right} key={sel}>
            {/* Header */}
            <div className={styles.detailHeader}>
              <div className={styles.detailTop}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <ProgressRing value={tailState.progress} color={tailMeta.color} size={50} stroke={3}/>
                  <div className={styles.detailGlyph} style={{ color: tailMeta.color }}>{tailMeta.glyph}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.detailTitleRow}>
                    <h2 className={styles.detailTitle} style={{ color: tailMeta.color }}>{tailMeta.name}</h2>
                    {tailMeta.ai && <span className={styles.aiBadge}>AI</span>}
                    <span className={styles.detailPct}>{tailState.progress}% capacity</span>
                    <button
                      className={styles.bigToggle}
                      style={{ background: tailState.enabled ? tailMeta.color : 'rgba(255,255,255,0.1)' }}
                      onClick={() => handleToggleEnabled(sel, !tailState.enabled)}>
                      <div className={styles.bigToggleThumb} style={{ left: tailState.enabled ? 17 : 2 }}/>
                    </button>
                  </div>
                  <p className={styles.detailDesc}>{tailMeta.description}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className={styles.progressBarRow}>
                <div className={styles.progressBarTrack}>
                  <div className={styles.progressBarFill} style={{ width: `${tailState.progress}%`, background: tailMeta.color, boxShadow: `0 0 8px ${tailMeta.glow}` }}/>
                </div>
                <span className={styles.progressBarLabel} style={{ color: tailMeta.color }}>{tailState.progress}%</span>
              </div>
            </div>

            {/* Tab bar */}
            <div className={styles.tabBar}>
              {(['activity', 'rules', 'presets'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={styles.tabBtn}
                  style={tab === t ? { borderBottomColor: tailMeta.color, color: tailMeta.color } : {}}>
                  {t}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className={styles.detailContent}>
              {tab === 'activity' && (
                <div>
                  <div className={styles.liveFeedHeader}>
                    <div className={styles.liveDot}/>
                    <span>Live feed</span>
                    <span className={styles.tailPath}>tail/{sel}</span>
                  </div>
                  <ActivityFeed events={tailState.events}/>
                </div>
              )}
              {tab === 'rules' && (
                <RuleList
                  rules={tailState.rules}
                  tailId={sel}
                  meta={tailMeta}
                  onAdd={handleAddRule}
                  onToggle={(ruleId, active) => handleUpdateRule(sel, ruleId, { active })}
                  onDelete={ruleId => handleDeleteRule(sel, ruleId)}
                />
              )}
              {tab === 'presets' && (
                <PresetList
                  meta={tailMeta}
                  tailId={sel}
                  onEnable={preset => {
                    handleAddRule({
                      tailId: sel, label: preset.label, pattern: preset.pattern,
                      trigger: preset.trigger as any, action: preset.action as any,
                      active: true, params: preset.params,
                    })
                    setTab('rules')
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
