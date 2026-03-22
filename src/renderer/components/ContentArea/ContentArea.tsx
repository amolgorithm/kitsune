// src/renderer/components/ContentArea/ContentArea.tsx
// ─────────────────────────────────────────────────────────────────
// ContentArea renders either:
//   • A placeholder/new-tab page (when URL is kitsune://newtab)
//   • The WebView placeholder (BrowserView managed by main via setBounds)
//   • A split pane layout when cleave is active — renders visual dividers
//     and separate bounding boxes for each BrowserView pane
// ─────────────────────────────────────────────────────────────────
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import { NewTabPage } from './NewTabPage'
import type { PaneNode } from '../../../shared/types'
import styles from './ContentArea.module.css'

export function ContentArea() {
  const activeTab      = useActiveTab()
  const cleaveLayout   = useBrowserStore(s => s.cleaveLayout)
  const tabs           = useBrowserStore(s => s.tabs)
  const activateTab    = useBrowserStore(s => s.activateTab)

  const isNewTab = !activeTab || activeTab.url === 'kitsune://newtab'

  // If we have an active split layout, render split panes
  if (cleaveLayout && cleaveLayout.type === 'split') {
    return (
      <div className={styles.contentArea} id="content-area">
        <SplitPaneView node={cleaveLayout} tabs={tabs} activeTabId={activeTab?.id ?? null} onActivate={activateTab} />
      </div>
    )
  }

  return (
    <div className={styles.contentArea} id="content-area">
      {isNewTab
        ? <NewTabPage />
        : (
          // BrowserView overlay — main process uses this div's bounds via setBounds()
          <div className={styles.webviewPlaceholder}>
            {activeTab?.status === 'loading' && (
              <div className={styles.loadingOverlay}>
                <div className={styles.foxSpinner}>🦊</div>
                <span className={styles.loadingText}>Loading {activeTab.url}</span>
              </div>
            )}
            {activeTab?.status === 'error' && (
              <div className={styles.errorPage}>
                <div className={styles.errorIcon}>⚠️</div>
                <h2 className={styles.errorTitle}>Page couldn't load</h2>
                <p className={styles.errorSub}>{activeTab.url}</p>
              </div>
            )}
          </div>
        )
      }
    </div>
  )
}

// ─── Split pane renderer ───────────────────────────────────────────

interface SplitPaneViewProps {
  node: PaneNode
  tabs: any[]
  activeTabId: string | null
  onActivate: (id: string) => void
}

function SplitPaneView({ node, tabs, activeTabId, onActivate }: SplitPaneViewProps) {
  if (node.type === 'leaf') {
    return <PaneLeaf node={node} tabs={tabs} activeTabId={activeTabId} onActivate={onActivate} />
  }

  const isHorizontal = node.direction === 'horizontal'
  const children = node.children ?? []
  const sizes = node.sizes ?? children.map(() => 100 / children.length)

  return (
    <div
      className={isHorizontal ? styles.splitH : styles.splitV}
      style={{ display: 'flex', flexDirection: isHorizontal ? 'row' : 'column', flex: 1, height: '100%' }}
    >
      {children.map((child, i) => (
        <div
          key={child.id}
          style={{
            flex: sizes[i] ?? 1,
            position: 'relative',
            overflow: 'hidden',
            // Add a visible divider between panes
            borderLeft: isHorizontal && i > 0 ? '1px solid var(--k-border-2)' : undefined,
            borderTop: !isHorizontal && i > 0 ? '1px solid var(--k-border-2)' : undefined,
          }}
        >
          <SplitPaneView
            node={child}
            tabs={tabs}
            activeTabId={activeTabId}
            onActivate={onActivate}
          />
        </div>
      ))}
    </div>
  )
}

function PaneLeaf({ node, tabs, activeTabId, onActivate }: {
  node: PaneNode; tabs: any[]; activeTabId: string | null; onActivate: (id: string) => void
}) {
  if (node.isAIPane) {
    return (
      <div className={styles.aiPanePlaceholder}>
        <span style={{ fontSize: 20, color: 'var(--k-ai-2)' }}>✦</span>
        <span style={{ fontSize: 12, color: 'var(--k-text-3)' }}>AI Panel</span>
      </div>
    )
  }

  const tab = node.tabId ? tabs.find(t => t.id === node.tabId) : null
  const isActive = node.tabId === activeTabId
  const isNewTab = !tab || tab.url === 'kitsune://newtab'

  return (
    <div
      className={`${styles.paneLeaf} ${isActive ? styles.paneLeafActive : ''}`}
      onClick={() => node.tabId && !isActive && onActivate(node.tabId)}
    >
      {/* Tab label bar at top of pane */}
      <div className={styles.paneTitleBar}>
        <div className={styles.paneFavicon}>
          {tab?.favicon
            ? <img src={tab.favicon} width={12} height={12} style={{ borderRadius: 2 }} alt="" />
            : <span style={{ fontSize: 10 }}>🌐</span>
          }
        </div>
        <span className={styles.paneTitle}>
          {tab?.title || (isNewTab ? 'New Tab' : tab?.url ? (() => { try { return new URL(tab.url).hostname } catch { return tab.url } })() : 'Empty')}
        </span>
        {isActive && <span className={styles.paneActiveIndicator} />}
      </div>

      {/* Content placeholder — the BrowserView sits on top of this via setBounds() */}
      <div className={styles.paneContent}>
        {isNewTab && <NewTabPage />}
        {tab?.status === 'loading' && (
          <div className={styles.loadingOverlay}>
            <div className={styles.foxSpinner}>🦊</div>
            <span className={styles.loadingText}>Loading…</span>
          </div>
        )}
        {tab?.status === 'error' && (
          <div className={styles.errorPage}>
            <div className={styles.errorIcon}>⚠️</div>
            <h2 className={styles.errorTitle}>Page couldn't load</h2>
          </div>
        )}
        {/* For ready non-newtab tabs, the BrowserView will overlay this area */}
        {tab && !isNewTab && tab.status !== 'loading' && tab.status !== 'error' && (
          <div className={styles.webviewPlaceholder} />
        )}
      </div>
    </div>
  )
}