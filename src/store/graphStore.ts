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
  Snapline,
  Transform,
} from '@antv/x6'
import { create } from 'zustand'
import { openAutoPan } from '@/plugin/openAutoPan'
import { createCommonService } from '@/services/common-service'
import { useSubGraphStore } from '@/store/subGraphStore'

const commonService = createCommonService()

interface GraphStore {
  graph: GraphType
  zoom: number
  /** 空白处点击记录的粘贴目标位置 */
  pasteTarget: { x: number; y: number } | null
  /** 在挂载的容器上创建 Graph 并完成所有初始化 */
  initGraph: (container: HTMLElement) => void
  /** 销毁 Graph 实例 */
  destroyGraph: () => void
  setZoom: (zoom: number) => void
  setPasteTarget: (pos: { x: number; y: number } | null) => void
  /** 长按允许粘贴一次  */
  firstTimePaste: boolean
}

const useGraphStore = create<GraphStore>((set, get) => ({
  // TS检查越狱
  graph: null as unknown as GraphType,
  zoom: 100,
  pasteTarget: null,
  firstTimePaste: true,

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
          name: 'manhattan',
          args: {
            step: 10,
            padding: 30,
            excludeTerminals: ['source', 'target'],
            startDirections: ['right'],
            endDirections: ['left'],
          },
        },
        connector: { name: 'rounded', args: { radius: 8 } },
      },
      grid: { visible: true, size: 15, type: 'dot' },
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
        showEdgeSelectionBox: true,
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
    graph.bindKey(['ctrl+y', 'meta+shift+z', 'ctrl+shift+z'], () => {
      graph.redo()
      return false
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
}))

export { useGraphStore }
