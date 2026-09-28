import { Dom, edgeToolPresets, Graph } from '@antv/x6'
import {
  getPortRouteGeometry,
  simplifyRoutePoints,
} from '@/services/routing-service'
import type { Edge } from '@antv/x6'

const Vertices = edgeToolPresets.vertices
type Handle = ReturnType<NonNullable<typeof Vertices.defaults.createHandle>>

type Vertex = { x: number; y: number }

function samePoint(a: Vertex, b: Vertex) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5
}

function isPortStub(edge: Edge, terminal: 'source' | 'target', vertex: Vertex) {
  const node =
    terminal === 'source' ? edge.getSourceCell() : edge.getTargetCell()
  const portId =
    terminal === 'source' ? edge.getSourcePortId() : edge.getTargetPortId()
  if (!node?.isNode() || !portId) return false
  const geometry = getPortRouteGeometry(node, portId)
  return !!geometry && samePoint(vertex, geometry.stubPoint)
}

function moveVertexPairSegment(
  original: Vertex[],
  firstIndex: number,
  secondIndex: number,
  axis: 'x' | 'y',
  delta: number,
  sourceStub: boolean,
  targetStub: boolean,
) {
  const vertices = original.map((vertex) => ({ ...vertex }))
  const position = original[firstIndex][axis] + delta
  vertices[firstIndex][axis] = position
  vertices[secondIndex][axis] = position
  if (sourceStub && (firstIndex === 0 || secondIndex === 0)) {
    const stub = original[0]
    vertices[0] = { ...stub }
    vertices.splice(1, 0, { ...stub, [axis]: position })
  }
  if (
    targetStub &&
    (firstIndex === original.length - 1 || secondIndex === original.length - 1)
  ) {
    const stub = original[original.length - 1]
    vertices[vertices.length - 1] = { ...stub }
    vertices.splice(vertices.length - 1, 0, { ...stub, [axis]: position })
  }
  return vertices
}

function simplifyEdgeVertices(edge: Edge, toolId?: string) {
  const vertices = edge.getVertices()
  const protectedIndices = new Set<number>()
  if (vertices.length && isPortStub(edge, 'source', vertices[0])) {
    protectedIndices.add(0)
  }
  if (
    vertices.length &&
    isPortStub(edge, 'target', vertices[vertices.length - 1])
  ) {
    protectedIndices.add(vertices.length - 1)
  }
  const simplified = simplifyRoutePoints(vertices, protectedIndices)
  if (simplified.length !== vertices.length) {
    edge.setVertices(simplified, { ui: true, toolId })
  }
}

/** 拖动拐点时平移相邻的正交线段，不单独移动一个顶点。 */
class M2PVerticesTool extends Vertices {
  static defaults = { ...Vertices.defaults, name: 'm2p-vertices' }

  private normalizing = false
  private dragStart: {
    x: number
    y: number
    vertices: Vertex[]
    sourceStub: boolean
    targetStub: boolean
    pair?: { index: number; axis: 'x' | 'y' }
  } | null = null

  private normalizeVertices(duringDrag: boolean) {
    if (this.normalizing) return
    const vertices = this.cellView.cell.getVertices()
    const protectedIndices = new Set<number>()
    if (
      vertices.length &&
      isPortStub(this.cellView.cell, 'source', vertices[0])
    ) {
      protectedIndices.add(0)
    }
    if (
      vertices.length &&
      isPortStub(this.cellView.cell, 'target', vertices[vertices.length - 1])
    ) {
      protectedIndices.add(vertices.length - 1)
    }
    const simplified = simplifyRoutePoints(vertices, protectedIndices)
    if (simplified.length === vertices.length) return
    this.normalizing = true
    try {
      this.cellView.cell.setVertices(
        simplified,
        duringDrag
          ? { ui: true, toolId: this.cid }
          : { ui: true, ignore: true, undo: false, toolId: this.cid },
      )
    } finally {
      this.normalizing = false
    }
  }

  protected onRender() {
    this.normalizeVertices(false)
    return super.onRender()
  }

  protected onHandleChange(args: { handle: Handle; e: Dom.MouseDownEvent }) {
    const { x, y } = this.getMouseEventArgs(args.e)
    const vertices = this.cellView.cell
      .getVertices()
      .map(({ x, y }) => ({ x, y }))
    this.dragStart = {
      x,
      y,
      vertices,
      sourceStub:
        !!vertices.length &&
        isPortStub(this.cellView.cell, 'source', vertices[0]),
      targetStub:
        !!vertices.length &&
        isPortStub(this.cellView.cell, 'target', vertices[vertices.length - 1]),
    }
    super.onHandleChange(args)
  }

  protected onHandleChanging({
    handle,
    e,
  }: {
    handle: Handle
    e: Dom.MouseMoveEvent
  }) {
    const start = this.dragStart
    if (!start) return

    const index = handle.options.index
    const current = start.vertices[index]
    if (!current) return

    const { x, y } = this.getMouseEventArgs(e)
    const dx = x - start.x
    const dy = y - start.y
    if (dx === 0 && dy === 0) return
    if (!start.pair) {
      const axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      const pairIndex = [index + 1, index - 1].find((otherIndex) => {
        const other = start.vertices[otherIndex]
        return (
          other &&
          (axis === 'x'
            ? other.x === current.x && other.y !== current.y
            : other.y === current.y && other.x !== current.x)
        )
      })
      if (pairIndex == null) return
      start.pair = { index: pairIndex, axis }
    }

    const { axis, index: pairIndex } = start.pair
    const vertices = moveVertexPairSegment(
      start.vertices,
      index,
      pairIndex,
      axis,
      axis === 'x' ? dx : dy,
      start.sourceStub,
      start.targetStub,
    )
    this.cellView.cell.setVertices(vertices, { ui: true, toolId: this.cid })
    handle.updatePosition(
      start.vertices[index].x + (axis === 'x' ? dx : 0),
      start.vertices[index].y + (axis === 'y' ? dy : 0),
    )
  }

  protected onHandleChanged(args: { e: Dom.MouseUpEvent; handle: Handle }) {
    this.dragStart = null
    this.normalizeVertices(true)
    super.onHandleChanged(args)
    this.render()
  }
}

function registerM2PVerticesTool() {
  Graph.registerEdgeTool('m2p-vertices', M2PVerticesTool, true)
}

export {
  isPortStub,
  moveVertexPairSegment,
  registerM2PVerticesTool,
  simplifyEdgeVertices,
}
