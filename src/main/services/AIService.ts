// src/main/services/AIService.ts
import type {
  AISummary, CrossPageSummary, ChatMessage,
  TaskItem, SmartNote,
} from '../../shared/types'
import { AI_CONTEXT_MAX_CHARS } from '../../shared/constants'
import type { SettingsStore } from './SettingsStore'
import { randomUUID } from 'crypto'

const HACKCLUB_BASE = 'https://ai.hackclub.com/proxy/v1'

interface OAIMessage { role: string; content: string }

export class AIService {
  private net: any

  constructor(private readonly settings: SettingsStore) {
    // electron.net uses Chromium's network stack — correct DNS, respects
    // system proxy, works where Node fetch fails with EAI_AGAIN.
    try {
      this.net = require('electron').net
      console.log('[AIService] electron.net loaded, fetch available:', typeof this.net?.fetch)
    } catch (e) {
      console.error('[AIService] failed to load electron.net:', e)
    }
  }

  // ─── Core API call ───────────────────────────────────────────────

  private async call(messages: OAIMessage[], maxTokens = 1000): Promise<{ text: string; model: string }> {
    this.assertReady()
    const key   = this.settings.get('hackclubApiKey')
    const model = this.settings.get('aiModel')
    const url   = `${HACKCLUB_BASE}/chat/completions`

    console.log(`[AIService] calling ${url} model=${model}`)

    if (!this.net?.fetch) {
      throw new Error('electron.net.fetch not available — cannot make AI calls from main process')
    }

    let res: Response
    try {
      res = await this.net.fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
      })
    } catch (err: any) {
      const cause = err?.cause?.message ?? String(err?.cause ?? '')
      console.error('[AIService] net.fetch error:', err.message, cause)
      throw new Error(`Network error: ${err.message}${cause ? ` (${cause})` : ''}`)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText)
      console.error(`[AIService] HTTP ${res.status}:`, body)
      throw new Error(`AI returned ${res.status}: ${body}`)
    }

    const data = await res.json() as any
    const text = data.choices?.[0]?.message?.content ?? ''
    console.log(`[AIService] OK length=${text.length}`)
    return { text, model: data.model ?? model }
  }

  private parseJSON(raw: string): any {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```$/im, '')
      .trim()
    return JSON.parse(cleaned)
  }

  // ─── Page Summary ───────────────────────────────────────────────

  async summarizePage(params: {
    tabId: string; url: string; title: string; pageText: string
  }): Promise<AISummary> {
    const text = params.pageText.slice(0, AI_CONTEXT_MAX_CHARS)
    const { text: raw, model } = await this.call([
      {
        role: 'system',
        content: `You are a web page summarizer. Respond ONLY with valid JSON:
{"keyPoints":["3-5 bullet points"],"stats":["notable numbers, empty if none"],"links":[{"text":"label","url":"https://..."}]}`,
      },
      { role: 'user', content: `Title: ${params.title}\nURL: ${params.url}\n\n${text}` },
    ], 800)

    try {
      const parsed = this.parseJSON(raw)
      return {
        tabId: params.tabId, url: params.url, title: params.title,
        keyPoints: parsed.keyPoints ?? [], stats: parsed.stats ?? [], links: parsed.links ?? [],
        generatedAt: Date.now(), model,
      }
    } catch {
      return {
        tabId: params.tabId, url: params.url, title: params.title,
        keyPoints: [raw.slice(0, 300)], stats: [], links: [],
        generatedAt: Date.now(), model,
      }
    }
  }

  // ─── Cross-Page Research ────────────────────────────────────────

  async summarizeCrossPage(params: {
    topic: string
    pages: Array<{ tabId: string; url: string; title: string; text: string }>
  }): Promise<CrossPageSummary> {
    const pagesCtx = params.pages
      .map((p, i) => `## Source [${i + 1}]: ${p.title}\nURL: ${p.url}\n${p.text.slice(0, 2000)}`)
      .join('\n\n---\n\n')

    const { text: raw } = await this.call([
      {
        role: 'system',
        content: `Synthesize multiple web pages into a research summary using [1],[2] citations.
Return ONLY valid JSON: {"content":"Markdown with citations","citations":[{"id":"1","title":"...","url":"...","excerpt":"..."}]}`,
      },
      { role: 'user', content: `Topic: ${params.topic}\n\n${pagesCtx}` },
    ], 2000)

    try {
      const parsed = this.parseJSON(raw)
      return {
        id: randomUUID(), tabIds: params.pages.map(p => p.tabId),
        topic: params.topic, content: parsed.content, citations: parsed.citations ?? [],
        generatedAt: Date.now(),
      }
    } catch {
      return {
        id: randomUUID(), tabIds: params.pages.map(p => p.tabId),
        topic: params.topic, content: raw, citations: [], generatedAt: Date.now(),
      }
    }
  }

  // ─── Chat ───────────────────────────────────────────────────────

  async chat(params: { messages: ChatMessage[]; pageContext?: string }): Promise<string> {
    const system = [
      'You are Kitsune AI, an intelligent browser assistant. Be concise and useful.',
      ...(params.pageContext ? [`\nCurrent page (first 3000 chars):\n${params.pageContext}`] : []),
    ].join('\n')

    const { text } = await this.call([
      { role: 'system', content: system },
      ...params.messages.map(m => ({ role: m.role, content: m.content })),
    ], 1000)

    return text
  }

  // ─── Tab Clustering ─────────────────────────────────────────────

  async clusterTabs(tabs: Array<{ id: string; title: string; url: string }>): Promise<
    Array<{ label: string; color: string; tabIds: string[] }>
  > {
    if (tabs.length < 2) return []
    const tabList = tabs.map((t, i) => `${i + 1}. [${t.id}] ${t.title} — ${t.url}`).join('\n')
    const { text: raw } = await this.call([
      {
        role: 'system',
        content: `Group these browser tabs into 2-5 clusters. Return ONLY valid JSON array:
[{"label":"Short name (max 3 words)","color":"#hexcolor","tabIds":["id1","id2"]}]`,
      },
      { role: 'user', content: tabList },
    ], 600)
    try { return this.parseJSON(raw) } catch { return [] }
  }

  // ─── Task Extraction ────────────────────────────────────────────

  async extractTasks(text: string, workspaceId: string): Promise<TaskItem[]> {
    const { text: raw } = await this.call([
      {
        role: 'system',
        content: 'Extract actionable to-do items. Return ONLY valid JSON: [{"text":"item","dueAt":null}]. Empty array if none.',
      },
      { role: 'user', content: text },
    ], 400)
    try {
      const parsed: Array<{ text: string; dueAt: number | null }> = this.parseJSON(raw)
      return parsed.map(item => ({
        id: randomUUID(), text: item.text, dueAt: item.dueAt ?? undefined,
        done: false, createdAt: Date.now(), workspaceId,
      }))
    } catch { return [] }
  }

  // ─── Risk Scoring ───────────────────────────────────────────────

  async scorePageRisk(url: string): Promise<number> {
    if (!this.settings.get('aiRiskScoringEnabled')) return 0
    try {
      const { text: raw } = await this.call([
        { role: 'system', content: 'Rate this URL risk 0.0 (safe) to 1.0 (dangerous). Reply with ONLY a decimal number.' },
        { role: 'user', content: url },
      ], 10)
      const score = parseFloat(raw.trim())
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score))
    } catch { return 0 }
  }

  // ─── Note Generation ────────────────────────────────────────────

  async generateNote(params: {
    highlightedText: string; pageUrl: string; pageTitle: string; workspaceId: string
  }): Promise<SmartNote> {
    const { text: raw } = await this.call([
      {
        role: 'system',
        content: 'Convert highlighted text into a structured Markdown note. Return ONLY valid JSON: {"content":"# Title\\n\\nMarkdown...","tags":["tag1"]}',
      },
      {
        role: 'user',
        content: `Text: "${params.highlightedText}"\nSource: ${params.pageTitle} — ${params.pageUrl}`,
      },
    ], 600)

    let parsed: { content: string; tags: string[] }
    try { parsed = this.parseJSON(raw) }
    catch { parsed = { content: `# Note\n\n${params.highlightedText}`, tags: [] } }

    return {
      id: randomUUID(), workspaceId: params.workspaceId,
      content: parsed.content, tags: parsed.tags,
      citations: [{ id: randomUUID(), title: params.pageTitle, url: params.pageUrl, excerpt: params.highlightedText.slice(0, 200) }],
      sourceUrl: params.pageUrl, createdAt: Date.now(), updatedAt: Date.now(),
    }
  }

  // ─── Status ────────────────────────────────────────────────────

  isReady(): boolean {
    return this.settings.get('aiEnabled') && !!this.settings.get('hackclubApiKey')
  }

  getStatus(): { ready: boolean; reason?: string } {
    if (!this.settings.get('aiEnabled')) return { ready: false, reason: 'AI disabled in settings' }
    if (!this.settings.get('hackclubApiKey')) return { ready: false, reason: 'No API key configured' }
    return { ready: true }
  }

  private assertReady(): void {
    if (!this.settings.get('aiEnabled')) throw new Error('AI disabled in settings')
    if (!this.settings.get('hackclubApiKey')) throw new Error('No API key set. Go to Settings → AI.')
  }
}