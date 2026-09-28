import { PORT_STUB_SIZE, RED } from '@/assets/constant'
import { createCommonService } from '@/services/common-service'
import { withDeviceGuard } from '@/utils/hof/withDeviceGuard'
import {
  isPortStub,
  moveVertexPairSegment,
  simplifyEdgeVertices,
} from '@/utils/plugin/m2pVerticesTool'
import type { Edge, EdgeView, EventArgs, Graph, Scroller } from '@antv/x6'

const commonService = createCommonService()

// ── 直接拖动 Edge 中段 ────────────────────────────────────────────────────
export function openPinDragPaper(graph: Graph) {
  const scroller = graph.getPlugin<Scroller>('scroller')
  let panningSuppressedEdge: Edge | undefined
  let drag:
    | {
        edge: Edge
        vertices: { x: number; y: number }[]
        firstIndex: number
        axis: 'x' | 'y'
        start: { x: number; y: number }
        sourceStub: boolean
        targetStub: boolean
        moved: boolean
      }
    | undefined

  function edgeMouseDown({ edge, e }: EventArgs['edge:mousedown']) {
    if (e.button !== 0 || e[commonService.getPrimaryModifeierByDevice()]) return
    if (edge.getAttrs()?.line?.stroke === RED) return
    // 即使落在两端保护区或短线段，也不把线身拖动转成画布平移。
    scroller?.togglePanning(false)
    panningSuppressedEdge = edge
    const vertices = edge.getVertices().map(({ x, y }) => ({ x, y }))
    if (vertices.length < 2) return
    const view = graph.findViewByCell(edge) as EdgeView | undefined
    if (!view) return

    const points = [view.sourcePoint, ...vertices, view.targetPoint]
    const pointer = graph.clientToLocal(e.clientX, e.clientY)
    let length = 0
    let hit:
      | {
          segment: number
          along: number
          distanceSquared: number
          axis: 'x' | 'y'
        }
      | undefined
    for (let segment = 0; segment < points.length - 1; segment += 1) {
      const a = points[segment]
      const b = points[segment + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const segmentLengthSquared = dx * dx + dy * dy
      if (segmentLengthSquared < 0.01) continue
      const segmentLength = Math.sqrt(segmentLengthSquared)
      const ratio = Math.max(
        0,
        Math.min(
          1,
          ((pointer.x - a.x) * dx + (pointer.y - a.y) * dy) /
            segmentLengthSquared,
        ),
      )
      const nearestX = a.x + ratio * dx
      const nearestY = a.y + ratio * dy
      const distanceSquared =
        (pointer.x - nearestX) ** 2 + (pointer.y - nearestY) ** 2
      const axis = Math.abs(dx) < 0.5 ? 'x' : Math.abs(dy) < 0.5 ? 'y' : null
      if (axis && (!hit || distanceSquared < hit.distanceSquared)) {
        hit = {
          segment,
          along: length + ratio * segmentLength,
          distanceSquared,
          axis,
        }
      }
      length += segmentLength
    }

    const scale = graph.zoom()
    const guardedLength = PORT_STUB_SIZE + 5 / scale
    const hitRadius = 12 / scale
    if (
      !hit ||
      length <= guardedLength * 2 ||
      hit.along <= guardedLength ||
      hit.along >= length - guardedLength ||
      hit.distanceSquared > hitRadius * hitRadius ||
      hit.segment < 1 ||
      hit.segment >= points.length - 2
    ) {
      return
    }

    drag = {
      edge,
      vertices,
      firstIndex: hit.segment - 1,
      axis: hit.axis,
      start: graph.snapToGrid(e.clientX, e.clientY),
      sourceStub: isPortStub(edge, 'source', vertices[0]),
      targetStub: isPortStub(edge, 'target', vertices[vertices.length - 1]),
      moved: false,
    }
  }

  function edgeMouseMove({ edge, e }: EventArgs['edge:mousemove']) {
    const state = drag
    if (!state || state.edge !== edge) return
    const pointer = graph.snapToGrid(e.clientX, e.clientY)
    const delta = pointer[state.axis] - state.start[state.axis]
    if (delta === 0) return
    edge.setVertices(
      moveVertexPairSegment(
        state.vertices,
        state.firstIndex,
        state.firstIndex + 1,
        state.axis,
        delta,
        state.sourceStub,
        state.targetStub,
      ),
      { ui: true },
    )
    state.moved = true
  }

  function edgeMouseUp({ edge }: EventArgs['edge:mouseup']) {
    const state = drag
    drag = undefined
    if (panningSuppressedEdge === edge) {
      panningSuppressedEdge = undefined
      scroller?.togglePanning(true)
    }
    if (state?.edge === edge && state.moved) simplifyEdgeVertices(edge)
  }

  const onDown = withDeviceGuard('desktop', edgeMouseDown)
  const onMove = withDeviceGuard('desktop', edgeMouseMove)
  const onUp = withDeviceGuard('desktop', edgeMouseUp)
  graph.on('edge:mousedown', onDown)
  graph.on('edge:mousemove', onMove)
  graph.on('edge:mouseup', onUp)
  return () => {
    drag = undefined
    panningSuppressedEdge = undefined
    scroller?.togglePanning(true)
    graph.off('edge:mousedown', onDown)
    graph.off('edge:mousemove', onMove)
    graph.off('edge:mouseup', onUp)
  }
}
