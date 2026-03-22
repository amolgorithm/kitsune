// src/main/ipc/cleaveIPC.ts
import type { IpcMain, BrowserWindow } from 'electron'
import type { CleaveManager } from '../services/CleaveManager'
import type { TabManager } from '../services/TabManager'
import type { PaneNode } from '../../shared/types'

export function registerCleaveIPC(
  ipcMain: IpcMain,
  cm: CleaveManager,
  tabManager: TabManager,
  win: BrowserWindow,
): void {
  ipcMain.handle('cleave:get-layout', () => cm.getLayout())

  ipcMain.handle('cleave:set-layout', (_e, layout: PaneNode) => {
    cm.setLayout(layout)

    // Remove all existing BrowserViews first
    for (const view of (tabManager as any).views.values()) {
      try { win.removeBrowserView(view as any) } catch { /* ignore */ }
    }

    if (layout.type === 'leaf' || !layout.children?.length) {
      // Reset to single pane — clear currentPanes so repositionAll() works normally
      ;(tabManager as any).currentPanes = []
      const activeId = tabManager.getActiveTabId()
      if (activeId) {
        const view = (tabManager as any).views.get(activeId)
        if (view) {
          win.addBrowserView(view)
          const [w, h] = win.getContentSize()
          const SIDEBAR_W = (tabManager as any).getSidebarWidth
            ? tabManager.getSidebarWidth()
            : 240
          const CHROME_TOP = 116  // 32 + 48 + 36
          const BOTTOM_H   = 52   // 24 + 28
          const replH = (tabManager as any).replHeight ?? 0
          view.setBounds({
            x: SIDEBAR_W, y: CHROME_TOP,
            width: Math.max(0, w - SIDEBAR_W),
            height: Math.max(0, h - CHROME_TOP - Math.max(BOTTOM_H, replH)),
          })
        }
      }
    } else {
      // Multi-pane layout — use tree-based positioning
      ;(tabManager as any).currentPanes = cm.getLeafPanes()

      const [winW, winH] = win.getContentSize()
      const SIDEBAR_W = tabManager.getSidebarWidth()
      const CHROME_TOP = 116  // 32 titlebar + 48 navbar + 36 lensbar
      const BOTTOM_H   = 52   // 24 statusbar + 28 hotkeybar
      const replH = (tabManager as any).replHeight ?? 0
      const aiW = (tabManager as any).aiPanelWidth ?? 0

      const bounds = {
        x:      SIDEBAR_W,
        y:      CHROME_TOP,
        width:  winW - SIDEBAR_W - aiW,
        height: winH - CHROME_TOP - Math.max(BOTTOM_H, replH),
      }

      tabManager.applyLayoutFromTree(layout, bounds)
    }

    // Push updated layout to renderer for visual update
    win.webContents.send('cleave:set-layout', layout)
    return layout
  })

  ipcMain.handle('cleave:reset', () => {
    const layout = cm.reset()
    ;(tabManager as any).currentPanes = []
    const activeId = tabManager.getActiveTabId()
    if (activeId) {
      // Remove all views and re-add active one
      for (const view of (tabManager as any).views.values()) {
        try { win.removeBrowserView(view as any) } catch { /* ignore */ }
      }
      const view = (tabManager as any).views.get(activeId)
      if (view) {
        win.addBrowserView(view)
        tabManager.repositionActiveView()
      }
    }
    win.webContents.send('cleave:set-layout', layout)
    return layout
  })
}