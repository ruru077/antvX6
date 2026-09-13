import { AvoidLib } from 'libavoid-js'
import { GAP_SIZE, GRAPH_GRID, RED } from '@/assets/constant'
// 参数配置
const ROUTE_OPTIONS = {
  edgeToNodeGap: 20,
  edgeToEdgeGap: 10,
  stubSize: 20,
  segmentPenalty: 80,
  anglePenalty: 100,
  crossingPenalty: 1500,
  reverseDirectionPenalty: 200,
  portDirectionPenalty: 100,
  gridSize: 0,
  gapSize: GAP_SIZE,
  cornerRadius: 0,
}
let routeRequestId = 0
let activeRoutePromise = null
let pendingRouteGraph = null
let avoidInitPromise = null
const AVOID_CONN_DIR_UP = 1
const AVOID_CONN_DIR_DOWN = 2
const AVOID_CONN_DIR_LEFT = 4
const AVOID_CONN_DIR_RIGHT = 8
const INSERT_PREVIEW = 'edgeInsertionPreview'
const INSERT_PREVIEW_TERMINALS = 'edgeInsertionPreviewTerminals'
function isRoutingNode(node) {
  return node.getPorts().length > 0
}
async function routeAllEdges(graph) {
  pendingRouteGraph = graph
  if (activeRoutePromise) return activeRoutePromise
  activeRoutePromise = drainRouteQueue()
  try {
    await activeRoutePromise
  } finally {
    activeRoutePromise = null
  }
}
async function drainRouteQueue() {
  while (pendingRouteGraph) {
    const graph = pendingRouteGraph
    pendingRouteGraph = null
    await routeAllEdgesNow(graph)
  }
}
async function routeAllEdgesNow(graph) {
  const requestId = ++routeRequestId
  const routableEdges = getRoutableEdges(graph)
  if (!routableEdges.length) return
  try {
    const branchEdges = routableEdges.filter(hasBranchTerminal)
    const avoidEdges = routableEdges.filter((edge) => !hasBranchTerminal(edge))
    applyBranchEdgesWithManhattan(branchEdges)
    const routes = await routeWithAvoid(graph, avoidEdges)
    if (requestId !== routeRequestId || pendingRouteGraph) return
    applyRoutes(routes)
  } catch (error) {
    // console.error('[avoid-route] routing failed', error)
    throw error
  }
}
function getRoutableEdges(graph) {
  return graph
    .getEdges()
    .map((edge) => {
      if (isPreviewEdge(edge)) return null
      if (edge.attr('line/visibility') === 'hidden') return null
      const source = getTerminalInfo(graph, edge, 'source')
      const target = getTerminalInfo(graph, edge, 'target')
      if (!source || !target) return null
      alignBranchDirections(source, target)
      return { edge, source, target }
    })
    .filter((item) => !!item)
}
function alignBranchDirections(source, target) {
  if (source.kind === 'branch') {
    source.direction = getPerpendicularDirection(
      source.direction,
      source.point,
      target.point,
    )
  }
  if (target.kind === 'branch') {
    target.direction = getPerpendicularDirection(
      target.direction,
      target.point,
      source.point,
    )
  }
}
function getTerminalInfo(graph, edge, terminal) {
  const terminalConfig = getTerminalConfig(edge, terminal)
  const nodeId =
    terminal === 'source' ? edge.getSourceCellId() : edge.getTargetCellId()
  const portId =
    terminal === 'source' ? edge.getSourcePortId() : edge.getTargetPortId()
  if (!nodeId) {
    const previewTerminal =
      edge.getData()?.[INSERT_PREVIEW_TERMINALS]?.[terminal]
    if (
      !previewTerminal ||
      typeof terminalConfig?.x !== 'number' ||
      typeof terminalConfig?.y !== 'number'
    ) {
      return null
    }
    const routeNodeId = `__preview_node__:${previewTerminal.nodeId}`
    const point = { x: terminalConfig.x, y: terminalConfig.y }
    const stubPoint = offsetByVector(
      point,
      previewTerminal.normal,
      ROUTE_OPTIONS.stubSize,
    )
    return {
      kind: 'virtualNode',
      nodeId: routeNodeId,
      portId: previewTerminal.portId,
      routeNodeId,
      routePortId: `${routeNodeId}:${previewTerminal.portId}`,
      point,
      normal: previewTerminal.normal,
      direction: previewTerminal.direction,
      stubPoint,
      checkpoint: stubPoint,
      hasStub: true,
      bbox: previewTerminal.bbox,
    }
  }
  const cell = graph.getCellById(nodeId)
  if (!cell) return null
  if (cell.isEdge()) {
    const point = getBranchTerminalPoint(graph, edge, terminal)
    if (!point) return null
    return {
      kind: 'branch',
      nodeId,
      portId: `${terminal}:${edge.id}`,
      routeNodeId: `__branch_node__:${edge.id}:${terminal}`,
      routePortId: `__branch_port__:${edge.id}:${terminal}`,
      point,
      direction: getBranchDirection(graph, cell, edge, terminal, point),
      checkpoint: point,
      hasStub: false,
    }
  }
  if (!cell.isNode() || !isRoutingNode(cell) || !portId) return null
  const geometry = getPortRouteGeometry(cell, portId)
  if (!geometry) return null
  return {
    kind: 'node',
    node: cell,
    nodeId,
    portId,
    routeNodeId: nodeId,
    routePortId: `${nodeId}:${portId}`,
    ...geometry,
    hasStub: true,
  }
}
async function routeWithAvoid(graph, routableEdges) {
  if (!routableEdges.length) return []
  const avoid = await ensureAvoidReady()
  const router = new avoid.Router(avoid.RouterFlag.OrthogonalRouting.value)
  try {
    configureAvoidRouter(avoid, router)
    const shapes = new Map()
    graph
      .getNodes()
      .filter(isRoutingNode)
      .forEach((node) => {
        const shapeRef = createAvoidShape(avoid, router, node)
        shapes.set(node.id, shapeRef)
      })
    const endpointShapes = new Map()
    const endpointPins = new Map()
    routableEdges.forEach(({ source, target }) => {
      for (const terminal of [source, target]) {
        if (
          terminal.kind === 'virtualNode' &&
          !shapes.has(terminal.routeNodeId)
        ) {
          const bbox = terminal.bbox
          shapes.set(
            terminal.routeNodeId,
            new avoid.ShapeRef(
              router,
              new avoid.Rectangle(
                new avoid.Point(bbox.x, bbox.y),
                new avoid.Point(bbox.x + bbox.width, bbox.y + bbox.height),
              ),
            ),
          )
        }
        if (endpointShapes.has(terminal.routePortId)) continue
        const endpointPoint = terminal.hasStub
          ? terminal.stubPoint
          : terminal.point
        const shapeRef = createAvoidEndpointShape(avoid, router, endpointPoint)
        const pinClass = 2
        const pin = new avoid.ShapeConnectionPin(
          shapeRef,
          pinClass,
          0.5,
          0.5,
          true,
          0,
          toAvoidDirection(terminal.direction),
        )
        pin.setExclusive(false)
        endpointShapes.set(terminal.routePortId, shapeRef)
        endpointPins.set(terminal.routePortId, pinClass)
      }
    })
    const connectors = routableEdges.map((routeEdge) => {
      const sourceShape = endpointShapes.get(routeEdge.source.routePortId)
      const targetShape = endpointShapes.get(routeEdge.target.routePortId)
      const sourcePin = endpointPins.get(routeEdge.source.routePortId)
      const targetPin = endpointPins.get(routeEdge.target.routePortId)
      if (!sourceShape || !targetShape || !sourcePin || !targetPin) {
        throw new Error(
          `[avoid-route] Avoid endpoint missing shape or pin for edge "${routeEdge.edge.id}"`,
        )
      }
      const sourceEnd = new avoid.ConnEnd(sourceShape, sourcePin)
      const targetEnd = new avoid.ConnEnd(targetShape, targetPin)
      const conn = new avoid.ConnRef(router, sourceEnd, targetEnd)
      conn.setRoutingType(avoid.ConnType.ConnType_Orthogonal.value)
      conn.setHateCrossings(ROUTE_OPTIONS.crossingPenalty > 0)
      return { conn, routeEdge }
    })
    router.processTransaction()
    const routes = connectors.map(({ conn, routeEdge }) => {
      const points = avoidRouteToPoints(conn.displayRoute())
      assertOrthogonalRoute(routeEdge.edge, points)
      const terminalPoints = applyTerminalGeometry(routeEdge, points)
      assertTerminalStubRoute(routeEdge, terminalPoints)
      return {
        edge: routeEdge.edge,
        points: terminalPoints,
        source: routeEdge.source,
        target: routeEdge.target,
      }
    })
    return routes
  } finally {
    router.delete?.()
  }
}
function ensureAvoidReady() {
  if (!avoidInitPromise) {
    avoidInitPromise = AvoidLib.load('/vendor/libavoid.wasm').then(() =>
      AvoidLib.getInstance(),
    )
  }
  return avoidInitPromise
}
function configureAvoidRouter(avoid, router) {
  router.setRoutingParameter(
    avoid.RoutingParameter.shapeBufferDistance,
    ROUTE_OPTIONS.edgeToNodeGap,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.idealNudgingDistance,
    ROUTE_OPTIONS.edgeToEdgeGap,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.segmentPenalty,
    Math.max(1, ROUTE_OPTIONS.segmentPenalty),
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.anglePenalty,
    ROUTE_OPTIONS.anglePenalty,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.crossingPenalty,
    ROUTE_OPTIONS.crossingPenalty,
  )
  router.setRoutingParameter(avoid.RoutingParameter.fixedSharedPathPenalty, 0)
  router.setRoutingParameter(
    avoid.RoutingParameter.reverseDirectionPenalty,
    ROUTE_OPTIONS.reverseDirectionPenalty,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.portDirectionPenalty,
    ROUTE_OPTIONS.portDirectionPenalty,
  )
  router.setRoutingOption(
    avoid.RoutingOption.nudgeOrthogonalSegmentsConnectedToShapes,
    true,
  )
  router.setRoutingOption(
    avoid.RoutingOption.nudgeSharedPathsWithCommonEndPoint,
    true,
  )
  router.setRoutingOption(
    avoid.RoutingOption.performUnifyingNudgingPreprocessingStep,
    true,
  )
  router.setRoutingOption(
    avoid.RoutingOption.nudgeOrthogonalTouchingColinearSegments,
    false,
  )
}
function createAvoidShape(avoid, router, node) {
  const bbox = getRotatedNodeBBox(node)
  return new avoid.ShapeRef(
    router,
    new avoid.Rectangle(
      new avoid.Point(bbox.x, bbox.y),
      new avoid.Point(bbox.x + bbox.width, bbox.y + bbox.height),
    ),
  )
}
function createAvoidEndpointShape(avoid, router, point) {
  return new avoid.ShapeRef(
    router,
    new avoid.Rectangle(
      new avoid.Point(point.x - 0.5, point.y - 0.5),
      new avoid.Point(point.x + 0.5, point.y + 0.5),
    ),
  )
}
function applyTerminalGeometry(routeEdge, points) {
  if (!points.length) {
    throw new Error(`[avoid-route] Empty route for edge "${routeEdge.edge.id}"`)
  }
  const sourceEndpoint = routeEdge.source.hasStub
    ? routeEdge.source.stubPoint
    : routeEdge.source.point
  const targetEndpoint = routeEdge.target.hasStub
    ? routeEdge.target.stubPoint
    : routeEdge.target.point
  if (!samePoint(points[0], sourceEndpoint)) {
    throw new Error(
      `[avoid-route] Source endpoint mismatch for edge "${routeEdge.edge.id}"`,
    )
  }
  if (!samePoint(points[points.length - 1], targetEndpoint)) {
    throw new Error(
      `[avoid-route] Target endpoint mismatch for edge "${routeEdge.edge.id}"`,
    )
  }
  const sourcePoints = routeEdge.source.hasStub
    ? [routeEdge.source.point, routeEdge.source.stubPoint]
    : []
  const targetPoints = routeEdge.target.hasStub
    ? [routeEdge.target.stubPoint, routeEdge.target.point]
    : []
  return dedupePoints([...sourcePoints, ...points, ...targetPoints])
}
function avoidRouteToPoints(polyline) {
  const points = []
  for (let index = 0; index < polyline.size(); index++) {
    const point = polyline.at(index)
    points.push({ x: point.x, y: point.y })
  }
  return dedupePoints(points)
}
function toAvoidDirection(direction) {
  switch (direction) {
    case 'left':
      return AVOID_CONN_DIR_LEFT
    case 'right':
      return AVOID_CONN_DIR_RIGHT
    case 'top':
      return AVOID_CONN_DIR_UP
    case 'bottom':
      return AVOID_CONN_DIR_DOWN
  }
}
function assertOrthogonalRoute(edge, points) {
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]
    const current = points[index]
    if (
      Math.abs(previous.x - current.x) >= 0.5 &&
      Math.abs(previous.y - current.y) >= 0.5
    ) {
      throw new Error(
        `[avoid-route] Avoid produced a non-orthogonal segment for edge "${edge.id}"`,
      )
    }
  }
}
function assertTerminalStubRoute(routeEdge, points) {
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]
    const current = points[index]
    const diagonal =
      Math.abs(previous.x - current.x) >= 0.5 &&
      Math.abs(previous.y - current.y) >= 0.5
    if (!diagonal) continue
    const isSourceStub =
      index === 1 &&
      routeEdge.source.hasStub &&
      samePoint(previous, routeEdge.source.point) &&
      samePoint(current, routeEdge.source.stubPoint)
    const isTargetStub =
      index === points.length - 1 &&
      routeEdge.target.hasStub &&
      samePoint(previous, routeEdge.target.stubPoint) &&
      samePoint(current, routeEdge.target.point)
    if (!isSourceStub && !isTargetStub) {
      throw new Error(
        `[avoid-route] Non-terminal diagonal segment for edge "${routeEdge.edge.id}"`,
      )
    }
  }
}
function applyBranchEdgesWithManhattan(routableEdges) {
  routableEdges.forEach(({ edge, source, target }) => {
    fallbackEdgeToManhattan(edge, source.direction, target.direction)
  })
}
function applyRoutes(routes) {
  routes.forEach(({ edge, points }) => {
    const routedPoints =
      ROUTE_OPTIONS.gridSize > 0
        ? points.map((point) => snapPoint(point, ROUTE_OPTIONS.gridSize))
        : points
    const normalized = dedupePoints(routedPoints)
    const vertices = normalized.slice(1, -1)
    edge.removeRouter({ ui: true, ignore: true })
    edge.setVertices(vertices, { ui: true, ignore: true })
    if (edge.attr('line/visibility') !== 'hidden') {
      edge.attr('line/visibility', 'visible', { ui: true, ignore: true })
    }
    setJumpoverConnector(edge)
  })
}
function fallbackEdgeToManhattan(edge, sourceDirection, targetDirection) {
  sourceDirection ??= getAttachedPortDirection(edge, 'source')
  targetDirection ??= getAttachedPortDirection(edge, 'target')
  const args = {
    step: GRAPH_GRID,
  }
  if (sourceDirection) args.startDirections = [sourceDirection]
  if (targetDirection) args.endDirections = [targetDirection]
  edge.setVertices([], { ui: true, ignore: true })
  edge.setRouter('manhattan', args, { ui: true, ignore: true })
  edge.attr('line/visibility', 'visible', { ui: true, ignore: true })
  setJumpoverConnector(edge)
}
function getAttachedPortDirection(edge, terminal) {
  const cell =
    terminal === 'source' ? edge.getSourceCell() : edge.getTargetCell()
  const portId =
    terminal === 'source' ? edge.getSourcePortId() : edge.getTargetPortId()
  if (!cell?.isNode() || !portId) return null
  return getPortRouteGeometry(cell, portId)?.direction ?? null
}
function setJumpoverConnector(edge) {
  edge.setConnector(
    'jumpover',
    {
      type: 'gap',
      size: ROUTE_OPTIONS.gapSize,
      radius: ROUTE_OPTIONS.cornerRadius,
    },
    { ui: true, ignore: true },
  )
}
function hasBranchTerminal(edge) {
  return edge.source.kind === 'branch' || edge.target.kind === 'branch'
}
function getBranchTerminalPoint(graph, edge, terminal) {
  const terminalConfig = getTerminalConfig(edge, terminal)
  const parentEdgeId = terminalConfig?.cell
  if (!parentEdgeId) return null
  const parentEdge = graph.getCellById(parentEdgeId)
  if (!parentEdge?.isEdge()) return null
  const parentEdgeView = graph.findViewByCell(parentEdge)
  if (!parentEdgeView) return null
  const ratio = getTerminalRatio(terminalConfig)
  const point = parentEdgeView.getPointAtRatio(ratio)
  if (!point) return null
  return { x: point.x, y: point.y }
}
function getBranchDirection(
  graph,
  parentEdge,
  branchEdge,
  terminal,
  branchPoint,
) {
  const parentEdgeView = graph.findViewByCell(parentEdge)
  if (!parentEdgeView)
    return inferBranchDirectionFromPeer(branchEdge, terminal, branchPoint)
  const ratio = getTerminalRatio(getTerminalConfig(branchEdge, terminal))
  const tangent = parentEdgeView.getTangentAtRatio(ratio)
  if (!tangent?.start || !tangent?.end) {
    return inferBranchDirectionFromPeer(branchEdge, terminal, branchPoint)
  }
  const dx = tangent.end.x - tangent.start.x
  const dy = tangent.end.y - tangent.start.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}
function inferBranchDirectionFromPeer(branchEdge, terminal, branchPoint) {
  const peerPoint = getTerminalPoint(
    branchEdge,
    terminal === 'source' ? 'target' : 'source',
  )
  if (!peerPoint) return 'right'
  const dx = peerPoint.x - branchPoint.x
  const dy = peerPoint.y - branchPoint.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}
function getTerminalPoint(edge, terminal) {
  const terminalConfig =
    terminal === 'source' ? edge.getSource() : edge.getTarget()
  const point = terminalConfig
  if (typeof point.x === 'number' && typeof point.y === 'number') {
    return { x: point.x, y: point.y }
  }
  return null
}
function getPerpendicularDirection(parentDirection, branchPoint, peerPoint) {
  if (parentDirection === 'left' || parentDirection === 'right') {
    return peerPoint.y >= branchPoint.y ? 'bottom' : 'top'
  }
  return peerPoint.x >= branchPoint.x ? 'right' : 'left'
}
function getTerminalConfig(edge, terminal) {
  return terminal === 'source' ? edge.getSource() : edge.getTarget()
}
function getTerminalRatio(terminal) {
  const ratio = terminal?.anchor?.args?.ratio
  return typeof ratio === 'number' ? ratio : 0.5
}
function getPortPoint(node, portId) {
  const port = node.getPort(portId)
  if (!port?.group) return null
  const layout = node.getPortsPosition(port.group)[portId]
  if (!layout) return null
  const position = node.getPosition()
  const point = {
    x: position.x + layout.position.x,
    y: position.y + layout.position.y,
  }
  const angle = node.getAngle()
  if (!angle) return point
  return rotatePoint(point, node.getBBox().getCenter(), angle)
}
function getPortRouteGeometry(node, portId) {
  const point = getPortPoint(node, portId)
  if (!point) return null
  const port = node.getPort(portId)
  const groupPosition = getPortGroupPosition(node, port?.group)
  const cardinalDirection = normalizePortDirection(groupPosition)
  let normal
  if (cardinalDirection) {
    normal = rotateVector(directionToVector(cardinalDirection), node.getAngle())
  } else if (isEllipsePosition(groupPosition)) {
    normal = getEllipsePortNormal(node, portId)
  }
  if (!normal) {
    const semanticDirection = inferPortDirectionFromName(portId, port?.group)
    if (semanticDirection) {
      normal = rotateVector(
        directionToVector(semanticDirection),
        node.getAngle(),
      )
    }
  }
  if (!normal) {
    const bbox = getRotatedNodeBBox(node)
    const distances = [
      { direction: 'left', value: Math.abs(point.x - bbox.x) },
      {
        direction: 'right',
        value: Math.abs(point.x - (bbox.x + bbox.width)),
      },
      { direction: 'top', value: Math.abs(point.y - bbox.y) },
      {
        direction: 'bottom',
        value: Math.abs(point.y - (bbox.y + bbox.height)),
      },
    ]
    distances.sort((a, b) => a.value - b.value)
    normal = directionToVector(distances[0].direction)
  }
  const direction = quantizeDirection(normal)
  const stubPoint = offsetByVector(point, normal, ROUTE_OPTIONS.stubSize)
  return {
    point,
    normal,
    direction,
    stubPoint,
    checkpoint: stubPoint,
  }
}
function isEllipsePosition(position) {
  const name = typeof position === 'string' ? position : position?.name
  return name === 'ellipse' || name === 'ellipseSpread'
}
function getEllipsePortNormal(node, portId) {
  const port = node.getPort(portId)
  const layout = node.getPortsPosition(port.group)[portId]
  if (!layout) return null
  const size = node.getSize()
  const rx = size.width / 2
  const ry = size.height / 2
  const dx = layout.position.x - rx
  const dy = layout.position.y - ry
  const localNormal = normalizeVector({
    x: dx / (rx * rx),
    y: dy / (ry * ry),
  })
  if (!localNormal) return null
  return rotateVector(localNormal, node.getAngle())
}
function directionToVector(direction) {
  switch (direction) {
    case 'left':
      return { x: -1, y: 0 }
    case 'right':
      return { x: 1, y: 0 }
    case 'top':
      return { x: 0, y: -1 }
    case 'bottom':
      return { x: 0, y: 1 }
  }
}
function quantizeDirection(vector) {
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return vector.x >= 0 ? 'right' : 'left'
  }
  return vector.y >= 0 ? 'bottom' : 'top'
}
function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y)
  if (!length) return null
  return { x: vector.x / length, y: vector.y / length }
}
function rotateVector(vector, angle) {
  return rotatePoint(vector, { x: 0, y: 0 }, angle)
}
function getPortGroupPosition(node, groupName) {
  if (!groupName) return null
  return node.ports.groups?.[groupName]?.position ?? null
}
function normalizePortDirection(position) {
  const name = typeof position === 'string' ? position : position?.name
  if (
    name === 'left' ||
    name === 'right' ||
    name === 'top' ||
    name === 'bottom'
  ) {
    return name
  }
  return null
}
function inferPortDirectionFromName(portId, groupName) {
  const key = `${groupName ?? ''}:${portId}`.toLowerCase()
  if (/(^|:)out|(^|:)o\d|outsys|oute/.test(key)) return 'right'
  if (/(^|:)in|(^|:)i\d|insys|ine/.test(key)) return 'left'
  return null
}
function getRotatedNodeBBox(node) {
  return node.getBBox().bbox(node.getAngle())
}
function rotatePoint(point, center, angle) {
  const radians = (angle * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cosine - dy * sine,
    y: center.y + dx * sine + dy * cosine,
  }
}
function offsetByVector(point, vector, distance) {
  return {
    x: point.x + vector.x * distance,
    y: point.y + vector.y * distance,
  }
}
function dedupePoints(points) {
  return points.filter((point, index) => {
    if (index === 0) return true
    return !samePoint(point, points[index - 1])
  })
}
function samePoint(a, b) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5
}
function snapPoint(point, gridSize) {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  }
}
function isPreviewEdge(edge) {
  return (
    edge.getAttrs()?.line?.stroke === RED &&
    edge.getData()?.[INSERT_PREVIEW] !== true
  )
}
function isCompleteNodeEdge(edge) {
  return (
    !!edge.getSourceCell()?.isNode() &&
    !!edge.getTargetCell()?.isNode() &&
    !!edge.getSourcePortId() &&
    !!edge.getTargetPortId()
  )
}
export {
  fallbackEdgeToManhattan,
  getPortRouteGeometry,
  isCompleteNodeEdge,
  isRoutingNode,
  routeAllEdges,
}
