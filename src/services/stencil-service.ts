import { Graph, Model, Stencil, StringExt } from '@antv/x6'
import type { Node } from '@antv/x6'
import { throttle } from 'lodash-es'
import type { Block } from '~/types/vo/block'
import { fetchBlockLibrary, fetchBlocks } from '@/api/blocks'
import {
  STENCIL_GROUP_PADDING,
  STENCIL_NODE_GAP,
  STENCIL_PADDING,
} from '@/assets/constant'
import { useGraphStore } from '@/store/graphStore'

function createStencilService(stencilContainer: HTMLElement) {
  let stencil!: Stencil
  let graph!: Graph
  let stencilWidth = stencilContainer.clientWidth
  let libraryWithBlock = new Map<string, Block[]>()
  let resizeObserver: ResizeObserver | null = null
  /**
   * 贪心布局：每行塞节点，装不下换行，不修改加载顺序；每行高度 = 该行最高节点；行列间距固定
   */
  function greedyLayout(model: Model) {
    const nodes = model.getNodes()
    const areaX = stencilWidth - 2 * STENCIL_PADDING
    const rows: Node[][] = []
    let row: Node[] = []
    let tolWidth = 0
    for (const node of nodes) {
      const { width } = node.getSize()
      const needed =
        row.length === 0 ? width : tolWidth + STENCIL_NODE_GAP + width
      if (needed <= areaX) {
        row.push(node)
        tolWidth = needed
      } else if (needed > areaX && row.length > 0) {
        rows.push(row)
        row = [node]
        tolWidth = width
      } else if (needed > areaX && row.length === 0) {
        // 单个节点宽度超过行宽 兼容性报错
        console.error('[联系管理员兼容]Exist node exceeds min row width:', node)
      } else {
        console.error('Unexpected layout case:', node)
      }
    }
    if (row.length) rows.push(row)
    let y = STENCIL_NODE_GAP / 2
    for (const r of rows) {
      const sizes = r.map((n) => n.getSize())
      const rowH = Math.max(...sizes.map((s) => s.height))
      const totalNodeWidth = sizes.reduce((sum, s) => sum + s.width, 0)
      //  gap 计算（两种情况）：
      // ┌ r.length > 1 → gap = (areaX - totalNodeWidth) / (r.length + 1)
      // │   节点间和两侧都留等量间距，共 (n+1) 份
      // └ r.length = 1 → gap = (areaX - totalNodeWidth) / 2
      //  单节点居中，左右各一份
      const gap =
        r.length > 1
          ? (areaX - totalNodeWidth) / (r.length + 1)
          : (areaX - totalNodeWidth) / 2
      let x = gap
      for (let i = 0; i < r.length; i++) {
        const { width, height } = sizes[i]
        r[i].position(x, y + (rowH - height) / 2)
        x += width + gap
      }
      y += rowH + STENCIL_NODE_GAP
    }
  }

  async function create(): Promise<void> {
    graph = useGraphStore.getState().graph
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
        libBlocks.map((b) => graph.createNode(b)),
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
