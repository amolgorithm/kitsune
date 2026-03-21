// src/shared/commandTypes.ts
// Shared types for the Kitsune command system

export type CommandCategory =
  | 'tab' | 'workspace' | 'ai' | 'privacy' | 'system'
  | 'navigation' | 'ui' | 'memory' | 'macro' | 'script' | 'alias' | 'meta'

export interface CommandCatalogEntry {
  command: string
  args: string
  desc: string
  category: CommandCategory
}
