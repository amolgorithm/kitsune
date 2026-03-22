// TEMPORARY DEBUG COMPONENT
// Add to App.tsx temporarily: import { AIDebug } from './components/AIDebug'
// Then add <AIDebug /> anywhere in the JSX
// Remove after diagnosing

import { useState } from 'react'

const TESTS = [
  {
    label: 'HackClub /proxy/v1 (current)',
    url: 'https://ai.hackclub.com/proxy/v1/chat/completions',
    needsAuth: true,
  },
  {
    label: 'HackClub /chat/completions (no prefix)',
    url: 'https://ai.hackclub.com/chat/completions',
    needsAuth: true,
  },
  {
    label: 'HackClub /proxy/v1 NO auth',
    url: 'https://ai.hackclub.com/proxy/v1/chat/completions',
    needsAuth: false,
  },
  {
    label: 'HackClub /chat/completions NO auth',
    url: 'https://ai.hackclub.com/chat/completions',
    needsAuth: false,
  },
]

const BODY = JSON.stringify({
  model: 'google/gemini-2.5-flash',
  messages: [{ role: 'user', content: 'Say the word OK and nothing else.' }],
  max_tokens: 5,
})

export function AIDebug() {
  const [key, setKey] = useState('')
  const [results, setResults] = useState<Array<{ label: string; status: string; body: string }>>([])
  const [running, setRunning] = useState(false)

  const runTests = async () => {
    setRunning(true)
    setResults([])
    const out: typeof results = []

    for (const test of TESTS) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (test.needsAuth && key) headers['Authorization'] = `Bearer ${key}`

      try {
        const res = await fetch(test.url, { method: 'POST', headers, body: BODY })
        const body = await res.text()
        out.push({ label: test.label, status: `HTTP ${res.status}`, body: body.slice(0, 200) })
      } catch (e: any) {
        out.push({ label: test.label, status: 'FETCH ERROR', body: `${e.message} | cause: ${e.cause?.message ?? e.cause ?? 'none'}` })
      }
      setResults([...out])
    }
    setRunning(false)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 60, right: 10, zIndex: 9999,
      width: 500, background: '#0d0f12', border: '1px solid #ff6b35',
      borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 11,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#ff6b35' }}>AI Debug Panel</div>
      <input
        value={key}
        onChange={e => setKey(e.target.value)}
        placeholder="Paste API key here (optional)"
        style={{ width: '100%', background: '#1a1e27', border: '1px solid #333', color: '#fff', padding: '4px 8px', borderRadius: 4, marginBottom: 8, fontSize: 11, fontFamily: 'monospace' }}
      />
      <button
        onClick={runTests}
        disabled={running}
        style={{ background: '#ff6b35', color: '#000', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', marginBottom: 8 }}
      >
        {running ? 'Testing...' : 'Run All Tests'}
      </button>
      {results.map((r, i) => (
        <div key={i} style={{ marginBottom: 8, borderTop: '1px solid #222', paddingTop: 6 }}>
          <div style={{ color: r.status.startsWith('HTTP 2') ? '#4cffb0' : '#ff4d6d', fontWeight: 700 }}>
            {r.label}: {r.status}
          </div>
          <div style={{ color: '#888', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{r.body}</div>
        </div>
      ))}
    </div>
  )
}