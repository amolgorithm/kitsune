// src/main/services/AIService.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — AI Service
// Central hub for all AI operations:
//   • Page summarization
//   • Cross-page research synthesis
//   • Chat with browsing context
//   • Tab clustering (auto-grouping)
//   • Task extraction from highlighted text
//   • Risk pre-scoring
// Uses @anthropic-ai/sdk. Supports streaming for chat.
// ─────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import type {
  AISummary,
  CrossPageSummary,
  ChatMessage,
  TaskItem,
  SmartNote,
  Citation,
} from '../../shared/types'
import { AI_CONTEXT_MAX_CHARS } from '../../shared/constants'
import type { SettingsStore } from './SettingsStore'
import { randomUUID } from 'crypto'

export class AIService {
  private client: Anthropic | null = null

  constructor(private readonly settings: SettingsStore) {
    this.refreshClient()
    // Re-init if API key changes at runtime
    settings.onChange('anthropicApiKey', () => this.refreshClient())
  }

  // ─── Page Summary ───────────────────────────────────────────────

  async summarizePage(params: {
    tabId: string
    url: string
    title: string
    pageText: string
  }): Promise<AISummary> {
    this.assertReady()

    const text = params.pageText.slice(0, AI_CONTEXT_MAX_CHARS)

    const response = await this.client!.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      system: `You are Kitsune's page summarizer. Given a web page's text content, extract:
1. keyPoints: 3-5 concise bullet points covering the main ideas
2. stats: any notable numbers, data points, or statistics (up to 5)
3. links: any external sources or references mentioned (url + text label)

Respond ONLY with valid JSON in this exact shape:
{
  "keyPoints": ["..."],
  "stats": ["..."],
  "links": [{ "text": "...", "url": "..." }]
}`,
      messages: [
        {
          role: 'user',
          content: `Page title: ${params.title}\nURL: ${params.url}\n\nPage content:\n${text}`,
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    let parsed: Pick<AISummary, 'keyPoints' | 'stats' | 'links'>

    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { keyPoints: [raw], stats: [], links: [] }
    }

    return {
      tabId: params.tabId,
      url: params.url,
      title: params.title,
      keyPoints: parsed.keyPoints ?? [],
      stats: parsed.stats ?? [],
      links: parsed.links ?? [],
      generatedAt: Date.now(),
      model: response.model,
    }
  }

  // ─── Cross-Page Research Summary ────────────────────────────────

  async summarizeCrossPage(params: {
    topic: string
    pages: Array<{ tabId: string; url: string; title: string; text: string }>
  }): Promise<CrossPageSummary> {
    this.assertReady()

    const pagesContext = params.pages
      .map(p => `## ${p.title}\nURL: ${p.url}\n${p.text.slice(0, 2000)}`)
      .join('\n\n---\n\n')

    const response = await this.client!.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      system: `You are a research synthesis engine. Given multiple web pages on a topic, produce a cohesive, well-structured research summary. Include inline citations using [1], [2] etc. referencing the source pages.

Respond with valid JSON:
{
  "content": "Markdown formatted summary with [n] citations",
  "citations": [
    { "id": "1", "title": "...", "url": "...", "excerpt": "..." }
  ]
}`,
      messages: [
        {
          role: 'user',
          content: `Research topic: ${params.topic}\n\nSources:\n${pagesContext}`,
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    let parsed: { content: string; citations: Citation[] }

    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { content: raw, citations: [] }
    }

    return {
      id: randomUUID(),
      tabIds: params.pages.map(p => p.tabId),
      topic: params.topic,
      content: parsed.content,
      citations: parsed.citations,
      generatedAt: Date.now(),
    }
  }

  // ─── Chat ───────────────────────────────────────────────────────

  /**
   * Non-streaming chat turn. For streaming, use chatStream().
   */
  async chat(params: {
    messages: ChatMessage[]
    pageContext?: string
    workspaceContext?: string
  }): Promise<string> {
    this.assertReady()

    const systemParts = [
      'You are Kitsune AI, an intelligent browser assistant. You help users with research, summarization, navigation, and productivity tasks.',
      'You have access to the user\'s current browsing context.',
    ]
    if (params.pageContext) {
      systemParts.push(`\nCurrent page content (truncated):\n${params.pageContext.slice(0, 3000)}`)
    }
    if (params.workspaceContext) {
      systemParts.push(`\nOpen tabs in current workspace:\n${params.workspaceContext}`)
    }

    const response = await this.client!.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: systemParts.join('\n'),
      messages: params.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    return response.content[0].type === 'text' ? response.content[0].text : ''
  }

  /**
   * Streaming chat — calls onDelta with each text chunk, returns full text.
   */
  async chatStream(params: {
    messages: ChatMessage[]
    pageContext?: string
    onDelta: (delta: string) => void
  }): Promise<string> {
    this.assertReady()

    let full = ''
    const stream = this.client!.messages.stream({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: 'You are Kitsune AI, an intelligent browser assistant.',
      messages: params.messages.map(m => ({ role: m.role, content: m.content })),
    })

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        full += chunk.delta.text
        params.onDelta(chunk.delta.text)
      }
    }

    return full
  }

  // ─── Tab Clustering (auto-grouping) ─────────────────────────────

  async clusterTabs(tabs: Array<{ id: string; title: string; url: string }>): Promise<
    Array<{ label: string; color: string; tabIds: string[] }>
  > {
    this.assertReady()

    const tabList = tabs
      .map((t, i) => `${i + 1}. [${t.id}] ${t.title} — ${t.url}`)
      .join('\n')

    const response = await this.client!.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      system: `You are a tab organizer. Given a list of browser tabs, group them into 2–6 logical clusters by topic or purpose. 
      
Return ONLY valid JSON:
[
  {
    "label": "Short group name",
    "color": "#hexcolor",
    "tabIds": ["id1", "id2"]
  }
]

Use distinct, visually distinct hex colors. Be concise with labels (2-3 words max).`,
      messages: [{ role: 'user', content: tabList }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  }

  // ─── Task Extraction ────────────────────────────────────────────

  async extractTasks(text: string, workspaceId: string): Promise<TaskItem[]> {
    this.assertReady()

    const response = await this.client!.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      system: `Extract actionable to-do items from the given text. Return ONLY valid JSON:
[{ "text": "Short action item", "dueAt": null }]
If no clear tasks, return [].`,
      messages: [{ role: 'user', content: text }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
    try {
      const parsed: Array<{ text: string; dueAt: number | null }> = JSON.parse(raw)
      return parsed.map(item => ({
        id: randomUUID(),
        text: item.text,
        dueAt: item.dueAt ?? undefined,
        done: false,
        createdAt: Date.now(),
        workspaceId,
      }))
    } catch {
      return []
    }
  }

  // ─── Pre-load Risk Score ─────────────────────────────────────────

  async scorePageRisk(url: string): Promise<number> {
    if (!this.settings.get('aiRiskScoringEnabled')) return 0
    this.assertReady()

    // Lightweight heuristic — no full page load needed, just URL analysis
    const response = await this.client!.messages.create({
      model: 'claude-haiku-4-5-20251001',  // fast, cheap model for this
      max_tokens: 50,
      system: 'You are a URL safety analyzer. Given a URL, respond with ONLY a single number between 0.0 and 1.0 representing malicious risk (0=safe, 1=definitely malicious). Base this on URL patterns, domain reputation signals, and known attack patterns.',
      messages: [{ role: 'user', content: url }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '0'
    const score = parseFloat(raw)
    return isNaN(score) ? 0 : Math.max(0, Math.min(1, score))
  }

  // ─── Notes Generation ───────────────────────────────────────────

  async generateNote(params: {
    highlightedText: string
    pageUrl: string
    pageTitle: string
    workspaceId: string
  }): Promise<SmartNote> {
    this.assertReady()

    const response = await this.client!.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      system: `Convert the highlighted text into a well-formatted research note in Markdown. Extract key info, format it cleanly, and note the source. Return ONLY valid JSON:
{
  "content": "# Note Title\\n\\nMarkdown content...",
  "tags": ["tag1", "tag2"]
}`,
      messages: [
        {
          role: 'user',
          content: `Highlighted text:\n"${params.highlightedText}"\n\nSource: ${params.pageTitle}\n${params.pageUrl}`,
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
    let parsed: { content: string; tags: string[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { content: params.highlightedText, tags: [] }
    }

    return {
      id: randomUUID(),
      workspaceId: params.workspaceId,
      content: parsed.content,
      citations: [{
        id: randomUUID(),
        title: params.pageTitle,
        url: params.pageUrl,
        excerpt: params.highlightedText.slice(0, 200),
      }],
      sourceUrl: params.pageUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: parsed.tags,
    }
  }

  // ─── Private ────────────────────────────────────────────────────

  private refreshClient(): void {
    const key = this.settings.get('anthropicApiKey')
    if (key) {
      this.client = new Anthropic({ apiKey: key })
    } else {
      this.client = null
    }
  }

  private assertReady(): void {
    if (!this.settings.get('aiEnabled')) {
      throw new Error('AI features are disabled in settings')
    }
    if (!this.client) {
      throw new Error('Anthropic API key not configured. Go to Settings → AI.')
    }
  }
}
