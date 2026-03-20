// src/renderer/components/ContentArea/ContentArea.tsx
// ─────────────────────────────────────────────────────────────────
// ContentArea renders either:
//   • A placeholder/new-tab page (when URL is kitsune://newtab)
//   • The WebView placeholder (BrowserView is managed by main process
//     and overlaid on top of this element via setBounds)
// The CleaveManager may split this into multiple panes.
// ─────────────────────────────────────────────────────────────────
import { useBrowserStore, useActiveTab } from '../../stores/browserStore'
import { NewTabPage } from './NewTabPage'
import styles from './ContentArea.module.css'

export function ContentArea() {
  const activeTab   = useActiveTab()
  const layout      = useBrowserStore(s => s.layout)
  const cleaveOpen  = useBrowserStore(s => s.cleaveOpen)

  const isNewTab = !activeTab || activeTab.url === 'kitsune://newtab'

  return (
    <div className={styles.contentArea} id="content-area">
      {isNewTab
        ? <NewTabPage />
        : (
          // The actual web content is a BrowserView overlaid by the main
          // process. This div provides the bounding box for setBounds().
          // We show a loading state here while the view loads.
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
