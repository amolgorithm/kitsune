// src/renderer/lib/commandIpc.ts
// IPC wrappers for the Kitsune Command Engine

const ipc = window.kitsune

export const CommandIPC = {
  // Execute a raw command string
  execute: (input: string, extraArgs?: Record<string, unknown>) =>
    ipc.invoke<unknown>('cmd:execute' as any, input, extraArgs),

  // Chain
  runChain: (commands: string[], globalArgs?: Record<string, unknown>) =>
    ipc.invoke<unknown>('cmd:chain.run' as any, commands, globalArgs),

  // Macros
  listMacros:   ()                => ipc.invoke<any[]>('cmd:macro.list' as any),
  getMacro:     (id: string)      => ipc.invoke<any>('cmd:macro.get' as any, id),
  createMacro:  (params: any)     => ipc.invoke<any>('cmd:macro.create' as any, params),
  updateMacro:  (id: string, p: any) => ipc.invoke<any>('cmd:macro.update' as any, id, p),
  deleteMacro:  (id: string)      => ipc.invoke<void>('cmd:macro.delete' as any, id),
  runMacro:     (name: string, args?: any) => ipc.invoke<any>('cmd:macro.run' as any, name, args),

  // Aliases
  listAliases:  ()               => ipc.invoke<any[]>('cmd:alias.list' as any),
  createAlias:  (s: string, e: string, d?: string) => ipc.invoke<any>('cmd:alias.create' as any, s, e, d),
  deleteAlias:  (s: string)      => ipc.invoke<void>('cmd:alias.delete' as any, s),
  expandAlias:  (i: string)      => ipc.invoke<string>('cmd:alias.expand' as any, i),

  // Programs
  listPrograms:   ()             => ipc.invoke<any[]>('cmd:program.list' as any),
  createProgram:  (p: any)       => ipc.invoke<any>('cmd:program.create' as any, p),
  deleteProgram:  (id: string)   => ipc.invoke<void>('cmd:program.delete' as any, id),
  runProgram:     (name: string) => ipc.invoke<any>('cmd:program.run' as any, name),

  // Scheduled
  listScheduled:    ()          => ipc.invoke<any[]>('cmd:scheduled.list' as any),
  createScheduled:  (p: any)    => ipc.invoke<any>('cmd:scheduled.create' as any, p),
  toggleScheduled:  (id: string, enabled: boolean) => ipc.invoke<void>('cmd:scheduled.toggle' as any, id, enabled),
  deleteScheduled:  (id: string) => ipc.invoke<void>('cmd:scheduled.delete' as any, id),

  // History
  listHistory:  (limit?: number) => ipc.invoke<any[]>('cmd:history.list' as any, limit),
  clearHistory: ()               => ipc.invoke<void>('cmd:history.clear' as any),
  undo:         ()               => ipc.invoke<any>('cmd:undo' as any),

  // Catalog
  listCommands: ()               => ipc.invoke<any[]>('cmd:commands.list' as any),
}
