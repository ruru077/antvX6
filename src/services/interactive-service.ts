import type { Cell, Edge, Graph, Node } from '@antv/x6'
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
    const isPreview = edge.getAttrs()?.line?.stroke === RED
    const sourceCell = useGraphStore
      .getState()
      .graph.getCellById(edge.getSourceCellId())
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
  function openInlineEditor({ graph, node, attrPath, anchorEl }: InlineEditorOptions) {
    const currentText = node.attr<string>(attrPath) ?? ''
    const elRect = anchorEl.getBoundingClientRect()
    const containerRect = graph.container.getBoundingClientRect()
    const scale = graph.scale()

    const input = document.createElement('input')
    input.value = currentText
    Object.assign(input.style, {
      position: 'absolute',
      left: `${elRect.left - containerRect.left}px`,
      top: `${elRect.top - containerRect.top}px`,
      width: `${Math.max(elRect.width, 60)}px`,
      height: `${Math.max(elRect.height, 20)}px`,
      fontSize: `${14 * scale.sx}px`,
      textAlign: 'center',
      border: '1px solid #4096ff',
      outline: 'none',
      zIndex: '9999',
      background: 'white',
      padding: '0 2px',
      boxSizing: 'border-box',
    } as CSSStyleDeclaration)

    const finish = (cancel = false) => {
      if (!input.parentNode) return
      const value = input.value.trim()
      if (!cancel && value !== currentText) {
        node.attr(attrPath, value)
      }
      input.remove()
    }

    input.addEventListener('blur', () => finish())
    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') {
        ke.preventDefault()
        finish()
      }
      if (ke.key === 'Escape') finish(true)
      ke.stopPropagation()
    })

    graph.container.appendChild(input)
    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
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