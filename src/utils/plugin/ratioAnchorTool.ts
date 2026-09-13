import { Dom, Graph, ToolItem } from '@antv/x6'
import { SOURCE_ARROWHEAD_STROKE_WIDTH } from '@/assets/constant'
import { setActiveToolEdgeId } from '@/store/flags'
import { setHoverEdgeToolsVisible } from '@/utils/plugin/edgeToolVisibility'
import type { Edge, EdgeView } from '@antv/x6'
import type { ToolItemOptions } from '@antv/x6/lib/view/tool/tool-item'

interface RatioAnchorOptions extends ToolItemOptions {
  r?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
}

type SourceWithRatioAnchor = {
  cell?: string
  anchor?: { name: string; args?: { ratio?: number } }
}

/**
 * 自定义边工具：仅允许拖拽修改 source ratio 锚点位置，
 * 不允许改变 source 连接对象（不会触发 prepareArrowheadDragging）
 */
class RatioAnchorTool extends ToolItem<EdgeView, RatioAnchorOptions> {
  static defaults: RatioAnchorOptions = {
    ...ToolItem.getDefaults<RatioAnchorOptions>(),
    name: 'ratio-anchor',
    tagName: 'circle',
    isSVGElement: true,
    r: 5,
    fill: 'white',
    stroke: 'black',
    strokeWidth: SOURCE_ARROWHEAD_STROKE_WIDTH,
    events: {
      mousedown: 'onMouseDown',
      touchstart: 'onMouseDown',
    },
    documentEvents: {
      mousemove: 'onMouseMove',
      touchmove: 'onMouseMove',
      mouseup: 'onMouseUp',
      touchend: 'onMouseUp',
      touchcancel: 'onMouseUp',
    },
  }

  protected init() {
    const { r, fill, stroke, strokeWidth } = this.options
    Dom.attr(this.container as SVGElement, {
      r: r ?? 5,
      fill: fill ?? 'white',
      stroke: stroke ?? 'black',
      'stroke-width': strokeWidth ?? SOURCE_ARROWHEAD_STROKE_WIDTH,
      cursor: 'move',
    })
  }

  protected onRender() {
    this.update()
  }

  update() {
    const edge = this.cell as unknown as Edge
    const source = edge.getSource() as SourceWithRatioAnchor
    if (!source?.cell) return this

    const ratio = source.anchor?.args?.ratio ?? 0
    const parentEdge = this.graph.getCellById(source.cell) as Edge | undefined
    if (!parentEdge) return this

    const parentEdgeView = this.graph.findViewByCell(parentEdge) as
      | EdgeView
      | undefined
    if (!parentEdgeView) return this

    const point = parentEdgeView.getPointAtRatio(ratio)
    if (!point) return this

    Dom.attr(this.container as SVGElement, { cx: point.x, cy: point.y })
    return this
  }

  protected onMouseDown(evt: Dom.MouseDownEvent) {
    if (this.guard(evt)) return
    evt.stopPropagation()
    evt.preventDefault()
    this.delegateDocumentEvents(
      (this.options as ToolItemOptions).documentEvents!,
      evt.data,
    )
    ;(this.container as HTMLElement).style.pointerEvents = 'none'
  }

  protected onMouseMove(evt: Dom.MouseMoveEvent) {
    const e = this.normalizeEvent(evt)
    const local = this.graph.clientToLocal(e.clientX, e.clientY)

    const edge = this.cell as unknown as Edge
    const source = edge.getSource() as SourceWithRatioAnchor
    if (!source?.cell) return

    const parentEdge = this.graph.getCellById(source.cell) as Edge | undefined
    if (!parentEdge) return

    const parentEdgeView = this.graph.findViewByCell(parentEdge) as
      | EdgeView
      | undefined
    if (!parentEdgeView) return

    const newRatio = parentEdgeView.getClosestPointRatio(local)
    if (newRatio == null) return

    this.cell.prop('source/anchor/args/ratio', newRatio, {
      ui: true,
      undo: false,
    })
    this.update()
  }

  protected onMouseUp(evt: Dom.MouseUpEvent) {
    this.undelegateDocumentEvents()
    ;(this.container as HTMLElement).style.pointerEvents = ''
    // 拖拽结束后，若鼠标已离开 edge 容器则隐藏 hover 工具
    const e = this.normalizeEvent(evt)
    const target = document.elementFromPoint(e.clientX, e.clientY)
    const edgeView = this.graph.findViewByCell(this.cell)
    if (edgeView && target && !edgeView.container.contains(target)) {
      setActiveToolEdgeId(null)
      setHoverEdgeToolsVisible(this.graph, this.cell.id, false)
    }
  }
}

function registerRatioAnchorTool() {
  Graph.registerEdgeTool('ratio-anchor', RatioAnchorTool, true)
}

export { registerRatioAnchorTool }
