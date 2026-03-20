// src/main/index.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — Electron Main Process Entry
// Responsibilities:
//   • Create & manage BrowserWindow (chrome window)
//   • Create & manage BrowserView pool (tab webContents)
//   • Wire IPC between renderer <-> main services
//   • Bootstrap all services on startup
// ─────────────────────────────────────────────────────────────────

import {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  session,
  shell,
  nativeTheme,
} from 'electron'
import { join } from 'path'
import { TabManager } from './services/TabManager'
import { HibernationScheduler } from './services/HibernationScheduler'
import { PrivacyEngine } from './services/PrivacyEngine'
import { AIService } from './services/AIService'
import { WorkspaceManager } from './services/WorkspaceManager'
import { CleaveManager } from './services/CleaveManager'
import { SettingsStore } from './services/SettingsStore'
import { registerTabIPC } from './ipc/tabIPC'
import { registerAIIPC } from './ipc/aiIPC'
import { registerPrivacyIPC } from './ipc/privacyIPC'
import { registerWorkspaceIPC } from './ipc/workspaceIPC'
import { registerCleaveIPC } from './ipc/cleaveIPC'
import { registerSettingsIPC } from './ipc/settingsIPC'

// ─── Constants ───────────────────────────────────────────────────

const DEV  = !app.isPackaged
const PRELOAD = join(__dirname, '../preload/index.js')
const INDEX_HTML = join(__dirname, '../../dist/index.html')
const DEV_URL   = 'http://localhost:5173'

// ─── State ───────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

// Service singletons — initialized after app ready
let settings: SettingsStore
let tabManager: TabManager
let hibernationScheduler: HibernationScheduler
let privacyEngine: PrivacyEngine
let aiService: AIService
let workspaceManager: WorkspaceManager
let cleaveManager: CleaveManager

// ─── App Bootstrap ───────────────────────────────────────────────

app.whenReady().then(async () => {
  // 1. Settings first (everything else reads from it)
  settings = new SettingsStore()
  await settings.init()

  // 2. Apply theme
  nativeTheme.themeSource = settings.get('theme')

  // 3. Workspace & tab state
  workspaceManager = new WorkspaceManager(settings)
  await workspaceManager.init()

  tabManager = new TabManager(workspaceManager, settings)

  // 4. Privacy engine — patches session request filter BEFORE any tabs open
  privacyEngine = new PrivacyEngine(session.defaultSession, settings)
  await privacyEngine.init()

  // 5. AI service
  aiService = new AIService(settings)

  // 6. Cleave layout manager
  cleaveManager = new CleaveManager()

  // 7. Hibernation scheduler — runs in background
  hibernationScheduler = new HibernationScheduler(tabManager, settings)
  hibernationScheduler.start()

  // 8. Create main window
  mainWindow = createMainWindow()

  // 9. Register all IPC handlers
  registerTabIPC(ipcMain, tabManager, mainWindow)
  registerAIIPC(ipcMain, aiService, tabManager)
  registerPrivacyIPC(ipcMain, privacyEngine)
  registerWorkspaceIPC(ipcMain, workspaceManager)
  registerCleaveIPC(ipcMain, cleaveManager, mainWindow)
  registerSettingsIPC(ipcMain, settings)

  // 10. Tab manager needs a reference to window for BrowserView placement
  tabManager.setWindow(mainWindow)

  // 11. Open with a blank new tab
  await tabManager.createTab({ url: 'kitsune://newtab' })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    hibernationScheduler?.stop()
    app.quit()
  }
})

// ─── Window Factory ──────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 10 },
    backgroundColor: '#0d0f12',
    show: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Security: no remote content in chrome UI
      allowRunningInsecureContent: false,
      webSecurity: true,
    },
  })

  // Load renderer
  if (DEV) {
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(INDEX_HTML)
  }

  win.once('ready-to-show', () => win.show())

  // Open external links in OS browser, not in Kitsune chrome
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

export type { BrowserView }
