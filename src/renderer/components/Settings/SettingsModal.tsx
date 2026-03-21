// src/renderer/components/Settings/SettingsModal.tsx
import { useState, useEffect } from 'react'
import { useBrowserStore } from '../../stores/browserStore'
import { SettingsIPC } from '../../lib/ipc'
import type { KitsuneSettings, AppearanceSettings, AccentPreset, BackgroundStyle, TextureStyle, AnimationStyle, ThemeBase } from '../../../shared/types'
import { DEFAULT_APPEARANCE } from '../../../shared/types'
import { MacroEditor } from '../MacroEditor/MacroEditor'
import { IconMoon, IconSun, IconMonitor, IconSidebarLeft, IconSidebarRight, IconAnimNone, IconBubble, IconAurora, IconParticle, IconRipple, IconGrain, IconMesh, IconGradientLinear, IconDotGrid, IconLineGrid, IconNoise } from '../Icons'
import {
  IconSparkle, IconTab, IconShield, IconPalette,
  IconHotkey, IconInfo, IconClose, IconCheck,
} from '../Icons'
import styles from './SettingsModal.module.css'

const AI_MODELS = [
  { value: 'google/gemini-2.5-flash',        label: 'Gemini 2.5 Flash (recommended)' },
  { value: 'google/gemini-3-flash-preview',  label: 'Gemini 3 Flash Preview' },
  { value: 'deepseek/deepseek-r1-0528',      label: 'DeepSeek R1 (reasoning)' },
  { value: 'qwen/qwen3-235b-a22b',           label: 'Qwen3 235B (powerful)' },
  { value: 'deepseek/deepseek-v3.2',         label: 'DeepSeek V3.2' },
  { value: 'moonshotai/kimi-k2-thinking',    label: 'Kimi K2 Thinking' },
]

type Section = 'ai' | 'tabs' | 'privacy' | 'appearance' | 'macros' | 'hotkeys' | 'about'

const NAV: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: 'ai',         label: 'AI & Intelligence',    icon: <IconSparkle size={14} /> },
  { id: 'tabs',       label: 'Tabs & Memory',        icon: <IconTab size={14} /> },
  { id: 'privacy',    label: 'Privacy & Security',   icon: <IconShield size={14} /> },
  { id: 'appearance', label: 'Appearance',            icon: <IconPalette size={14} /> },
  { id: 'macros',     label: 'Macros & Automation',  icon: <IconHotkey size={14} /> },
  { id: 'hotkeys',    label: 'Hotkeys',               icon: <IconHotkey size={14} /> },
  { id: 'about',      label: 'About',                 icon: <IconInfo size={14} /> },
]

export function SettingsModal() {
  const closeSettings = useBrowserStore(s => s.closeSettings)
  const toggleREPL    = useBrowserStore(s => s.toggleREPL)
  const [section, setSection]   = useState<Section>('ai')
  const [settings, setSettings] = useState<KitsuneSettings | null>(null)
  const [saved, setSaved]       = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    SettingsIPC.get().then(setSettings)
  }, [])

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

  const testAI = async () => {
    if (!settings) return
    setTestStatus('testing')
    try {
      const res = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.hackclubApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.aiModel,
          messages: [{ role: 'user', content: 'Reply with just: OK' }],
          max_tokens: 5,
        }),
      })
      if (res.ok) setTestStatus('ok')
      else setTestStatus('fail')
    } catch { setTestStatus('fail') }
    setTimeout(() => setTestStatus('idle'), 3000)
  }

  if (!settings) return null

  return (
    <div className={styles.overlay} onClick={closeSettings}>
      <div className={`${styles.modal} k-scale-in`} onClick={e => e.stopPropagation()}>
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
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
          {saved && (
            <div className={styles.savedBadge}>
              <IconCheck size={11} /> Saved
            </div>
          )}
        </nav>

        <div className={styles.content}>
          {section === 'ai'         && <AISection         s={settings} update={update} testAI={testAI} testStatus={testStatus} />}
          {section === 'tabs'       && <TabsSection       s={settings} update={update} />}
          {section === 'privacy'    && <PrivacySection    s={settings} update={update} />}
          {section === 'appearance' && <AppearanceSection s={settings} update={update} />}
          {section === 'macros'     && <MacrosSection onOpenREPL={() => { closeSettings(); toggleREPL() }} />}
          {section === 'hotkeys'    && <HotkeysSection    s={settings} />}
          {section === 'about'      && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

type U = <K extends keyof KitsuneSettings>(key: K, value: KitsuneSettings[K]) => void

function AISection({ s, update, testAI, testStatus }: {
  s: KitsuneSettings; update: U;
  testAI: () => void; testStatus: string
}) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>AI & Intelligence</h2>
      <p className={styles.sectionDesc}>Powered by HackClub AI — free, no account required.</p>

      <Row label="Enable AI" desc="Master switch for all AI-powered features">
        <Toggle on={s.aiEnabled} onChange={v => update('aiEnabled', v)} />
      </Row>
      <Row label="HackClub API Key" desc="Pre-filled with shared key. You can use your own from ai.hackclub.com">
        <div className={styles.keyRow}>
          <input
            type="password"
            className={styles.textInput}
            defaultValue={s.hackclubApiKey}
            onBlur={e => update('hackclubApiKey', e.target.value)}
            placeholder="sk-hc-v1-…"
          />
          <button
            className={`${styles.testBtn} ${styles[`testBtn_${testStatus}`]}`}
            onClick={testAI}
            disabled={testStatus === 'testing'}
          >
            {testStatus === 'testing' ? '…' : testStatus === 'ok' ? '✓ OK' : testStatus === 'fail' ? '✗ Fail' : 'Test'}
          </button>
        </div>
      </Row>
      <Row label="AI Model" desc="Model to use for summaries, chat, and research">
        <Select
          value={s.aiModel}
          options={AI_MODELS}
          onChange={v => update('aiModel', v)}
        />
      </Row>
      <Row label="AI Tab Grouping" desc="Automatically cluster open tabs by topic">
        <Toggle on={s.autoGroupTabs} onChange={v => update('autoGroupTabs', v)} accent="ai" />
      </Row>
      <Row label="Pre-load Risk Scoring" desc="Score page safety before loading based on URL">
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
            { value: '300',  label: '300 MB (default)' },
            { value: '500',  label: '500 MB' },
            { value: '1000', label: '1 GB' },
          ]}
          onChange={v => update('maxActiveTabMemoryMB', parseInt(v))}
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
        LibreWolf-equivalent protection active
      </div>
      <Row label="Block Trackers" desc="Block known tracking scripts and ad networks">
        <Toggle on={s.trackerBlockingEnabled} onChange={v => update('trackerBlockingEnabled', v)} />
      </Row>
      <Row label="Block Ads" desc="Block advertisements using EasyList + uBlock filters">
        <Toggle on={s.adBlockingEnabled} onChange={v => update('adBlockingEnabled', v)} />
      </Row>
      <Row label="Fingerprint Protection" desc="Randomize canvas, WebGL, and device APIs">
        <Toggle on={s.fingerprintProtection} onChange={v => update('fingerprintProtection', v)} />
      </Row>
      <Row label="AI Threat Detection" desc="Use AI heuristics to catch novel trackers">
        <Toggle on={s.aiRiskScoringEnabled} onChange={v => update('aiRiskScoringEnabled', v)} accent="ai" />
      </Row>
    </div>
  )
}

function AppearanceSection({ s, update }: { s: KitsuneSettings; update: U }) {
  const a = s.appearance ?? DEFAULT_APPEARANCE
  const updateA = (patch: Partial<AppearanceSettings>) => {
    update('appearance', { ...a, ...patch })
  }

  const THEMES: Array<{ id: ThemeBase; label: string; icon: React.ReactNode; dark: boolean }> = [
    { id: 'dark',     label: 'Dark',     icon: <IconMoon size={14} />,    dark: true  },
    { id: 'light',    label: 'Light',    icon: <IconSun size={14} />,     dark: false },
    { id: 'system',   label: 'System',   icon: <IconMonitor size={14} />, dark: true  },
    { id: 'midnight', label: 'Midnight', icon: <IconMoon size={14} />,    dark: true  },
    { id: 'forest',   label: 'Forest',   icon: <IconMoon size={14} />,    dark: true  },
    { id: 'volcano',  label: 'Volcano',  icon: <IconMoon size={14} />,    dark: true  },
    { id: 'ocean',    label: 'Ocean',    icon: <IconMoon size={14} />,    dark: true  },
    { id: 'dusk',     label: 'Dusk',     icon: <IconMoon size={14} />,    dark: true  },
  ]

  const ACCENTS: Array<{ id: AccentPreset; color: string; label: string }> = [
    { id: 'fox',     color: '#ff6b35', label: 'Fox'     },
    { id: 'violet',  color: '#8b5cf6', label: 'Violet'  },
    { id: 'cyan',    color: '#06b6d4', label: 'Cyan'    },
    { id: 'rose',    color: '#f43f5e', label: 'Rose'    },
    { id: 'emerald', color: '#10b981', label: 'Emerald' },
    { id: 'amber',   color: '#f59e0b', label: 'Amber'   },
    { id: 'indigo',  color: '#6366f1', label: 'Indigo'  },
    { id: 'pink',    color: '#ec4899', label: 'Pink'    },
    { id: 'custom',  color: a.accentCustom, label: 'Custom' },
  ]

  const BG_OPTIONS: Array<{ id: BackgroundStyle; label: string; icon: React.ReactNode }> = [
    { id: 'plain',            label: 'Plain',       icon: <div style={{width:20,height:14,background:'var(--k-bg)',borderRadius:3,border:'1px solid var(--k-border)'}} /> },
    { id: 'gradient-linear',  label: 'Linear',      icon: <IconGradientLinear size={16} /> },
    { id: 'gradient-mesh',    label: 'Mesh',        icon: <IconMesh size={16} /> },
    { id: 'gradient-accent',  label: 'Accent Glow', icon: <IconMesh size={16} /> },
    { id: 'dots',             label: 'Dots',        icon: <IconDotGrid size={16} /> },
    { id: 'grid',             label: 'Grid',        icon: <IconLineGrid size={16} /> },
    { id: 'noise',            label: 'Noise',       icon: <IconNoise size={16} /> },
  ]

  const TEXTURES: Array<{ id: TextureStyle; label: string; icon: React.ReactNode }> = [
    { id: 'smooth',       label: 'Smooth',       icon: <div style={{width:28,height:18,background:'var(--k-surface-2)',borderRadius:3}} /> },
    { id: 'grain-light',  label: 'Light Grain',  icon: <IconGrain size={14} /> },
    { id: 'grain-medium', label: 'Medium Grain', icon: <IconGrain size={14} /> },
    { id: 'grain-heavy',  label: 'Heavy Grain',  icon: <IconGrain size={14} /> },
  ]

  const ANIMS: Array<{ id: AnimationStyle; label: string; desc: string; icon: React.ReactNode }> = [
    { id: 'none',      label: 'None',      desc: 'Static',            icon: <IconAnimNone size={16} /> },
    { id: 'bubbles',   label: 'Bubbles',   desc: 'Rising glass orbs', icon: <IconBubble   size={16} /> },
    { id: 'aurora',    label: 'Aurora',    desc: 'Northern lights',   icon: <IconAurora   size={16} /> },
    { id: 'particles', label: 'Particles', desc: 'Connected network', icon: <IconParticle size={16} /> },
    { id: 'ripple',    label: 'Ripple',    desc: 'Expanding rings',   icon: <IconRipple   size={16} /> },
    { id: 'starfield', label: 'Warp',      desc: 'Hyperspace effect', icon: <IconAurora   size={16} /> },
    { id: 'lava',      label: 'Lava Lamp', desc: 'Morphing blobs',    icon: <IconBubble   size={16} /> },
  ]

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Appearance</h2>
      <p className={styles.sectionDesc}>Live preview — changes apply instantly.</p>

      <div className={styles.appearGroup}>
        <div className={styles.appearGroupLabel}>Theme</div>
        <div className={styles.themeGrid}>
          {THEMES.map(t => (
            <button key={t.id}
              className={`${styles.themeChip} ${a.themeBase === t.id ? styles.themeChipActive : ''}`}
              onClick={() => updateA({ themeBase: t.id })}>
              <span className={styles.themeChipIcon}>{t.icon}</span>
              <span>{t.label}</span>
              {t.id !== 'dark' && t.id !== 'light' && t.id !== 'system' && (
                <span className={styles.themeChipDot} style={{ background: {
                  midnight:'#1a1e30', forest:'#162419', volcano:'#241815',
                  ocean:'#0c1422', dusk:'#17151e',
                }[t.id] }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.appearGroup}>
        <div className={styles.appearGroupLabel}>Accent Color</div>
        <div className={styles.accentGrid}>
          {ACCENTS.map(ac => (
            <button key={ac.id}
              className={`${styles.accentSwatch} ${a.accentPreset === ac.id ? styles.accentSwatchActive : ''}`}
              onClick={() => updateA({ accentPreset: ac.id })} title={ac.label}>
              <div className={styles.accentSwatchColor} style={{
                background: ac.id === 'custom' ? a.accentCustom : ac.color,
                boxShadow: a.accentPreset === ac.id ? `0 0 8px ${ac.color}88` : 'none',
              }} />
              <span className={styles.accentSwatchLabel}>{ac.label}</span>
            </button>
          ))}
        </div>
        {a.accentPreset === 'custom' && (
          <div className={styles.customColorRow}>
            <input type="color" className={styles.colorPicker} value={a.accentCustom}
              onChange={e => updateA({ accentCustom: e.target.value })} />
            <input type="text" className={styles.colorHex} value={a.accentCustom}
              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) updateA({ accentCustom: e.target.value }) }} />
          </div>
        )}
      </div>

      <div className={styles.appearGroup}>
        <div className={styles.appearGroupLabel}>Background</div>
        <div className={styles.optionRow}>
          {BG_OPTIONS.map(bg => (
            <button key={bg.id}
              className={`${styles.optionChip} ${a.backgroundStyle === bg.id ? styles.optionChipActive : ''}`}
              onClick={() => updateA({ backgroundStyle: bg.id })}>
              <span className={styles.optionChipIcon}>{bg.icon}</span>
              <span>{bg.label}</span>
            </button>
          ))}
        </div>
        {(a.backgroundStyle === 'gradient-linear' || a.backgroundStyle === 'gradient-mesh') && (
          <div className={styles.gradientRow}>
            <label className={styles.gradientLabel}>From</label>
            <input type="color" className={styles.colorPickerSm} value={a.backgroundGradientFrom}
              onChange={e => updateA({ backgroundGradientFrom: e.target.value })} />
            <input type="text" className={styles.colorHexSm} value={a.backgroundGradientFrom}
              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) updateA({ backgroundGradientFrom: e.target.value }) }} />
            <div className={styles.gradientArrow}>→</div>
            <label className={styles.gradientLabel}>To</label>
            <input type="color" className={styles.colorPickerSm} value={a.backgroundGradientTo}
              onChange={e => updateA({ backgroundGradientTo: e.target.value })} />
            <input type="text" className={styles.colorHexSm} value={a.backgroundGradientTo}
              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) updateA({ backgroundGradientTo: e.target.value }) }} />
          </div>
        )}
      </div>

      <div className={styles.appearGroup}>
        <div className={styles.appearGroupLabel}>Surface Texture</div>
        <div className={styles.optionRow}>
          {TEXTURES.map(t => (
            <button key={t.id}
              className={`${styles.optionChip} ${a.textureStyle === t.id ? styles.optionChipActive : ''}`}
              onClick={() => updateA({ textureStyle: t.id })}>
              <span className={styles.optionChipIcon}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.appearGroup}>
        <div className={styles.appearGroupLabel}>Background Animation</div>
        <div className={styles.animGrid}>
          {ANIMS.map(an => (
            <button key={an.id}
              className={`${styles.animCard} ${a.animationStyle === an.id ? styles.animCardActive : ''}`}
              onClick={() => updateA({ animationStyle: an.id })}>
              <span className={styles.animCardIcon}>{an.icon}</span>
              <span className={styles.animCardLabel}>{an.label}</span>
              <span className={styles.animCardDesc}>{an.desc}</span>
            </button>
          ))}
        </div>
        {a.animationStyle !== 'none' && (
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Intensity</span>
            <input type="range" min={10} max={100} value={a.animationIntensity}
              className={styles.slider}
              onChange={e => updateA({ animationIntensity: parseInt(e.target.value) })} />
            <span className={styles.sliderValue}>{a.animationIntensity}%</span>
          </div>
        )}
      </div>

      <div className={styles.appearGroup}>
        <div className={styles.appearGroupLabel}>Shape & Layout</div>
        <div className={styles.shapeRow}>
          <span className={styles.shapeLabel}>Corners</span>
          {(['sharp','rounded','pill'] as const).map(r => (
            <button key={r}
              className={`${styles.shapeBtn} ${a.borderRadius === r ? styles.shapeBtnActive : ''}`}
              onClick={() => updateA({ borderRadius: r })}>
              <CornerIcon type={r} />
              <span>{r.charAt(0).toUpperCase() + r.slice(1)}</span>
            </button>
          ))}
        </div>
        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>Sidebar width</span>
          <input type="range" min={180} max={320} value={a.sidebarWidth} className={styles.slider}
            onChange={e => updateA({ sidebarWidth: parseInt(e.target.value) })} />
          <span className={styles.sliderValue}>{a.sidebarWidth}px</span>
        </div>
        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>Tab height</span>
          <input type="range" min={28} max={48} value={a.tabHeight} className={styles.slider}
            onChange={e => updateA({ tabHeight: parseInt(e.target.value) })} />
          <span className={styles.sliderValue}>{a.tabHeight}px</span>
        </div>
        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>Font scale</span>
          <input type="range" min={85} max={120} value={Math.round(a.fontScale * 100)} className={styles.slider}
            onChange={e => updateA({ fontScale: parseInt(e.target.value) / 100 })} />
          <span className={styles.sliderValue}>{Math.round(a.fontScale * 100)}%</span>
        </div>
        <div className={styles.toggleRow}>
          <span className={styles.sliderLabel}>Sidebar glass blur</span>
          <button className={`${styles.toggle} ${a.sidebarBlur ? styles.toggleOn : styles.toggleOff}`}
            onClick={() => updateA({ sidebarBlur: !a.sidebarBlur })} />
        </div>
      </div>

      <div className={styles.appearGroup}>
        <div className={styles.appearGroupLabel}>Sidebar Position</div>
        <div className={styles.themeGrid}>
          <button className={`${styles.themeChip} ${s.sidebarPosition === 'left' ? styles.themeChipActive : ''}`}
            onClick={() => update('sidebarPosition', 'left')}>
            <span className={styles.themeChipIcon}><IconSidebarLeft size={14} /></span>
            <span>Left</span>
          </button>
          <button className={`${styles.themeChip} ${s.sidebarPosition === 'right' ? styles.themeChipActive : ''}`}
            onClick={() => update('sidebarPosition', 'right')}>
            <span className={styles.themeChipIcon}><IconSidebarRight size={14} /></span>
            <span>Right</span>
          </button>
        </div>
      </div>

      <button className={styles.resetAppearance} onClick={() => update('appearance', DEFAULT_APPEARANCE)}>
        Reset to defaults
      </button>
    </div>
  )
}

function CornerIcon({ type }: { type: 'sharp'|'rounded'|'pill' }) {
  const r = type === 'sharp' ? 1 : type === 'rounded' ? 5 : 12
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" style={{ marginBottom: 2 }}>
      <rect x="2" y="1" width="16" height="14" rx={r} stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function MacrosSection({ onOpenREPL }: { onOpenREPL: () => void }) {
  return (
    <div className={styles.section} style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px 24px 12px', flexShrink: 0 }}>
        <h2 className={styles.sectionTitle}>Macros & Automation</h2>
        <p className={styles.sectionDesc}>
          Create macros, aliases, workspace programs, and scheduled commands.
          For interactive control, open the REPL with{' '}
          <kbd style={{ fontFamily: 'var(--k-font-mono)', fontSize: 11, background: 'var(--k-surface-3)', border: '1px solid var(--k-border-2)', borderRadius: 4, padding: '1px 5px' }}>⌘`</kbd>
          {' '}or{' '}
          <button
            onClick={onOpenREPL}
            style={{ fontSize: 11, color: 'var(--k-fox)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            click here to open REPL
          </button>
        </p>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <MacroEditor />
      </div>
    </div>
  )
}

function HotkeysSection({ s }: { s: KitsuneSettings }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Hotkeys</h2>
      <p className={styles.sectionDesc}>Full keyboard operation — no mouse needed.</p>
      <div className={styles.hotkeyList}>
        {Object.entries(s.hotkeys).map(([key, action]) => (
          <div key={key} className={styles.hotkeyRow}>
            <span className={styles.hotkeyAction}>{String(action).replace(/:/g, ' › ')}</span>
            <kbd className={styles.hotkeyKbd}>{key.replace('ctrl', '⌃').replace('shift', '⇧')}</kbd>
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
          <img
            src={new URL('../../../assets/logo.png', import.meta.url).href}
            width={40}
            height={40}
            alt="Kitsune"
            draggable={false}
            style={{ objectFit: 'contain', borderRadius: 10 }}
          />
        </div>
        <div>
          <h2 className={styles.aboutTitle}>Kitsune</h2>
          <p className={styles.aboutVersion}>Version 0.10.0-beta</p>
        </div>
      </div>
      <p className={styles.aboutDesc}>
        An AI-native, fully programmable browser built on Electron. Fast, private, and intelligent.
        AI powered by HackClub (free). Privacy by default. Programmable control via the Command Engine.
      </p>
    </div>
  )
}

// ── Shared controls ────────────────────────────────────────────────

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

function Toggle({ on, onChange, accent = 'fox' }: {
  on: boolean; onChange: (v: boolean) => void; accent?: string
}) {
  return (
    <button
      role="switch" aria-checked={on}
      className={`${styles.toggle} ${on ? (accent === 'ai' ? styles.toggleAI : styles.toggleOn) : styles.toggleOff}`}
      onClick={() => onChange(!on)}
    />
  )
}

function Select({ value, options, onChange }: {
  value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void
}) {
  return (
    <select className={styles.select} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}