# AI

## Backend

Kitsune uses [HackClub's AI proxy](https://ai.hackclub.com), which exposes an OpenAI-compatible `/v1/chat/completions` endpoint backed by a range of frontier models. It is free and requires no account sign-up.

A working API key ships bundled in the default settings so AI features work immediately on first launch.

## Models

The default model is `google/gemini-2.5-flash`. You can change it in Settings → AI & Intelligence.

| Model string | Notes |
|---|---|
| `google/gemini-2.5-flash` | Default — fast, capable, recommended |
| `google/gemini-3-flash-preview` | Newer preview build |
| `deepseek/deepseek-r1-0528` | Strong reasoning tasks |
| `qwen/qwen3-235b-a22b` | Large, powerful |
| `deepseek/deepseek-v3.2` | Fast general purpose |
| `moonshotai/kimi-k2-thinking` | Thinking model |

## API Key Setup

The bundled key is a shared HackClub key. For production or heavy use, get your own:

1. Visit [ai.hackclub.com](https://ai.hackclub.com)
2. Copy the key
3. Open Settings (`Ctrl+,`) → AI & Intelligence → paste into the API Key field
4. Click **Test** to verify it works

You can also set it via environment variable before launching:

```bash
ANTHROPIC_API_KEY=sk-hc-v1-... npm run dev
```

## How Each Feature Uses AI

### Page Summary
- Model: configured model
- Input: page title, URL, up to 8,000 characters of `document.body.innerText`
- Output: JSON `{ keyPoints, stats, links }` — parsed and rendered as cards
- Caching: result is stored per tab ID for the session

### Cross-Page Research
- Model: configured model
- Input: topic string + up to 2,000 chars per tab from N selected tabs
- Output: Markdown with `[1]`, `[2]` inline citations + citation list

### Chat
- Model: configured model
- System prompt: Kitsune assistant identity + optional current page context (first 3,000 chars)
- Conversation history: full message array sent each turn

### Tab Clustering
- Model: configured model
- Input: list of `{ id, title, url }` for all tabs in the workspace
- Output: JSON array of `{ label, color, tabIds }` — creates AI-managed groups

### Task Extraction
- Model: configured model
- Input: highlighted text
- Output: JSON array of `{ text, dueAt }` task objects

### Risk Scoring
- Model: `claude-haiku` equivalent (fast, cheap)
- Input: URL string only — no page content loaded yet
- Output: decimal 0.0–1.0
- Only runs when enabled in Settings → Privacy

### Note Generation
- Model: configured model
- Input: highlighted text + page title and URL
- Output: JSON `{ content: "# Title\n\nMarkdown...", tags: [] }`

### File Search
- Model: configured model
- Input: natural language query + up to 12,000 chars of extracted file text
- Output: JSON `{ answer, results: [{ fileId, fileName, excerpt, relevance }], linkedToPage }`

## Context Limits

| Feature | Max chars sent to AI |
|---------|---------------------|
| Page summary | 8,000 |
| Cross-page research | 2,000 per tab |
| Chat page context | 3,000 |
| File search | 12,000 total across all files |
| Note generation | highlighted text as-is |
| Risk scoring | URL only |

These limits are defined in `src/shared/constants.ts` and `src/renderer/components/FileSearch/FileSearch.tsx`.

## AI Status

The status badge in the AI panel header shows whether AI is ready. Reasons it may not be ready:

- AI is disabled in Settings → AI & Intelligence
- No API key is configured

Check status programmatically: `AIIPC.status()` returns `{ ready: boolean, reason?: string }`.
