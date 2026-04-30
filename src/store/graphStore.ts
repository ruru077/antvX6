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
  routerPresets,
} from '@antv/x6'
import { create } from 'zustand'
import { openAutoPan } from '@/plugin/openAutoPan'
import { useSubGraphStore } from '@/store/subGraphStore'

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
}

const useGraphStore = create<GraphStore>((set, get) => ({
  // TS检查越狱
  graph: null as unknown as GraphType,
  zoom: 100,
  pasteTarget: null,

  initGraph: (container) => {
    const graph = new Graph({
      container,
      autoResize: true,
      background: { color: '#F2F7FA' },
      connecting: {
        router: {
          name: 'manhattan',
          args: {
            step: 15,
            padding: 30,
            draggingRouter: function (_from, _to, options) {
              return routerPresets.orth.call(
                this,
                [],
                { padding: options.padding },
                this,
              )
            },
          },
        },
        connector: { name: 'rounded', args: { radius: 8 } },
      },
      grid: { visible: true, size: 10, type: 'dot' },
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
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
        showNodeSelectionBox: true,
        modifiers: 'shift',
        content(_selection, el) {
          const btn = document.createElement('button')
          btn.className = 'btn-create-subsystem'
          Object.assign(btn.style, {
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 12px',
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
          })
          btn.textContent = '转为子系统'
          btn.onmousedown = (e) => e.stopPropagation()
          btn.onclick = (e) => {
            e.stopPropagation()
            const cells = graph.getSelectedCells() as Node[]
            useSubGraphStore.getState().mergeToSubsystem(cells)
          }
          el.innerHTML = ''
          el.appendChild(btn)
          return ''
        },
      }),
    )
    graph.use(
      new Scroller({
        enabled: true,
        pannable: true,
        pageWidth: 400,
        pageHeight: 400,
        pageBreak: true,
        pageVisible: true,
      }),
    )
    graph.use(
      new Transform({
        resizing: {
          enabled: true,
          minWidth: 20,
          maxWidth: 200,
          minHeight: 20,
          maxHeight: 150,
          orthogonal: false,
          restrict: false,
          preserveAspectRatio: false,
        },
      }),
    )
    graph.use(new Clipboard({ enabled: true }))
    graph.use(new History({ enabled: true }))
    graph.use(new Keyboard({ enabled: true }))

    // ── 快捷键 ───────────────────────────────────────────────────
    graph.bindKey(['ctrl+c', 'meta+c'], () => {
      const cells = graph.getSelectedCells()
      if (cells.length) graph.copy(cells)
      return false
    })
    graph.bindKey(['ctrl+v', 'meta+v'], () => {
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
      }
      return false
    })
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

    graph.centerContent()
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
