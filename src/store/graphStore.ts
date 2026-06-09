import {
  Cell,
  Clipboard,
  Export,
  Graph,
  History,
  Keyboard,
  Node,
  Rectangle,
  Scroller,
  Selection,
  Shape,
  Snapline,
  Transform,
} from '@antv/x6'
import { debounce } from 'lodash-es'
import { create } from 'zustand'
import {
  EDGE_TARGET_CP_OFFSET,
  GAP_SIZE,
  GRAPH_GRID,
  PASTE_OFFSET,
  SNAP_RADIUS,
} from '@/assets/constant'
import { previewLink } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import {
  isSelectionByKey,
  pasteTarget,
  setIsSelectionByKey,
  setPasteTarget,
} from '@/store/flags'
import { useSubGraphStore } from '@/store/subGraphStore'
import { openAutoPan } from '@/utils/plugin/openAutoPan'
import { registerRatioAnchorTool } from '@/utils/plugin/ratioAnchorTool'
import { registerSimulinkSegmentsTool } from '@/utils/plugin/segmentsTool'
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

// ─────────────────────────────────────────────────────────────────────────────

interface GraphStore {
  graph: GraphType
  /** 在挂载的容器上创建 Graph 并完成所有初始化 */
  initGraph: (container: HTMLElement) => void
  /** 销毁 Graph 实例 */
  destroyGraph: () => void
  // 缩放比
  zoom: number
  setZoom: (zoom: number) => void
}

const useGraphStore = create<GraphStore>((set, get) => ({
  // TS检查越狱
  graph: null as unknown as GraphType,
  zoom: 100,
  initGraph: (container) => {
    const graph = createGraph(container)
    setupDevTools(graph)
    graph.on('scale', ({ sx }: { sx: number }) => {
      get().setZoom(Math.round(sx * 100))
    })
    registerPlugins(graph)
    registerKeyBindings(graph)
    graph.getPlugin<Scroller>('scroller')!.centerPoint(500, 500)
    openAutoPan(graph)
    set({ graph })
  },

  destroyGraph: () => {
    get().graph.dispose()
  },

  setZoom: (zoom) => set({ zoom }),
}))

// ── Graph 实例创建 ────────────────────────────────────────────────────────────

function createGraph(container: HTMLElement): GraphType {
  return new Graph({
    container,
    autoResize: true,
    connecting: {
      allowNode: false, //是否允许连接到Block本体上
      allowEdge: false, //是否允许连接到连线上
      allowMulti: true, //是否允许多条相同的source target
      allowLoop: false, //是否允许自连接
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
      router: {
        name: 'manhattan',
      },
      // ── 拖线时生成的 Edge 默认样式 ────────────────────────────
      createEdge() {
        return new Shape.Edge(previewLink)
      },
    },
    grid: { visible: true, size: GRAPH_GRID, type: 'dot' },
    scaling: { min: 0.5, max: 5 },
    // 🧪BUG: 框架内置 mousewheel 参数过大会导致页面闪烁
    mousewheel: {
      enabled: true,
      modifiers: ['ctrl', 'meta'],
      factor: 1.1,
    },
    panning: false,
    virtual: true,
    interacting: (cellView) => {
      // 按住 Ctrl 时允许 edge 整体移动（用于 branchEdge 拖拽），否则禁用
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
  // graph.use(new AvoidLibRouter(AVOID_ROUTER_OPTIONS))
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
      // pointerEvents: 'none',
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
          useSubGraphStore.getState().mergeToSubsystem(cells)
        })
        return ''
      },
    }),
  )
  graph.use(
    new Scroller({
      enabled: true,
      pannable: true,
      pageWidth: 1000,
      pageHeight: 1000,
      pageBreak: false,
      pageVisible: true,
      autoResizeOptions: {
        useCellGeometry: false,
      },
    }),
  )

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
  // 禁用插件默认的 click 触发，改为 hover 触发
  transformPlugin.disable()

  graph.use(new Clipboard({ enabled: true, useLocalStorage: true }))
  graph.use(
    new History({
      enabled: true,
      /**
       * @custom dev
       * @tips args 配置 {undo : false} 的命令不加入历史记录
       */
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
  // 方向键单独处理（依赖运行时 dir 参数）
  DIRS.forEach((dir) => {
    graph.bindKey(dir, moveKeyHandler(dir))
  })
  // Mousetrap 只把 ctrl/shift/alt/meta 当作修饰键
  const space = createSpaceHandlers()

  registerKeys(graph, [
    // ── 复制 / 粘贴 / 剪切 ──────────────────────────────────
    [['ctrl+c', 'meta+c'], copyHandler],
    [['ctrl+v', 'meta+v'], pasteHandler],
    [['ctrl+v', 'meta+v'], pasteUpHandler, 'keyup'],
    [['ctrl+x', 'meta+x'], cutHandler],
    // ── 删除 / 全选 ─────────────────────────────────────────
    [['delete', 'backspace'], removeHandler],
    [['ctrl+a', 'meta+a'], selectAllHandler],
    // ── Space 单键 ───────────────────────────────────────────
    ['space', space.down],
    ['space', space.up, 'keyup'],
    // ── Space + 方向键 平移画布 ───────────────────────────────
    ['left', space.panLeft],
    ['right', space.panRight],
    ['up', space.panUp],
    ['down', space.panDown],
    // ── Space + 缩放 ────────────────────────────────────────
    ['=', space.zoomIn],
    ['-', space.zoomOut],
    ['0', space.zoomReset],
    // ── Space + 视图适应 ─────────────────────────────────────
    ['g', space.zoomToFit],
    ['f', space.zoomToSelection],
    // ── 撤销 / 重做 ─────────────────────────────────────────
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

// ── 方向键辅助（纯函数） ──────────────────────────────────────────────────────

type ArrowDir = 'up' | 'down' | 'left' | 'right'

const DIRS: ArrowDir[] = ['left', 'right', 'up', 'down']

const STEP: Record<ArrowDir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -GRAPH_GRID },
  down: { dx: 0, dy: GRAPH_GRID },
  left: { dx: -GRAPH_GRID, dy: 0 },
  right: { dx: GRAPH_GRID, dy: 0 },
}
/**
 * 寻找 [current, dir] 方向的下一个节点
 * @param current 当前节点
 * @param dir 方向
 * @returns 下一个节点或 null
 */
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
  // 是否为正在批处理
  let isBatching = false
  const _debounce = debounce(() => {
    useGraphStore.getState().graph.stopBatch('move')
    isBatching = false
  }, 700)
  return () => {
    // space 序列触发期间跳过，避免与 space+方向键 冲突
    if (spaceHeld) return false
    // 没有节点过滤事件
    const graph = useGraphStore.getState().graph
    if (!graph.getNodes().length) return false

    const selectedNodes = graph.getSelectedCells().filter((c) => c.isNode())
    const selectedEdges = graph.getSelectedCells().filter((c) => c.isEdge())
    if (selectedNodes.length > 0 && !isSelectionByKey) {
      // ── 移动模式 ────────────────────────────────────────
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
      // ──没有Cell选中 导航模式 ────────────────────────────────────────
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

// ── 行为标志位（不需要触发 React re-render，模块级变量）────────────────────
/** 粘贴去抖：keydown 首次触发后锁定，keyup 解锁 */
let firstTimePaste = true
/** space 键当前是否处于按下状态，供 moveKeyHandler 跳过误触 */
let spaceHeld = false

// ── 快捷键 handler（模块级，通过 store.getState() 按需取 graph）────────────

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

/** 对所有 cell 做 zoomToFit，关虚拟渲染 + 同步 renderViews 全量创建 view */
function zoomToFitWithVirtual(graph: GraphType): void {
  interactiveService.zoomToFitWithVirtual(graph, {
    scaleGrid: 0.05,
    padding: 20,
  })
}

// ── Space 键闭包 ────────────────────────────────────────────────────────────
/**
 * - 单键：space keyup → zoomToFit
 * - 组合键：space+G/F/方向键/+/-/0 → 触发对应动作并阻止 keyup 时的 zoomToFit
 */
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
    // ── Space + 方向键 平移画布 ───────────────────────────────
    panLeft: panHandler('left'),
    panRight: panHandler('right'),
    panUp: panHandler('up'),
    panDown: panHandler('down'),
    // ── 缩放 ──────────────────────────────────────────────
    zoomIn: used(() => useGraphStore.getState().graph.zoom(0.1)),
    zoomOut: used(() => useGraphStore.getState().graph.zoom(-0.1)),
    zoomReset: used(() => useGraphStore.getState().graph.zoomTo(1)),
    // ── 视图适应 ──────────────────────────────────────────
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
/**
 * 批量注册快捷键，每条 entry 为 `[keys, handler, eventType?]`。
 * handler 统一用 `function` 具名声明，自动追加 `return false`。
 */
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
        handler()
        return false
      },
      eventType,
    )
  }
}

export { useGraphStore }
