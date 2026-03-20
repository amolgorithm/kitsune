// src/renderer/App.tsx
// ─────────────────────────────────────────────────────────────────
// Kitsune — Root Renderer Component
// Composes the full browser chrome UI. Bootstraps the store on
// mount and wires global hotkeys.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useCallback } from 'react'
import { useBrowserStore } from './stores/browserStore'
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
import './styles/global.css'
import './styles/tokens.css'
import './styles/lenses.css'

export default function App() {
  const init            = useBrowserStore(s => s.init)
  const aiPanelOpen     = useBrowserStore(s => s.aiPanelOpen)
  const cmdOpen         = useBrowserStore(s => s.commandPaletteOpen)
  const settingsOpen    = useBrowserStore(s => s.settingsOpen)
  const cleaveOpen      = useBrowserStore(s => s.cleaveOpen)
  const activeLensId    = useBrowserStore(s => s.activeLensId)

  const openCommandPalette = useBrowserStore(s => s.openCommandPalette)
  const toggleAIPanel      = useBrowserStore(s => s.toggleAIPanel)
  const toggleCleave       = useBrowserStore(s => s.toggleCleave)
  const openSettings       = useBrowserStore(s => s.openSettings)
  const createTab          = useBrowserStore(s => s.createTab)
  const closeTab           = useBrowserStore(s => s.closeTab)
  const activeTabId        = useBrowserStore(s => s.activeTabId)

  // Bootstrap
  useEffect(() => { init() }, [init])

  // Global hotkeys
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey

    if (meta && e.key === 'k') { e.preventDefault(); openCommandPalette() }
    if (meta && e.key === '\\') { e.preventDefault(); toggleCleave() }
    if (meta && e.key === ',') { e.preventDefault(); openSettings() }
    if (meta && e.shiftKey && e.key === 'A') { e.preventDefault(); toggleAIPanel() }
    if (meta && e.key === 't') { e.preventDefault(); createTab('kitsune://newtab') }
    if (meta && e.key === 'w' && activeTabId) { e.preventDefault(); closeTab(activeTabId) }
  }, [openCommandPalette, toggleCleave, openSettings, toggleAIPanel, createTab, closeTab, activeTabId])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className={`app lens-${activeLensId}`}>
      {/* Main chrome layout */}
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

      {/* Overlays */}
      {cmdOpen      && <CommandPalette />}
      {settingsOpen && <SettingsModal />}
      {cleaveOpen   && <CleaveOverlay />}
    </div>
  )
}
