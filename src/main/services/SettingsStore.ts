// src/main/services/SettingsStore.ts
// ─────────────────────────────────────────────────────────────────

import ElectronStore from 'electron-store'
import { DEFAULT_SETTINGS, type KitsuneSettings } from '../../shared/types'

type SettingsKey = keyof KitsuneSettings

export class SettingsStore {
  private store!: ElectronStore<KitsuneSettings>
  private listeners = new Map<string, Array<() => void>>()

  async init(): Promise<void> {
    this.store = new ElectronStore<KitsuneSettings>({
      name: 'kitsune-settings',
      defaults: DEFAULT_SETTINGS,
      schema: {
        aiProvider:               { type: 'string', enum: ['anthropic', 'local'] },
        anthropicApiKey:          { type: 'string' },
        aiEnabled:                { type: 'boolean' },
        aiRunLocal:               { type: 'boolean' },
        autoHibernateEnabled:     { type: 'boolean' },
        hibernateAfterMs:         { type: 'number' },
        autoGroupTabs:            { type: 'boolean' },
        maxActiveTabMemoryMB:     { type: 'number' },
        trackerBlockingEnabled:   { type: 'boolean' },
        adBlockingEnabled:        { type: 'boolean' },
        fingerprintProtection:    { type: 'boolean' },
        aiRiskScoringEnabled:     { type: 'boolean' },
        sidebarPosition:          { type: 'string', enum: ['left', 'right'] },
        tabLayout:                { type: 'string', enum: ['vertical', 'horizontal'] },
        theme:                    { type: 'string', enum: ['dark', 'light', 'system'] },
        activeLensId:             { type: 'string' },
        hotkeys:                  { type: 'object' },
      } as any,
    })
  }

  get<K extends SettingsKey>(key: K): KitsuneSettings[K] {
    return this.store.get(key) as KitsuneSettings[K]
  }

  set<K extends SettingsKey>(key: K, value: KitsuneSettings[K]): void {
    this.store.set(key, value)
    this.listeners.get(key)?.forEach(fn => fn())
  }

  getAll(): KitsuneSettings {
    return this.store.store as KitsuneSettings
  }

  setMany(patch: Partial<KitsuneSettings>): void {
    for (const [k, v] of Object.entries(patch)) {
      this.store.set(k as SettingsKey, v as any)
    }
  }

  onChange(key: SettingsKey, fn: () => void): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, [])
    this.listeners.get(key)!.push(fn)
    return () => {
      const arr = this.listeners.get(key)!
      const i = arr.indexOf(fn)
      if (i >= 0) arr.splice(i, 1)
    }
  }
}
