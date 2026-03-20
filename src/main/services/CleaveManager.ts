// src/main/services/CleaveManager.ts
// ─────────────────────────────────────────────────────────────────
// Kitsune — Cleave Layout Manager
// Manages split-pane layouts. The actual rendering is done in the
// renderer via react-resizable-panels; this service stores the
// canonical layout tree and syncs it.
// ─────────────────────────────────────────────────────────────────

import { randomUUID } from 'crypto'
import type { PaneNode, SplitDirection } from '../../shared/types'

const DEFAULT_LAYOUT: PaneNode = {
  id: 'root',
  type: 'leaf',
  tabId: undefined,
  isAIPane: false,
}

export class CleaveManager {
  private layout: PaneNode = DEFAULT_LAYOUT

  getLayout(): PaneNode {
    return this.layout
  }

  setLayout(layout: PaneNode): void {
    this.layout = layout
  }

  /**
   * Split a leaf pane into two panes.
   * @param paneId   ID of the leaf to split
   * @param direction horizontal or vertical
   * @param newTabId  Tab to put in the new pane (optional)
   */
  splitPane(paneId: string, direction: SplitDirection, newTabId?: string): PaneNode {
    this.layout = this.splitInTree(this.layout, paneId, direction, newTabId)
    return this.layout
  }

  /** Remove a pane from the layout, collapsing its parent if needed */
  closePane(paneId: string): PaneNode {
    this.layout = this.closePaneInTree(this.layout, paneId) ?? DEFAULT_LAYOUT
    return this.layout
  }

  /** Create a pure AI pane alongside the current layout */
  addAIPane(): PaneNode {
    const aiPane: PaneNode = {
      id: randomUUID(),
      type: 'leaf',
      isAIPane: true,
    }
    this.layout = {
      id: randomUUID(),
      type: 'split',
      direction: 'horizontal',
      sizes: [65, 35],
      children: [this.layout, aiPane],
    }
    return this.layout
  }

  reset(): PaneNode {
    this.layout = DEFAULT_LAYOUT
    return this.layout
  }

  // ─── Tree helpers ───────────────────────────────────────────────

  private splitInTree(
    node: PaneNode,
    targetId: string,
    direction: SplitDirection,
    newTabId?: string,
  ): PaneNode {
    if (node.id === targetId && node.type === 'leaf') {
      const newLeaf: PaneNode = { id: randomUUID(), type: 'leaf', tabId: newTabId }
      return {
        id: randomUUID(),
        type: 'split',
        direction,
        sizes: [50, 50],
        children: [node, newLeaf],
      }
    }
    if (node.type === 'split' && node.children) {
      return {
        ...node,
        children: node.children.map(c => this.splitInTree(c, targetId, direction, newTabId)),
      }
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


