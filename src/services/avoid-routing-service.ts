import type { Edge, EdgeView, Graph, Node } from '@antv/x6'
import { type Avoid, AvoidLib } from 'libavoid-js'
import {
  AStarPath,
  Checkpoint,
  ConnDirAll,
  ConnDirDown,
  ConnDirLeft,
  ConnDirRight,
  ConnDirUp,
  ConnEnd,
  ConnRef,
  ConnType_Orthogonal,
  ConnectorCrossings,
  OrthogonalRouting,
  Point,
  Rectangle,
  Router,
  ShapeConnectionPin,
  ShapeRef,
  anglePenalty,
  crossingPenalty,
  generateStaticOrthogonalVisGraph,
  idealNudgingDistance,
  improveOrthogonalRoutes,
  nudgeOrthogonalSegmentsConnectedToShapes,
  nudgeSharedPathsWithCommonEndPoint,
  performUnifyingNudgingPreprocessingStep,
  portDirectionPenalty,
  reverseDirectionPenalty,
  segmentPenalty,
  shapeBufferDistance,
  vertexVisibility,
} from 'obstacle-router'
import { GRAPH_GRID, RED } from '@/assets/constant'
import type { RouteDemoOptions } from '@/store/routeDemoStore'
import { useRouteDemoStore } from '@/store/routeDemoStore'

type XY = { x: number; y: number }
type BBox = {
  x: number
  y: number
  width: number
  height: number
}
type PortDirection = 'left' | 'right' | 'top' | 'bottom'
type TerminalInfo = {
  kind: 'node' | 'branch'
  node?: Node
  nodeId: string
  portId: string
  routeNodeId: string
  routePortId: string
  point: XY
  direction: PortDirection
}
type BranchTerminalInfo = TerminalInfo & {
  kind: 'branch'
  node?: never
}
type NodeTerminalInfo = TerminalInfo & {
  kind: 'node'
  node: Node
}
type AnyTerminalInfo = NodeTerminalInfo | BranchTerminalInfo
type RoutableEdge = {
  edge: Edge
  source: AnyTerminalInfo
  target: AnyTerminalInfo
}
type RouteItem = RoutableEdge & {
  points: XY[]
}
type SimulinkRoutePlan = {
  checkpoints: XY[]
}
type TerminalRole = 'source' | 'target'
type EdgeRoutingContext = {
  ignoredNodeIds: Set<string>
  pointTerminals: Set<TerminalRole>
}

let routeRequestId = 0
let activeRoutePromise: Promise<void> | null = null
let pendingRouteGraph: Graph | null = null
let simulinkAvoidInitPromise: Promise<Avoid> | null = null
const SIMULINK_CONN_DIR_UP = 1
const SIMULINK_CONN_DIR_DOWN = 2
const SIMULINK_CONN_DIR_LEFT = 4
const SIMULINK_CONN_DIR_RIGHT = 8
const SIMULINK_CONN_DIR_ALL = 15
const SIMULINK_MIN_EDGE_GAP = 5

async function routeAllEdges(graph: Graph) {
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

async function routeAllEdgesNow(graph: Graph) {
  const options = useRouteDemoStore.getState()
  const requestId = ++routeRequestId

  if (options.engine === 'off') {
    clearRoutedEdges(graph)
    return
  }

  const routableEdges = getRoutableEdges(graph)
  if (!routableEdges.length) return

  try {
    const branchEdges = routableEdges.filter(hasBranchTerminal)
    const avoidEdges = routableEdges.filter((edge) => !hasBranchTerminal(edge))
    if (options.engine === 'orth' || options.engine === 'manhattan') {
      applyX6BuiltInRouter(routableEdges, options)
      return
    }

    if (options.engine === 'avoid') {
      showRoutableEdges(routableEdges)
      if (branchEdges.length) {
        console.warn(
          `[avoid-route] Avoid engine skipped ${branchEdges.length} branch edge(s); branch routing is not implemented in libavoid mode.`,
        )
      }
      const routes = await routeWithSimulink(graph, avoidEdges, options)
      if (requestId !== routeRequestId || pendingRouteGraph) return
      applyRoutes(routes, options, false)
      return
    }

    applyBranchEdgesWithX6Manhattan(branchEdges, options)
    const avoidRoutes =
      avoidEdges.length === 0
        ? []
        : routeWithObstacle(graph, avoidEdges, options)
    if (requestId !== routeRequestId || pendingRouteGraph) return
    applyRoutes(avoidRoutes, options)
  } catch (error) {
    console.error('[avoid-route] routing failed', error)
  }
}

function clearRoutedEdges(graph: Graph) {
  graph.getEdges().forEach((edge) => {
    if (isPreviewEdge(edge)) return
    edge.removeRouter({ ui: true, ignore: true })
    edge.setVertices([], { ui: true, ignore: true })
    edge.attr('line/visibility', 'visible', { ui: true, ignore: true })
  })
}

function clearRoutableEdges(routableEdges: RoutableEdge[]) {
  routableEdges.forEach(({ edge }) => {
    edge.removeRouter({ ui: true, ignore: true })
    edge.setVertices([], { ui: true, ignore: true })
    edge.attr('line/visibility', 'visible', { ui: true, ignore: true })
  })
}

function showRoutableEdges(routableEdges: RoutableEdge[]) {
  routableEdges.forEach(({ edge }) => {
    edge.attr('line/visibility', 'visible', { ui: true, ignore: true })
  })
}

function getRoutableEdges(graph: Graph): RoutableEdge[] {
  return graph
    .getEdges()
    .map((edge) => {
      if (isPreviewEdge(edge)) return null
      const source = getTerminalInfo(graph, edge, 'source')
      const target = getTerminalInfo(graph, edge, 'target')
      if (!source || !target) return null
      alignBranchDirections(source, target)
      return { edge, source, target }
    })
    .filter((item): item is RoutableEdge => !!item)
}

function alignBranchDirections(
  source: AnyTerminalInfo,
  target: AnyTerminalInfo,
) {
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

function getTerminalInfo(
  graph: Graph,
  edge: Edge,
  terminal: 'source' | 'target',
): AnyTerminalInfo | null {
  const nodeId =
    terminal === 'source' ? edge.getSourceCellId() : edge.getTargetCellId()
  const portId =
    terminal === 'source' ? edge.getSourcePortId() : edge.getTargetPortId()
  if (!nodeId) return null

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
    }
  }

  if (!cell.isNode() || !portId) return null

  const point = getPortPoint(cell, portId)
  if (!point) return null

  return {
    kind: 'node',
    node: cell,
    nodeId,
    portId,
    routeNodeId: nodeId,
    routePortId: `${nodeId}:${portId}`,
    point,
    direction: getPortDirection(cell, portId, point),
  }
}

async function routeWithSimulink(
  graph: Graph,
  routableEdges: RoutableEdge[],
  options: RouteDemoOptions,
) {
  if (!routableEdges.length) return []

  const avoid = await ensureSimulinkAvoidReady()
  const router = new avoid.Router(avoid.RouterFlag.OrthogonalRouting.value)

  try {
    configureSimulinkRouter(avoid, router, options)

    const shapes = new Map<string, InstanceType<Avoid['ShapeRef']>>()
    const pins = new Map<string, number>()
    graph.getNodes().forEach((node) => {
      const shapeRef = createSimulinkShape(avoid, router, node)
      shapes.set(node.id, shapeRef)
      node.getPorts().forEach((port, index) => {
        if (!port.id) return
        const point = getPortPoint(node, port.id)
        if (!point) return
        const pinClass = index + 2
        const proportion = getPortProportion(node, point)
        const pin = new avoid.ShapeConnectionPin(
          shapeRef,
          pinClass,
          proportion.x,
          proportion.y,
          true,
          0,
          toSimulinkDirection(getPortDirection(node, port.id, point)),
        )
        pin.setExclusive(false)
        pins.set(`${node.id}:${port.id}`, pinClass)
      })
    })

    const connectors = routableEdges.map((routeEdge) => {
      const sourceShape = shapes.get(routeEdge.source.nodeId)
      const targetShape = shapes.get(routeEdge.target.nodeId)
      const sourcePin = pins.get(routeEdge.source.routePortId)
      const targetPin = pins.get(routeEdge.target.routePortId)
      if (!sourceShape || !targetShape || !sourcePin || !targetPin) {
        throw new Error(
          `[avoid-route] Avoid endpoint missing shape or pin for edge "${routeEdge.edge.id}"`,
        )
      }

      const sourceEnd = new avoid.ConnEnd(sourceShape, sourcePin)
      const targetEnd = new avoid.ConnEnd(targetShape, targetPin)
      const conn = new avoid.ConnRef(router, sourceEnd, targetEnd)
      conn.setRoutingType(avoid.ConnType.ConnType_Orthogonal.value)
      conn.setHateCrossings(options.simulinkCrossingPenalty > 0)

      const checkpoints = createSimulinkCheckpoints(
        avoid,
        routeEdge,
        options.stubSize,
      )
      if (checkpoints) conn.setRoutingCheckpoints(checkpoints)

      return { conn, routeEdge }
    })

    router.processTransaction()

    return connectors.map(({ conn, routeEdge }) => {
      const points = simulinkRouteToPoints(conn.displayRoute())
      assertOrthogonalRoute(routeEdge.edge, points)
      return {
        edge: routeEdge.edge,
        points,
        source: routeEdge.source,
        target: routeEdge.target,
      }
    })
  } finally {
    router.delete()
  }
}

function ensureSimulinkAvoidReady() {
  if (!simulinkAvoidInitPromise) {
    simulinkAvoidInitPromise = AvoidLib.load('/vendor/libavoid.wasm').then(() =>
      AvoidLib.getInstance(),
    )
  }
  return simulinkAvoidInitPromise
}

function configureSimulinkRouter(
  avoid: Avoid,
  router: InstanceType<Avoid['Router']>,
  options: RouteDemoOptions,
) {
  router.setRoutingParameter(
    avoid.RoutingParameter.shapeBufferDistance,
    options.edgeToNodeGap,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.idealNudgingDistance,
    options.edgeToEdgeGap,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.segmentPenalty,
    Math.max(1, options.segmentPenalty),
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.anglePenalty,
    options.anglePenalty,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.crossingPenalty,
    options.simulinkCrossingPenalty,
  )
  router.setRoutingParameter(avoid.RoutingParameter.fixedSharedPathPenalty, 0)
  router.setRoutingParameter(
    avoid.RoutingParameter.reverseDirectionPenalty,
    options.reverseDirectionPenalty,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.portDirectionPenalty,
    options.portDirectionPenalty,
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

function createSimulinkShape(
  avoid: Avoid,
  router: InstanceType<Avoid['Router']>,
  node: Node,
) {
  const bbox = node.getBBox()
  return new avoid.ShapeRef(
    router,
    new avoid.Rectangle(
      new avoid.Point(bbox.x, bbox.y),
      new avoid.Point(bbox.x + bbox.width, bbox.y + bbox.height),
    ),
  )
}

function createSimulinkCheckpoints(
  avoid: Avoid,
  routeEdge: RoutableEdge,
  stubSize: number,
) {
  if (stubSize <= 0) return null
  const checkpoints = new avoid.CheckpointVector()
  const sourceStub = offsetByDirection(
    routeEdge.source.point,
    routeEdge.source.direction,
    stubSize,
  )
  checkpoints.push_back(
    new avoid.Checkpoint(
      new avoid.Point(sourceStub.x, sourceStub.y),
      toSimulinkDirection(routeEdge.source.direction),
      SIMULINK_CONN_DIR_ALL,
    ),
  )

  const targetStub = offsetByDirection(
    routeEdge.target.point,
    routeEdge.target.direction,
    stubSize,
  )
  checkpoints.push_back(
    new avoid.Checkpoint(
      new avoid.Point(targetStub.x, targetStub.y),
      toSimulinkDirection(routeEdge.target.direction),
      toSimulinkDirection(oppositeDirection(routeEdge.target.direction)),
    ),
  )

  return checkpoints
}

function simulinkRouteToPoints(polyline: {
  size: () => number
  at: (index: number) => XY
}) {
  const points: XY[] = []
  for (let index = 0; index < polyline.size(); index++) {
    const point = polyline.at(index)
    points.push({ x: point.x, y: point.y })
  }
  return dedupePoints(points)
}

function toSimulinkDirection(direction: PortDirection) {
  switch (direction) {
    case 'left':
      return SIMULINK_CONN_DIR_LEFT
    case 'right':
      return SIMULINK_CONN_DIR_RIGHT
    case 'top':
      return SIMULINK_CONN_DIR_UP
    case 'bottom':
      return SIMULINK_CONN_DIR_DOWN
  }
}

function oppositeDirection(direction: PortDirection): PortDirection {
  switch (direction) {
    case 'left':
      return 'right'
    case 'right':
      return 'left'
    case 'top':
      return 'bottom'
    case 'bottom':
      return 'top'
  }
}

function assertOrthogonalRoute(edge: Edge, points: XY[]) {
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

function routeWithObstacle(
  graph: Graph,
  routableEdges: RoutableEdge[],
  options: RouteDemoOptions,
) {
  const normalEdges: RoutableEdge[] = []
  const fallbackRoutes: RouteItem[] = []

  routableEdges.forEach((edge) => {
    const context = getEdgeRoutingContext(graph, edge, options)
    if (isEmptyRoutingContext(context)) {
      normalEdges.push(edge)
      return
    }

    fallbackRoutes.push(
      ...routeWithObstacleOnce(graph, [edge], options, context),
    )
  })

  return [
    ...routeWithObstacleOnce(
      graph,
      normalEdges,
      options,
      createRoutingContext(),
    ),
    ...fallbackRoutes,
  ]
}

function routeWithObstacleOnce(
  graph: Graph,
  routableEdges: RoutableEdge[],
  options: RouteDemoOptions,
  context: EdgeRoutingContext,
) {
  if (!routableEdges.length) return []

  const router = new Router(OrthogonalRouting)
  wireObstacleRouter(router)
  router.setRoutingParameter(shapeBufferDistance, options.edgeToNodeGap)
  router.setRoutingParameter(idealNudgingDistance, options.edgeToEdgeGap)
  router.setRoutingParameter(segmentPenalty, options.segmentPenalty)
  router.setRoutingParameter(anglePenalty, options.anglePenalty)
  // Keep obstacle-router's crossing reroute pass disabled; it can hang.
  router.setRoutingParameter(crossingPenalty, 0)
  router.setRoutingParameter(
    reverseDirectionPenalty,
    options.reverseDirectionPenalty,
  )
  router.setRoutingParameter(portDirectionPenalty, options.portDirectionPenalty)
  router.setRoutingOption(nudgeOrthogonalSegmentsConnectedToShapes, true)
  router.setRoutingOption(nudgeSharedPathsWithCommonEndPoint, true)
  router.setRoutingOption(performUnifyingNudgingPreprocessingStep, true)

  const shapeRefs = new Map<string, ShapeRef>()
  const pinClassByPort = new Map<string, number>()
  graph.getNodes().forEach((node) => {
    if (context.ignoredNodeIds.has(node.id)) return
    const bbox = node.getBBox()
    const shapeRef = createObstacleShape(router, bbox)
    shapeRefs.set(node.id, shapeRef)
    node.getPorts().forEach((port, index) => {
      if (!port.id) return
      const point = getPortPoint(node, port.id)
      if (!point) return
      const pinClass = index + 2
      const proportion = getPortProportion(node, point)
      ShapeConnectionPin.createForShape(
        shapeRef as never,
        pinClass,
        proportion.x,
        proportion.y,
        true,
        0,
        toObstacleDirection(getPortDirection(node, port.id, point)),
      ).setExclusive(false)
      pinClassByPort.set(`${node.id}:${port.id}`, pinClass)
    })
  })
  const connectors = routableEdges.flatMap((item) => {
    const sourceShape = shapeRefs.get(item.source.routeNodeId)
    const targetShape = shapeRefs.get(item.target.routeNodeId)
    const sourcePin = pinClassByPort.get(item.source.routePortId)
    const targetPin = pinClassByPort.get(item.target.routePortId)
    const sourceAsPoint = context.pointTerminals.has('source')
    const targetAsPoint = context.pointTerminals.has('target')

    if (!sourceAsPoint && (!sourceShape || !sourcePin)) return []
    if (!targetAsPoint && (!targetShape || !targetPin)) return []
    const conn = new ConnRef(
      router,
      getObstacleConnEnd(
        item.source,
        sourceAsPoint ? undefined : sourceShape,
        sourceAsPoint ? undefined : sourcePin,
      ),
      getObstacleConnEnd(
        item.target,
        targetAsPoint ? undefined : targetShape,
        targetAsPoint ? undefined : targetPin,
      ),
    )
    conn.setRoutingType(ConnType_Orthogonal)
    const checkpoints = getStubCheckpoints(item, options.stubSize)
    if (checkpoints.length) conn.setRoutingCheckpoints(checkpoints)
    return [{ ...item, conn }]
  })

  router.processTransaction()

  return connectors.map((item) => ({
    edge: item.edge,
    points: polygonToPoints(item.conn.displayRoute()),
    source: item.source,
    target: item.target,
  }))
}

function applyBranchEdgesWithX6Manhattan(
  routableEdges: RoutableEdge[],
  options: RouteDemoOptions,
) {
  routableEdges.forEach(({ edge, source, target }) => {
    edge.attr('line/visibility', 'visible', { ui: true, ignore: true })
    edge.setVertices([], { ui: true, ignore: true })
    edge.setRouter(
      'manhattan',
      {
        step: GRAPH_GRID,
        padding: 45,
        startDirections: [source.direction],
        endDirections: [target.direction],
      },
      { ui: true, ignore: true },
    )
    edge.setConnector(
      'jumpover',
      {
        type: 'gap',
        size: options.gapSize,
        radius: options.cornerRadius,
      },
      { ui: true, ignore: true },
    )
  })
}

function applyX6BuiltInRouter(
  routableEdges: RoutableEdge[],
  options: RouteDemoOptions,
) {
  routableEdges.forEach(({ edge, source, target }) => {
    edge.attr('line/visibility', 'visible', { ui: true, ignore: true })
    edge.setVertices([], { ui: true, ignore: true })

    if (options.engine === 'orth') {
      edge.setRouter(
        'orth',
        {
          padding: options.x6RouterPadding,
        },
        { ui: true, ignore: true },
      )
    } else {
      edge.setRouter(
        'manhattan',
        {
          padding: options.x6RouterPadding,
          step: options.x6RouterStep,
          maxLoopCount: options.x6RouterMaxLoopCount,
          precision: options.x6RouterPrecision,
          maxDirectionChange: options.x6RouterMaxDirectionChange,
          perpendicular: options.x6RouterPerpendicular,
          snapToGrid: options.x6RouterSnapToGrid,
          startDirections: [source.direction],
          endDirections: [target.direction],
        },
        { ui: true, ignore: true },
      )
    }

    edge.setConnector(
      'jumpover',
      {
        type: 'gap',
        size: options.gapSize,
        radius: options.cornerRadius,
      },
      { ui: true, ignore: true },
    )
  })
}

function hasBranchTerminal(edge: RoutableEdge) {
  return edge.source.kind === 'branch' || edge.target.kind === 'branch'
}

function applyRoutes(
  routes: RouteItem[],
  options: RouteDemoOptions,
  normalize = true,
) {
  routes.forEach(({ edge, points, source, target }) => {
    const normalized = normalize
      ? normalizeRoutePoints(points, source, target, options)
      : dedupePoints(points)
    const vertices = normalized.slice(1, -1)
    edge.removeRouter({ ui: true, ignore: true })
    edge.setVertices(vertices, { ui: true, ignore: true })
    edge.attr('line/visibility', 'visible', { ui: true, ignore: true })
    edge.setConnector(
      'jumpover',
      {
        type: 'gap',
        size: options.gapSize,
        radius: options.cornerRadius,
      },
      { ui: true, ignore: true },
    )
  })
}

function createRoutingContext(): EdgeRoutingContext {
  return {
    ignoredNodeIds: new Set<string>(),
    pointTerminals: new Set<TerminalRole>(),
  }
}

function isEmptyRoutingContext(context: EdgeRoutingContext) {
  return context.ignoredNodeIds.size === 0 && context.pointTerminals.size === 0
}

function getEdgeRoutingContext(
  graph: Graph,
  edge: RoutableEdge,
  options: RouteDemoOptions,
) {
  const context = createRoutingContext()
  const terminalNodeIds = new Set(
    [edge.source, edge.target]
      .filter(
        (terminal): terminal is NodeTerminalInfo => terminal.kind === 'node',
      )
      .map((terminal) => terminal.nodeId),
  )

  graph.getNodes().forEach((node) => {
    if (terminalNodeIds.has(node.id)) return

    const effectiveBBox = inflateBBox(node.getBBox(), options.edgeToNodeGap)
    if (
      isTerminalBlockedByBBox(edge.source, effectiveBBox, options) ||
      isTerminalBlockedByBBox(edge.target, effectiveBBox, options)
    ) {
      context.ignoredNodeIds.add(node.id)
    }
  })

  addTerminalObstacleFallback(context, edge, options)

  return context
}

function addTerminalObstacleFallback(
  context: EdgeRoutingContext,
  edge: RoutableEdge,
  options: RouteDemoOptions,
) {
  if (edge.source.kind === 'node' && edge.target.kind === 'node') {
    maybeIgnoreBlockingTerminal(
      context,
      'source',
      edge.source,
      edge.target,
      options,
    )
    maybeIgnoreBlockingTerminal(
      context,
      'target',
      edge.target,
      edge.source,
      options,
    )
  }
}

function maybeIgnoreBlockingTerminal(
  context: EdgeRoutingContext,
  blockerRole: TerminalRole,
  blocker: NodeTerminalInfo,
  peer: NodeTerminalInfo,
  options: RouteDemoOptions,
) {
  const effectiveBBox = inflateBBox(
    blocker.node.getBBox(),
    options.edgeToNodeGap,
  )
  if (!isTerminalBlockedByBBox(peer, effectiveBBox, options)) return

  context.ignoredNodeIds.add(blocker.nodeId)
  context.pointTerminals.add(blockerRole)
}

function isTerminalBlockedByBBox(
  terminal: AnyTerminalInfo,
  effectiveBBox: BBox,
  options: RouteDemoOptions,
) {
  if (pointInBBox(terminal.point, effectiveBBox)) return true

  const clearance = Math.max(
    options.stubSize,
    options.edgeToNodeGap,
    GRAPH_GRID,
  )
  const forwardPoint = offsetByDirection(
    terminal.point,
    terminal.direction,
    clearance,
  )
  return segmentIntersectsBBox(terminal.point, forwardPoint, effectiveBBox)
}

function inflateBBox(bbox: BBox, padding: number): BBox {
  return {
    x: bbox.x - padding,
    y: bbox.y - padding,
    width: bbox.width + padding * 2,
    height: bbox.height + padding * 2,
  }
}

function pointInBBox(point: XY, bbox: BBox) {
  return (
    point.x >= bbox.x &&
    point.x <= bbox.x + bbox.width &&
    point.y >= bbox.y &&
    point.y <= bbox.y + bbox.height
  )
}

function segmentIntersectsBBox(a: XY, b: XY, bbox: BBox) {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  return (
    minX <= bbox.x + bbox.width &&
    maxX >= bbox.x &&
    minY <= bbox.y + bbox.height &&
    maxY >= bbox.y
  )
}

function normalizeRoutePoints(
  points: XY[],
  source: AnyTerminalInfo,
  target: AnyTerminalInfo,
  options: RouteDemoOptions,
) {
  const withTerminals = [
    source.point,
    ...points.filter(
      (point) =>
        !samePoint(point, source.point) && !samePoint(point, target.point),
    ),
    target.point,
  ]
  const withStubs = applyStubPoints(
    withTerminals,
    source,
    target,
    options.stubSize,
  )
  const snapped =
    options.gridSize > 0
      ? withStubs.map((point) => snapPoint(point, options.gridSize))
      : withStubs
  return dedupePoints(snapped)
}

function applyStubPoints(
  points: XY[],
  source: AnyTerminalInfo,
  target: AnyTerminalInfo,
  stubSize: number,
) {
  if (stubSize <= 0) return points
  const sourceStub =
    source.kind === 'branch'
      ? null
      : offsetByDirection(source.point, source.direction, stubSize)
  const targetStub =
    target.kind === 'branch'
      ? null
      : offsetByDirection(target.point, target.direction, stubSize)
  return [
    points[0],
    ...(sourceStub ? [sourceStub] : []),
    ...points.slice(1, -1),
    ...(targetStub ? [targetStub] : []),
    points.at(-1)!,
  ]
}

function getStubCheckpoints(edge: RoutableEdge, stubSize: number) {
  if (stubSize <= 0) return []
  const checkpoints: Checkpoint[] = []
  if (edge.source.kind !== 'branch') {
    checkpoints.push(
      new Checkpoint(
        toObstaclePoint(
          offsetByDirection(edge.source.point, edge.source.direction, stubSize),
        ),
        toObstacleDirection(edge.source.direction),
        ConnDirAll,
      ),
    )
  }
  if (edge.target.kind !== 'branch') {
    checkpoints.push(
      new Checkpoint(
        toObstaclePoint(
          offsetByDirection(edge.target.point, edge.target.direction, stubSize),
        ),
        ConnDirAll,
        toObstacleDirection(edge.target.direction),
      ),
    )
  }
  return checkpoints
}

function getObstacleConnEnd(
  terminal: AnyTerminalInfo,
  shapeRef?: ShapeRef,
  pinClass?: number,
) {
  if (!shapeRef || !pinClass) {
    return ConnEnd.fromPoint(toObstaclePoint(terminal.point))
  }
  return ConnEnd.fromShapePin(shapeRef as never, pinClass)
}

function createObstacleShape(router: Router, bbox: BBox) {
  return new ShapeRef(
    router as never,
    new Rectangle(
      new Point(bbox.x, bbox.y),
      new Point(bbox.x + bbox.width, bbox.y + bbox.height),
    ),
  )
}

function getBranchTerminalPoint(
  graph: Graph,
  edge: Edge,
  terminal: 'source' | 'target',
): XY | null {
  const terminalConfig = getTerminalConfig(edge, terminal)
  const parentEdgeId = terminalConfig?.cell
  if (!parentEdgeId) return null

  const parentEdge = graph.getCellById(parentEdgeId)
  if (!parentEdge?.isEdge()) return null

  const parentEdgeView = graph.findViewByCell(parentEdge) as
    | EdgeView
    | undefined
  if (!parentEdgeView) return null

  const ratio = getTerminalRatio(terminalConfig)
  const point = parentEdgeView.getPointAtRatio(ratio)
  if (!point) return null

  return { x: point.x, y: point.y }
}

function getBranchDirection(
  graph: Graph,
  parentEdge: Edge,
  branchEdge: Edge,
  terminal: 'source' | 'target',
  branchPoint: XY,
): PortDirection {
  const parentEdgeView = graph.findViewByCell(parentEdge) as
    | EdgeView
    | undefined
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

function inferBranchDirectionFromPeer(
  branchEdge: Edge,
  terminal: 'source' | 'target',
  branchPoint: XY,
): PortDirection {
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

function getTerminalPoint(
  edge: Edge,
  terminal: 'source' | 'target',
): XY | null {
  const terminalConfig =
    terminal === 'source' ? edge.getSource() : edge.getTarget()
  const point = terminalConfig as { x?: number; y?: number }
  if (typeof point.x === 'number' && typeof point.y === 'number') {
    return { x: point.x, y: point.y }
  }
  return null
}

function getPerpendicularDirection(
  parentDirection: PortDirection,
  branchPoint: XY,
  peerPoint: XY,
): PortDirection {
  if (parentDirection === 'left' || parentDirection === 'right') {
    return peerPoint.y >= branchPoint.y ? 'bottom' : 'top'
  }
  return peerPoint.x >= branchPoint.x ? 'right' : 'left'
}

function getTerminalConfig(edge: Edge, terminal: 'source' | 'target') {
  return (terminal === 'source' ? edge.getSource() : edge.getTarget()) as
    | {
        cell?: string
        anchor?: {
          name?: string
          args?: {
            ratio?: number
          }
        }
      }
    | undefined
}

function getTerminalRatio(
  terminal:
    | {
        anchor?: {
          args?: {
            ratio?: number
          }
        }
      }
    | undefined,
) {
  const ratio = terminal?.anchor?.args?.ratio
  return typeof ratio === 'number' ? ratio : 0.5
}

function getPortPoint(node: Node, portId: string): XY | null {
  const port = node.getPort(portId)
  if (!port?.group) return null
  const layout = node.getPortsPosition(port.group)[portId]
  if (!layout) return null
  const position = node.getPosition()
  return {
    x: position.x + layout.position.x,
    y: position.y + layout.position.y,
  }
}

function getPortDirection(
  node: Node,
  portId: string,
  point: XY,
): PortDirection {
  const port = node.getPort(portId) as
    | { group?: string; position?: PortPositionLike }
    | undefined
  const groupPosition = getPortGroupPosition(node, port?.group)
  const declared = normalizePortDirection(port?.position ?? groupPosition)
  if (declared) return declared

  const bbox = node.getBBox()
  const distances = [
    { direction: 'left' as const, value: Math.abs(point.x - bbox.x) },
    {
      direction: 'right' as const,
      value: Math.abs(point.x - (bbox.x + bbox.width)),
    },
    { direction: 'top' as const, value: Math.abs(point.y - bbox.y) },
    {
      direction: 'bottom' as const,
      value: Math.abs(point.y - (bbox.y + bbox.height)),
    },
  ]
  distances.sort((a, b) => a.value - b.value)
  return distances[0].direction
}

function getPortGroupPosition(node: Node, groupName?: string) {
  if (!groupName) return null
  return ((node as unknown as PortNode).ports.groups?.[groupName]?.position ??
    null) as PortPositionLike | null
}

function normalizePortDirection(position?: PortPositionLike | null) {
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

function getPortProportion(node: Node, point: XY) {
  const bbox = node.getBBox()
  return {
    x: clamp((point.x - bbox.x) / bbox.width, 0, 1),
    y: clamp((point.y - bbox.y) / bbox.height, 0, 1),
  }
}

function offsetByDirection(
  point: XY,
  direction: PortDirection,
  distance: number,
) {
  switch (direction) {
    case 'left':
      return { x: point.x - distance, y: point.y }
    case 'right':
      return { x: point.x + distance, y: point.y }
    case 'top':
      return { x: point.x, y: point.y - distance }
    case 'bottom':
      return { x: point.x, y: point.y + distance }
  }
}

function toObstacleDirection(direction: PortDirection) {
  switch (direction) {
    case 'left':
      return ConnDirLeft
    case 'right':
      return ConnDirRight
    case 'top':
      return ConnDirUp
    case 'bottom':
      return ConnDirDown
  }
}

function toObstaclePoint(point: XY) {
  return new Point(point.x, point.y)
}

function polygonToPoints(polygon: {
  size: () => number
  at: (index: number) => XY
}) {
  const points: XY[] = []
  for (let i = 0; i < polygon.size(); i++) {
    const point = polygon.at(i)
    points.push({ x: point.x, y: point.y })
  }
  return points
}

function dedupePoints(points: XY[]) {
  return points.filter((point, index) => {
    if (index === 0) return true
    return !samePoint(point, points[index - 1])
  })
}

function samePoint(a: XY, b: XY) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5
}

function snapPoint(point: XY, gridSize: number) {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isPreviewEdge(edge: Edge) {
  return edge.getAttrs()?.line?.stroke === RED
}

function wireObstacleRouter(router: Router) {
  const writableRouter = router as unknown as Record<string, unknown>
  writableRouter._generateStaticOrthogonalVisGraph =
    generateStaticOrthogonalVisGraph
  writableRouter._improveOrthogonalRoutes = improveOrthogonalRoutes
  writableRouter._ConnectorCrossings = ConnectorCrossings
  writableRouter._AStarPath = AStarPath
  writableRouter._vertexVisibility = vertexVisibility
}

type PortPositionLike = string | { name?: string }
type PortNode = Node & {
  ports: {
    groups?: Record<string, { position?: PortPositionLike }>
  }
}

export { routeAllEdges }
