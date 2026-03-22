// src/renderer/components/AIPanel/Humanizer.tsx
// ─────────────────────────────────────────────────────────────────
// AI Humanizer — rewrites AI-generated text to sound genuinely
// human across different register modes using the HackClub AI proxy.
// Focuses on real linguistic naturalness, not detector-gaming tricks.
// ─────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import styles from './Humanizer.module.css'

// ─── Types ─────────────────────────────────────────────────────────

type HumanizeMode = 'standard' | 'casual' | 'formal' | 'academic' | 'creative' | 'simple'

interface ModeConfig {
  id: HumanizeMode
  label: string
  glyph: string
  description: string
  prompt: string
}

const MODES: ModeConfig[] = [
  {
    id: 'standard',
    label: 'Standard',
    glyph: '◎',
    description: 'Natural, balanced everyday prose',
    prompt: `Rewrite this text so it sounds like a real person wrote it — not an AI. Use natural sentence rhythm with genuine variation: some long, some short, some fragments. Include mild hedging ("I think", "kind of", "basically"), contractions, and the occasional run-on sentence or informally structured thought. Vary vocabulary naturally — don't use fancy words unless they fit. The goal is text that reads like a thoughtful person wrote it off the cuff, not like a polished AI output. Do NOT make it sound corporate, listy, or over-explained.`,
  },
  {
    id: 'casual',
    label: 'Casual',
    glyph: '~',
    description: 'Conversational, relaxed, everyday tone',
    prompt: `Rewrite this text to sound like a real person talking or messaging a friend. Use contractions liberally, informal phrasing, and natural conversational rhythms. It's okay to start sentences with "And", "But", "So", "Look —". Use dashes for asides. Keep it punchy. Occasional tangents or asides are fine — that's how people actually write. Avoid anything that sounds polished or formal. Think: smart person texting, not AI generating.`,
  },
  {
    id: 'formal',
    label: 'Formal',
    glyph: '▪',
    description: 'Professional but human, not robotic',
    prompt: `Rewrite this text to sound like a knowledgeable professional human wrote it — not an AI assistant. Use formal vocabulary but with genuine voice: clear, direct, occasionally opinionated. Avoid passive voice where active is natural. Include the writer's perspective with first person where appropriate. Vary sentence structure. Avoid AI tells like excessive hedging, generic transitions ("Furthermore", "Moreover", "In conclusion"), and over-qualification. Think: experienced professional writing a memo or email, not a formal report template.`,
  },
  {
    id: 'academic',
    label: 'Academic',
    glyph: '◈',
    description: 'Scholarly, precise, with intellectual voice',
    prompt: `Rewrite this text to sound like an actual academic or researcher wrote it. Use field-appropriate vocabulary precisely. Acknowledge complexity and nuance. Include the author's analytical perspective. Vary sentence length dramatically — scholars write complex multi-clause sentences AND short declarative ones for effect. Use hedging that feels intellectually honest, not evasive ("this suggests", "evidence indicates", "one might argue"). Avoid AI-typical patterns: excessive lists, over-structured paragraphs, and summaries that restate what was just said. Think: journal article introduction, not a student essay outline.`,
  },
  {
    id: 'creative',
    label: 'Creative',
    glyph: '✦',
    description: 'Vivid, expressive, with personality',
    prompt: `Rewrite this text to sound like a writer with a distinctive voice. Be evocative but not purple. Use concrete sensory detail. Vary rhythm dramatically for effect. Use unexpected word choices. Allow personality and point-of-view to show through. Subvert expectations occasionally — don't just describe, illuminate. Use metaphor sparingly but powerfully. The writing should feel alive, not competent. Think: someone who actually thinks carefully about language, not an AI writing in "creative mode".`,
  },
  {
    id: 'simple',
    label: 'Simple',
    glyph: '○',
    description: 'Plain, clear, easy to read',
    prompt: `Rewrite this text to be genuinely easy to read — plain language, short sentences, simple words. But keep it human: don't strip out all personality or voice. A real person explaining something clearly to a general audience. Avoid jargon, passive voice, and over-complex structures. Think: explainer blog post written by someone who actually cares about being understood, not a simplified-AI output with all character removed.`,
  },
]

// ─── Core humanization via API ─────────────────────────────────────

async function humanizeText(
  text: string,
  mode: HumanizeMode,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const modeConfig = MODES.find(m => m.id === mode)!

  const systemPrompt = `You are a skilled editor who rewrites AI-generated text to sound genuinely human. 
You understand the subtle tells of AI writing: over-formality, excessive hedging, predictable structure, 
repetitive sentence patterns, and vocabulary that's technically correct but oddly uniform.

${modeConfig.prompt}

CRITICAL RULES:
- Output ONLY the rewritten text. No preamble, no explanation, no "Here is the rewritten version:".
- Preserve the core meaning and all key information.
- Match the approximate length of the original (within 20%).
- Do not add new information not in the original.
- Do not use bullet points or numbered lists unless the original has them.
- The output should feel like it came from ONE person with a consistent voice.`

  const userPrompt = `Rewrite this text in ${modeConfig.label.toLowerCase()} style:\n\n${text}`

  const res = await fetch('https://ai.hackclub.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      max_tokens: Math.max(500, Math.min(4000, text.length * 3)),
      temperature: 0.85,   // Higher temp → more varied, less predictable
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const result = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!result) throw new Error('Empty response from API')
  return result
}

// ─── Diff highlighter — shows what changed ────────────────────────

function computeWordDiff(original: string, humanized: string): React.ReactNode[] {
  const origWords = original.split(/(\s+)/)
  const humWords  = humanized.split(/(\s+)/)

  // Simple Levenshtein-based diff on word level
  // For display: just highlight the humanized text where words differ
  const humWordSet = new Set(humWords.map(w => w.toLowerCase().replace(/[^a-z]/g, '')))
  const origWordSet = new Set(origWords.map(w => w.toLowerCase().replace(/[^a-z]/g, '')))

  return humWords.map((word, i) => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '')
    if (!clean) return word  // whitespace
    const isNew = clean.length > 3 && !origWordSet.has(clean)
    return isNew
      ? <mark key={i} className={styles.diffMark}>{word}</mark>
      : word
  })
}

// ─── Stats ────────────────────────────────────────────────────────

function textStats(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim())
  const avgWordLen = words.reduce((a, w) => a + w.replace(/[^a-z]/gi, '').length, 0) / Math.max(words.length, 1)
  const avgSentLen = words.length / Math.max(sentences.length, 1)
  return {
    words: words.length,
    sentences: sentences.length,
    avgWordLen: avgWordLen.toFixed(1),
    avgSentLen: Math.round(avgSentLen),
  }
}

// ─── Main component ────────────────────────────────────────────────

export function Humanizer() {
  const settings = useBrowserStore(s => s.settings)

  const [input, setInput]       = useState('')
  const [output, setOutput]     = useState('')
  const [mode, setMode]         = useState<HumanizeMode>('standard')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [tab, setTab]           = useState<'input' | 'output'>('input')

  const abortRef = useRef<AbortController | null>(null)

  const inputWords  = input.trim()  ? textStats(input).words  : 0
  const outputWords = output.trim() ? textStats(output).words : 0

  const handleHumanize = useCallback(async () => {
    if (!input.trim() || loading) return
    if (!settings.hackclubApiKey) {
      setError('No API key configured — add one in Settings → AI.')
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)
    setOutput('')

    try {
      const result = await humanizeText(
        input,
        mode,
        settings.hackclubApiKey,
        settings.aiModel,
        abortRef.current.signal,
      )
      setOutput(result)
      setTab('output')
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message ?? 'Humanization failed')
      }
    } finally {
      setLoading(false)
    }
  }, [input, mode, settings])

  const handleCopy = () => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const handleSwap = () => {
    if (!output) return
    setInput(output)
    setOutput('')
    setTab('input')
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const currentMode = MODES.find(m => m.id === mode)!

  return (
    <div className={styles.root}>
      {/* Mode selector */}
      <div className={styles.modeRow}>
        {MODES.map(m => (
          <button
            key={m.id}
            className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`}
            onClick={() => setMode(m.id)}
            title={m.description}
          >
            <span className={styles.modeGlyph}>{m.glyph}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.modeDesc}>{currentMode.description}</div>

      {/* Tab bar: Input / Output */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${tab === 'input' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('input')}
        >
          Input
          {inputWords > 0 && <span className={styles.wordCount}>{inputWords}w</span>}
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'output' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('output')}
          disabled={!output && !loading}
        >
          Output
          {outputWords > 0 && <span className={styles.wordCount}>{outputWords}w</span>}
        </button>
        {output && (
          <button
            className={`${styles.tabBtn} ${styles.tabBtnDiff} ${showDiff ? styles.tabBtnActive : ''}`}
            onClick={() => { setShowDiff(d => !d); setTab('output') }}
          >
            Diff
          </button>
        )}
      </div>

      {/* Content panels */}
      <div className={styles.panels}>
        {tab === 'input' && (
          <div className={styles.panel}>
            <textarea
              className={styles.textarea}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste your AI-generated text here…"
              spellCheck={false}
            />
            {input && (
              <div className={styles.statsRow}>
                <StatsBar stats={textStats(input)} label="Input" />
              </div>
            )}
          </div>
        )}

        {tab === 'output' && (
          <div className={styles.panel}>
            {loading ? (
              <div className={styles.loadingPanel}>
                <div className={styles.loadingSpinner}>
                  {['◎','○','◉','●'].map((g, i) => (
                    <span key={i} className={styles.spinnerGlyph} style={{ animationDelay: `${i * 0.18}s` }}>{g}</span>
                  ))}
                </div>
                <p className={styles.loadingText}>Humanizing in {currentMode.label.toLowerCase()} mode…</p>
                <button className={styles.cancelBtn} onClick={handleCancel}>Cancel</button>
              </div>
            ) : output ? (
              <>
                <div className={styles.outputText}>
                  {showDiff && input
                    ? computeWordDiff(input, output)
                    : output
                  }
                </div>
                <div className={styles.statsRow}>
                  <StatsBar stats={textStats(output)} label="Output" />
                </div>
              </>
            ) : (
              <div className={styles.emptyOutput}>
                <span className={styles.emptyGlyph}>◎</span>
                <p>Output will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className={styles.errorBox}>
          <span>⚠</span> {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Action bar */}
      <div className={styles.actionBar}>
        {tab === 'input' ? (
          <>
            <button
              className={styles.clearBtn}
              onClick={() => { setInput(''); setOutput('') }}
              disabled={!input}
            >
              Clear
            </button>
            <button
              className={styles.humanizeBtn}
              onClick={handleHumanize}
              disabled={!input.trim() || loading}
            >
              {loading
                ? <><LoadingDots /> Humanizing…</>
                : <><span>◎</span> Humanize</>
              }
            </button>
          </>
        ) : (
          <>
            <button className={styles.swapBtn} onClick={handleSwap} disabled={!output}>
              ↩ Re-humanize
            </button>
            <button
              className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
              onClick={handleCopy}
              disabled={!output}
            >
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────

function StatsBar({ stats, label }: { stats: ReturnType<typeof textStats>; label: string }) {
  return (
    <div className={styles.stats}>
      <span className={styles.statsLabel}>{label}</span>
      <span className={styles.statItem}>{stats.words} words</span>
      <span className={styles.statDot}>·</span>
      <span className={styles.statItem}>{stats.sentences} sentences</span>
      <span className={styles.statDot}>·</span>
      <span className={styles.statItem}>avg {stats.avgSentLen} words/sentence</span>
    </div>
  )
}

function LoadingDots() {
  return (
    <span className={styles.dotsWrap}>
      {[0,1,2].map(i => (
        <span key={i} className={styles.dotDot} style={{ animationDelay: `${i * 0.18}s` }}>·</span>
      ))}
    </span>
  )
}