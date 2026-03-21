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
  const activeLensId       = useBrowserStore(s => s.activeLensId)
  const settings           = useBrowserStore(s => s.settings)
  const applySettingsToDOM = useBrowserStore(s => s.applySettingsToDOM)

  const openCommandPalette = useBrowserStore(s => s.openCommandPalette)
  const toggleAIPanel      = useBrowserStore(s => s.toggleAIPanel)
  const toggleCleave       = useBrowserStore(s => s.toggleCleave)
  const openSettings       = useBrowserStore(s => s.openSettings)
  const toggleFileSearch   = useBrowserStore(s => s.toggleFileSearch)
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
    if (meta && e.shiftKey && e.key === 'a')      { e.preventDefault(); toggleAIPanel() }
    if (meta && e.shiftKey && e.key === 'f')      { e.preventDefault(); toggleFileSearch() }
    if (meta && e.key === 't')                    { e.preventDefault(); createTab('kitsune://newtab') }
    if (meta && e.key === 'w' && activeTabId)     { e.preventDefault(); closeTab(activeTabId) }
    if (e.ctrlKey && e.key === '1')               { e.preventDefault(); setActiveLens('default') }
    if (e.ctrlKey && e.key === '2')               { e.preventDefault(); setActiveLens('research') }
    if (e.ctrlKey && e.key === '3')               { e.preventDefault(); setActiveLens('coding') }
    if (e.ctrlKey && e.key === '4')               { e.preventDefault(); setActiveLens('reading') }
  }, [openCommandPalette, toggleCleave, openSettings, toggleAIPanel, toggleFileSearch,
      createTab, closeTab, activeTabId, setActiveLens])

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
    </div>
  )
}
