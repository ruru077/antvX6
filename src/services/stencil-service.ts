import type { BlockDefinition } from '@/api/blocks'
import { fetchBlocks, parseBlockData, parseMarkupData } from '@/api/blocks'
import { Graph, Stencil } from '@antv/x6'
// 节点固定尺寸 & 间距常量
const NODE_SIZE = 60
const NODE_GAP = 30 // 节点之间的间距
const LABEL_H = 22 // 标签文字高度（refY 132% 时约 20px）
const SIDE_PAD = 8 // 左右两侧边距

function graphWidthForCols(cols: number): number {
  return SIDE_PAD * 2 + cols * (NODE_SIZE + NODE_GAP) - NODE_GAP
}

export function createStencilService(stencilContainer: HTMLElement) {
  let stencil: Stencil | undefined
  let graph: Graph | undefined
  let resizeObserver: ResizeObserver | undefined
  let activeColumns = 2
  const registeredShapes = new Set<string>()

  function create(g: Graph): void {
    graph = g
    activeColumns = resolveColumns()
    stencil = buildStencil(activeColumns)
    stencilContainer.appendChild(stencil.container)
    injectCustomHeader()
    watchResize()
    loadDynamicShapes()
  }

  function dispose(): void {
    resizeObserver?.disconnect()
    stencil?.dispose()

    resizeObserver = undefined
    stencil = undefined
    graph = undefined
  }

  // ── Private functions ──────────────────────────────────────────

  function resolveColumns(): number {
    const w = stencilContainer.offsetWidth
    const cols = Math.floor(
      (w - SIDE_PAD * 2 + NODE_GAP) / (NODE_SIZE + NODE_GAP),
    )
    return Math.max(1, Math.min(cols, 5))
  }

  function buildStencil(columns: number): Stencil {
    return new Stencil({
      title: 'Stencil',
      target: graph!,
      collapsable: false,
      stencilGraphWidth: graphWidthForCols(columns),
      stencilGraphHeight: 0,
      groups: [{ name: 'blocks', title: 'Blocks', collapsable: true }],
      search(cell, keyword) {
        return cell.shape.indexOf(keyword) !== -1
      },
      placeholder: 'Search shapes...',
      notFoundText: 'No shapes found',
      layoutOptions: {
        columns,
        columnWidth: NODE_SIZE + NODE_GAP,
        rowHeight: NODE_SIZE + NODE_GAP + LABEL_H,
        dx: 0,
        dy: 0,
        marginX: SIDE_PAD,
        marginY: SIDE_PAD,
      },
    })
  }

  function setAllGroupsCollapsed(collapse: boolean): void {
    const groups = stencilContainer.querySelectorAll<HTMLElement>(
      '.x6-widget-stencil-group.collapsable',
    )
    groups.forEach((groupEl) => {
      const isCollapsed = groupEl.classList.contains('collapsed')
      if ((collapse && !isCollapsed) || (!collapse && isCollapsed)) {
        groupEl
          .querySelector<HTMLElement>('.x6-widget-stencil-group-title')
          ?.click()
      }
    })
  }

  function injectCustomHeader(): void {
    // Remove any previously injected header to avoid duplicates on rebuild
    stencilContainer.querySelector('.stencil-header')?.remove()

    const header = document.createElement('div')
    header.className = 'stencil-header'

    const ctrlGroup = document.createElement('div')
    ctrlGroup.className = 'stencil-ctrl-group'
    ctrlGroup.innerHTML =
      '<button class="stencil-ctrl-btn stencil-ctrl-expand" title="Expand all groups"></button>' +
      '<button class="stencil-ctrl-btn stencil-ctrl-collapse" title="Collapse all groups"></button>'

    const label = document.createElement('span')
    label.className = 'stencil-title-label'
    label.textContent = 'STENCIL'

    header.appendChild(ctrlGroup)
    header.appendChild(label)

    ctrlGroup
      .querySelector('.stencil-ctrl-expand')
      ?.addEventListener('click', (e) => {
        e.stopPropagation()
        setAllGroupsCollapsed(false)
      })
    ctrlGroup
      .querySelector('.stencil-ctrl-collapse')
      ?.addEventListener('click', (e) => {
        e.stopPropagation()
        setAllGroupsCollapsed(true)
      })

    stencilContainer.prepend(header)
  }

  function rebuildStencil(): void {
    stencil?.dispose()
    stencil = buildStencil(activeColumns)
    stencilContainer.appendChild(stencil.container)
    injectCustomHeader()
    loadDynamicShapes()
  }

  function watchResize(): void {
    resizeObserver = new ResizeObserver(() => {
      const cols = resolveColumns()
      if (cols !== activeColumns) {
        activeColumns = cols
        rebuildStencil()
      }
    })
    resizeObserver.observe(stencilContainer)
  }

  function registerBlockShape(block: BlockDefinition): void {
    if (registeredShapes.has(block.type)) return

    const blockData = parseBlockData(block.data)
    const attrs = (blockData.defaults.attrs || {}) as Record<string, unknown>

    const newAttrs: Record<string, unknown> = {
      ...attrs,
    }

    if (attrs.image && typeof attrs.image === 'object') {
      newAttrs.image = {
        ...(attrs.image as Record<string, unknown>),
        xlinkHref: `data:image/png;base64,${block.icon}`,
      }
    }

    Graph.registerNode(block.type, {
      width: 100,
      height: 100,
      markup: blockData.protoProps.markup,
      // 数据来自可信的 API 来源，已通过 parseBlockData 验证
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attrs: newAttrs as any,
    })

    registeredShapes.add(block.type)
  }

  async function loadDynamicShapes(): Promise<void> {
    if (!graph || !stencil) return
    try {
      const blocks = await fetchBlocks()
      const nodes = blocks
        .filter((block) => {
          registerBlockShape(block)
          return registeredShapes.has(block.type)
        })
        .map((block) => {
          const markupData = parseMarkupData(block.markup)
          return graph!.createNode({
            shape: block.type,
            width: NODE_SIZE,
            height: NODE_SIZE,
            attrs: markupData.attrs,
            ports: markupData.ports,
          })
        })
      stencil.load(nodes, 'blocks')
    } catch (error) {
      console.error('Failed to load dynamic shapes:', error)
    }
  }

  return {
    create,
    dispose,
  }
}
