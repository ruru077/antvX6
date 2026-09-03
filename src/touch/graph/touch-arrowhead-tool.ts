import { Dom, Graph, Point, ToolItem } from '@antv/x6'
import sourceAnchorCursor from '@/assets/source-anchor-cursor.png'
import type {
  EdgeView,
  EventDataArrowheadDragging,
  SimpleAttrs,
} from '@antv/x6'

const TOUCH_SOURCE_ARROWHEAD_TOOL = 'touch-source-arrowhead'
const TOUCH_TARGET_ARROWHEAD_TOOL = 'touch-target-arrowhead'

type ArrowheadType = 'source' | 'target'

type PublicToolItemOptions = NonNullable<
  ConstructorParameters<typeof ToolItem>[0]
>

interface PointerArrowheadOptions extends PublicToolItemOptions {
  attrs?: SimpleAttrs
  type?: ArrowheadType
  ratio?: number
}

interface ArrowheadLifecycleView {
  fallbackConnection: (data: EventDataArrowheadDragging) => void
  afterArrowheadDragging: (data: EventDataArrowheadDragging) => void
}

const draggingGraphs = new WeakSet<Graph>()

class PointerArrowheadTool extends ToolItem<EdgeView, PointerArrowheadOptions> {
  static defaults: PointerArrowheadOptions = {
    ...ToolItem.getDefaults<PointerArrowheadOptions>(),
    tagName: 'path',
    isSVGElement: true,
    events: {
      pointerdown: 'onPointerDown',
    },
    documentEvents: {
      pointermove: 'onPointerMove',
      pointerup: 'onPointerUp',
      pointercancel: 'onPointerCancel',
    },
  }

  private activePointerId: number | null = null
  private batchActive = false
  private graphEventsSuspended = false
  private dragData: EventDataArrowheadDragging | null = null

  protected get type() {
    return this.options.type!
  }

  protected get ratio() {
    return this.options.ratio!
  }

  protected init() {
    if (this.options.attrs) {
      const { class: className, ...attrs } = this.options.attrs
      this.setAttrs(attrs, this.container)
      if (className) Dom.addClass(this.container, String(className))
    }
    this.container.style.touchAction = 'none'
  }

  protected onRender() {
    Dom.addClass(
      this.container,
      this.prefixClassName(`edge-tool-${this.type}-arrowhead`),
    )
    this.update()
  }

  update() {
    const tangent = this.cellView.getTangentAtRatio(this.ratio)
    const position = tangent
      ? tangent.start
      : this.cellView.getPointAtRatio(this.ratio)
    const angle =
      (tangent && tangent.vector().vectorAngle(new Point(1, 0))) || 0

    if (!position) return this

    const matrix = Dom.createSVGMatrix()
      .translate(position.x, position.y)
      .rotate(angle)
    Dom.transform(this.container as SVGElement, matrix, { absolute: true })
    return this
  }

  protected onPointerDown(evt: Dom.EventObject) {
    const pointerEvent = evt.originalEvent as PointerEvent
    if (
      this.guard(evt) ||
      pointerEvent.isPrimary === false ||
      pointerEvent.button !== 0
    )
      return

    evt.stopPropagation()
    evt.preventDefault()

    if (!this.cellView.can('arrowheadMovable')) return

    this.activePointerId = pointerEvent.pointerId

    try {
      this.cellView.cell.startBatch('move-arrowhead', {
        ui: true,
        toolId: this.cid,
      })
      this.batchActive = true

      const coords = this.graph.snapToGrid(
        pointerEvent.clientX,
        pointerEvent.clientY,
      )
      const data = this.cellView.prepareArrowheadDragging(this.type, {
        x: coords.x,
        y: coords.y,
        options: {
          ...this.options,
          toolId: this.cid,
        },
      })
      this.dragData = data
      this.cellView.setEventData(evt, data)
      this.delegateDocumentEvents(this.options.documentEvents!, evt.data)
      this.graph.view.undelegateEvents()
      this.graphEventsSuspended = true
      this.container.style.pointerEvents = 'none'
      draggingGraphs.add(this.graph)
      this.focus()
    } catch (error) {
      this.restoreInitialTerminal()
      this.cleanupDragging()
      throw error
    }
  }

  protected onPointerMove(evt: Dom.EventObject) {
    const pointerEvent = evt.originalEvent as PointerEvent
    if (pointerEvent.pointerId !== this.activePointerId) return

    evt.stopPropagation()
    evt.preventDefault()
    const coords = this.graph.snapToGrid(
      pointerEvent.clientX,
      pointerEvent.clientY,
    )
    this.cellView.onMouseMove(evt as Dom.MouseMoveEvent, coords.x, coords.y)
    this.update()
  }

  protected onPointerUp(evt: Dom.EventObject) {
    this.finishDragging(evt)
  }

  protected onPointerCancel(evt: Dom.EventObject) {
    const pointerEvent = evt.originalEvent as PointerEvent
    if (pointerEvent.pointerId !== this.activePointerId) return

    evt.stopPropagation()
    evt.preventDefault()
    this.undelegateDocumentEvents()

    try {
      // pointercancel 表示系统取消手势，必须恢复拖动前的 terminal，不能走正常提交路径。
      this.restoreInitialTerminal()
    } finally {
      this.cleanupDragging()
    }
  }

  private finishDragging(evt: Dom.EventObject) {
    const pointerEvent = evt.originalEvent as PointerEvent
    if (pointerEvent.pointerId !== this.activePointerId) return

    evt.stopPropagation()
    evt.preventDefault()
    this.undelegateDocumentEvents()

    try {
      const coords = this.graph.snapToGrid(
        pointerEvent.clientX,
        pointerEvent.clientY,
      )
      this.cellView.onMouseUp(evt as Dom.MouseUpEvent, coords.x, coords.y)
    } finally {
      this.cleanupDragging()
    }
  }

  private restoreInitialTerminal() {
    const data = this.dragData
    if (!data) return

    // X6 没有公开 cancelArrowheadDragging；复用其已安装的 revert/after 生命周期，
    // 恢复 initialTerminal、zIndex、pointerEvents，并清理端口高亮。
    const lifecycleView = this.cellView as EdgeView & ArrowheadLifecycleView
    lifecycleView.fallbackConnection(data)
    lifecycleView.afterArrowheadDragging(data)
    this.dragData = null
  }

  private cleanupDragging() {
    const restoreGraphEvents = this.graphEventsSuspended
    const stopBatch = this.batchActive
    this.graphEventsSuspended = false
    this.batchActive = false
    this.activePointerId = null
    this.dragData = null
    draggingGraphs.delete(this.graph)

    try {
      this.undelegateDocumentEvents()
      if (restoreGraphEvents) this.graph.view.delegateEvents()
    } finally {
      this.container.style.pointerEvents = ''
      try {
        this.blur()
      } finally {
        if (stopBatch) {
          this.cellView.cell.stopBatch('move-arrowhead', {
            ui: true,
            toolId: this.cid,
          })
        }
      }
    }
  }
}

class TouchSourceArrowheadTool extends PointerArrowheadTool {
  static defaults: PointerArrowheadOptions = {
    ...PointerArrowheadTool.getDefaults<PointerArrowheadOptions>(),
    name: TOUCH_SOURCE_ARROWHEAD_TOOL,
    type: 'source',
    ratio: 0,
    attrs: {
      d: 'M -7.5 -7.5 H 7.5 V 7.5 H -7.5 Z',
      fill: 'transparent',
      stroke: 'transparent',
      'stroke-width': 2,
      cursor: `url("${sourceAnchorCursor}") 16 16, default`,
    },
  }
}

class TouchTargetArrowheadTool extends PointerArrowheadTool {
  static defaults: PointerArrowheadOptions = {
    ...PointerArrowheadTool.getDefaults<PointerArrowheadOptions>(),
    name: TOUCH_TARGET_ARROWHEAD_TOOL,
    type: 'target',
    ratio: 1,
    attrs: {
      d: 'M -10 -8 10 0 -10 8 Z',
      fill: '#333',
      stroke: '#fff',
      'stroke-width': 2,
      cursor: 'move',
    },
  }
}

function registerTouchArrowheadTools() {
  Graph.registerEdgeTool(
    TOUCH_SOURCE_ARROWHEAD_TOOL,
    TouchSourceArrowheadTool,
    true,
  )
  Graph.registerEdgeTool(
    TOUCH_TARGET_ARROWHEAD_TOOL,
    TouchTargetArrowheadTool,
    true,
  )
}

function isTouchArrowheadDragging(graph: Graph) {
  return draggingGraphs.has(graph)
}

export {
  TOUCH_SOURCE_ARROWHEAD_TOOL,
  TOUCH_TARGET_ARROWHEAD_TOOL,
  isTouchArrowheadDragging,
  registerTouchArrowheadTools,
}
