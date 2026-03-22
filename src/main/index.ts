// src/main/index.ts
import {
  app, BrowserWindow, ipcMain, session, shell, nativeTheme,
} from 'electron'
import { join } from 'path'
import { TabManager } from './services/TabManager'
import { HibernationScheduler } from './services/HibernationScheduler'
import { PrivacyEngine } from './services/PrivacyEngine'
import { AIService } from './services/AIService'
import { WorkspaceManager } from './services/WorkspaceManager'
import { CleaveManager } from './services/CleaveManager'
import { SettingsStore } from './services/SettingsStore'
import { CommandEngine } from './services/CommandEngine'
import { CommandExecutorImpl } from './services/CommandExecutorImpl'
import { NineTailsEngine } from './services/NineTailsEngine'
import { registerTabIPC } from './ipc/tabIPC'
import { registerAIIPC } from './ipc/aiIPC'
import { registerPrivacyIPC } from './ipc/privacyIPC'
import { registerWorkspaceIPC } from './ipc/workspaceIPC'
import { registerCleaveIPC } from './ipc/cleaveIPC'
import { registerSettingsIPC } from './ipc/settingsIPC'
import { registerCommandIPC } from './ipc/commandIPC'
import { registerNineTailsIPC } from './ipc/nineTailsIPC'


const DEV        = !app.isPackaged
const IS_MAC     = process.platform === 'darwin'
const DEV_URL    = process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173'
const PRELOAD    = join(__dirname, '../preload/preload.js')
const INDEX_HTML = join(__dirname, '../../dist/index.html')

console.log('[main] DEV:', DEV, '| URL:', DEV_URL)

let mainWindow: BrowserWindow | null = null
let settings: SettingsStore
let tabManager: TabManager
let hibernationScheduler: HibernationScheduler
let privacyEngine: PrivacyEngine
let aiService: AIService
let workspaceManager: WorkspaceManager
let cleaveManager: CleaveManager
let commandEngine: CommandEngine
let nineTailsEngine: NineTailsEngine

app.whenReady().then(async () => {
  settings = new SettingsStore()
  await settings.init()
  nativeTheme.themeSource = (settings.get('theme') as 'dark' | 'light' | 'system') ?? 'dark'

  workspaceManager = new WorkspaceManager(settings)
  await workspaceManager.init()

  privacyEngine = new PrivacyEngine(session.defaultSession, settings)
  await privacyEngine.init()

  aiService     = new AIService(settings)
  cleaveManager = new CleaveManager()

  mainWindow = createMainWindow()

  tabManager = new TabManager(workspaceManager, settings, mainWindow)

  nineTailsEngine = new NineTailsEngine(settings, tabManager, workspaceManager)
  await nineTailsEngine.init(mainWindow)

  // Wire Nine Tails into the other services that need it
  tabManager.setNineTailsEngine(nineTailsEngine)
  privacyEngine.setNineTailsEngine(nineTailsEngine)

  commandEngine = new CommandEngine(settings)
  const cmdExecutor = new CommandExecutorImpl(
    tabManager, workspaceManager, aiService,
    privacyEngine, settings, hibernationScheduler, mainWindow
  )

  commandEngine.setExecutor(cmdExecutor)
  commandEngine.startScheduler()

  hibernationScheduler = new HibernationScheduler(tabManager, settings)
  hibernationScheduler.start()

  registerTabIPC(ipcMain, tabManager, mainWindow)
  registerAIIPC(ipcMain, aiService, tabManager)
  registerPrivacyIPC(ipcMain, privacyEngine)
  registerWorkspaceIPC(ipcMain, workspaceManager, tabManager, aiService, mainWindow)
  registerCleaveIPC(ipcMain, cleaveManager, tabManager, mainWindow)
  registerSettingsIPC(ipcMain, settings, mainWindow)
  registerCommandIPC(ipcMain, commandEngine, tabManager, workspaceManager, aiService, mainWindow)
  registerNineTailsIPC(ipcMain, nineTailsEngine, mainWindow)

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())

  mainWindow.webContents.once('did-finish-load', async () => {
    console.log('[main] renderer ready — creating first tab')
    await tabManager.createTab({ url: 'kitsune://newtab' })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })
})

app.on('window-all-closed', () => {
  hibernationScheduler?.stop()
  commandEngine?.stopScheduler()
  nineTailsEngine?.destroy()
  if (!IS_MAC) app.quit()
})

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#0d0f12', show: false,
    icon: join(app.getAppPath(), 'assets/logo.png'),
    ...(IS_MAC
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 9 } }
      : { frame: false }
    ),
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  })

  win.webContents.on('console-message', (_e, level, msg, line, src) => {
    if (level >= 2) console.log(`[renderer][${level === 3 ? 'ERR' : 'WARN'}] ${msg} (${src}:${line})`)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (!url.includes('devtools://')) console.error('[renderer] LOAD FAILED:', code, desc, url)
  })

  if (DEV) win.loadURL(DEV_URL)
  else win.loadFile(INDEX_HTML)

  win.once('ready-to-show', () => win.show())
  win.on('resize',     () => tabManager?.repositionActiveView())
  win.on('maximize',   () => tabManager?.repositionActiveView())
  win.on('unmaximize', () => tabManager?.repositionActiveView())

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => { mainWindow = null })
  return win
}