import {
  Clipboard,
  Edge,
  Export,
  Graph,
  History,
  Keyboard,
  Node,
  Scroller,
  Selection,
  Shape,
  Snapline,
  Transform,
} from '@antv/x6'
import { debounce } from 'lodash-es'
import {
  EDGE_TARGET_CP_OFFSET,
  GRAPH_GRID,
  PASTE_OFFSET,
  SNAP_RADIUS,
  WHEEL_ZOOM_LEVELS,
} from '@/assets/constant'
import { previewLinkAttrs } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import { routeAllEdges } from '@/services/routing-service'
import { mergeToSubsystem } from '@/services/subsystem-service'
import {
  firstTimePaste,
  isSelectionByKey,
  pasteTarget,
  rightEdgeDragging,
  setFirstTimePaste,
  setIsSelectionByKey,
  setPasteTarget,
  setSpaceComboUsed,
  setSpaceHeld,
  spaceComboUsed,
  spaceHeld,
} from '@/store/flags'
import { useGraphStore } from '@/store/graphStore'
import { openAutoPan } from '@/utils/plugin/openAutoPan'
import { registerRatioAnchorTool } from '@/utils/plugin/ratioAnchorTool'
import { _patchScrollerOnUpdate } from '@/utils/plugin/X6patch'
import type { Graph as GraphType } from '@antv/x6'

const commonService = createCommonService()
const interactiveService = createInteractiveService()

// 从 edge 回溯上游 source，拿到源端口（按当前模型约定：源端最终可追到 Node）
const resolveSourceFromUpstreamEdge = (
  startEdge: Edge,
): { cell: Node; portId: string } | null => {
  let current: Edge | null = startEdge

  while (current) {
    // 读取当前边的上游 source 节点和端口
    const srcCell = current.getSourceCell() as Node | Edge
    const srcPortId = current.getSourcePortId()
    if (srcCell.isNode()) {
      return {
        cell: srcCell,
        portId: srcPortId,
      }
    }
    // 不是 node 就是 edge，继续回溯
    current = srcCell
  }
  // TODO feat: 空接 删除模块不删除连接线
  return null
}
/**
 * Graph 连线合法性校验
 * @description TODO 当前校验规则：out-> in，端口只能单连，允许自环
 * @returns boolean 是否合法
 */
function isConnectionValid(
  graph: GraphType,
  sourceCell: Node | Edge,
  sourcePort: string | null | undefined,
  targetCell: Node,
  targetPort: string,
  edge?: Edge | null,
) {
  // 统一算出当前连接起点的端口信息：节点直连 or edge 回溯
  const sourcePortInfo = sourceCell.isNode()
    ? {
        cell: sourceCell,
        portId: sourcePort!,
      }
    : resolveSourceFromUpstreamEdge(sourceCell as Edge)!

  const sourceDir = commonService.getPortGroup(
    sourcePortInfo.cell.getPort(sourcePortInfo.portId),
  )
  const targetDir = commonService.getPortGroup(targetCell.getPort(targetPort))
  // in <-> out
  if (!sourceDir || !targetDir || sourceDir === targetDir) return false

  const currentEdgeId = edge?.id
  if (sourceCell.isNode()) {
    const sourcePortOccupied = graph
      .getConnectedEdges(sourcePortInfo.cell)
      .some(
        (e) =>
          e.id !== currentEdgeId &&
          ((e.getSourceCell()?.id === sourcePortInfo.cell.id &&
            e.getSourcePortId() === sourcePortInfo.portId) ||
            (e.getTargetCell()?.id === sourcePortInfo.cell.id &&
              e.getTargetPortId() === sourcePortInfo.portId)),
      )
    if (sourcePortOccupied) return false
  }

  const targetPortOccupied = graph
    .getConnectedEdges(targetCell)
    .some(
      (e) =>
        e.id !== currentEdgeId &&
        ((e.getSourceCell()?.id === targetCell.id &&
          e.getSourcePortId() === targetPort) ||
          (e.getTargetCell()?.id === targetCell.id &&
            e.getTargetPortId() === targetPort)),
    )
  if (targetPortOccupied) return false

  return true
}

// ── 主入口 ──────────────────────────────────────────────────────────────────

function createAndSetupGraph(
  container: HTMLElement,
  onScale: (zoom: number) => void,
): GraphType {
  const graph = createGraph(container)
  registerSteppedMouseWheel(graph)
  setupDevTools(graph)
  registerPlugins(graph)
  registerCtrlClickConnection(graph)
  registerKeyBindings(graph)
  graph.on('scale', ({ sx }: { sx: number }) => {
    // 使用selection 插件选择多个cell 之后滚轮进行缩放，选择框错位 #3452
    const cells = graph.getSelectedCells()
    graph.resetSelection(cells)
    cells.forEach((cell) => {
      interactiveService.addOutline(cell)
    })
    onScale(Math.round(sx * 100))
  })
  graph.getPlugin<Scroller>('scroller')!.centerPoint(1500, 1000)
  openAutoPan(graph)
  return graph
}

// ── Graph 实例创建 ────────────────────────────────────────────────────────────

function createGraph(container: HTMLElement): GraphType {
  const graph = new Graph({
    container,
    autoResize: true,
    connecting: {
      allowNode: false,
      // TODO Edge 拉线反接
      allowEdge: false,
      allowMulti: 'withPort',
      allowLoop: true,
      sourceConnectionPoint: 'anchor',
      targetConnectionPoint: {
        name: 'anchor',
        args: {
          offset: EDGE_TARGET_CP_OFFSET,
        },
      },
      snap: {
        radius: SNAP_RADIUS,
        anchor: 'bbox',
      },
      createEdge({ sourceCell, sourceMagnet }) {
        return new Shape.Edge(previewLinkAttrs)
      },
      highlight: true,
      validateConnection({
        sourceCell,
        targetCell,
        sourcePort,
        targetPort,
        edge,
      }): boolean {
        // 缺少关键参数直接拒绝
        if (!sourceCell || !targetCell || !targetPort) return false
        return isConnectionValid(
          graph,
          sourceCell as Node | Edge,
          sourcePort,
          targetCell as Node,
          targetPort,
          edge,
        )
      },
    },
    highlighting: {
      // 拖拽开始时高亮所有可连接的端口
      magnetAvailable: {
        name: 'stroke',
        args: {
          padding: 10,
          attrs: {
            'stroke-width': 3,
            stroke: 'green',
          },
        },
      },
      // 鼠标悬停在可连接端口时高亮
      magnetAdsorbed: {
        name: 'stroke',
        args: {
          padding: 4,
          attrs: {
            'stroke-width': 2,
            stroke: 'red',
          },
        },
      },
    },
    grid: { visible: true, size: GRAPH_GRID, type: 'doubleMesh' },
    scaling: { min: 0.5, max: 5 },
    panning: false,
    virtual: false,
    interacting: (cellView) => {
      if (cellView.cell.isEdge()) {
        return { edgeMovable: rightEdgeDragging }
      }
      return {}
    },
  })

  return graph
}

function registerCtrlClickConnection(graph: GraphType) {
  let selectedNodes: Node[] = []

  // mousedown 更新选中节点列表
  graph.on('node:mousedown', ({ node, e }) => {
    selectedNodes = []
    const currentSelection = graph
      .getSelectedCells()
      .filter((cell): cell is Node => cell.isNode())
    if (
      e.button !== 0 ||
      (!e.ctrlKey && !e.metaKey) ||
      e.target.closest('.x6-port')
    ) {
      return
    }

    selectedNodes = currentSelection.filter((cell) => cell.id !== node.id)
  })
  // Ctrl / Command + 鼠标点击连接
  graph.on('node:click', async ({ node, e }) => {
    const sourceNodes = selectedNodes
    selectedNodes = []
    if (!e.ctrlKey && !e.metaKey) return
    if (sourceNodes.length === 0) return
    // y轴优先排序，x轴次之，保证连接顺序可控
    sourceNodes.sort((a, b) => {
      const aPosition = a.getPosition()
      const bPosition = b.getPosition()
      return aPosition.y - bPosition.y || aPosition.x - bPosition.x
    })

    const targetPorts = node
      .getPorts()
      .filter(
        (port) => port.id !== null && commonService.getPortGroup(port) === 'in',
      )
      .sort((a, b) => a.id!.localeCompare(b.id!, undefined, { numeric: true }))

    let connected = false
    graph.startBatch('ctrl-click-connect')
    try {
      sourceNodes.forEach((sourceNode) => {
        const sourcePorts = sourceNode
          .getPorts()
          .filter(
            (port) =>
              port.id !== null && commonService.getPortGroup(port) === 'out',
          )
          .sort((a, b) =>
            a.id!.localeCompare(b.id!, undefined, { numeric: true }),
          )

        for (const targetPort of targetPorts) {
          const sourcePort = sourcePorts.find((port) =>
            isConnectionValid(graph, sourceNode, port.id, node, targetPort.id!),
          )
          if (!sourcePort) continue

          const edge = graph.addEdge({
            source: { cell: sourceNode.id, port: sourcePort.id },
            ...previewLinkAttrs,
          })
          edge.setTarget({ cell: node.id, port: targetPort.id })
          connected = true
        }
      })
      if (connected) await routeAllEdges(graph)
    } finally {
      graph.stopBatch('ctrl-click-connect')
    }
  })
}

/**
 * 定规格监听 mouseWheel
 * @param graph 图示例
 */
function registerSteppedMouseWheel(graph: GraphType) {
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return

    e.preventDefault()
    e.stopPropagation()

    const currentScale = graph.zoom()
    const zoomIn = e.deltaY < 0
    const targetScale = zoomIn
      ? (WHEEL_ZOOM_LEVELS.find((level) => level > currentScale) ??
        WHEEL_ZOOM_LEVELS[WHEEL_ZOOM_LEVELS.length - 1])
      : (WHEEL_ZOOM_LEVELS.findLast((level) => level < currentScale) ??
        WHEEL_ZOOM_LEVELS[0])
    if (targetScale === currentScale) return

    const center = graph.getPlugin('scroller')
      ? graph.clientToLocal(e.clientX, e.clientY)
      : graph.clientToGraph(e.clientX, e.clientY)

    graph.zoom(targetScale, {
      absolute: true,
      center,
    })
  }

  graph.container.addEventListener('wheel', onWheel, { passive: false })

  const dispose = graph.dispose.bind(graph)
  graph.dispose = (clean?: boolean) => {
    graph.container.removeEventListener('wheel', onWheel)
    dispose(clean)
  }
}

// ── 插件注册 ──────────────────────────────────────────────────────────────────

registerRatioAnchorTool()
// registerSimulinkSegmentsTool()

function registerPlugins(graph: GraphType) {
  graph.use(new Snapline({ enabled: true, sharp: true }))
  graph.use(new Export())
  graph.use(
    new Selection({
      enabled: true,
      // 关闭内置多选 使用 Ctrl/Command + 鼠标点击 进行模块连接
      multiple: false,
      rubberband: true,
      rubberEdge: true,
      showNodeSelectionBox: true,
      showEdgeSelectionBox: false,
      movingRouterFallback: 'orth',
      modifiers: 'shift',
      content(_selection, el) {
        el.innerHTML = `
          <div class="x6-selection-action-bar">
            <button class="x6-selection-action-bar__btn" data-action="create-subsystem" title="创建子系统">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <rect x="1" y="1" width="14" height="14" rx="2"/>
                <path d="M5 8h6M8 5v6"/>
              </svg>
              <span>创建子系统</span>
            </button>
          </div>
        `
        const btn = el.querySelector<HTMLElement>(
          '[data-action="create-subsystem"]',
        )!
        btn.addEventListener('mousedown', (e) => e.stopPropagation())
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const cells = graph.getSelectedCells()
          mergeToSubsystem(cells, graph)
        })
        return ''
      },
    }),
  )
  const scroller = new Scroller({
    enabled: true,
    pannable: true,
    pageWidth: 3000,
    pageHeight: 2000,
    pageBreak: false,
    pageVisible: true,
    autoResizeOptions: {
      useCellGeometry: false,
    },
  })
  graph.use(scroller)
  _patchScrollerOnUpdate(scroller)

  const transformPlugin = new Transform({
    resizing: {
      enabled: true,
      minWidth: 40,
      maxWidth: 800,
      minHeight: 40,
      maxHeight: 400,
      orthogonal: false,
      restrict: false,
      preserveAspectRatio: false,
    },
  })
  graph.use(transformPlugin)
  transformPlugin.disable()

  graph.use(new Clipboard({ enabled: true, useLocalStorage: true }))
  graph.use(
    new History({
      enabled: true,
      beforeAddCommand(_event, args) {
        if (!args) return
        if ('options' in args && args.options?.undo === false) return false
      },
    }),
  )
  graph.use(new Keyboard({ enabled: true }))
}

// ── 快捷键注册 ────────────────────────────────────────────────────────────────

function registerKeyBindings(graph: GraphType) {
  const space = createSpaceHandlers()

  // 方向键合并：Space 按住时走 pan，否则走 move
  DIRS.forEach((dir) => {
    const move = moveKeyHandler(dir)
    const pan = [space.panLeft, space.panRight, space.panUp, space.panDown][
      DIRS.indexOf(dir)
    ]
    graph.bindKey(dir, () => {
      if (isEditingElement()) return
      if (spaceHeld) return pan()
      return move()
    })
  })

  registerKeys(graph, [
    [['ctrl+c', 'meta+c'], copyHandler],
    [['ctrl+v', 'meta+v'], pasteHandler],
    [['ctrl+v', 'meta+v'], pasteUpHandler, 'keyup'],
    [['ctrl+x', 'meta+x'], cutHandler],
    [['delete', 'backspace'], removeHandler],
    [['ctrl+a', 'meta+a'], selectAllHandler],
    ['space', space.down],
    ['space', space.up, 'keyup'],
    ['=', space.zoomIn],
    ['-', space.zoomOut],
    ['0', space.zoomReset],
    ['g', space.zoomToFit],
    ['f', space.zoomToSelection],
    [
      ['ctrl+z', 'meta+z'],
      () => {
        graph.undo()
      },
    ],
    [
      ['ctrl+y', 'meta+y', 'meta+shift+z', 'ctrl+shift+z'],
      () => {
        graph.redo()
      },
    ],
  ])
}

// ── 开发工具 ──────────────────────────────────────────────────────────────────

function setupDevTools(graph: GraphType) {
  // @ts-expect-error AntV X6 插件
  window.__x6_instances__ = []
  // @ts-expect-error AntV X6 插件
  window.__x6_instances__.push(graph)
}

/**
 * @description 检查当前焦点是否在可编辑元素上，若是则应跳过快捷键处理
 */
function isEditingElement(): boolean {
  const el = document.activeElement
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el.closest('input, textarea, select')) return true
  return false
}

// ── 方向键辅助（纯函数） ──────────────────────────────────────────────────────

type ArrowDir = 'up' | 'down' | 'left' | 'right'

const DIRS: ArrowDir[] = ['left', 'right', 'up', 'down']

const STEP: Record<ArrowDir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -GRAPH_GRID },
  down: { dx: 0, dy: GRAPH_GRID },
  left: { dx: -GRAPH_GRID, dy: 0 },
  right: { dx: GRAPH_GRID, dy: 0 },
}

function findNeighbor(current: Node, dir: ArrowDir): Node | null {
  const graph = useGraphStore.getState().graph
  const center = current.getBBox().getCenter()
  const candidates = graph.getNodes().filter((n) => {
    if (n === current) return false
    const c = n.getBBox().getCenter()
    const dx = c.x - center.x
    const dy = c.y - center.y
    if (dir === 'left') return dx < 0
    if (dir === 'right') return dx > 0
    if (dir === 'up') return dy < 0
    if (dir === 'down') return dy > 0
  })
  if (!candidates.length) return null
  return candidates.reduce((best, n) => {
    const c = n.getBBox().getCenter()
    const bc = best.getBBox().getCenter()
    return Math.hypot(c.x - center.x, c.y - center.y) <
      Math.hypot(bc.x - center.x, bc.y - center.y)
      ? n
      : best
  })
}

function moveKeyHandler(dir: ArrowDir) {
  let isBatching = false
  const _debounce = debounce(() => {
    useGraphStore.getState().graph.stopBatch('move')
    isBatching = false
  }, 700)
  return () => {
    // 编辑态：直接 return（不 return false），避免 Mousetrap 调 preventDefault
    if (isEditingElement()) return
    if (spaceHeld) return false
    const graph = useGraphStore.getState().graph
    if (!graph.getNodes().length) return false

    const selectedNodes = graph.getSelectedCells().filter((c) => c.isNode())
    const selectedEdges = graph.getSelectedCells().filter((c) => c.isEdge())
    if (selectedNodes.length > 0 && !isSelectionByKey) {
      if (!isBatching) {
        isBatching = true
        graph.startBatch('move')
      }
      selectedNodes.forEach((node) => {
        const { x, y } = node.getPosition()
        node.setPosition(x + STEP[dir].dx, y + STEP[dir].dy)
      })
      _debounce()
    } else if (!selectedEdges.length) {
      const nodes = graph.getNodes()
      const current = isSelectionByKey ? selectedNodes[0] : nodes[0]
      current.removeTool('boundary', { undo: false })
      const neighbor = findNeighbor(current, dir) ?? current
      setIsSelectionByKey(true)
      graph.resetSelection([neighbor])
      interactiveService.addOutline(neighbor)
      interactiveService.addBoundaryTool(neighbor)
      graph.getPlugin<Scroller>('scroller')?.scrollToCell(neighbor)
    }
    return false
  }
}

// ── 快捷键 handler ──────────────────────────────────────────────────────────

function copyHandler() {
  const graph = useGraphStore.getState().graph
  const cells = graph.getSelectedCells()
  if (cells.length) graph.copy(cells)
}

function pasteHandler() {
  if (!firstTimePaste) return
  if (!pasteAndSelect()) return
  setFirstTimePaste(false)
}

function pasteAndSelect() {
  const graph = useGraphStore.getState().graph
  if (graph.isClipboardEmpty()) return false
  let cells
  if (pasteTarget) {
    const clipboardCells = graph.getCellsInClipboard()
    const nodes = clipboardCells.filter((c) => c.isNode())
    const minX = Math.min(...nodes.map((n) => n.getPosition().x))
    const minY = Math.min(...nodes.map((n) => n.getPosition().y))
    cells = graph.paste({
      offset: { dx: pasteTarget.x - minX, dy: pasteTarget.y - minY },
    })
    setPasteTarget(pasteTarget.x + PASTE_OFFSET, pasteTarget.y + PASTE_OFFSET)
  } else {
    cells = graph.paste({ offset: PASTE_OFFSET })
  }
  graph.resetSelection(cells)
  return true
}

function pasteUpHandler() {
  setFirstTimePaste(true)
}

function cutHandler() {
  const graph = useGraphStore.getState().graph
  const cells = graph.getSelectedCells()
  if (cells.length) {
    graph.cut(cells)
    graph.resetSelection([])
  }
}

function removeHandler() {
  const graph = useGraphStore.getState().graph
  const cells = graph.getSelectedCells()
  if (cells.length) {
    graph.removeCells(cells)
    graph.resetSelection([])
  }
}

function selectAllHandler() {
  const graph = useGraphStore.getState().graph
  const cells = graph.getCells()
  if (cells.length) graph.resetSelection(cells)
}

function zoomToFitWithVirtual(graph: GraphType): void {
  interactiveService.zoomToFitWithVirtual(graph, {
    scaleGrid: 0.05,
    padding: 20,
  })
}

// ── Space 键闭包 ────────────────────────────────────────────────────────────

function createSpaceHandlers() {
  function used(fn: () => void) {
    return () => {
      if (!spaceHeld) return false
      setSpaceComboUsed(true)
      fn()
      return false
    }
  }

  const panHandler = (dir: ArrowDir) =>
    used(() => {
      const scroller = useGraphStore
        .getState()
        .graph.getPlugin<Scroller>('scroller')
      if (!scroller) return
      const { left, top } = scroller.getScrollbarPosition()
      scroller.setScrollbarPosition(
        left + STEP[dir].dx * 5,
        top + STEP[dir].dy * 5,
      )
    })

  return {
    down() {
      setSpaceComboUsed(false)
      setSpaceHeld(true)
    },
    up() {
      setSpaceHeld(false)
      if (!spaceComboUsed) {
        zoomToFitWithVirtual(useGraphStore.getState().graph)
      }
    },
    panLeft: panHandler('left'),
    panRight: panHandler('right'),
    panUp: panHandler('up'),
    panDown: panHandler('down'),
    zoomIn: used(() => useGraphStore.getState().graph.zoom(0.1)),
    zoomOut: used(() => useGraphStore.getState().graph.zoom(-0.1)),
    zoomReset: used(() => useGraphStore.getState().graph.zoomTo(1)),
    zoomToFit: used(() => zoomToFitWithVirtual(useGraphStore.getState().graph)),
    zoomToSelection: used(() => {
      const graph = useGraphStore.getState().graph
      const cells =
        graph.getPlugin<Selection>('selection')?.getSelectedCells() ?? []
      if (cells.length > 0) {
        graph.zoomToRect(graph.getCellsBBox(cells)!, {
          padding: 20,
        })
      }
    }),
  }
}

// ── registerKeys ─────────────────────────────────────────────────────────────

type KeyEntry = [
  keys: string | string[],
  handler: () => void,
  eventType?: 'keydown' | 'keyup' | 'keypress',
]

function registerKeys(graph: GraphType, entries: KeyEntry[]) {
  for (const [keys, handler, eventType] of entries) {
    graph.bindKey(
      keys,
      function () {
        // 编辑态：不执行 handler，不 return false（避免 Mousetrap 调 preventDefault）
        if (isEditingElement()) return
        handler()
        return false
      },
      eventType,
    )
  }
}

export { createAndSetupGraph, isConnectionValid, pasteAndSelect }
