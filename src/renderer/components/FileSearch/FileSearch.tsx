// src/renderer/components/FileSearch/FileSearch.tsx
// Smart Universal File Search
// - Upload PDFs, docs, spreadsheets, code, text files
// - Natural language queries across all files
// - Summarize, compare, extract via HackClub AI (routed through main process)
// - Links results to current browsing context
import { useState, useRef, useCallback, useEffect } from 'react'
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import {
  IconClose, IconSearch, IconFile, IconFilePDF, IconSparkle,
  IconPlus, IconArrowRight, IconNote, IconTask, IconExternal,
} from '../Icons'
import styles from './FileSearch.module.css'

// ─── Types ────────────────────────────────────────────────────────

interface IndexedFile {
  id: string
  name: string
  type: FileType
  size: number
  addedAt: number
  text: string          // extracted text content
  summary?: string      // AI-generated summary
}

type FileType = 'pdf' | 'text' | 'code' | 'spreadsheet' | 'doc' | 'email' | 'other'

interface SearchResult {
  fileId: string
  fileName: string
  excerpt: string
  relevance: number
}

interface QueryResult {
  answer: string
  results: SearchResult[]
  linkedToPage?: string
}

// ─── File text extraction ──────────────────────────────────────────

async function extractText(file: File): Promise<string> {
  const type = getFileType(file.name)

  if (type === 'pdf') {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const buf = reader.result as ArrayBuffer
        const bytes = new Uint8Array(buf)
        let text = ''
        for (let i = 0; i < bytes.length; i++) {
          const c = bytes[i]
          if (c >= 32 && c < 127) text += String.fromCharCode(c)
          else if (c === 10 || c === 13) text += ' '
        }
        const chunks: string[] = []
        const btEt = /BT([\s\S]*?)ET/g
        let m: RegExpExecArray | null
        while ((m = btEt.exec(text)) !== null) {
          const segment = m[1]
            .replace(/\(([^)]*)\)\s*T[jJ]/g, '$1 ')
            .replace(/[^a-zA-Z0-9 .,!?;:'"()\-\n]/g, '')
            .trim()
          if (segment.length > 3) chunks.push(segment)
        }
        const result = chunks.length > 0
          ? chunks.join('\n')
          : text.replace(/[^\x20-\x7E\n]/g, '').replace(/\s+/g, ' ')
        resolve(result.slice(0, 50000))
      }
      reader.readAsArrayBuffer(file)
    })
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).slice(0, 50000))
    reader.readAsText(file)
  })
}

function getFileType(name: string): FileType {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf')                                return 'pdf'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'doc'
  if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext)) return 'spreadsheet'
  if (['eml', 'msg'].includes(ext))                return 'email'
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'cs', 'swift', 'kt'].includes(ext)) return 'code'
  if (['txt', 'md', 'mdx', 'rst', 'log'].includes(ext)) return 'text'
  return 'other'
}

function fileIcon(type: FileType) {
  if (type === 'pdf') return <IconFilePDF size={16} />
  return <IconFile size={16} />
}

// ─── AI query via main-process proxy ──────────────────────────────
// renderer fetch() cannot reach external hosts in Electron's sandboxed
// renderer process — all requests must go through electron.net in main.

async function aiProxyFetch(
  model: string,
  msgs: Array<{ role: string; content: string }>,
  maxTokens: number,
): Promise<unknown> {
  const result = await window.kitsune.invoke('ai:proxy-fetch' as any, {
    url: 'https://ai.hackclub.com/proxy/v1/chat/completions',
    body: JSON.stringify({
      model,
      messages: msgs,
      max_tokens: maxTokens,
    }),
  }) as { ok: boolean; status?: number; body?: string; error?: string }

  if (!result.ok) {
    throw new Error(result.error ?? `AI error ${result.status}: ${(result.body ?? '').slice(0, 200)}`)
  }

  return JSON.parse(result.body!)
}

async function queryFiles(
  prompt: string,
  files: IndexedFile[],
  model: string,
  pageContext?: string,
): Promise<QueryResult> {
  if (files.length === 0) throw new Error('No files indexed')

  const fileDocs = files.map(f => {
    const chunk = f.text.slice(0, Math.floor(12000 / files.length))
    return `### File: ${f.name}\n${chunk}`
  }).join('\n\n---\n\n')

  const systemPrompt = `You are a file search assistant. The user has indexed ${files.length} file(s). 
Answer their question using only the file content provided.
${pageContext ? `\nThe user is currently browsing: ${pageContext.slice(0, 500)}\nLink your answer to the page content where relevant.` : ''}
Return JSON: {
  "answer": "Direct answer in markdown",
  "results": [{"fileId": "...", "fileName": "...", "excerpt": "Relevant quote from file (max 200 chars)", "relevance": 0.0-1.0}],
  "linkedToPage": "How this relates to current page (or null)"
}`

  const data = await aiProxyFetch(
    model,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Files:\n${fileDocs}\n\nQuestion: ${prompt}` },
    ],
    1500,
  ) as any

  const raw = data.choices?.[0]?.message?.content ?? '{}'
  try {
    return JSON.parse(raw)
  } catch {
    return { answer: raw, results: [], linkedToPage: undefined }
  }
}

async function summarizeFile(
  file: IndexedFile,
  model: string,
): Promise<string> {
  const data = await aiProxyFetch(
    model,
    [
      {
        role: 'system',
        content: 'Summarize this file in 3-5 bullet points. Be concise and specific. Return plain text.',
      },
      {
        role: 'user',
        content: `File: ${file.name}\n\n${file.text.slice(0, 8000)}`,
      },
    ],
    400,
  ) as any

  return data.choices?.[0]?.message?.content ?? ''
}

// ─── Component ────────────────────────────────────────────────────

export function FileSearch() {
  const toggleFileSearch = useBrowserStore(s => s.toggleFileSearch)
  const settings         = useBrowserStore(s => s.settings)
  const activeTab        = useActiveTab()

  const [files, setFiles]             = useState<IndexedFile[]>([])
  const [query, setQuery]             = useState('')
  const [result, setResult]           = useState<QueryResult | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [indexing, setIndexing]       = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState<string | null>(null)
  const [activeFile, setActiveFile]   = useState<string | null>(null)
  const [dragOver, setDragOver]       = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') toggleFileSearch() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [toggleFileSearch])

  const processFiles = useCallback(async (fileList: File[]) => {
    for (const file of fileList) {
      setIndexing(file.name)
      try {
        const text = await extractText(file)
        const indexed: IndexedFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: getFileType(file.name),
          size: file.size,
          addedAt: Date.now(),
          text,
        }
        setFiles(prev => [...prev.filter(f => f.name !== file.name), indexed])
      } catch (e) {
        setError(`Failed to read ${file.name}: ${(e as any).message}`)
      }
    }
    setIndexing(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const fileList = Array.from(e.dataTransfer.files)
    if (fileList.length > 0) processFiles(fileList)
  }, [processFiles])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files ?? [])
    if (fileList.length > 0) processFiles(fileList)
    e.target.value = ''
  }

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || files.length === 0 || loading) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const pageContext = activeTab && activeTab.url !== 'kitsune://newtab'
        ? `${activeTab.title}: ${activeTab.url}`
        : undefined

      const res = await queryFiles(
        query,
        files,
        settings.aiModel,
        pageContext,
      )
      setResult(res)
    } catch (e) {
      setError((e as any).message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSummarize = async (file: IndexedFile) => {
    setSummarizing(file.id)
    try {
      const summary = await summarizeFile(file, settings.aiModel)
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, summary } : f))
    } catch (e) {
      setError((e as any).message ?? String(e))
    } finally {
      setSummarizing(null)
    }
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    if (activeFile === id) setActiveFile(null)
  }

  const quickPrompts = [
    'Summarize all files',
    'Key differences between files',
    'Extract action items',
    'What are the main topics?',
    activeTab && activeTab.url !== 'kitsune://newtab'
      ? `How do these files relate to "${activeTab.title?.slice(0, 30)}"?`
      : null,
  ].filter(Boolean) as string[]

  const activeFileObj = files.find(f => f.id === activeFile)

  return (
    <div className={styles.overlay} onClick={toggleFileSearch}>
      <div className={`${styles.panel} k-scale-in`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}><IconSearch size={16} /></div>
            <div>
              <h2 className={styles.title}>File Search</h2>
              <p className={styles.subtitle}>
                {files.length === 0
                  ? 'Upload files to search and query with AI'
                  : `${files.length} file${files.length > 1 ? 's' : ''} indexed · ask anything`
                }
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={toggleFileSearch}>
            <IconClose size={14} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Left: file list */}
          <div className={styles.filePanel}>
            {/* Drop zone */}
            <div
              className={`${styles.dropZone} ${dragOver ? styles.dropZoneOver : ''} ${indexing ? styles.dropZoneIndexing : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.cs,.eml,.log,.xml,.html,.css"
                className={styles.fileInput}
                onChange={handleFileInput}
              />
              <IconPlus size={18} className={styles.dropIcon} />
              <span className={styles.dropLabel}>
                {indexing ? `Reading ${indexing}…` : 'Drop files or click to upload'}
              </span>
              <span className={styles.dropHint}>PDF, text, code, CSV, email…</span>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className={styles.fileList}>
                {files.map(file => (
                  <div
                    key={file.id}
                    className={`${styles.fileItem} ${activeFile === file.id ? styles.fileItemActive : ''}`}
                    onClick={() => setActiveFile(activeFile === file.id ? null : file.id)}
                  >
                    <span className={styles.fileTypeIcon}>{fileIcon(file.type)}</span>
                    <div className={styles.fileMeta}>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>{formatSize(file.size)}</span>
                    </div>
                    <div className={styles.fileActions}>
                      {!file.summary && (
                        <button
                          className={styles.fileActionBtn}
                          title="AI summary"
                          onClick={e => { e.stopPropagation(); handleSummarize(file) }}
                          disabled={summarizing === file.id}
                        >
                          {summarizing === file.id
                            ? <LoadingDots />
                            : <IconSparkle size={11} />
                          }
                        </button>
                      )}
                      <button
                        className={styles.fileActionBtn}
                        title="Remove"
                        onClick={e => { e.stopPropagation(); removeFile(file.id) }}
                      >
                        <IconClose size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expanded file detail */}
            {activeFileObj && (
              <div className={styles.fileDetail}>
                {activeFileObj.summary ? (
                  <>
                    <div className={styles.fileDetailLabel}>
                      <IconSparkle size={11} /> AI Summary
                    </div>
                    <p className={styles.fileDetailText}>{activeFileObj.summary}</p>
                  </>
                ) : (
                  <>
                    <div className={styles.fileDetailLabel}>Preview</div>
                    <p className={styles.fileDetailText}>{activeFileObj.text.slice(0, 300)}…</p>
                  </>
                )}
              </div>
            )}

            {/* Current page context badge */}
            {activeTab && activeTab.url !== 'kitsune://newtab' && (
              <div className={styles.pageContext}>
                <IconExternal size={10} />
                <span>Linked to: <strong>{activeTab.title?.slice(0, 35)}</strong></span>
              </div>
            )}
          </div>

          {/* Right: query + results */}
          <div className={styles.queryPanel}>
            {/* Query form */}
            <form className={styles.queryForm} onSubmit={handleQuery}>
              <div className={styles.queryInput}>
                <IconSearch size={14} className={styles.queryIcon} />
                <input
                  type="text"
                  className={styles.queryText}
                  placeholder={
                    files.length === 0
                      ? 'Upload files first…'
                      : 'Ask anything about your files…'
                  }
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  disabled={files.length === 0}
                  autoFocus
                />
                <button
                  type="submit"
                  className={styles.querySubmit}
                  disabled={loading || files.length === 0 || !query.trim()}
                >
                  {loading ? <LoadingDots /> : <IconArrowRight size={14} />}
                </button>
              </div>

              {/* Quick prompts */}
              <div className={styles.quickPrompts}>
                {quickPrompts.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={styles.quickPrompt}
                    onClick={() => setQuery(p)}
                    disabled={files.length === 0}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </form>

            {/* Error */}
            {error && (
              <div className={styles.errorBox}>{error}</div>
            )}

            {/* Results */}
            {result && (
              <div className={styles.results}>
                {/* Main answer */}
                <div className={styles.resultAnswer}>
                  <div className={styles.resultAnswerLabel}>
                    <IconSparkle size={12} /> Answer
                  </div>
                  <div className={styles.resultAnswerText}>{result.answer}</div>
                </div>

                {/* Page link */}
                {result.linkedToPage && (
                  <div className={styles.resultPageLink}>
                    <IconExternal size={11} />
                    <span>{result.linkedToPage}</span>
                  </div>
                )}

                {/* Source excerpts */}
                {result.results.length > 0 && (
                  <div className={styles.resultSources}>
                    <div className={styles.resultSourcesLabel}>Sources</div>
                    {result.results
                      .sort((a, b) => b.relevance - a.relevance)
                      .map((r, i) => (
                        <div
                          key={i}
                          className={styles.resultSource}
                          onClick={() => setActiveFile(r.fileId)}
                        >
                          <div className={styles.resultSourceName}>
                            <IconFile size={11} />
                            {r.fileName}
                            <span className={styles.resultRelevance}>
                              {Math.round(r.relevance * 100)}% match
                            </span>
                          </div>
                          <p className={styles.resultExcerpt}>"{r.excerpt}"</p>
                        </div>
                      ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className={styles.resultActions}>
                  <button className={styles.resultAction}
                    onClick={() => {
                      navigator.clipboard.writeText(result.answer)
                    }}>
                    <IconNote size={12} /> Copy answer
                  </button>
                  <button className={styles.resultAction}
                    onClick={() => setResult(null)}>
                    <IconSearch size={12} /> New search
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!result && !loading && !error && (
              <div className={styles.emptyState}>
                {files.length === 0 ? (
                  <>
                    <IconFile size={32} className={styles.emptyIcon} />
                    <p className={styles.emptyTitle}>No files yet</p>
                    <p className={styles.emptyDesc}>
                      Upload PDFs, documents, spreadsheets, or code files.
                      Ask questions in natural language and AI will search across all of them.
                    </p>
                  </>
                ) : (
                  <>
                    <IconSparkle size={32} className={styles.emptyIcon} />
                    <p className={styles.emptyTitle}>{files.length} file{files.length > 1 ? 's' : ''} ready</p>
                    <p className={styles.emptyDesc}>
                      Ask anything — summarize, compare, extract data, or find specific information.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'currentColor', opacity: 0.6,
          animation: `k-dot-bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  )
}