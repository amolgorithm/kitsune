// src/main/services/AIService.ts
// Uses HackClub AI proxy (free, OpenAI-compatible API)
// Endpoint: https://ai.hackclub.com/proxy/v1
import type {
  AISummary, CrossPageSummary, ChatMessage,
  TaskItem, SmartNote, Citation,
} from '../../shared/types'
import { AI_CONTEXT_MAX_CHARS } from '../../shared/constants'
import type { SettingsStore } from './SettingsStore'
import { randomUUID } from 'crypto'

// HackClub AI uses OpenAI-compatible API format
const HACKCLUB_BASE = 'https://ai.hackclub.com/proxy/v1'

interface OAIMessage { role: string; content: string }
interface OAIResponse { choices: Array<{ message: { content: string } }>; model: string }

export class AIService {
  constructor(private readonly settings: SettingsStore) {}

  // ─── Core API call ───────────────────────────────────────────────

  private async call(messages: OAIMessage[], maxTokens = 1000): Promise<{ text: string; model: string }> {
    this.assertReady()
    const key   = this.settings.get('hackclubApiKey')
    const model = this.settings.get('aiModel')

    const res = await fetch(`${HACKCLUB_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`AI API error ${res.status}: ${err}`)
    }

    const data: OAIResponse = await res.json()
    return {
      text:  data.choices[0]?.message?.content ?? '',
      model: data.model ?? model,
    }
  }

  // ─── Page Summary ───────────────────────────────────────────────

  async summarizePage(params: {
    tabId: string; url: string; title: string; pageText: string
  }): Promise<AISummary> {
    const text = params.pageText.slice(0, AI_CONTEXT_MAX_CHARS)
    const { text: raw, model } = await this.call([
      {
        role: 'system',
        content: `You are a web page summarizer. Extract:
1. keyPoints: 3-5 bullet points covering the main ideas
2. stats: notable numbers/data (up to 5, empty array if none)
3. links: external sources mentioned (up to 5, empty array if none)
Respond ONLY with valid JSON: {"keyPoints":["..."],"stats":["..."],"links":[{"text":"...","url":"..."}]}`
      },
      { role: 'user', content: `Title: ${params.title}\nURL: ${params.url}\n\n${text}` },
    ], 800)

    try {
      const parsed = JSON.parse(raw)
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
      .map((p, i) => `## Source [${i+1}]: ${p.title}\nURL: ${p.url}\n${p.text.slice(0, 2000)}`)
      .join('\n\n---\n\n')

    const { text: raw } = await this.call([
      {
        role: 'system',
        content: `Synthesize multiple web pages into a cohesive research summary. Use [1],[2] inline citations referencing source numbers.
Return ONLY valid JSON: {"content":"Markdown summary with [n] citations","citations":[{"id":"1","title":"...","url":"...","excerpt":"..."}]}`
      },
      { role: 'user', content: `Research topic: ${params.topic}\n\nSources:\n${pagesCtx}` },
    ], 2000)

    try {
      const parsed = JSON.parse(raw)
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

  async chat(params: {
    messages: ChatMessage[]; pageContext?: string
  }): Promise<string> {
    const systemParts = [
      'You are Kitsune AI, an intelligent browser assistant. Help users with research, summarization, navigation, and productivity. Be concise and useful.',
    ]
    if (params.pageContext) {
      systemParts.push(`\nCurrent page content (first 3000 chars):\n${params.pageContext}`)
    }

    const { text } = await this.call([
      { role: 'system', content: systemParts.join('\n') },
      ...params.messages.map(m => ({ role: m.role, content: m.content })),
    ], 1000)

    return text
  }

  // ─── Tab Clustering ─────────────────────────────────────────────

  async clusterTabs(tabs: Array<{ id: string; title: string; url: string }>): Promise<
    Array<{ label: string; color: string; tabIds: string[] }>
  > {
    if (tabs.length < 2) return []

    const tabList = tabs.map((t, i) => `${i+1}. [${t.id}] ${t.title} — ${t.url}`).join('\n')

    const { text: raw } = await this.call([
      {
        role: 'system',
        content: `Group browser tabs into 2-5 logical clusters by topic/purpose. Labels max 3 words. Use distinct hex colors.
Return ONLY valid JSON array: [{"label":"Short name","color":"#hexcolor","tabIds":["id1","id2"]}]`
      },
      { role: 'user', content: tabList },
    ], 600)

    try { return JSON.parse(raw) } catch { return [] }
  }

  // ─── Task Extraction ────────────────────────────────────────────

  async extractTasks(text: string, workspaceId: string): Promise<TaskItem[]> {
    const { text: raw } = await this.call([
      {
        role: 'system',
        content: 'Extract actionable to-do items from the text. Return ONLY valid JSON: [{"text":"Action item","dueAt":null}]. If no tasks, return [].'
      },
      { role: 'user', content: text },
    ], 400)

    try {
      const parsed: Array<{ text: string; dueAt: number | null }> = JSON.parse(raw)
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
        { role: 'system', content: 'Rate the malicious risk of this URL from 0.0 (safe) to 1.0 (dangerous). Consider phishing patterns, suspicious TLDs, misleading domains. Respond with ONLY a decimal number like 0.1 or 0.85.' },
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
        content: 'Convert highlighted text into a structured Markdown research note with a clear title, organized content, and proper citation. Return ONLY valid JSON: {"content":"# Title\\n\\nMarkdown...","tags":["tag1","tag2"]}'
      },
      {
        role: 'user',
        content: `Highlighted text:\n"${params.highlightedText}"\n\nSource: ${params.pageTitle}\n${params.pageUrl}`,
      },
    ], 600)

    let parsed: { content: string; tags: string[] }
    try { parsed = JSON.parse(raw) }
    catch { parsed = { content: `# Note\n\n${params.highlightedText}`, tags: [] } }

    return {
      id: randomUUID(), workspaceId: params.workspaceId,
      content: parsed.content, tags: parsed.tags,
      citations: [{
        id: randomUUID(), title: params.pageTitle, url: params.pageUrl,
        excerpt: params.highlightedText.slice(0, 200),
      }],
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
    if (!this.settings.get('hackclubApiKey')) throw new Error('No API key set. Add it in Settings → AI.')
  }
}
