import type { Graph as GraphType } from '@antv/x6'
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
  routerPresets,
} from '@antv/x6'
import { debounce } from 'lodash-es'
import { create } from 'zustand'
import { GRAPH_GRID, RED } from '@/assets/constant'
import previewArrowRaw from '@/assets/previewArrow.svg?raw'
import { openAutoPan } from '@/plugin/openAutoPan'
import { createCommonService } from '@/services/common-service'
import { useSubGraphStore } from '@/store/subGraphStore'

const commonService = createCommonService()

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
  /** 是否为第一次粘贴  */
  firstTimePaste: boolean
  /** 空白处点击记录的粘贴目标位置 */
  pasteTarget: { x: number; y: number } | null
  setPasteTarget: (pos: { x: number; y: number } | null) => void
  // 是否为由方向键导航产生的选中
  isSelectionByKey: boolean
  setIsSelectionByKey: (is: boolean) => void
}

const useGraphStore = create<GraphStore>((set, get) => ({
  // TS检查越狱
  graph: null as unknown as GraphType,
  zoom: 100,
  pasteTarget: null,
  firstTimePaste: true,
  isSelectionByKey: false,
  initGraph: (container) => {
    const graph = new Graph({
      container,
      autoResize: true,
      connecting: {
        allowNode: false, //是否允许连接到Block本体上
        allowEdge: false, //是否允许连接到连线上
        allowMulti: true, //是否允许多条相同的source target
        allowLoop: false, //是否允许自连接
        snap: {
          radius: 20,
          anchor: 'bbox',
        },
        router: {
          name: 'orth',
          args: {
            step: GRAPH_GRID,
            // padding: { top: 0, right: 30, bottom: 0, left: 30 },
            // padding: 0,
            // excludeTerminals: ['source', 'target'],
            // startDirections: ['right'],
            // endDirections: ['left'],
            // fallbackRouter: routerPresets.er,
            // 拉线时 target 悬空，endPoints 极易落入障碍物导致 A* 失败
            // 直接返回空顶点（直线）跳过避障，连接后再走完整 manhattan 路由
            // draggingRouter() {
            //   return []
            // },
          },
        },
        connector: {
          name: 'jumpover',
          args: {
            type: 'gap',
            size: 3,
            radius: 8,
          },
        }, // ── 拖线时生成的 Edge 默认样式 ────────────────────────────
        createEdge() {
          return new Shape.Edge({
            attrs: {
              line: {
                stroke: RED,
                strokeWidth: 1.5,
                targetMarker: {
                  name: 'path',
                  d: previewArrowRaw.match(/\bd="([^"]+)"/)?.[1],
                  transform: 'rotate(-90) scale(0.02)',
                },
                strokeDasharray: '4 2',
              },
            },
          })
        },
      },
      grid: { visible: true, size: GRAPH_GRID, type: 'dot' },
      scaling: { min: 0.5, max: 5 },
      // 🧪BUG: 框架内置 mousewheel 参数过大会导致页面闪烁
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
        factor: 1.1,
        minScale: 0.5,
        maxScale: 5,
      },
      panning: false,
      virtual: true,
    })
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
    const DIRS: ArrowDir[] = ['left', 'right', 'up', 'down']

    // ── 基础事件 ────────────────────────────────────────────────
    graph.on('scale', ({ sx }: { sx: number }) => {
      get().setZoom(Math.round(sx * 100))
    })

    // ── 插件 ────────────────────────────────────────────────────
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

    // ── 快捷键 ───────────────────────────────────────────────────
    graph.bindKey(['ctrl+c', 'meta+c'], () => {
      const cells = graph.getSelectedCells()
      if (cells.length) graph.copy(cells)
      return false
    })
    graph.bindKey(['ctrl+v', 'meta+v'], () => {
      if (!get().firstTimePaste) return false
      if (!graph.isClipboardEmpty()) {
        const { pasteTarget, setPasteTarget } = get()
        let cells
        if (pasteTarget) {
          const clipboardCells = graph.getCellsInClipboard()
          const nodes = clipboardCells.filter((c) => c.isNode())
          if (nodes.length) {
            const minX = Math.min(...nodes.map((n) => n.getPosition().x))
            const minY = Math.min(...nodes.map((n) => n.getPosition().y))
            cells = graph.paste({
              offset: { dx: pasteTarget.x - minX, dy: pasteTarget.y - minY },
            })
          }
          setPasteTarget(null)
        } else {
          cells = graph.paste({ offset: 32 })
        }
        graph.resetSelection(cells)
        set({ firstTimePaste: false })
      }
      return false
    })
    graph.bindKey(
      ['ctrl+v', 'meta+v'],
      () => {
        set({ firstTimePaste: true })
        return false
      },
      'keyup',
    )
    graph.bindKey(['ctrl+x', 'meta+x'], () => {
      const cells = graph.getSelectedCells()
      if (cells.length) {
        graph.cut(cells)
        graph.resetSelection([])
      }
      return false
    })
    graph.bindKey(['delete', 'backspace'], () => {
      const cells = graph.getSelectedCells()
      if (cells.length) {
        graph.removeCells(cells)
        graph.resetSelection([])
      }
      return false
    })
    graph.bindKey(['ctrl+a', 'meta+a'], () => {
      const cells = graph.getCells()
      if (cells.length) graph.resetSelection(cells)
      return false
    })
    graph.bindKey(['ctrl+z', 'meta+z'], () => {
      graph.undo()
      return false
    })
    graph.bindKey(['ctrl+y', 'meta+y', 'meta+shift+z', 'ctrl+shift+z'], () => {
      graph.redo()
      return false
    })
    // key up down left right
    DIRS.forEach((dir) => {
      graph.bindKey(dir, moveKeyCallback(dir))
    })
    const scroller = graph.getPlugin<Scroller>('scroller')
    scroller!.centerPoint(1500, 1000)
    openAutoPan(graph)
    set({ graph })
  },

  destroyGraph: () => {
    get().graph.dispose()
  },

  setZoom: (zoom) => set({ zoom }),
  setPasteTarget: (pos) => set({ pasteTarget: pos }),
  setIsSelectionByKey: (is) => set({ isSelectionByKey: is }),
}))

// ── 方向键辅助（纯函数） ──────────────────────────────────────────────────────

type ArrowDir = 'up' | 'down' | 'left' | 'right'

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

function moveKeyCallback(dir: ArrowDir) {
  // 是否为正在批处理
  let isBatching = false
  const _debounce = debounce(() => {
    useGraphStore.getState().graph.stopBatch('move')
    isBatching = false
  }, 700)
  return () => {
    // 没有节点过滤事件
    const graph = useGraphStore.getState().graph
    if (!graph.getNodes().length) return false
    const isSelectionByKey = useGraphStore.getState().isSelectionByKey
    const setIsSelectionByKey = useGraphStore.getState().setIsSelectionByKey

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
      current.removeTools({ undo: false })
      const neighbor = findNeighbor(current, dir) ?? current
      setIsSelectionByKey(true)
      graph.resetSelection([neighbor])
      commonService.addOutline(neighbor)
      commonService.addBoundaryTool(neighbor)
      graph.getPlugin<Scroller>('scroller')?.scrollToCell(neighbor)
    }
    return false
  }
}

export { useGraphStore }
