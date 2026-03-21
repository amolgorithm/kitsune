// src/main/services/SettingsStore.ts
import ElectronStore from 'electron-store'
import { DEFAULT_SETTINGS, type KitsuneSettings } from '../../shared/types'

type SettingsKey = keyof KitsuneSettings

export class SettingsStore {
  private store!: InstanceType<typeof ElectronStore>
  private listeners = new Map<string, Array<() => void>>()

  async init(): Promise<void> {
    this.store = new ElectronStore({
      name: 'kitsune-settings',
      defaults: {
        ...DEFAULT_SETTINGS,
        workspaceData: null,
      },
    })
    console.log('[SettingsStore] path:', (this.store as any).path)
  }

  get<K extends SettingsKey>(key: K): KitsuneSettings[K] {
    return this.store.get(key as string) as KitsuneSettings[K]
  }

  set<K extends SettingsKey>(key: K, value: KitsuneSettings[K]): void {
    this.store.set(key as string, value)
    this.listeners.get(key)?.forEach(fn => fn())
  }

  getRaw(key: string): unknown {
    return this.store.get(key)
  }

  setRaw(key: string, value: unknown): void {
    this.store.set(key, value)
  }

  getAll(): KitsuneSettings {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(DEFAULT_SETTINGS) as SettingsKey[]) {
      result[key] = this.store.get(key as string) ?? DEFAULT_SETTINGS[key]
    }
    return result as KitsuneSettings
  }

  setMany(patch: Partial<KitsuneSettings>): void {
    for (const [k, v] of Object.entries(patch)) {
      this.store.set(k, v)
      this.listeners.get(k)?.forEach(fn => fn())
    }
    console.log('[SettingsStore] saved:', Object.keys(patch).join(', '))
  }

  onChange(key: SettingsKey | string, fn: () => void): () => void {
    if (!this.listeners.has(key)) this.listeners.set(key, [])
    this.listeners.get(key)!.push(fn)
    return () => {
      const arr = this.listeners.get(key)
      if (!arr) return
      const i = arr.indexOf(fn)
      if (i >= 0) arr.splice(i, 1)
    }
  }
}
