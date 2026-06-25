import {
  Clipboard,
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
} from '@/assets/constant'
import { previewLink } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import { mergeToSubsystem } from '@/services/subsystem-service'
import {
  isSelectionByKey,
  pasteTarget,
  setIsSelectionByKey,
  setPasteTarget,
} from '@/store/flags'
import { useGraphStore } from '@/store/graphStore'
import { openAutoPan } from '@/utils/plugin/openAutoPan'
import { registerRatioAnchorTool } from '@/utils/plugin/ratioAnchorTool'
import { registerSimulinkSegmentsTool } from '@/utils/plugin/segmentsTool'
import { _patchScrollerOnUpdate } from '@/utils/plugin/X6patch'
import type { Graph as GraphType } from '@antv/x6'

const commonService = createCommonService()
const interactiveService = createInteractiveService()

// 模块级 Ctrl 键状态，供 interacting 回调使用
let ctrlHeld = false
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Control') ctrlHeld = true
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Control') ctrlHeld = false
  })
}

// ── 主入口 ──────────────────────────────────────────────────────────────────

function createAndSetupGraph(
  container: HTMLElement,
  onScale: (zoom: number) => void,
): GraphType {
  const graph = createGraph(container)
  setupDevTools(graph)
  graph.on('scale', ({ sx }: { sx: number }) => {
    onScale(Math.round(sx * 100))
  })
  registerPlugins(graph)
  registerKeyBindings(graph)
  graph.getPlugin<Scroller>('scroller')!.centerPoint(500, 500)
  openAutoPan(graph)
  return graph
}

// ── Graph 实例创建 ────────────────────────────────────────────────────────────

function createGraph(container: HTMLElement): GraphType {
  return new Graph({
    container,
    autoResize: true,
    connecting: {
      allowNode: false,
      allowEdge: false,
      allowMulti: true,
      allowLoop: false,
      sourceConnectionPoint: {
        name: 'anchor',
        args: {
          offset: -EDGE_TARGET_CP_OFFSET + 5,
        },
      },
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
      router: {
        name: 'manhattan',
      },
      createEdge() {
        return new Shape.Edge(previewLink)
      },
      highlight: true,
      validateConnection({
        sourceCell,
        targetCell,
        sourcePort,
        targetPort,
        edge,
      }) {
        if (!sourceCell || !targetCell || !targetPort) return true

        // 从 edge 拉出新线：sourceCell 是 Edge，无 sourcePort
        // 只需验证目标端口是 in 方向且未被占用
        if (sourceCell.isEdge()) {
          const tgtDir = commonService.getPortGroup(
            (targetCell as Node).getPort(targetPort),
          )
          if (tgtDir !== 'in') return false
          const targetEdges =
            targetCell.model?.getConnectedEdges(targetCell) ?? []
          return !targetEdges.some(
            (e) =>
              e !== edge &&
              (e.getSourcePortId() === targetPort ||
                e.getTargetPortId() === targetPort),
          )
        } else if (sourceCell.isNode()) {
          // 从 node 端口创建/重连：sourceCell 是 Node
          if (!sourcePort || !targetPort) return true
          const srcDir = commonService.getPortGroup(
            (sourceCell as Node).getPort(sourcePort),
          )
          const tgtDir = commonService.getPortGroup(
            (targetCell as Node).getPort(targetPort),
          )
          if (!srcDir || !tgtDir) {
            console.warn(
              '[validateConnection] port group 未定义，无法验证连接合法性',
              { sourceCell, targetCell, sourcePort, targetPort },
            )
          }
          // 只允许 out → in
          if (srcDir !== 'out' || tgtDir !== 'in') return false
        }

        // 每个端口只允许一条连接（重连时排除当前 edge）
        const sourceEdges =
          sourceCell.model?.getConnectedEdges(sourceCell) ?? []
        const targetEdges =
          targetCell.model?.getConnectedEdges(targetCell) ?? []
        const sourceBusy = sourceEdges.some(
          (e) =>
            e !== edge &&
            (e.getSourcePortId() === sourcePort ||
              e.getTargetPortId() === sourcePort),
        )
        const targetBusy = targetEdges.some(
          (e) =>
            e !== edge &&
            (e.getSourcePortId() === targetPort ||
              e.getTargetPortId() === targetPort),
        )
        return !sourceBusy && !targetBusy
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
    mousewheel: {
      enabled: true,
      modifiers: ['ctrl', 'meta'],
      factor: 1.1,
    },
    panning: false,
    virtual: false,
    interacting: (cellView) => {
      if (cellView.cell.isEdge()) {
        return { edgeMovable: ctrlHeld }
      }
      return {}
    },
  })
}

// ── 插件注册 ──────────────────────────────────────────────────────────────────

registerRatioAnchorTool()
registerSimulinkSegmentsTool()

function registerPlugins(graph: GraphType) {
  graph.use(new Snapline({ enabled: true, sharp: true }))
  graph.use(new Export())
  graph.use(
    new Selection({
      enabled: true,
      multiple: true,
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
    pageWidth: 1000,
    pageHeight: 1000,
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
      minWidth: 30,
      maxWidth: 200,
      minHeight: 30,
      maxHeight: 150,
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

// ── 行为标志位 ──────────────────────────────────────────────────────────────

let firstTimePaste = true
let spaceHeld = false

// ── 快捷键 handler ──────────────────────────────────────────────────────────

function copyHandler() {
  const graph = useGraphStore.getState().graph
  const cells = graph.getSelectedCells()
  if (cells.length) graph.copy(cells)
}

function pasteHandler() {
  if (!firstTimePaste) return
  const graph = useGraphStore.getState().graph
  if (graph.isClipboardEmpty()) return
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
  firstTimePaste = false
}

function pasteUpHandler() {
  firstTimePaste = true
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
  let comboUsed = false

  function used(fn: () => void) {
    return () => {
      if (!spaceHeld) return false
      comboUsed = true
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
      comboUsed = false
      spaceHeld = true
    },
    up() {
      spaceHeld = false
      if (!comboUsed) {
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

export { createAndSetupGraph }
