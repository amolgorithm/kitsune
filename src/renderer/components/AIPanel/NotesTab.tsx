// src/renderer/components/AIPanel/NotesTab.tsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import styles from './NotesTab.module.css'

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  sourceUrl?: string
  sourceTitle?: string
  folderId?: string
  createdAt: number
  updatedAt: number
  highlight?: string
  aiGenerated: boolean
}

interface Folder {
  id: string
  name: string
  color: string
  expanded: boolean
}

interface NotesState {
  notes: Note[]
  folders: Folder[]
}

const FOLDER_COLORS = ['#ff6b35', '#a594ff', '#4cc9f0', '#4cffb0', '#ffd166', '#ff4d6d']

function loadState(): NotesState {
  try {
    const raw = localStorage.getItem('kitsune-notes-v1')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { notes: [], folders: [] }
}

function persist(state: NotesState) {
  try { localStorage.setItem('kitsune-notes-v1', JSON.stringify(state)) } catch {}
}

async function aiEnhanceNote(
  text: string, pageUrl: string, pageTitle: string,
  apiKey: string, model: string
): Promise<{ title: string; content: string; tags: string[] }> {
  const res = await fetch('https://ai.hackclub.com/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a knowledge assistant. When given highlighted text from a webpage, return ONLY valid JSON:
{"title":"concise 4-8 word title","content":"structured markdown with key insight, supporting points, why it matters. Under 150 words.","tags":["2-4 lowercase tags"]}`,
        },
        { role: 'user', content: `From "${pageTitle}" (${pageUrl}):\n\n"${text}"` },
      ],
      max_tokens: 400,
      temperature: 0.4,
    }),
  })
  if (!res.ok) throw new Error(`AI ${res.status}`)
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
  try {
    return JSON.parse(raw.replace(/^```json|```$/g, '').trim())
  } catch {
    return {
      title: text.split('\n')[0]?.slice(0, 60) ?? 'Note',
      content: `## From "${pageTitle}"\n\n${text}`,
      tags: [],
    }
  }
}

async function runAiAction(
  action: 'expand' | 'summarize' | 'related' | 'email',
  note: Note, apiKey: string, model: string
): Promise<string> {
  const prompts = {
    expand: `Expand this note with more depth, examples, and connections. Return markdown only.\n\nNote:\n${note.content}`,
    summarize: `Summarize this note into 2-3 bullet points. Return markdown only.\n\nNote:\n${note.content}`,
    related: `What topics, papers, or concepts is this note connected to? Return a markdown list of 4-6 items to explore.\n\nNote:\n${note.content}`,
    email: `Draft a professional email based on these notes. Return email body as plain text only.\n\nNotes:\n${note.content}`,
  }
  const res = await fetch('https://ai.hackclub.com/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a knowledge assistant. Be concise and useful.' },
        { role: 'user', content: prompts[action] },
      ],
      max_tokens: 800,
      temperature: 0.5,
    }),
  })
  if (!res.ok) throw new Error(`AI ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/---/g, '<hr/>')
}

export function NotesTab() {
  const settings = useBrowserStore(s => s.settings)
  const activeTab = useActiveTab()

  const [state, setState] = useState<NotesState>(loadState)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [search, setSearch] = useState('')
  const [pendingHighlight, setPendingHighlight] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [flashMsg, setFlashMsg] = useState('')
  const [view, setView] = useState<'list' | 'note'>('list')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const setStateAndPersist = useCallback((updater: (prev: NotesState) => NotesState) => {
    setState(prev => {
      const next = updater(prev)
      persist(next)
      return next
    })
  }, [])

  // Listen for highlight events from SelectionCapture / preload
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail?.text
      if (text?.trim().length > 10) setPendingHighlight(text.trim())
    }
    window.addEventListener('kitsune:highlight', handler)
    return () => window.removeEventListener('kitsune:highlight', handler)
  }, [])

  // Listen via IPC push (ninetails:mirror-highlight is reused for selection captures)
  useEffect(() => {
    const unsub = window.kitsune?.on?.('ninetails:mirror-highlight' as any, (d: any) => {
      if (d?.text?.trim().length > 10) setPendingHighlight(d.text.trim())
    })
    return () => { try { unsub?.() } catch {} }
  }, [])

  const createNoteFromHighlight = useCallback(async (highlight: string) => {
    setAiLoading(true)
    setPendingHighlight(null)
    try {
      let noteData: { title: string; content: string; tags: string[] }
      if (settings.aiEnabled && settings.hackclubApiKey) {
        noteData = await aiEnhanceNote(
          highlight,
          activeTab?.url ?? '',
          activeTab?.title ?? 'Unknown page',
          settings.hackclubApiKey,
          settings.aiModel,
        )
      } else {
        noteData = {
          title: highlight.split('\n')[0]?.slice(0, 60) ?? 'Note',
          content: `## From "${activeTab?.title ?? 'page'}"\n\n${highlight}`,
          tags: [],
        }
      }
      const note: Note = {
        id: crypto.randomUUID(),
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags,
        sourceUrl: activeTab?.url,
        sourceTitle: activeTab?.title,
        highlight,
        aiGenerated: settings.aiEnabled && !!settings.hackclubApiKey,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setStateAndPersist(prev => ({ ...prev, notes: [note, ...prev.notes] }))
      setSelectedId(note.id)
      setEditTitle(note.title)
      setEditContent(note.content)
      setEditMode(false)
      setView('note')
    } catch {
      const note: Note = {
        id: crypto.randomUUID(),
        title: highlight.split('\n')[0]?.slice(0, 60) ?? 'Note',
        content: highlight,
        tags: [],
        sourceUrl: activeTab?.url,
        sourceTitle: activeTab?.title,
        highlight,
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setStateAndPersist(prev => ({ ...prev, notes: [note, ...prev.notes] }))
      setSelectedId(note.id)
      setView('note')
    } finally {
      setAiLoading(false)
    }
  }, [settings, activeTab, setStateAndPersist])

  const createBlankNote = useCallback(() => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: 'New note',
      content: '',
      tags: [],
      sourceUrl: activeTab?.url,
      sourceTitle: activeTab?.title,
      aiGenerated: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setStateAndPersist(prev => ({ ...prev, notes: [note, ...prev.notes] }))
    setSelectedId(note.id)
    setEditTitle(note.title)
    setEditContent('')
    setEditMode(true)
    setView('note')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [activeTab, setStateAndPersist])

  const selectedNote = useMemo(
    () => state.notes.find(n => n.id === selectedId) ?? null,
    [state.notes, selectedId]
  )

  const openNote = (note: Note) => {
    setSelectedId(note.id)
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditMode(false)
    setView('note')
  }

  const saveEdit = () => {
    if (!selectedId) return
    setStateAndPersist(prev => ({
      ...prev,
      notes: prev.notes.map(n =>
        n.id === selectedId
          ? { ...n, title: editTitle.trim() || n.title, content: editContent, updatedAt: Date.now() }
          : n
      ),
    }))
    setEditMode(false)
  }

  const deleteNote = (id: string) => {
    setStateAndPersist(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== id) }))
    setSelectedId(null)
    setView('list')
  }

  const createFolder = () => {
    if (!newFolderName.trim()) return
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: newFolderName.trim(),
      color: FOLDER_COLORS[state.folders.length % FOLDER_COLORS.length]!,
      expanded: true,
    }
    setStateAndPersist(prev => ({ ...prev, folders: [...prev.folders, folder] }))
    setNewFolderName('')
    setAddingFolder(false)
  }

  const flash = (msg: string) => {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(''), 1600)
  }

  const exportNote = async (note: Note) => {
    const md = `# ${note.title}\n\n${note.content}\n\n---\nSource: ${note.sourceUrl ?? 'none'}\nCreated: ${new Date(note.createdAt).toLocaleDateString()}`
    await navigator.clipboard.writeText(md)
    flash('✓ Copied')
  }

  const exportAll = async () => {
    const md = state.notes.map(n =>
      `# ${n.title}\n\n${n.content}\n\nSource: ${n.sourceUrl ?? 'none'}\n`
    ).join('\n\n---\n\n')
    await navigator.clipboard.writeText(md)
    flash('✓ All copied')
  }

  const doAiAction = async (action: 'expand' | 'summarize' | 'related' | 'email') => {
    if (!selectedNote || !settings.aiEnabled || !settings.hackclubApiKey) return
    setAiActionLoading(action)
    try {
      const result = await runAiAction(action, selectedNote, settings.hackclubApiKey, settings.aiModel)
      if (action === 'email') {
        await navigator.clipboard.writeText(result)
        flash('✓ Email copied')
        setAiActionLoading(null)
      } else {
        const newContent = selectedNote.content + `\n\n---\n**AI ${action}:**\n\n${result}`
        setStateAndPersist(prev => ({
          ...prev,
          notes: prev.notes.map(n =>
            n.id === selectedNote.id ? { ...n, content: newContent, updatedAt: Date.now() } : n
          ),
        }))
        setEditContent(newContent)
        setAiActionLoading(null)
      }
    } catch {
      setAiActionLoading(null)
    }
  }

  const filteredNotes = useMemo(() => {
    if (!search) return state.notes
    const q = search.toLowerCase()
    return state.notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.includes(q))
    )
  }, [state.notes, search])

  const notesByFolder = useMemo(() => {
    const map: Record<string, Note[]> = { __ungrouped: [] }
    for (const f of state.folders) map[f.id] = []
    for (const n of filteredNotes) {
      const key = n.folderId && map[n.folderId] ? n.folderId : '__ungrouped'
      map[key]!.push(n)
    }
    return map
  }, [filteredNotes, state.folders])

  // ── Note detail view ─────────────────────────────────────────────
  if (view === 'note' && selectedNote) {
    return (
      <div className={styles.noteDetail}>
        <div className={styles.noteDetailHeader}>
          <button className={styles.backBtn} onClick={() => setView('list')}>← Notes</button>
          <div className={styles.noteDetailActions}>
            {flashMsg && <span className={styles.flash}>{flashMsg}</span>}
            {editMode ? (
              <>
                <button className={styles.actionBtn} onClick={saveEdit}>Save</button>
                <button className={styles.actionBtnGhost} onClick={() => setEditMode(false)}>Cancel</button>
              </>
            ) : (
              <>
                <button className={styles.actionBtnGhost} onClick={() => {
                  setEditTitle(selectedNote.title)
                  setEditContent(selectedNote.content)
                  setEditMode(true)
                  setTimeout(() => textareaRef.current?.focus(), 50)
                }}>Edit</button>
                <button className={styles.actionBtnGhost} onClick={() => exportNote(selectedNote)}>Export</button>
                <button className={styles.actionBtnDanger} onClick={() => deleteNote(selectedNote.id)}>Delete</button>
              </>
            )}
          </div>
        </div>

        {editMode ? (
          <input
            className={styles.titleInput}
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Note title…"
          />
        ) : (
          <h2 className={styles.noteTitle}>{selectedNote.title}</h2>
        )}

        <div className={styles.noteMeta}>
          {selectedNote.sourceUrl && (
            <span
              className={styles.sourceLink}
              title={selectedNote.sourceUrl}
              onClick={() => window.kitsune.invoke('tab:create' as any, { url: selectedNote.sourceUrl, workspaceId: '' })}
            >
              ↗ {selectedNote.sourceTitle?.slice(0, 28) ?? new URL(selectedNote.sourceUrl).hostname}
            </span>
          )}
          {selectedNote.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
          <span className={styles.metaDate}>{new Date(selectedNote.updatedAt).toLocaleDateString()}</span>
          {selectedNote.aiGenerated && <span className={styles.aiBadge}>✦ AI</span>}
        </div>

        {selectedNote.highlight && (
          <blockquote className={styles.highlightQuote}>
            "{selectedNote.highlight.slice(0, 220)}{selectedNote.highlight.length > 220 ? '…' : ''}"
          </blockquote>
        )}

        {editMode ? (
          <textarea
            ref={textareaRef}
            className={styles.editor}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            placeholder="Write in markdown… (# headings, **bold**, - lists)"
          />
        ) : (
          <div
            className={styles.noteContent}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedNote.content) }}
          />
        )}

        {!editMode && (
          <div className={styles.folderMove}>
            <span className={styles.folderMoveLabel}>Folder:</span>
            <select
              className={styles.folderSelect}
              value={selectedNote.folderId ?? ''}
              onChange={e => setStateAndPersist(prev => ({
                ...prev,
                notes: prev.notes.map(n =>
                  n.id === selectedNote.id ? { ...n, folderId: e.target.value || undefined } : n
                ),
              }))}
            >
              <option value="">None (Scratchpad)</option>
              {state.folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {!editMode && settings.aiEnabled && (
          <div className={styles.aiActions}>
            <div className={styles.aiActionsLabel}>✦ AI Actions</div>
            <div className={styles.aiActionBtns}>
              {(['expand', 'summarize', 'related', 'email'] as const).map(a => (
                <button
                  key={a}
                  className={styles.aiActionBtn}
                  disabled={!!aiActionLoading}
                  onClick={() => doAiAction(a)}
                >
                  {aiActionLoading === a ? '…' : { expand: 'Expand', summarize: 'Summarize', related: 'Find related', email: 'Draft email' }[a]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────
  return (
    <div className={styles.notesList}>
      {pendingHighlight && (
        <div className={styles.highlightBanner}>
          <div className={styles.highlightPreview}>
            "{pendingHighlight.slice(0, 90)}{pendingHighlight.length > 90 ? '…' : ''}"
          </div>
          <div className={styles.highlightActions}>
            <button className={styles.highlightCapture} disabled={aiLoading}
              onClick={() => createNoteFromHighlight(pendingHighlight)}>
              {aiLoading ? '✦ Processing…' : '✦ Save as note'}
            </button>
            <button className={styles.highlightDismiss} onClick={() => setPendingHighlight(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          placeholder="Search notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className={styles.newNoteBtn} onClick={createBlankNote} title="New note">+</button>
        {state.notes.length > 0 && (
          <button className={styles.exportAllBtn} onClick={exportAll} title="Export all to clipboard">
            {flashMsg ? '✓' : '↑'}
          </button>
        )}
      </div>

      <div className={styles.folderToolbar}>
        {!addingFolder ? (
          <button className={styles.addFolderBtn} onClick={() => setAddingFolder(true)}>+ New folder</button>
        ) : (
          <div className={styles.addFolderForm}>
            <input
              className={styles.folderInput}
              placeholder="Folder name…"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setAddingFolder(false) }}
              autoFocus
            />
            <button className={styles.folderSaveBtn} onClick={createFolder}>Add</button>
          </div>
        )}
      </div>

      {state.notes.length === 0 && !pendingHighlight && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>◈</div>
          <p className={styles.emptyTitle}>No notes yet</p>
          <p className={styles.emptyDesc}>
            Select any text on a webpage and right-click → <strong>Save to Kitsune Notes</strong>.<br/>
            Or click <strong>+</strong> to write manually.
          </p>
          <div className={styles.emptyHint}>
            Works on any tab — selection captures source URL automatically
          </div>
        </div>
      )}

      {state.folders.map(folder => {
        const folderNotes = notesByFolder[folder.id] ?? []
        if (folderNotes.length === 0 && search) return null
        return (
          <div key={folder.id} className={styles.folderGroup}>
            <div className={styles.folderHeader}>
              <button
                className={styles.folderToggle}
                onClick={() => setStateAndPersist(prev => ({
                  ...prev,
                  folders: prev.folders.map(f => f.id === folder.id ? { ...f, expanded: !f.expanded } : f),
                }))}
              >
                <span className={styles.folderDot} style={{ background: folder.color }} />
                <span className={styles.folderName}>{folder.name}</span>
                <span className={styles.folderCount}>{folderNotes.length}</span>
                <span className={styles.folderChevron}>{folder.expanded ? '▾' : '▸'}</span>
              </button>
              <button
                className={styles.folderDeleteBtn}
                onClick={() => setStateAndPersist(prev => ({
                  ...prev,
                  folders: prev.folders.filter(f => f.id !== folder.id),
                  notes: prev.notes.map(n => n.folderId === folder.id ? { ...n, folderId: undefined } : n),
                }))}
                title="Delete folder"
              >×</button>
            </div>
            {folder.expanded && folderNotes.map(note => (
              <NoteCard key={note.id} note={note} onClick={() => openNote(note)} />
            ))}
          </div>
        )
      })}

      {(notesByFolder.__ungrouped ?? []).length > 0 && (
        <div className={styles.folderGroup}>
          {state.folders.length > 0 && (
            <div className={styles.folderHeader}>
              <div className={styles.folderToggle}>
                <span className={styles.folderDot} style={{ background: 'var(--k-text-3)' }} />
                <span className={styles.folderName}>Scratchpad</span>
                <span className={styles.folderCount}>{notesByFolder.__ungrouped?.length}</span>
              </div>
            </div>
          )}
          {(notesByFolder.__ungrouped ?? []).map(note => (
            <NoteCard key={note.id} note={note} onClick={() => openNote(note)} />
          ))}
        </div>
      )}
    </div>
  )
}

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  const preview = note.content.replace(/[#*`[\]>-]/g, '').split('\n').find(l => l.trim())?.slice(0, 80) ?? ''
  const t = new Date(note.updatedAt)
  const timeStr = Date.now() - note.updatedAt < 86400000
    ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : t.toLocaleDateString([], { month: 'short', day: 'numeric' })

  return (
    <button className={styles.noteCard} onClick={onClick}>
      <div className={styles.noteCardTitle}>{note.title}</div>
      {preview && <div className={styles.noteCardPreview}>{preview}</div>}
      <div className={styles.noteCardMeta}>
        {note.sourceTitle && (
          <span className={styles.noteCardSource}>↗ {note.sourceTitle.slice(0, 22)}</span>
        )}
        {note.tags.slice(0, 2).map(t => <span key={t} className={styles.noteCardTag}>{t}</span>)}
        {note.aiGenerated && <span className={styles.noteCardAI}>✦</span>}
        <span className={styles.noteCardTime}>{timeStr}</span>
      </div>
    </button>
  )
}
