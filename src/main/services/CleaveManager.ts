// src/main/services/CleaveManager.ts
// Manages split-pane layouts and coordinates BrowserView repositioning.
// When layout changes, notifies TabManager to reposition views.
import { randomUUID } from 'crypto'
import type { PaneNode, SplitDirection } from '../../shared/types'

const DEFAULT_LAYOUT: PaneNode = { id: 'root', type: 'leaf' }

export class CleaveManager {
  private layout: PaneNode = DEFAULT_LAYOUT

  getLayout(): PaneNode { return this.layout }

  setLayout(layout: PaneNode): void { this.layout = layout }

  // Collect all leaf tabIds from the layout tree (for multi-view positioning)
  getLeafPanes(): Array<{ paneId: string; tabId?: string; isAIPane?: boolean }> {
    return this.collectLeaves(this.layout)
  }

  splitPane(paneId: string, direction: SplitDirection, newTabId?: string): PaneNode {
    this.layout = this.splitInTree(this.layout, paneId, direction, newTabId)
    return this.layout
  }

  closePane(paneId: string): PaneNode {
    this.layout = this.closePaneInTree(this.layout, paneId) ?? DEFAULT_LAYOUT
    return this.layout
  }

  reset(): PaneNode {
    this.layout = DEFAULT_LAYOUT
    return this.layout
  }

  private collectLeaves(node: PaneNode): Array<{ paneId: string; tabId?: string; isAIPane?: boolean }> {
    if (node.type === 'leaf') return [{ paneId: node.id, tabId: node.tabId, isAIPane: node.isAIPane }]
    return (node.children ?? []).flatMap(c => this.collectLeaves(c))
  }

  private splitInTree(node: PaneNode, targetId: string, direction: SplitDirection, newTabId?: string): PaneNode {
    if (node.id === targetId && node.type === 'leaf') {
      return {
        id: randomUUID(), type: 'split', direction, sizes: [50, 50],
        children: [
          node,
          { id: randomUUID(), type: 'leaf', tabId: newTabId },
        ],
      }
    }
    if (node.type === 'split' && node.children) {
      return { ...node, children: node.children.map(c => this.splitInTree(c, targetId, direction, newTabId)) }
    }
    return node
  }

  private closePaneInTree(node: PaneNode, targetId: string): PaneNode | null {
    if (node.id === targetId) return null
    if (node.type === 'split' && node.children) {
      const newChildren = node.children
        .map(c => this.closePaneInTree(c, targetId))
        .filter((c): c is PaneNode => c !== null)
      if (newChildren.length === 0) return null
      if (newChildren.length === 1) return newChildren[0]
      return { ...node, children: newChildren }
    }
    return node
  }
}
