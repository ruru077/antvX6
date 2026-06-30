import type { Cell, Edge, Graph, Node } from '@antv/x6'
import { Input } from 'antd'
import { createRoot } from 'react-dom/client'
import {
  RED,
  SOURCE_ARROWHEAD_STROKE_WIDTH,
  TARGET_ARROWHEAD_STROKE_WIDTH,
} from '@/assets/constant'
import { useGraphStore } from '@/store/graphStore'

type InlineEditorOptions = {
  graph: Graph
  node: Node
  attrPath: string
  anchorEl: SVGElement
}

function createInteractiveService() {
  function addOutline(cell: Cell) {
    if (cell.isNode()) {
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

  function removeOutline(cell: Cell) {
    if (cell.isNode()) cell.attr('body/filter', null, { undo: false })
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
    tools.push({
      name: 'target-arrowhead',
      args: {
        ratio: isPreview ? 1.05 : 0.96,
        attrs: {
          fill: 'transparent',
          stroke: 'transparent',
          'stroke-width': TARGET_ARROWHEAD_STROKE_WIDTH,
          cursor: 'move',
        },
      },
    })
    edge.addTools(tools, { undo: false })
  }

  /**
   * @description 在指定 SVG 文本元素上叠加 inline input，编辑完成后回写 attr
   * @param graph 当前图实例（用于坐标换算和挂载 input）
   * @param node 目标节点
   * @param attrPath X6 attr 路径，如 `label/text`
   * @param anchorEl 用于定位的 SVG 文本元素
   */
  function openInlineEditor({
    graph,
    node,
    attrPath,
    anchorEl,
  }: InlineEditorOptions) {
    const currentText = node.attr<string>(attrPath) ?? ''
    const elRect = anchorEl.getBoundingClientRect()
    const scale = graph.scale()
    const fontSize = 14 * scale.sx
    // 以节点逻辑宽度 × 缩放比作为容器宽度，保证不同缩放下宽度一致
    const scaledNodeWidth = node.getSize().width * scale.sx * 1.2

    const container = document.createElement('div')
    Object.assign(container.style, {
      position: 'fixed',
      left: `${elRect.left + elRect.width / 2}px`,
      top: `${elRect.top}px`,
      transform: 'translateX(-50%)',
      width: `${Math.max(scaledNodeWidth, 100)}px`,
      zIndex: '999',
    })
    document.body.appendChild(container)
    const root = createRoot(container)

    const finish = (cancel: boolean, value: string) => {
      if (!container.parentNode) return
      if (!cancel && value !== currentText) node.attr(attrPath, value)
      root.unmount()
      container.remove()
    }

    root.render(
      <Input.TextArea
        defaultValue={currentText}
        autoSize
        autoFocus
        maxLength={30}
        style={{ fontSize: `${fontSize}px`, textAlign: 'center' }}
        onBlur={(e) => finish(false, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            finish(false, e.currentTarget.value)
          }
          if (e.key === 'Escape') finish(true, currentText)
          e.stopPropagation()
        }}
      />,
    )
  }

  return {
    addOutline,
    removeOutline,
    addBoundaryTool,
    addEdgeTools,
    openInlineEditor,
  }
}

export { createInteractiveService }
