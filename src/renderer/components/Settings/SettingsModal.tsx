// src/renderer/components/Settings/SettingsModal.tsx
import { useState, useEffect } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { SettingsIPC } from '../../lib/ipc'
import type { KitsuneSettings } from '../../../shared/types'
import styles from './SettingsModal.module.css'

type SettingsSection = 'ai' | 'tabs' | 'privacy' | 'appearance' | 'hotkeys' | 'about'

const NAV_ITEMS: Array<{ id: SettingsSection; label: string; icon: string }> = [
  { id: 'ai',         label: 'AI & Intelligence', icon: '✦' },
  { id: 'tabs',       label: 'Tabs & Memory',      icon: '📋' },
  { id: 'privacy',    label: 'Privacy & Security', icon: '🛡' },
  { id: 'appearance', label: 'Appearance',          icon: '🎨' },
  { id: 'hotkeys',    label: 'Hotkeys',             icon: '⌨' },
  { id: 'about',      label: 'About Kitsune',       icon: '🦊' },
]

export function SettingsModal() {
  const closeSettings = useBrowserStore(s => s.closeSettings)
  const [section, setSection]   = useState<SettingsSection>('ai')
  const [settings, setSettings] = useState<KitsuneSettings | null>(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    SettingsIPC.get().then(setSettings)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeSettings])

  const update = async <K extends keyof KitsuneSettings>(key: K, value: KitsuneSettings[K]) => {
    if (!settings) return
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    setSaving(true)
    try {
      await SettingsIPC.set({ [key]: value })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return null

  return (
    <div className={styles.overlay} onClick={closeSettings}>
      <div className={`${styles.modal} k-scale-in`} onClick={e => e.stopPropagation()}>
        {/* Sidebar nav */}
        <nav className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Settings</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`${styles.navItem} ${section === item.id ? styles.navItemActive : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* Save status */}
          <div className={styles.saveStatus}>
            {saving && <span className={styles.saving}>Saving…</span>}
            {saved  && <span className={styles.saved}>✓ Saved</span>}
          </div>
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {section === 'ai'         && <AISettings         settings={settings} update={update} />}
          {section === 'tabs'       && <TabSettings        settings={settings} update={update} />}
          {section === 'privacy'    && <PrivacySettings    settings={settings} update={update} />}
          {section === 'appearance' && <AppearanceSettings settings={settings} update={update} />}
          {section === 'hotkeys'    && <HotkeysSettings    settings={settings} />}
          {section === 'about'      && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

// ── Section components ────────────────────────────────────────────

type UpdateFn = <K extends keyof KitsuneSettings>(key: K, value: KitsuneSettings[K]) => void

function AISettings({ settings, update }: { settings: KitsuneSettings; update: UpdateFn }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>AI & Intelligence</h2>
      <p className={styles.sectionDesc}>Configure Kitsune's AI capabilities and data handling.</p>

      <SettingRow
        label="AI Features"
        desc="Enable all AI-powered features across the browser"
        control={<Toggle value={settings.aiEnabled} onChange={v => update('aiEnabled', v)} />}
      />
      <SettingRow
        label="AI Provider"
        desc="Choose where AI requests are processed"
        control={
          <Select
            value={settings.aiProvider}
            options={[{ value: 'anthropic', label: 'Anthropic (Claude)' }, { value: 'local', label: 'Local (Ollama)' }]}
            onChange={v => update('aiProvider', v as any)}
          />
        }
      />
      <SettingRow
        label="Anthropic API Key"
        desc="Required for Claude-powered features. Never sent to third parties."
        control={
          <input
            type="password"
            className={styles.textInput}
            placeholder="sk-ant-…"
            defaultValue={settings.anthropicApiKey}
            onBlur={e => update('anthropicApiKey', e.target.value)}
          />
        }
      />
      <SettingRow
        label="Run AI Locally"
        desc="Process all AI features on-device — slower but fully private"
        control={<Toggle value={settings.aiRunLocal} onChange={v => update('aiRunLocal', v)} accent="ai" />}
      />
      <SettingRow
        label="AI Tab Grouping"
        desc="Automatically cluster open tabs by topic using AI"
        control={<Toggle value={settings.autoGroupTabs} onChange={v => update('autoGroupTabs', v)} />}
      />
      <SettingRow
        label="Pre-load Risk Scoring"
        desc="AI scores page safety before loading — protects against unknown threats"
        control={<Toggle value={settings.aiRiskScoringEnabled} onChange={v => update('aiRiskScoringEnabled', v)} accent="ai" />}
      />
    </div>
  )
}

function TabSettings({ settings, update }: { settings: KitsuneSettings; update: UpdateFn }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Tabs & Memory</h2>
      <p className={styles.sectionDesc}>Keep Kitsune fast and RAM-efficient.</p>

      <SettingRow
        label="Auto-Hibernate Tabs"
        desc="Automatically unload idle tabs to free memory"
        control={<Toggle value={settings.autoHibernateEnabled} onChange={v => update('autoHibernateEnabled', v)} />}
      />
      <SettingRow
        label="Hibernate After"
        desc="How long a tab must be idle before hibernation"
        control={
          <Select
            value={String(settings.hibernateAfterMs)}
            options={[
              { value: '300000',  label: '5 minutes' },
              { value: '600000',  label: '10 minutes' },
              { value: '1800000', label: '30 minutes' },
              { value: '3600000', label: '1 hour' },
            ]}
            onChange={v => update('hibernateAfterMs', parseInt(v))}
          />
        }
      />
      <SettingRow
        label="Memory Cap per Tab (MB)"
        desc="Trigger early hibernation when a tab exceeds this limit"
        control={
          <Select
            value={String(settings.maxActiveTabMemoryMB)}
            options={[
              { value: '150', label: '150 MB' },
              { value: '300', label: '300 MB (default)' },
              { value: '500', label: '500 MB' },
              { value: '1000', label: '1 GB' },
            ]}
            onChange={v => update('maxActiveTabMemoryMB', parseInt(v))}
          />
        }
      />
      <SettingRow
        label="Tab Layout"
        desc="Show tabs vertically in sidebar or horizontally at top"
        control={
          <Select
            value={settings.tabLayout}
            options={[{ value: 'vertical', label: 'Vertical (sidebar)' }, { value: 'horizontal', label: 'Horizontal (top)' }]}
            onChange={v => update('tabLayout', v as any)}
          />
        }
      />
    </div>
  )
}

function PrivacySettings({ settings, update }: { settings: KitsuneSettings; update: UpdateFn }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Privacy & Security</h2>
      <p className={styles.sectionDesc}>Kitsune is private-first. These features are all on by default.</p>

      <div className={styles.securityBadge}>
        <span>🛡</span>
        <span>Security level: <strong>LibreWolf-equivalent</strong></span>
      </div>

      <SettingRow
        label="Block Trackers"
        desc="Block known tracking scripts and ad networks"
        control={<Toggle value={settings.trackerBlockingEnabled} onChange={v => update('trackerBlockingEnabled', v)} />}
      />
      <SettingRow
        label="Block Ads"
        desc="Block ads using curated filter lists (EasyList + uBlock)"
        control={<Toggle value={settings.adBlockingEnabled} onChange={v => update('adBlockingEnabled', v)} />}
      />
      <SettingRow
        label="Fingerprint Protection"
        desc="Randomize canvas, WebGL, and device APIs to prevent fingerprinting"
        control={<Toggle value={settings.fingerprintProtection} onChange={v => update('fingerprintProtection', v)} />}
      />
      <SettingRow
        label="AI Tracker Detection"
        desc="Use AI heuristics to catch novel trackers not in block lists"
        control={<Toggle value={settings.trackerBlockingEnabled} onChange={v => update('trackerBlockingEnabled', v)} accent="ai" />}
      />
    </div>
  )
}

function AppearanceSettings({ settings, update }: { settings: KitsuneSettings; update: UpdateFn }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Appearance</h2>
      <SettingRow
        label="Theme"
        desc="Choose a color scheme for the browser chrome"
        control={
          <Select
            value={settings.theme}
            options={[
              { value: 'dark',   label: '🌙 Dark (default)' },
              { value: 'light',  label: '☀️ Light' },
              { value: 'system', label: '💻 Match System' },
            ]}
            onChange={v => update('theme', v as any)}
          />
        }
      />
      <SettingRow
        label="Sidebar Position"
        desc="Place the tab sidebar on the left or right"
        control={
          <Select
            value={settings.sidebarPosition}
            options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
            onChange={v => update('sidebarPosition', v as any)}
          />
        }
      />
    </div>
  )
}

function HotkeysSettings({ settings }: { settings: KitsuneSettings }) {
  const entries = Object.entries(settings.hotkeys)
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Hotkeys</h2>
      <p className={styles.sectionDesc}>All hotkeys that let you operate Kitsune without a mouse.</p>
      <div className={styles.hotkeyList}>
        {entries.map(([key, action]) => (
          <div key={key} className={styles.hotkeyRow}>
            <span className={styles.hotkeyAction}>{action.replace(/:/g, ' › ')}</span>
            <kbd className={styles.hotkeyKbd}>{key.replace(/cmd/g, '⌘').replace(/shift/g, '⇧').replace(/ctrl/g, '⌃')}</kbd>
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
        <div className={styles.aboutLogo}>🦊</div>
        <h2 className={styles.aboutTitle}>Kitsune</h2>
        <p className={styles.aboutVersion}>Version 0.9.4 (pre-release)</p>
      </div>
      <p className={styles.aboutDesc}>
        An AI-native browser built on Electron. Designed to be fast, private, and intelligent — helping you research, focus, and build without friction.
      </p>
      <div className={styles.aboutLinks}>
        <a href="https://github.com/kitsune-browser/kitsune" className={styles.aboutLink}>GitHub →</a>
        <a href="https://kitsune.dev/docs" className={styles.aboutLink}>Documentation →</a>
        <a href="https://kitsune.dev/changelog" className={styles.aboutLink}>Changelog →</a>
      </div>
    </div>
  )
}

// ── Reusable controls ─────────────────────────────────────────────

function SettingRow({ label, desc, control }: { label: string; desc: string; control: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowInfo}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <div className={styles.rowControl}>{control}</div>
    </div>
  )
}

function Toggle({ value, onChange, accent = 'fox' }: { value: boolean; onChange: (v: boolean) => void; accent?: 'fox' | 'ai' }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      className={`${styles.toggle} ${value ? (accent === 'ai' ? styles.toggleOnAI : styles.toggleOn) : styles.toggleOff}`}
      onClick={() => onChange(!value)}
    />
  )
}

function Select({ value, options, onChange }: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <select
      className={styles.select}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
