/* oxlint-disable @typescript-eslint/no-explicit-any */
import { Dom, Graph, Line, Point, View, edgeToolRegistry } from '@antv/x6'
import { createCommonService } from '@/services/common-service'

const DRAG_THRESHOLD = 4
const TERMINAL_STUB_THRESHOLD = 24
const POINT_TOLERANCE = 0.5
const SVG_NS = 'http://www.w3.org/2000/svg'
const commonService = createCommonService()
const primaryModifierKey = commonService.getPrimaryModifeierByDevice()

type SegmentHandleOptions = {
  graph: Graph
  guard: (evt: any) => boolean
  attrs: any
  index?: number
  axis?: 'x' | 'y'
}

type SegmentHandleEventArgs = {
  change: { e: any; handle: SegmentHandle }
  changing: { e: any; handle: SegmentHandle }
  changed: { e: any; handle: SegmentHandle }
}

class SegmentHandle extends View<SegmentHandleEventArgs> {
  public container: SVGRectElement
  public options: SegmentHandleOptions

  private dragging = false
  private removePendingListeners?: () => void

  constructor(options: SegmentHandleOptions) {
    super()
    this.options = options
    this.container = document.createElementNS(SVG_NS, 'rect') as SVGRectElement
    this.render()
    this.delegateEvents({
      mousedown: 'onMouseDown',
      touchstart: 'onMouseDown',
    })
  }

  render() {
    const attrs = this.options.attrs
    this.setAttrs(typeof attrs === 'function' ? attrs(this) : attrs)
    this.addClass(this.prefixClassName('edge-tool-segment'))
  }

  updatePosition(x: number, y: number, angle: number, view: any) {
    const closestPoint =
      view.getClosestPoint(new Point(x, y)) || new Point(x, y)
    let matrix = Dom.createSVGMatrix().translate(closestPoint.x, closestPoint.y)
    if (!closestPoint.equals({ x, y })) {
      const line = new Line(x, y, closestPoint.x, closestPoint.y)
      let deg = line.vector().vectorAngle(new Point(1, 0))
      if (deg !== 0) deg += 90
      matrix = matrix.rotate(deg)
    } else {
      matrix = matrix.rotate(angle)
    }

    this.setAttrs({
      transform: Dom.matrixToTransformString(matrix),
      cursor: angle % 180 === 0 ? 'row-resize' : 'col-resize',
    })
  }

  protected onMouseDown(evt: any) {
    if (this.options.guard(evt)) return
    if (evt[primaryModifierKey]) return

    const startX = evt.clientX
    const startY = evt.clientY

    const onMove = (moveEvt: MouseEvent) => {
      if (this.dragging) return
      const distance = Math.hypot(
        moveEvt.clientX - startX,
        moveEvt.clientY - startY,
      )
      if (distance <= DRAG_THRESHOLD) return

      this.dragging = true
      this.removePendingListeners?.()
      this.options.graph.view.undelegateDocumentEvents()
      void this.trigger('change', { e: evt, handle: this })
      evt.preventDefault()
      this.options.graph.view.undelegateEvents()
      this.delegateDocumentEvents(
        {
          mousemove: 'onMouseMove',
          touchmove: 'onMouseMove',
          mouseup: 'onMouseUp',
          touchend: 'onMouseUp',
          touchcancel: 'onMouseUp',
        },
        evt.data,
      )
    }

    const onUp = () => {
      this.removePendingListeners?.()
    }

    this.removePendingListeners = () => {
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('mouseup', onUp, true)
      this.removePendingListeners = undefined
    }

    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
  }

  protected onMouseMove(evt: any) {
    void this.emit('changing', { e: evt, handle: this })
  }

  protected onMouseUp(evt: any) {
    void this.emit('changed', { e: evt, handle: this })
    this.undelegateDocumentEvents()
    this.options.graph.view.delegateEvents()
    if (this.dragging) this.suppressNextClick()
    this.dragging = false
  }

  show() {
    this.container.style.display = ''
  }

  hide() {
    this.container.style.display = 'none'
  }

  private suppressNextClick() {
    const cleanup = () => {
      document.removeEventListener('click', stopClick, true)
    }
    const stopClick = (clickEvt: MouseEvent) => {
      clickEvt.stopPropagation()
      clickEvt.preventDefault()
      cleanup()
    }

    document.addEventListener('click', stopClick, true)
    window.setTimeout(cleanup, 100)
  }
}

function registerSimulinkSegmentsTool() {
  const SegmentsCtor = edgeToolRegistry.get('segments') as any
  if (!SegmentsCtor) return

  class SimulinkSegmentsTool extends SegmentsCtor {
    static defaults = {
      ...SegmentsCtor.defaults,
      name: 'simulink-segments',
      attrs: {
        width: 20,
        height: 10,
        x: -10,
        y: -5,
        rx: 5,
        ry: 5,
        fill: 'transparent',
        stroke: 'transparent',
        'stroke-width': 0,
      },
      createHandle: (options: SegmentHandleOptions) =>
        new SegmentHandle(options),
    }

    protected onHandleChanging(args: SegmentHandleEventArgs['changing']) {
      super.onHandleChanging(args)
      this.normalizeTerminalStubs(args.handle)
    }

    protected updateHandle(
      handle: SegmentHandle,
      vertex: any,
      nextVertex: any,
      offset = 0,
    ) {
      const precision = this.options.precision || 0
      const vertical = Math.abs(vertex.x - nextVertex.x) < precision
      const horizontal = Math.abs(vertex.y - nextVertex.y) < precision
      if (vertical || horizontal) {
        const segmentLine = new Line(vertex, nextVertex)
        const length = segmentLine.length()
        if (length < this.options.threshold) {
          handle.hide()
        } else {
          const position = segmentLine.getCenter()
          const axis = vertical ? 'x' : 'y'
          position[axis] += offset || 0
          const angle = segmentLine.vector().vectorAngle(new Point(1, 0))
          const handleWidth = length * 0.8
          handle.setAttrs({ width: handleWidth, x: -handleWidth / 2 })
          handle.updatePosition(position.x, position.y, angle, this.cellView)
          handle.show()
          handle.options.axis = axis
        }
      } else {
        handle.hide()
      }
    }

    private normalizeTerminalStubs(handle: SegmentHandle) {
      const axis = handle.options.axis
      if (!axis) return

      const edgeView = this.cellView
      const vertices = edgeView.cell.getVertices().map((vertex: any) => ({
        x: vertex.x,
        y: vertex.y,
      }))
      if (vertices.length === 0) return

      const sourceAnchor = edgeView.sourceAnchor.toJSON()
      const targetAnchor = edgeView.targetAnchor.toJSON()
      if (!this.isAxisAlignedEdge(sourceAnchor, targetAnchor)) return

      const crossAxis = axis === 'x' ? 'y' : 'x'
      let changed = false

      changed =
        this.normalizeStartStub(
          vertices,
          axis,
          crossAxis,
          sourceAnchor,
          targetAnchor,
          handle,
        ) || changed
      changed =
        this.normalizeEndStub(
          vertices,
          axis,
          crossAxis,
          targetAnchor,
          sourceAnchor,
        ) || changed

      if (!changed) return

      edgeView.cell.setVertices(vertices, { ui: true, toolId: this.cid })

      const index = handle.options.index! - 1
      const vertex = vertices[index]
      const nextVertex = vertices[index + 1]
      if (vertex && nextVertex) {
        this.updateHandle(handle, vertex, nextVertex, 0)
      }
    }

    private normalizeStartStub(
      vertices: Array<{ x: number; y: number }>,
      axis: 'x' | 'y',
      crossAxis: 'x' | 'y',
      sourceAnchor: { x: number; y: number },
      targetAnchor: { x: number; y: number },
      handle: SegmentHandle,
    ) {
      const firstVertex = vertices[0]
      const secondVertex = vertices[1]
      const referencePoint =
        secondVertex || vertices[vertices.length - 1] || targetAnchor
      const stubCoord = this.getTerminalStubCoord(
        this.cellView.sourceBBox,
        sourceAnchor,
        referencePoint,
        crossAxis,
      )

      if (
        this.isDirectTerminalLeg(firstVertex, sourceAnchor, axis, crossAxis)
      ) {
        const sourceStub = { ...sourceAnchor, [crossAxis]: stubCoord }
        firstVertex[crossAxis] = stubCoord
        vertices.unshift(sourceStub)
        this.shiftHandleIndexes(1)
        return true
      }

      if (
        secondVertex &&
        this.isExistingTerminalStub(
          firstVertex,
          secondVertex,
          sourceAnchor,
          axis,
          crossAxis,
        ) &&
        !this.sameCoord(firstVertex[crossAxis], stubCoord)
      ) {
        firstVertex[crossAxis] = stubCoord
        secondVertex[crossAxis] = stubCoord
        return true
      }

      return false
    }

    private normalizeEndStub(
      vertices: Array<{ x: number; y: number }>,
      axis: 'x' | 'y',
      crossAxis: 'x' | 'y',
      targetAnchor: { x: number; y: number },
      sourceAnchor: { x: number; y: number },
    ) {
      const lastVertex = vertices[vertices.length - 1]
      const previousVertex = vertices[vertices.length - 2]
      const referencePoint = previousVertex || vertices[0] || sourceAnchor
      const stubCoord = this.getTerminalStubCoord(
        this.cellView.targetBBox,
        targetAnchor,
        referencePoint,
        crossAxis,
      )

      if (this.isDirectTerminalLeg(lastVertex, targetAnchor, axis, crossAxis)) {
        const targetStub = { ...targetAnchor, [crossAxis]: stubCoord }
        lastVertex[crossAxis] = stubCoord
        vertices.push(targetStub)
        return true
      }

      if (
        previousVertex &&
        this.isExistingTerminalStub(
          lastVertex,
          previousVertex,
          targetAnchor,
          axis,
          crossAxis,
        ) &&
        !this.sameCoord(lastVertex[crossAxis], stubCoord)
      ) {
        lastVertex[crossAxis] = stubCoord
        previousVertex[crossAxis] = stubCoord
        return true
      }

      return false
    }

    private getTerminalStubCoord(
      bbox: any,
      anchor: { x: number; y: number },
      reference: { x: number; y: number },
      crossAxis: 'x' | 'y',
    ) {
      const direction = reference[crossAxis] >= anchor[crossAxis] ? 1 : -1
      if (crossAxis === 'x') {
        return direction > 0
          ? bbox.x + bbox.width + TERMINAL_STUB_THRESHOLD
          : bbox.x - TERMINAL_STUB_THRESHOLD
      }

      return direction > 0
        ? bbox.y + bbox.height + TERMINAL_STUB_THRESHOLD
        : bbox.y - TERMINAL_STUB_THRESHOLD
    }

    private isDirectTerminalLeg(
      vertex: { x: number; y: number } | undefined,
      anchor: { x: number; y: number },
      axis: 'x' | 'y',
      crossAxis: 'x' | 'y',
    ) {
      return (
        !!vertex &&
        this.sameCoord(vertex[crossAxis], anchor[crossAxis]) &&
        !this.sameCoord(vertex[axis], anchor[axis])
      )
    }

    private isExistingTerminalStub(
      stubVertex: { x: number; y: number },
      bendVertex: { x: number; y: number },
      anchor: { x: number; y: number },
      axis: 'x' | 'y',
      crossAxis: 'x' | 'y',
    ) {
      return (
        this.sameCoord(stubVertex[axis], anchor[axis]) &&
        this.sameCoord(stubVertex[crossAxis], bendVertex[crossAxis]) &&
        !this.sameCoord(bendVertex[axis], anchor[axis])
      )
    }

    private sameCoord(a: number, b: number) {
      return Math.abs(a - b) <= POINT_TOLERANCE
    }

    private isAxisAlignedEdge(
      sourceAnchor: { x: number; y: number },
      targetAnchor: { x: number; y: number },
    ) {
      return (
        this.sameCoord(sourceAnchor.x, targetAnchor.x) ||
        this.sameCoord(sourceAnchor.y, targetAnchor.y)
      )
    }
  }

  Graph.registerEdgeTool('simulink-segments', SimulinkSegmentsTool, true)
}

export { registerSimulinkSegmentsTool }
