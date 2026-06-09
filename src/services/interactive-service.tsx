import { createRoot } from 'react-dom/client'
import {
  RED,
  SOURCE_ARROWHEAD_STROKE_WIDTH,
  TARGET_ARROWHEAD_STROKE_WIDTH,
} from '@/assets/constant'
import { BlockParamModal } from '@/components/ParamModal'
import { useGraphStore } from '@/store/graphStore'
import type { Cell, Edge, EdgeView, Graph, Node } from '@antv/x6'
import type { ScaleContentToFitOptions } from '@antv/x6'

function createInteractiveService() {
  function addOutline(cell: Cell) {
    if (cell.isNode()) {
      cell.attr('body/filter', null, { undo: false })
      cell.attr(
        'body/filter',
        {
          name: 'outline',
          args: { color: 'rgb(102,194,255)', width: 4, margin: 0 },
        },
        { undo: false },
      )
    } else if (cell.isEdge()) {
      cell.attr(
        'line/filter',
        {
          name: 'outline',
          args: { color: 'rgb(102,194,255)', width: 2, margin: 0 },
          attrs: {
            filterUnits: 'userSpaceOnUse',
            x: -9999,
            y: -9999,
            width: 19998,
            height: 19998,
          },
        },
        { undo: false },
      )
    }
  }
  /**
   * @add 取消节点outline添加阴影
   * @param cell 处理的 Cell
   */
  function removeOutline(cell: Cell) {
    if (cell.isNode())
      cell.attr(
        'body/filter',
        {
          name: 'dropShadow',
          args: {
            dx: 2.5,
            dy: 2.5,
            blur: 1.25,
            color: 'black',
            opacity: 0.55,
          },
        },
        { undo: false },
      )
    else if (cell.isEdge()) cell.attr('line/filter', null, { undo: false })
  }

  /**
   * @param cell 目标元素
   * @description 在节点上添加边界工具，不加入undoStack
   */
  function addBoundaryTool(cell: Cell) {
    cell.addTools(
      {
        name: 'boundary',
        args: {
          padding: 5,
          attrs: {
            fill: '#7c68fc',
            stroke: '#333',
            strokeWidth: 0.5,
            fillOpacity: 0.2,
          },
        },
      },
      { undo: false },
    )
  }

  function addEdgeTools(edge: Edge) {
    const graph = useGraphStore.getState().graph
    const isPreview = edge.getAttrs()?.line?.stroke === RED

    // 将 X6 视图层动态计算的折点物化为模型 vertices
    // 仅对正式连线处理；previewLink（红色临时线）不物化，避免影响后续连接的寻线结果
    // const edgeView = graph.findViewByCell(edge) as EdgeView
    // if (
    //   !isPreview &&
    //   !edge.getRouter() &&
    //   edge.getVertices().length === 0 &&
    //   edgeView?.routePoints
    // ) {
    //   const pts = edgeView.routePoints
    //   // routePoints 已是纯中间折点，不含 source/target
    //   const intermediates = pts.map((p) => ({ x: p.x, y: p.y }))
    //   if (intermediates.length > 0) {
    //     edge.setVertices(intermediates, { undo: false })
    //     edge.setRouter('orth', { undo: false })
    //   }
    // }

    const sourceCell = graph.getCellById(edge.getSourceCellId())
    const isBranchEdge = sourceCell.isEdge()
    const tools = []
    if (isBranchEdge) {
      tools.push({ name: 'ratio-anchor' })
    } else {
      tools.push({
        name: 'source-arrowhead',
        args: {
          attrs: {
            d: 'M -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0',
            fill: 'white',
            stroke: 'black',
            cursor: 'move',
            'stroke-width': SOURCE_ARROWHEAD_STROKE_WIDTH,
          },
        },
      })
    }
    tools.push(
      {
        name: 'target-arrowhead',
        args: {
          // ratio: isPreview ? 1 : 1,
          attrs: {
            // 使用 d 反转箭头 防止嵌入 Block 造成预期行为错乱
            ...(isPreview ? {} : { d: 'M 0 -8 -18 0 0 8 Z' }),
            fill: 'transparent',
            stroke: 'transparent',
            'stroke-width': TARGET_ARROWHEAD_STROKE_WIDTH,
            cursor: 'move',
          },
        },
      },
      // {
      //   name: 'vertices',
      //   args: {
      //     addable: false,
      //     removable: false,
      //     attrs: { fill: 'transparent', stroke: 'transparent' },
      //     processHandle(handle: {
      //       container: SVGElement
      //       setAttrs: (attrs: Record<string, unknown>) => void
      //     }) {
      //       handle.container.addEventListener('mouseenter', () => {
      //         handle.setAttrs({ fill: 'green', stroke: '#fff' })
      //       })
      //       handle.container.addEventListener('mouseleave', () => {
      //         handle.setAttrs({ fill: 'transparent', stroke: 'transparent' })
      //       })
      //     },
      //   },
      // },
      // {
      //   name: 'simulink-segments',
      // },
    )
    edge.addTools(tools, { undo: false })
  }

  /**
   * 命令式打开模块参数弹窗，无需在组件树中挂载占位符
   */
  function openBlockParamModal(node: Node) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const destroy = () => {
      requestAnimationFrame(() => {
        root.unmount()
        container.remove()
      })
    }

    root.render(<BlockParamModal node={node} onDestroy={destroy} />)
  }

  /**
   * zoomToFit with virtual render support.
   * Temporarily disables virtual rendering & async to ensure all cell views are
   * in the DOM so useCellGeometry:false can read the full visual bounding box.
   */
  function zoomToFitWithVirtual(
    graph: Graph,
    options?: ScaleContentToFitOptions,
  ) {
    graph.options.async = false
    graph.disableVirtualRender()
    ;(graph as any).renderer.schedule.renderViews(graph.getCells())
    graph.zoomToFit({
      useCellGeometry: false,
      ...options,
    })
    graph.options.async = true
    graph.enableVirtualRender()
  }

  return {
    addOutline,
    removeOutline,
    addBoundaryTool,
    addEdgeTools,
    openBlockParamModal,
    zoomToFitWithVirtual,
  }
}

export { createInteractiveService }
