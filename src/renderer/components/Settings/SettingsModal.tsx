// src/renderer/components/Settings/SettingsModal.tsx
import { useState, useEffect } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { SettingsIPC } from '../../lib/ipc'
import type { KitsuneSettings } from '../../../shared/types'
import {
  IconSparkle, IconTab, IconShield, IconPalette,
  IconHotkey, IconInfo, IconClose,
} from '../Icons'
import styles from './SettingsModal.module.css'

type Section = 'ai' | 'tabs' | 'privacy' | 'appearance' | 'hotkeys' | 'about'

const NAV: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: 'ai',         label: 'AI & Intelligence', icon: <IconSparkle size={14} /> },
  { id: 'tabs',       label: 'Tabs & Memory',      icon: <IconTab size={14} /> },
  { id: 'privacy',    label: 'Privacy & Security', icon: <IconShield size={14} /> },
  { id: 'appearance', label: 'Appearance',          icon: <IconPalette size={14} /> },
  { id: 'hotkeys',    label: 'Hotkeys',             icon: <IconHotkey size={14} /> },
  { id: 'about',      label: 'About',               icon: <IconInfo size={14} /> },
]

export function SettingsModal() {
  const closeSettings = useBrowserStore(s => s.closeSettings)
  const [section, setSection]   = useState<Section>('ai')
  const [settings, setSettings] = useState<KitsuneSettings | null>(null)
  const [saved, setSaved]       = useState(false)

  useEffect(() => { SettingsIPC.get().then(setSettings) }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettings() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [closeSettings])

  const update = async <K extends keyof KitsuneSettings>(key: K, value: KitsuneSettings[K]) => {
    if (!settings) return
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    await SettingsIPC.set({ [key]: value })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (!settings) return null

  return (
    <div className={styles.overlay} onClick={closeSettings}>
      <div className={`${styles.modal} k-scale-in`} onClick={e => e.stopPropagation()}>

        {/* Sidebar */}
        <nav className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Settings</span>
            <button className={styles.closeBtn} onClick={closeSettings}><IconClose size={13} /></button>
          </div>
          {NAV.map(item => (
            <button
              key={item.id}
              className={`${styles.navItem} ${section === item.id ? styles.navActive : ''}`}
              onClick={() => setSection(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          {saved && <div className={styles.savedBadge}>Saved</div>}
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {section === 'ai'         && <AISection         s={settings} update={update} />}
          {section === 'tabs'       && <TabsSection       s={settings} update={update} />}
          {section === 'privacy'    && <PrivacySection    s={settings} update={update} />}
          {section === 'appearance' && <AppearanceSection s={settings} update={update} />}
          {section === 'hotkeys'    && <HotkeysSection    s={settings} />}
          {section === 'about'      && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

type U = <K extends keyof KitsuneSettings>(key: K, value: KitsuneSettings[K]) => void

function AISection({ s, update }: { s: KitsuneSettings; update: U }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>AI & Intelligence</h2>
      <p className={styles.sectionDesc}>Configure how Kitsune's AI works and where it runs.</p>

      <Row label="Enable AI" desc="Master switch for all AI features">
        <Toggle on={s.aiEnabled} onChange={v => update('aiEnabled', v)} />
      </Row>
      <Row label="Anthropic API Key" desc="Required for Claude-powered features. Stored locally, never shared.">
        <input
          type="password"
          className={styles.textInput}
          placeholder="sk-ant-…"
          defaultValue={s.anthropicApiKey}
          onBlur={e => update('anthropicApiKey', e.target.value)}
        />
      </Row>
      <Row label="Auto-summarize pages" desc="Generate a summary when you open the AI panel on a page">
        <Toggle on={s.autoGroupTabs} onChange={v => update('autoGroupTabs', v)} accent="ai" />
      </Row>
      <Row label="AI Tab Grouping" desc="Automatically cluster open tabs by topic">
        <Toggle on={s.autoGroupTabs} onChange={v => update('autoGroupTabs', v)} accent="ai" />
      </Row>
      <Row label="Pre-load Risk Scoring" desc="Score page safety before loading based on URL patterns">
        <Toggle on={s.aiRiskScoringEnabled} onChange={v => update('aiRiskScoringEnabled', v)} accent="ai" />
      </Row>
    </div>
  )
}

function TabsSection({ s, update }: { s: KitsuneSettings; update: U }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Tabs & Memory</h2>
      <p className={styles.sectionDesc}>Keep Kitsune fast with automatic RAM management.</p>

      <Row label="Auto-Hibernate Tabs" desc="Suspend idle tabs to free memory">
        <Toggle on={s.autoHibernateEnabled} onChange={v => update('autoHibernateEnabled', v)} />
      </Row>
      <Row label="Hibernate After" desc="How long a tab must be idle before hibernation">
        <Select
          value={String(s.hibernateAfterMs)}
          options={[
            { value: '300000',  label: '5 minutes' },
            { value: '600000',  label: '10 minutes' },
            { value: '1800000', label: '30 minutes' },
            { value: '3600000', label: '1 hour' },
          ]}
          onChange={v => update('hibernateAfterMs', parseInt(v))}
        />
      </Row>
      <Row label="Memory Cap per Tab" desc="Trigger early hibernation when tab exceeds this">
        <Select
          value={String(s.maxActiveTabMemoryMB)}
          options={[
            { value: '150',  label: '150 MB' },
            { value: '300',  label: '300 MB' },
            { value: '500',  label: '500 MB' },
            { value: '1000', label: '1 GB' },
          ]}
          onChange={v => update('maxActiveTabMemoryMB', parseInt(v))}
        />
      </Row>
      <Row label="Tab Layout" desc="Vertical sidebar or horizontal top bar">
        <Select
          value={s.tabLayout}
          options={[
            { value: 'vertical',   label: 'Vertical (sidebar)' },
            { value: 'horizontal', label: 'Horizontal (top)' },
          ]}
          onChange={v => update('tabLayout', v as any)}
        />
      </Row>
    </div>
  )
}

function PrivacySection({ s, update }: { s: KitsuneSettings; update: U }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Privacy & Security</h2>
      <div className={styles.securityBadge}>
        <IconShield size={13} />
        LibreWolf-equivalent protection
      </div>

      <Row label="Block Trackers" desc="Block known tracking scripts and ad networks at the network level">
        <Toggle on={s.trackerBlockingEnabled} onChange={v => update('trackerBlockingEnabled', v)} />
      </Row>
      <Row label="Block Ads" desc="Block advertisements using EasyList + uBlock filter lists">
        <Toggle on={s.adBlockingEnabled} onChange={v => update('adBlockingEnabled', v)} />
      </Row>
      <Row label="Fingerprint Protection" desc="Randomize canvas, WebGL, and device APIs to prevent tracking">
        <Toggle on={s.fingerprintProtection} onChange={v => update('fingerprintProtection', v)} />
      </Row>
      <Row label="AI Threat Detection" desc="Use AI heuristics to catch novel trackers not on any list">
        <Toggle on={s.trackerBlockingEnabled} onChange={v => update('trackerBlockingEnabled', v)} accent="ai" />
      </Row>
    </div>
  )
}

function AppearanceSection({ s, update }: { s: KitsuneSettings; update: U }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Appearance</h2>

      <Row label="Theme" desc="Color scheme for the browser chrome">
        <Select
          value={s.theme}
          options={[
            { value: 'dark',   label: 'Dark' },
            { value: 'light',  label: 'Light' },
            { value: 'system', label: 'Match System' },
          ]}
          onChange={v => update('theme', v as any)}
        />
      </Row>
      <Row label="Sidebar Position" desc="Which side the tab sidebar appears on">
        <Select
          value={s.sidebarPosition}
          options={[
            { value: 'left',  label: 'Left' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={v => update('sidebarPosition', v as any)}
        />
      </Row>
    </div>
  )
}

function HotkeysSection({ s }: { s: KitsuneSettings }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Hotkeys</h2>
      <p className={styles.sectionDesc}>All keyboard shortcuts. Full mouse-free operation supported.</p>
      <div className={styles.hotkeyList}>
        {Object.entries(s.hotkeys).map(([key, action]) => (
          <div key={key} className={styles.hotkeyRow}>
            <span className={styles.hotkeyAction}>{String(action).replace(/:/g, ' › ')}</span>
            <kbd className={styles.hotkeyKbd}>
              {key.replace('cmd', '⌘').replace('shift', '⇧').replace('ctrl', '⌃')}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  )
}

function AboutSection() {
  return (
    <div className={styles.section}>
      <div className={styles.aboutHeader}>
        <div className={styles.aboutLogoWrap}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#ff6b35" />
            <path d="M20 6L10 13 7 20l3 8 10 3 10-3 3-8-3-7z" fill="white" opacity=".9" />
            <path d="M10 13L7 8M30 13l3-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="16" cy="20" r="2.5" fill="#ff6b35" />
            <circle cx="24" cy="20" r="2.5" fill="#ff6b35" />
          </svg>
        </div>
        <div>
          <h2 className={styles.aboutTitle}>Kitsune</h2>
          <p className={styles.aboutVersion}>Version 0.9.4 — pre-release</p>
        </div>
      </div>
      <p className={styles.aboutDesc}>
        An AI-native browser built on Electron. Designed to be fast, private, and intelligent
        — helping you research, focus, and build without friction.
      </p>
    </div>
  )
}

// ── Shared controls ───────────────────────────────────────────────

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowInfo}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, accent = 'fox' }: { on: boolean; onChange: (v: boolean) => void; accent?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      className={`${styles.toggle} ${on ? (accent === 'ai' ? styles.toggleAI : styles.toggleOn) : styles.toggleOff}`}
      onClick={() => onChange(!on)}
    />
  )
}

function Select({ value, options, onChange }: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <select className={styles.select} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
