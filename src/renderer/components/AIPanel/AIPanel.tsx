// src/renderer/components/AIPanel/AIPanel.tsx
import { useEffect, useRef, useState } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import { AIIPC } from '../../lib/ipc'
import type { AISummary } from '../../../shared/types'
import styles from './AIPanel.module.css'

export function AIPanel() {
  const activeTab      = useActiveTab()
  const panelTab       = useBrowserStore(s => s.aiPanelTab)
  const setPanelTab    = useBrowserStore(s => s.setAIPanelTab)
  const toggleAIPanel  = useBrowserStore(s => s.toggleAIPanel)
  const chatMessages   = useBrowserStore(s => s.chatMessages)
  const chatLoading    = useBrowserStore(s => s.chatLoading)
  const sendChat       = useBrowserStore(s => s.sendChatMessage)
  const cacheAISummary = useBrowserStore(s => s.cacheAISummary)
  const aiSummaries    = useBrowserStore(s => s.aiSummaries)

  const [summary, setSummary]         = useState<AISummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [chatInput, setChatInput]     = useState('')
  const chatEndRef                    = useRef<HTMLDivElement>(null)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Auto-summarize when panel opens on a new tab
  useEffect(() => {
    if (!activeTab || panelTab !== 'summary') return
    const cached = aiSummaries.get(activeTab.id)
    if (cached) { setSummary(cached); return }
    if (activeTab.status !== 'ready') return

    setSummaryLoading(true)
    AIIPC.summarizePage(activeTab.id)
      .then(s => { setSummary(s); cacheAISummary(activeTab.id, s) })
      .catch(console.error)
      .finally(() => setSummaryLoading(false))
  }, [activeTab?.id, panelTab])

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return
    sendChat(chatInput)
    setChatInput('')
  }

  const TABS = [
    { id: 'summary',  label: 'Summary' },
    { id: 'research', label: 'Research' },
    { id: 'notes',    label: 'Notes' },
    { id: 'tasks',    label: 'Tasks' },
    { id: 'chat',     label: 'Chat' },
  ] as const

  return (
    <aside className={`${styles.panel} k-slide-right`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.aiIcon}>✦</div>
          <div>
            <div className={styles.headerTitle}>Kitsune AI</div>
            <div className={styles.headerSub}>
              {activeTab?.title ? `Viewing: ${activeTab.title.slice(0, 28)}…` : 'No page active'}
            </div>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={toggleAIPanel} title="Close AI panel">
          <CloseIcon />
        </button>
      </div>

      {/* Tab bar */}
      <div className={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={panelTab === t.id}
            className={`${styles.tab} ${panelTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setPanelTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {panelTab === 'summary' && (
          <SummaryTab summary={summary} loading={summaryLoading} />
        )}
        {panelTab === 'research' && <ResearchTab />}
        {panelTab === 'notes'    && <NotesTab />}
        {panelTab === 'tasks'    && <TasksTab />}
        {panelTab === 'chat'     && (
          <ChatTab
            messages={chatMessages}
            loading={chatLoading}
            endRef={chatEndRef}
          />
        )}
      </div>

      {/* Chat input always visible in chat tab */}
      {panelTab === 'chat' && (
        <form className={styles.chatInputArea} onSubmit={handleChatSubmit}>
          <div className={styles.quickBtns}>
            {['Summarize page', 'Find key facts', 'Related topics'].map(q => (
              <button
                key={q}
                type="button"
                className={styles.quickBtn}
                onClick={() => { setChatInput(q); }}
              >{q}</button>
            ))}
          </div>
          <div className={styles.chatInputRow}>
            <textarea
              className={styles.chatInput}
              rows={1}
              placeholder="Ask Kitsune AI anything…"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleChatSubmit(e as any)
                }
              }}
            />
            <button
              className={`${styles.sendBtn} ${chatLoading ? styles.sendBtnLoading : ''}`}
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
            >
              {chatLoading ? <LoadingDots /> : <SendIcon />}
            </button>
          </div>
        </form>
      )}
    </aside>
  )
}

// ── Tab content components ──────────────────────────────────────────

function SummaryTab({ summary, loading }: { summary: AISummary | null; loading: boolean }) {
  if (loading) return (
    <div className={styles.loadingState}>
      <LoadingDots />
      <span>Summarizing page…</span>
    </div>
  )
  if (!summary) return (
    <div className={styles.emptyState}>
      <span>📄</span>
      <p>Open a page and the AI will summarize it automatically.</p>
    </div>
  )
  return (
    <div className={styles.summaryContent}>
      <AICard title="Key Points" icon="◆">
        <ul className={styles.bulletList}>
          {summary.keyPoints.map((p, i) => <li key={i} className={styles.bullet}>{p}</li>)}
        </ul>
      </AICard>
      {summary.stats.length > 0 && (
        <AICard title="Statistics" icon="📊">
          <ul className={styles.bulletList}>
            {summary.stats.map((s, i) => <li key={i} className={styles.bullet}>{s}</li>)}
          </ul>
        </AICard>
      )}
      {summary.links.length > 0 && (
        <AICard title="References" icon="🔗">
          {summary.links.map((l, i) => (
            <a key={i} href={l.url} className={styles.citationLink} target="_blank" rel="noreferrer">
              <LinkIcon />
              {l.text}
            </a>
          ))}
        </AICard>
      )}
      <div className={styles.summaryMeta}>
        Generated {new Date(summary.generatedAt).toLocaleTimeString()} · {summary.model}
      </div>
    </div>
  )
}

function ResearchTab() {
  return (
    <div className={styles.placeholderTab}>
      <span className={styles.placeholderIcon}>🔬</span>
      <h3 className={styles.placeholderTitle}>Cross-Page Research</h3>
      <p className={styles.placeholderDesc}>Select multiple tabs to synthesize a cohesive research summary with citations.</p>
      <button className={styles.placeholderBtn}>Select tabs to research →</button>
    </div>
  )
}

function NotesTab() {
  return (
    <div className={styles.placeholderTab}>
      <span className={styles.placeholderIcon}>📝</span>
      <h3 className={styles.placeholderTitle}>Smart Notes</h3>
      <p className={styles.placeholderDesc}>Highlight text on any page — Kitsune AI converts it into a formatted note with citations.</p>
    </div>
  )
}

function TasksTab() {
  return (
    <div className={styles.placeholderTab}>
      <span className={styles.placeholderIcon}>✅</span>
      <h3 className={styles.placeholderTitle}>Task Extraction</h3>
      <p className={styles.placeholderDesc}>Highlight action items on any page to auto-convert them into tasks.</p>
    </div>
  )
}

function ChatTab({
  messages, loading, endRef,
}: {
  messages: { id: string; role: string; content: string }[]
  loading: boolean
  endRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div className={styles.chatMessages}>
      {messages.length === 0 && (
        <div className={styles.chatEmpty}>
          <span>✦</span>
          <p>Ask me anything about this page, your research, or browsing.</p>
        </div>
      )}
      {messages.map(msg => (
        <div key={msg.id} className={`${styles.chatMsg} ${msg.role === 'user' ? styles.chatMsgUser : styles.chatMsgAI}`}>
          {msg.role === 'assistant' && <div className={styles.chatMsgIcon}>✦</div>}
          <div className={styles.chatMsgContent}>{msg.content}</div>
        </div>
      ))}
      {loading && (
        <div className={`${styles.chatMsg} ${styles.chatMsgAI}`}>
          <div className={styles.chatMsgIcon}>✦</div>
          <div className={styles.chatMsgContent}><LoadingDots /></div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────

function AICard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}><span>{icon}</span>{title}</div>
      <div className={styles.cardBody}>{children}</div>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className={styles.dots}>
      {[0, 1, 2].map(i => (
        <div key={i} className={styles.dot} style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  )
}

// Icons
function CloseIcon()  { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg> }
function SendIcon()   { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="8" x2="14" y2="8"/><polyline points="9,3 14,8 9,13"/></svg> }
function LinkIcon()   { return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4h-2a4 4 0 000 8h2M10 4h2a4 4 0 010 8h-2M6 8h4"/></svg> }
