// src/renderer/App.tsx
import { useEffect, useCallback } from 'react'
import { useBrowserStore } from './stores/browserStore'
import { TitleBar } from './components/TitleBar/TitleBar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Navbar } from './components/Navbar/Navbar'
import { LensBar } from './components/LensBar/LensBar'
import { ContentArea } from './components/ContentArea/ContentArea'
import { AIPanel } from './components/AIPanel/AIPanel'
import { StatusBar } from './components/StatusBar/StatusBar'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { SettingsModal } from './components/Settings/SettingsModal'
import { CleaveOverlay } from './components/Cleave/CleaveOverlay'
import { HotkeyBar } from './components/HotkeyBar/HotkeyBar'
import { FileSearch } from './components/FileSearch/FileSearch'
import { CommandREPL } from './components/CommandREPL/CommandREPL'
import { NineTails } from './components/NineTails/NineTails'
import './styles/global.css'
import './styles/tokens.css'
import './styles/lenses.css'
import './styles/appearance.css'

export default function App() {
  const init               = useBrowserStore(s => s.init)
  const initError          = useBrowserStore(s => s.initError)
  const aiPanelOpen        = useBrowserStore(s => s.aiPanelOpen)
  const cmdOpen            = useBrowserStore(s => s.commandPaletteOpen)
  const settingsOpen       = useBrowserStore(s => s.settingsOpen)
  const cleaveOpen         = useBrowserStore(s => s.cleaveOpen)
  const fileSearchOpen     = useBrowserStore(s => s.fileSearchOpen)
  const replOpen           = useBrowserStore(s => s.replOpen)
  const nineTailsOpen      = useBrowserStore(s => s.nineTailsOpen)
  const activeLensId       = useBrowserStore(s => s.activeLensId)
  const settings           = useBrowserStore(s => s.settings)
  const applySettingsToDOM = useBrowserStore(s => s.applySettingsToDOM)

  const openCommandPalette = useBrowserStore(s => s.openCommandPalette)
  const toggleAIPanel      = useBrowserStore(s => s.toggleAIPanel)
  const toggleCleave       = useBrowserStore(s => s.toggleCleave)
  const openSettings       = useBrowserStore(s => s.openSettings)
  const toggleFileSearch   = useBrowserStore(s => s.toggleFileSearch)
  const toggleREPL         = useBrowserStore(s => s.toggleREPL)
  const toggleNineTails    = useBrowserStore(s => s.toggleNineTails)
  const createTab          = useBrowserStore(s => s.createTab)
  const closeTab           = useBrowserStore(s => s.closeTab)
  const activeTabId        = useBrowserStore(s => s.activeTabId)
  const setActiveLens      = useBrowserStore(s => s.setActiveLens)

  useEffect(() => { init() }, [init])
  useEffect(() => { applySettingsToDOM() }, [settings, applySettingsToDOM])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey
    if (meta && e.key === 'k')                    { e.preventDefault(); openCommandPalette() }
    if (meta && e.key === '\\')                   { e.preventDefault(); toggleCleave() }
    if (meta && e.key === ',')                    { e.preventDefault(); openSettings() }
    if (meta && e.shiftKey && e.key === 'A')      { e.preventDefault(); toggleAIPanel() }
    if (meta && e.shiftKey && e.key === 'F')      { e.preventDefault(); toggleFileSearch() }
    if (meta && e.key === 't')                    { e.preventDefault(); createTab('kitsune://newtab') }
    if (meta && e.key === 'w' && activeTabId)     { e.preventDefault(); closeTab(activeTabId) }
    if (meta && e.key === '`')                    { e.preventDefault(); toggleREPL() }
    if (meta && e.shiftKey && e.key === ':')      { e.preventDefault(); toggleREPL() }
    if (meta && e.key === '9')                    { e.preventDefault(); toggleNineTails() }
    if (e.ctrlKey && e.key === '1')               { e.preventDefault(); setActiveLens('default') }
    if (e.ctrlKey && e.key === '2')               { e.preventDefault(); setActiveLens('research') }
    if (e.ctrlKey && e.key === '3')               { e.preventDefault(); setActiveLens('coding') }
    if (e.ctrlKey && e.key === '4')               { e.preventDefault(); setActiveLens('reading') }
  }, [openCommandPalette, toggleCleave, openSettings, toggleAIPanel, toggleFileSearch,
      createTab, closeTab, activeTabId, setActiveLens, toggleREPL, toggleNineTails])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (initError) {
    return (
      <div style={{ background:'#0d0f12', color:'#e8eaf0', height:'100vh', display:'flex',
        flexDirection:'column', alignItems:'center', justifyContent:'center',
        fontFamily:'monospace', padding:32, gap:16 }}>
        <div style={{ fontSize:32 }}>⚠</div>
        <div style={{ fontSize:16, fontWeight:600 }}>Kitsune failed to start</div>
        <div style={{ fontSize:12, color:'#ff4d6d', background:'#1a1e27',
          padding:'12px 16px', borderRadius:8, maxWidth:560, wordBreak:'break-all' }}>
          {initError}
        </div>
      </div>
    )
  }

  return (
    <div className={`app lens-${activeLensId}`}>
      <TitleBar />
      <div className="chrome">
        <Sidebar />
        <div className="main">
          <Navbar />
          <LensBar />
          <div className="content-row">
            <ContentArea />
            {aiPanelOpen && <AIPanel />}
          </div>
          <HotkeyBar />
          <StatusBar />
        </div>
      </div>

      {cmdOpen        && <CommandPalette />}
      {settingsOpen   && <SettingsModal />}
      {cleaveOpen     && <CleaveOverlay />}
      {fileSearchOpen && <FileSearch />}
      {replOpen       && <CommandREPL />}
      {nineTailsOpen  && <NineTailsModal onClose={toggleNineTails} />}
    </div>
  )
}

// ─── Nine Tails full-screen modal wrapper ─────────────────────────
function NineTailsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--k-z-modal)' as any,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'k-fade-in 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '92vw', maxWidth: 1160, height: '86vh',
          background: '#080a0f',
          border: '1px solid rgba(255,107,53,0.18)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
          position: 'relative',
          animation: 'k-scale-in 0.25s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 10,
            width: 30, height: 30, borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,77,109,0.2)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#ff4d6d'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'
          }}
        >
          ✕
        </button>
        <NineTails />
      </div>
    </div>
  )
}