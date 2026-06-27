import { StringExt } from '@antv/x6'
import { Input } from 'antd'
import { createRoot } from 'react-dom/client'
import {
  RED,
  SOURCE_ARROWHEAD_STROKE_WIDTH,
  TARGET_ARROWHEAD_STROKE_WIDTH,
} from '@/assets/constant'
import { AddBlockModal } from '@/components/AddBlockModal'
import { BlockParamModal, SubsystemParamModal } from '@/components/Modal'
import { hasSubsystemMask } from '@/services/subsystem-service'
import { useGraphStore } from '@/store/graphStore'
import type { Cell, Edge, EdgeView, Graph, Node } from '@antv/x6'
import type { ScaleContentToFitOptions } from '@antv/x6'
import type { Block } from '~/types/vo/block'

// ── Label 就地编辑器（antd Input 浮层）──────────────────────────────────────

/**
 * 双击节点 label 时弹出的浮动输入框。
 * 读取 node.attr('label/text') 作为初始值，失焦/回车写回，Escape 取消。
 */
function LabelEditor({
  node,
  rect,
  onDestroy,
}: {
  node: Node
  rect: DOMRect
  onDestroy: () => void
}) {
  const initialValue = node.attr<string>('label/text') ?? ''
  const [value, setValue] = useState(initialValue)

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed !== initialValue) {
      node.attr('label/text', trimmed)
    }
    onDestroy()
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: Math.max(rect.width, 80),
        zIndex: 9999,
      }}
    >
      <Input
        size="small"
        value={value}
        autoFocus
        onFocus={(e) => e.target.select()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onPressEnter={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDestroy()
        }}
      />
    </div>
  )
}

function createInteractiveService() {
  function getFilterWidth(width: number) {
    const zoom = useGraphStore.getState().graph?.zoom() || 1
    return Number((width / zoom).toFixed(3))
  }

  function addOutline(cell: Cell) {
    if (cell.isNode()) {
      cell.attr('body/filter', null, { undo: false })
      cell.attr(
        'body/filter',
        {
          name: 'outline',
          args: {
            color: 'rgb(102,194,255)',
            width: getFilterWidth(4),
            margin: 0,
          },
        },
        { undo: false },
      )
    } else if (cell.isEdge()) {
      cell.attr(
        'line/filter',
        {
          name: 'outline',
          args: {
            color: 'rgb(102,194,255)',
            width: getFilterWidth(2),
            margin: 0,
          },
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
   * 统一节点参数弹窗入口。
   * - 已封装子系统 → SubsystemParamModal（读取 maskParam）
   * - 其他 block → BlockParamModal（读取 paramValues）
   * 注：子系统未封装时由 useGraphListener 直接进入子系统，不经过此方法
   */
  function openNodeModal(node: Node) {
    const ModalComponent = hasSubsystemMask(node)
      ? SubsystemParamModal
      : BlockParamModal

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const destroy = () => {
      requestAnimationFrame(() => {
        root.unmount()
        container.remove()
      })
    }

    root.render(<ModalComponent node={node} onDestroy={destroy} />)
  }

  /**
   * 双击节点 label 文本时，在文本位置浮动 antd Input 就地编辑。
   * 失焦/回车写回 node.attr('label/text')，Escape 取消。
   */
  function openLabelEditor(node: Node, textEl: Element) {
    const rect = textEl.getBoundingClientRect()

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const destroy = () => {
      requestAnimationFrame(() => {
        root.unmount()
        container.remove()
      })
    }

    root.render(<LabelEditor node={node} rect={rect} onDestroy={destroy} />)
  }

  /**
   * 根据 Block 元数据创建节点并添加到画布指定位置（居中于点击点）
   * 复用 stencil getDragNode 的后处理逻辑：端口 ID 唯一化、尺寸兜底、阴影
   */
  function addNodeFromBlock(block: Block, x: number, y: number): void {
    const graph = useGraphStore.getState().graph
    if (!graph) return

    const node = graph.createNode(block)

    // 阴影（新节点默认外观）
    removeOutline(node)

    // 子系统不做端口/尺寸处理，方便解构
    if (node.getData()?.blockType !== 'Subsystem') {
      // 更新 port id 确保唯一性
      node.getPorts().forEach((port) => {
        if (port.id) node.portProp(port.id, 'id', StringExt.uuid())
      })
      // 宽高相等时设为最小 60×60
      const { width, height } = node.getSize()
      if (width === height) {
        node.size(Math.max(60, width), Math.max(60, height))
      }
    }

    // 居中于双击位置
    const { width, height } = node.getSize()
    node.setPosition(x - width / 2, y - height / 2)

    graph.addNode(node)
  }

  /**
   * 命令式打开"添加模块"浮动面板，双击画布空白处触发
   * @param graphX 画布坐标 X（用于节点放置）
   * @param graphY 画布坐标 Y（用于节点放置）
   * @param screenX 屏幕坐标 X（用于面板定位，clientX）
   * @param screenY 屏幕坐标 Y（用于面板定位，clientY）
   */
  function openAddBlockModal(
    graphX: number,
    graphY: number,
    screenX: number,
    screenY: number,
  ) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const destroy = () => {
      requestAnimationFrame(() => {
        root.unmount()
        container.remove()
      })
    }

    root.render(
      <AddBlockModal
        screenX={screenX}
        screenY={screenY}
        onDestroy={destroy}
        onSelect={(block) => addNodeFromBlock(block, graphX, graphY)}
      />,
    )
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
    // 兼容非开启 virtual
    if (!graph.options.virtual) {
      graph.zoomToFit({
        useCellGeometry: false,
        ...options,
      })
      return
    }
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
    openNodeModal,
    openLabelEditor,
    openAddBlockModal,
    addNodeFromBlock,
    zoomToFitWithVirtual,
  }
}

export { createInteractiveService }
