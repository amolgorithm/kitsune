// src/renderer/components/AIPanel/AIPanel.tsx
import { useEffect, useRef, useState } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import { AIIPC } from '../../lib/ipc'
import type { AISummary } from '../../../shared/types'
import {
  IconClose, IconSparkle, IconArrowRight, IconSummary, IconResearch,
  IconNote, IconTask, IconChatBubble, IconExternal,
} from '../Icons'
import { NotesTab } from './NotesTab'
import styles from './AIPanel.module.css'

const TABS = [
  { id: 'summary',  label: 'Summary',  icon: (s: number) => <IconSummary    size={s} /> },
  { id: 'research', label: 'Research', icon: (s: number) => <IconResearch   size={s} /> },
  { id: 'notes',    label: 'Notes',    icon: (s: number) => <IconNote       size={s} /> },
  { id: 'tasks',    label: 'Tasks',    icon: (s: number) => <IconTask       size={s} /> },
  { id: 'chat',     label: 'Chat',     icon: (s: number) => <IconChatBubble size={s} /> },
] as const

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

  const [summary, setSummary]               = useState<AISummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [chatInput, setChatInput]           = useState('')
  const [canScrollTabs, setCanScrollTabs]   = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const tabsRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    const check = () => setCanScrollTabs(el.scrollWidth > el.clientWidth + 4)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    el.addEventListener('scroll', check)
    return () => { ro.disconnect(); el.removeEventListener('scroll', check) }
  }, [])

  const scrollTabsRight = () => {
    tabsRef.current?.scrollBy({ left: 100, behavior: 'smooth' })
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (!activeTab || panelTab !== 'summary') return
    // FIX: aiSummaries is now a plain Record, not a Map
    const cached = aiSummaries[activeTab.id]
    if (cached) { setSummary(cached); return }
    if (activeTab.status !== 'ready' || activeTab.url === 'kitsune://newtab') return

    setSummaryLoading(true)
    AIIPC.summarizePage(activeTab.id)
      .then(s => { setSummary(s); cacheAISummary(activeTab.id, s) })
      .catch(console.error)
      .finally(() => setSummaryLoading(false))
  }, [activeTab?.id, panelTab])

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return
    sendChat(chatInput)
    setChatInput('')
  }

  const isNotes = panelTab === 'notes'

  return (
    <aside className={`${styles.panel} k-slide-right`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.aiIcon}><IconSparkle size={13} /></div>
          <div>
            <div className={styles.headerTitle}>Kitsune AI</div>
            <div className={styles.headerSub}>
              {isNotes
                ? 'Notes'
                : activeTab?.url === 'kitsune://newtab'
                  ? 'New Tab'
                  : (activeTab?.title?.slice(0, 28) ?? 'No page')
              }
            </div>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={toggleAIPanel}>
          <IconClose size={13} />
        </button>
      </div>

      {/* Tab bar */}
      <div className={styles.tabsWrapper}>
        <div className={styles.tabs} ref={tabsRef}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={[
                styles.tab,
                panelTab === t.id ? styles.tabActive : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setPanelTab(t.id as any)}
            >
              {t.icon(12)}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <button
          className={[styles.tabScrollBtn, !canScrollTabs ? styles.tabScrollBtnHidden : ''].join(' ')}
          onClick={scrollTabsRight}
          tabIndex={canScrollTabs ? 0 : -1}
        >›</button>
      </div>

      {/* Content — Notes gets full height, others get scrollable area */}
      {isNotes ? (
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <NotesTab />
        </div>
      ) : (
        <>
          <div className={styles.content}>
            {panelTab === 'summary'  && <SummaryTab summary={summary} loading={summaryLoading} />}
            {panelTab === 'research' && (
              <PlaceholderTab icon={<IconResearch size={28} />} title="Cross-Page Research"
                desc="Open multiple tabs on a topic and synthesize them into a single cited document." />
            )}
            {panelTab === 'tasks' && (
              <PlaceholderTab icon={<IconTask size={28} />} title="Task Extraction"
                desc="Highlight action items on any page to convert them into tasks." />
            )}
            {panelTab === 'chat' && (
              <ChatTab messages={chatMessages} loading={chatLoading} endRef={chatEndRef} />
            )}
          </div>

          {panelTab === 'chat' && (
            <form className={styles.chatInputArea} onSubmit={handleChat}>
              <div className={styles.quickBtns}>
                {['Summarize this page', 'Key takeaways', 'Find related topics'].map(q => (
                  <button key={q} type="button" className={styles.quickBtn}
                    onClick={() => setChatInput(q)}>{q}</button>
                ))}
              </div>
              <div className={styles.chatInputRow}>
                <textarea
                  className={styles.chatInput}
                  rows={1}
                  placeholder="Ask anything about this page…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(e as any) }
                  }}
                />
                <button type="submit" className={styles.sendBtn} disabled={chatLoading || !chatInput.trim()}>
                  {chatLoading ? <LoadingDots /> : <IconArrowRight size={13} />}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </aside>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function SummaryTab({ summary, loading }: { summary: AISummary | null; loading: boolean }) {
  if (loading) return (
    <div className={styles.centered}>
      <LoadingDots />
      <span className={styles.loadingLabel}>Summarizing…</span>
    </div>
  )
  if (!summary) return (
    <div className={styles.centered}>
      <IconSummary size={28} className={styles.emptyIcon} />
      <p className={styles.emptyText}>Navigate to a page to generate an AI summary.</p>
    </div>
  )
  return (
    <div className={styles.summaryContent}>
      <AICard title="Key Points">
        <ul className={styles.bulletList}>
          {summary.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </AICard>
      {summary.stats.length > 0 && (
        <AICard title="Stats & Data">
          <ul className={styles.bulletList}>
            {summary.stats.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </AICard>
      )}
      {summary.links.length > 0 && (
        <AICard title="References">
          {summary.links.map((l, i) => (
            <a key={i} href={l.url} className={styles.citationLink} target="_blank" rel="noreferrer">
              <IconExternal size={10} /><span>{l.text}</span>
            </a>
          ))}
        </AICard>
      )}
      <div className={styles.summaryMeta}>
        {new Date(summary.generatedAt).toLocaleTimeString()} · {summary.model}
      </div>
    </div>
  )
}

function PlaceholderTab({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className={styles.centered}>
      <span className={styles.emptyIcon}>{icon}</span>
      <strong className={styles.placeholderTitle}>{title}</strong>
      <p className={styles.emptyText}>{desc}</p>
    </div>
  )
}

function ChatTab({ messages, loading, endRef }: {
  messages: any[]; loading: boolean; endRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div className={styles.chatMessages}>
      {messages.length === 0 && (
        <div className={styles.centered}>
          <IconChatBubble size={28} className={styles.emptyIcon} />
          <p className={styles.emptyText}>Ask me anything about this page or your research.</p>
        </div>
      )}
      {messages.map((msg: any) => (
        <div key={msg.id} className={`${styles.chatMsg} ${msg.role === 'user' ? styles.chatMsgUser : styles.chatMsgAI}`}>
          {msg.role === 'assistant' && <div className={styles.chatMsgIcon}><IconSparkle size={11} /></div>}
          <div className={styles.chatMsgContent}>{msg.content}</div>
        </div>
      ))}
      {loading && (
        <div className={`${styles.chatMsg} ${styles.chatMsgAI}`}>
          <div className={styles.chatMsgIcon}><IconSparkle size={11} /></div>
          <div className={styles.chatMsgContent}><LoadingDots /></div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}

function AICard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardBody}>{children}</div>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className={styles.dots}>
      {[0, 1, 2].map(i => <div key={i} className={styles.dot} style={{ animationDelay: `${i * 0.18}s` }} />)}
    </div>
  )
}