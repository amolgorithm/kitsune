// src/main/services/SelectionCapture.ts
// Injects a floating toolbar into BrowserViews on text selection.
// Also wires native Electron context menu with "Save to Kitsune Notes".
import { Menu } from 'electron'
import type { WebContents, BrowserWindow } from 'electron'

const TOOLBAR_SCRIPT = `
(function() {
  if (window.__kitsuneToolbarWired) return;
  window.__kitsuneToolbarWired = true;

  let bar = null;
  let hideT = null;

  function ensureBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.id = '__kitsune-toolbar';
    Object.assign(bar.style, {
      position: 'fixed', zIndex: '2147483647',
      background: '#13161c',
      border: '1px solid rgba(255,107,53,0.35)',
      borderRadius: '8px', padding: '5px 6px',
      display: 'none', gap: '4px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
      pointerEvents: 'all',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px', userSelect: 'none',
      alignItems: 'center',
    });

    const save = btn('✦ Save note', '#a594ff');
    const copy = btn('Copy', '#6b7280');

    save.onclick = () => {
      const t = getSelection()?.toString().trim();
      if (t) window.__kitsunePending = t;
      hide();
    };
    copy.onclick = () => { document.execCommand('copy'); hide(); };

    bar.append(save, copy);
    document.body.append(bar);
  }

  function btn(label, color) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      background: 'none',
      border: '1px solid ' + color + '44',
      borderRadius: '5px', color,
      padding: '3px 9px', cursor: 'pointer',
      fontSize: '11px', fontFamily: 'inherit',
    });
    b.onmouseenter = () => b.style.background = color + '22';
    b.onmouseleave = () => b.style.background = 'none';
    return b;
  }

  function show(x, y) {
    ensureBar();
    clearTimeout(hideT);
    bar.style.top  = Math.max(8, y - 46) + 'px';
    bar.style.left = Math.max(8, Math.min(x - 60, innerWidth - 170)) + 'px';
    bar.style.display = 'flex';
  }
  function hide() {
    if (bar) bar.style.display = 'none';
  }

  document.addEventListener('mouseup', () => {
    clearTimeout(hideT);
    hideT = setTimeout(() => {
      const sel = getSelection();
      const txt = sel?.toString().trim();
      if (txt && txt.length > 10 && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        show(r.right, r.top + scrollY);
      } else hide();
    }, 80);
  });

  document.addEventListener('mousedown', e => {
    if (e.target?.closest?.('#__kitsune-toolbar')) return;
    clearTimeout(hideT);
    hideT = setTimeout(hide, 120);
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
})();
`

export function wireSelectionCapture(
  webContents: WebContents,
  win: BrowserWindow,
  tabId: string,
): void {
  // Inject floating toolbar on every page load
  webContents.on('did-finish-load', async () => {
    try { await webContents.executeJavaScript(TOOLBAR_SCRIPT) } catch {}
  })

  // Native context menu
  webContents.on('context-menu', (_e, params) => {
    const text = params.selectionText?.trim()
    if (!text || text.length < 5) return

    const menu = Menu.buildFromTemplate([
      {
        label: '✦ Save to Kitsune Notes',
        click: () => {
          win.webContents.send('ninetails:mirror-highlight', {
            text,
            url: params.pageURL,
            rule: null,
          })
        },
      },
      { label: 'Copy', role: 'copy' },
      { type: 'separator' },
      {
        label: 'Summarize with AI',
        click: () => {
          win.webContents.send('command:ui', { action: 'ai.panel.open' })
          win.webContents.send('command:ui', { action: 'ai.panel.tab', tab: 'chat' })
          setTimeout(() => {
            win.webContents.send('kitsune:inject-chat', {
              message: `Summarize and explain this:\n\n"${text.slice(0, 800)}"`,
            })
          }, 300)
        },
      },
    ])
    menu.popup({ window: win })
  })

  // Poll for toolbar saves (floating toolbar can't directly IPC from page context)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const startPoll = () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(async () => {
      try {
        const pending = await webContents.executeJavaScript(
          '(()=>{const t=window.__kitsunePending;window.__kitsunePending=null;return t;})()'
        )
        if (pending && typeof pending === 'string' && pending.trim().length > 10) {
          win.webContents.send('ninetails:mirror-highlight', {
            text: pending.trim(),
            url: webContents.getURL(),
            rule: null,
          })
        }
      } catch {}
    }, 800)
  }

  webContents.on('did-finish-load', startPoll)
  webContents.on('destroyed', () => { if (pollTimer) clearInterval(pollTimer) })
}
