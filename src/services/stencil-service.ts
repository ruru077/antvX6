import { Stencil, StringExt } from '@antv/x6'
import { throttle } from 'lodash-es'
import type { Block } from '~/types/vo/block'
import { fetchBlockLibrary, fetchBlocks } from '@/api/blocks'
import { STENCIL_GROUP_PADDING, STENCIL_NODE_GAP } from '@/assets/constant'
import { useGraphStore } from '@/store/graphStore'

function createStencilService(stencilContainer: HTMLElement) {
  let stencil!: Stencil
  let stencilWidth = stencilContainer.clientWidth
  const STENCIL_PADDING = 10
  let libraryWithBlock = new Map<string, Block[]>()
  let resizeObserver: ResizeObserver | null = null

  /**
   * 贪心行布局：每行尽量塞节点，装不下换行；每行高度 = 该行最高节点；行列间距固定
   */
  function greedyLayout(model: {
    getNodes: () => {
      getSize: () => { width: number; height: number }
      position: (x: number, y: number) => void
    }[]
  }) {
    const nodes = model.getNodes()
    const available = stencilWidth - 2 * STENCIL_PADDING
    const rows: (typeof nodes)[] = []
    let row: typeof nodes = []
    let rowWidth = 0
    for (const node of nodes) {
      const { width } = node.getSize()
      const needed =
        row.length === 0 ? width : rowWidth + STENCIL_NODE_GAP + width
      if (needed <= available || row.length === 0) {
        row.push(node)
        rowWidth = needed
      } else {
        rows.push(row)
        row = [node]
        rowWidth = width
      }
    }
    if (row.length) rows.push(row)
    let y = STENCIL_NODE_GAP / 2
    for (const r of rows) {
      const rowH = Math.max(...r.map((n) => n.getSize().height))
      const totalNodeWidth = r.reduce((sum, n) => sum + n.getSize().width, 0)
      const gap =
        r.length > 1
          ? (available - totalNodeWidth) / (r.length + 1)
          : (available - totalNodeWidth) / 2
      let x = gap
      for (const node of r) {
        const { width, height } = node.getSize()
        node.position(x, y + (rowH - height) / 2)
        x += width + gap
      }
      y += rowH + STENCIL_NODE_GAP
    }
  }

  async function create(): Promise<void> {
    const graph = useGraphStore.getState().graph
    const [blocks, libraries] = await Promise.all([
      fetchBlocks(),
      fetchBlockLibrary(),
    ])
    libraryWithBlock = new Map(
      libraries.map((lib) => [
        lib.name,
        blocks
          .filter((item) => item.libraryId === lib.id)
          .map((item) => item.block),
      ]),
    )
    stencil = buildStencil()
    for (const [libName, libBlocks] of libraryWithBlock) {
      stencil.load(
        libBlocks.map((b) => graph.createNode(b)),
        libName,
      )
    }
    stencilContainer.appendChild(stencil.container)
    resizeObserver = new ResizeObserver(
      throttle((entries: ResizeObserverEntry[]) => {
        const newWidth = entries[0].contentRect.width
        if (Math.abs(newWidth - stencilWidth) < 10) return
        resize(newWidth)
      }, 200),
    )
    resizeObserver.observe(stencilContainer)
  }

  function dispose(): void {
    resizeObserver?.disconnect()
    stencil.dispose()
  }

  function buildStencil(): Stencil {
    const graph = useGraphStore.getState().graph
    return new Stencil({
      target: graph,
      stencilGraphWidth: stencilWidth,
      stencilGraphHeight: 0,
      groups: Array.from(libraryWithBlock).map(([libName]) => ({
        name: libName,
        title: libName,
        graphPadding: STENCIL_GROUP_PADDING,
        layout: greedyLayout,
      })),
      search(cell, keyword) {
        const label = cell.attr<string>('label/text') ?? ''
        return label.toLowerCase().indexOf(keyword.toLowerCase()) !== -1
      },
      placeholder: 'TO_BLOCK_NAME',
      stencilGraphPadding: STENCIL_PADDING,
      notFoundText: 'NOT FOUND',
      getDragNode(node) {
        const cloned = node.clone()
        cloned.getPorts().forEach((port) => {
          if (port.id) cloned.portProp(port.id, 'id', StringExt.uuid())
        })
        const { width, height } = cloned.getSize()
        return cloned.size(Math.max(width, 60), Math.max(height, 60))
      },
    })
  }

  function resize(newWidth: number): void {
    stencilWidth = newWidth
    if (!libraryWithBlock.size) return
    stencil.options.stencilGraphWidth = stencilWidth
    for (const [libName, libBlocks] of libraryWithBlock) {
      stencil.resizeGroup(libName, { width: stencilWidth, height: 0 })
      stencil.load(
        libBlocks.map((b) => useGraphStore.getState().graph.createNode(b)),
        libName,
      )
    }
  }

  function collapseAll(): void {
    stencil?.collapseGroups()
  }
  function expandAll(): void {
    stencil?.expandGroups()
  }

  return { create, dispose, resize, collapseAll, expandAll }
}

export { createStencilService }
