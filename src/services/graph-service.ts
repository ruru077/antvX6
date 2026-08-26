import {
  Clipboard,
  Export,
  Graph,
  History,
  Scroller,
  Selection,
  Shape,
  Snapline,
  Transform,
} from '@antv/x6'
import {
  EDGE_TARGET_CP_OFFSET,
  GRAPH_GRID,
  SNAP_RADIUS,
  WHEEL_ZOOM_LEVELS,
} from '@/assets/constant'
import { previewLinkAttrs } from '@/assets/x6Model'
import { isConnectionValid } from '@/services/connection-service'
import { createInteractiveService } from '@/services/interactive-service'
import { registerKeyboard } from '@/services/keyboard-service'
import { mergeToSubsystem } from '@/services/subsystem-service'
import { rightEdgeDragging } from '@/store/flags'
import { SUBGRAPH_HISTORY_OPTION } from '@/store/subGraphStore'
import { registerEdgeEditTool } from '@/utils/plugin/EdgeEditTool'
import { openAutoPan } from '@/utils/plugin/openAutoPan'
import { registerRatioAnchorTool } from '@/utils/plugin/ratioAnchorTool'
import { _patchScrollerOnUpdate } from '@/utils/plugin/X6patch'
import type { Edge, Graph as GraphType, Node } from '@antv/x6'

const interactiveService = createInteractiveService()

// ── 主入口 ──────────────────────────────────────────────────────────────────

function createAndSetupGraph(
  container: HTMLElement,
  onScale: (zoom: number) => void,
): GraphType {
  const graph = createGraph(container)
  registerSteppedMouseWheel(graph)
  setupDevTools(graph)
  registerPlugins(graph)
  // Keyboard 的插件安装和快捷键行为由 keyboard-service 统一维护。
  registerKeyboard(graph)
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
/**
 * 定规格监听 mouseWheel
 * @param graph 图实例
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

registerEdgeEditTool()
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
      // 允许在画布空白处拖出矩形框选区域
      rubberband: true,
      // Edge 与框选区域命中时，也将 Edge 加入 Selection
      rubberEdge: true,
      // 为每个选中的 Node 显示独立的 SelectionBox
      showNodeSelectionBox: true,
      // Edge 可以被选中，但不为其显示独立的 SelectionBox
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
        btn.addEventListener('click', async (e) => {
          e.stopPropagation()
          const cells = graph.getSelectedCells()
          await mergeToSubsystem(cells, graph)
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
      revertOptionsList: ['propertyPath', SUBGRAPH_HISTORY_OPTION],
      applyOptionsList: ['propertyPath', SUBGRAPH_HISTORY_OPTION],
      beforeAddCommand(_event, args) {
        if (!args) return
        if ('options' in args && args.options?.undo === false) return false
      },
    }),
  )
}

// ── 开发工具 ──────────────────────────────────────────────────────────────────

function setupDevTools(graph: GraphType) {
  // @ts-expect-error AntV X6 插件
  window.__x6_instances__ = []
  // @ts-expect-error AntV X6 插件
  window.__x6_instances__.push(graph)
}

export { createAndSetupGraph }
