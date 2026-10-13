import { AvoidLib } from 'libavoid-js'
import {
  GAP_SIZE,
  GRAPH_GRID,
  PORT_STUB_SIZE,
  RED,
  NODE_ROUTE_RESET_DISTANCE,
} from '@/assets/constant'
import {
  repairManualRoute,
  validRoute,
  scoreFixedPaths,
} from './routing-geometry'
import {
  getRoutingSession,
  invalidateRouting,
  isRoutingReplay,
  routingMode,
  sameVertices,
} from './routing-session'
// 参数配置
const ROUTE_OPTIONS = {
  edgeToNodeGap: 20,
  edgeToEdgeGap: 10,
  stubSize: PORT_STUB_SIZE,
  segmentPenalty: 80,
  anglePenalty: 100,
  crossingPenalty: 1500,
  reverseDirectionPenalty: 200,
  portDirectionPenalty: 100,
  gridSize: 0,
  gapSize: GAP_SIZE,
  cornerRadius: 0,
}
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
function routeAllEdges(graph) {
  return routeEdges(graph, graph.getEdges(), { reason: 'global', force: true })
}
function routeEdge(edge, options = {}) {
  const graph = edge.model?.graph
  return graph ? routeEdges(graph, [edge], options) : Promise.resolve()
}
function connectedNodeEdges(graph, nodes) {
  return [
    ...new Set(nodes.flatMap((node) => graph.getConnectedEdges(node) ?? [])),
  ]
}
function withDependentEdges(graph, edges) {
  const result = new Set(edges)
  for (const parent of result) {
    graph.getEdges().forEach((edge) => {
      if ([edge.getSourceCellId(), edge.getTargetCellId()].includes(parent.id))
        result.add(edge)
    })
  }
  return [...result]
}
function routeNodeEdges(graph, nodes, options = {}) {
  const state = getRoutingSession(graph)
  const forced = new Set()
  if (!options.reason || options.reason === 'node') {
    for (const node of nodes) {
      const drag = state.nodeDrags.get(node)
      if (!drag) continue
      const position = node.getPosition()
      // Latch at request time: frame coalescing must not lose a threshold crossing.
      if (
        Math.hypot(position.x - drag.x, position.y - drag.y) >
        NODE_ROUTE_RESET_DISTANCE
      )
        drag.relayout = true
      if (drag.relayout)
        connectedNodeEdges(graph, [node]).forEach((edge) => forced.add(edge))
    }
  }
  const edges = connectedNodeEdges(graph, nodes)
  if (forced.size)
    routeEdges(graph, [...forced], { ...options, reason: 'node', force: true })
  return routeEdges(
    graph,
    edges.filter((edge) => !forced.has(edge)),
    { reason: 'node', ...options },
  )
}
function captureNodeRoutes(graph, nodes) {
  captureEdgeRoutes(graph, connectedNodeEdges(graph, nodes))
  const state = getRoutingSession(graph)
  nodes.forEach((node) => {
    if (!state.nodeDrags.has(node))
      state.nodeDrags.set(node, { ...node.getPosition(), relayout: false })
  })
  withDependentEdges(graph, connectedNodeEdges(graph, nodes)).forEach(
    (edge) => {
      const snapshot = state.snapshots.get(edge)
      if (snapshot) snapshot.gesture = true
    },
  )
}
function captureEdgeRoutes(graph, edges, { gesture = false } = {}) {
  const state = getRoutingSession(graph)
  for (const edge of withDependentEdges(graph, edges)) {
    if (state.snapshots.get(edge)?.gesture) continue
    const source = getTerminalInfo(graph, edge, 'source')
    const target = getTerminalInfo(graph, edge, 'target')
    if (source && target)
      state.snapshots.set(edge, {
        source,
        target,
        mode: routingMode(edge),
        gesture,
        points: getExistingRoutePoints(graph, { edge, source, target }),
      })
  }
}
function finishNodeRoutes(graph, nodes) {
  const state = getRoutingSession(graph)
  nodes.forEach((node) => state.nodeDrags.delete(node))
  finishEdgeRoutes(graph, connectedNodeEdges(graph, nodes))
}
function finishEdgeRoutes(graph, edges) {
  const state = getRoutingSession(graph)
  withDependentEdges(graph, edges).forEach((edge) =>
    state.snapshots.delete(edge),
  )
}
function beginManualEdgeEdit(edge) {
  const graph = edge.model?.graph
  if (!graph) return
  const state = getRoutingSession(graph)
  captureEdgeRoutes(
    graph,
    withDependentEdges(graph, [edge]).filter((child) => child !== edge),
  )
  state.editing.add(edge)
  state.pending.delete(edge)
  state.snapshots.delete(edge)
  state.revision++
}
function finishManualEdgeEdit(edge, original) {
  const graph = edge.model?.graph
  if (!graph) return Promise.resolve()
  const state = getRoutingSession(graph)
  state.editing.delete(edge)
  if (sameVertices(original, edge.getVertices())) {
    withDependentEdges(graph, [edge]).forEach((child) => {
      if (!state.snapshots.get(child)?.gesture) state.snapshots.delete(child)
    })
    return Promise.resolve()
  }
  edge.setData({ routingMode: 'manual' }, { routingWrite: true })
  return routeDependentEdges(edge)
}
function routeDependentEdges(edge) {
  const graph = edge.model?.graph
  if (!graph) return Promise.resolve()
  const children = graph
    .getEdges()
    .filter(
      (child) =>
        child !== edge &&
        [child.getSourceCellId(), child.getTargetCellId()].includes(edge.id),
    )
  return routeEdges(graph, children, { reason: 'parent' })
}
function routeEdges(graph, edges, options = {}) {
  const state = getRoutingSession(graph)
  if (state.disposed || isRoutingReplay(graph)) return Promise.resolve()
  for (const edge of edges) {
    if (graph.getCellById(edge.id) !== edge || state.editing.has(edge)) continue
    const previous = state.pending.get(edge)
    state.pending.set(edge, {
      ...previous,
      ...options,
      force: !!(previous?.force || options.force),
    })
  }
  if (!state.pending.size) return state.promise ?? Promise.resolve()
  if (!state.promise) {
    state.promise = drainRouteQueue(graph, state).finally(() => {
      state.promise = null
      // A listener may enqueue in a microtask after drain's last synchronous pass.
      if (!state.disposed && state.pending.size) return routeEdges(graph, [])
    })
  }
  return state.promise
}
async function drainRouteQueue(graph, state) {
  // Merge event bursts and wait for WASM before taking geometry snapshots.
  await new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function')
      requestAnimationFrame(resolve)
    else setTimeout(resolve, 0)
  })
  const avoid = await ensureAvoidReady()
  while (!state.disposed && state.pending.size) {
    const epoch = state.epoch
    const requests = new Map(state.pending)
    state.pending.clear()
    const all = getRoutableEdges(graph)
    const byId = new Map(all.map((entry) => [entry.edge.id, entry]))
    const active = new Map()
    function include(entry, options, ancestors = new Set()) {
      if (!entry || state.editing.has(entry.edge) || ancestors.has(entry.edge))
        return
      const previous = active.get(entry.edge)
      active.set(entry.edge, {
        ...options,
        ...previous,
        force: !!(previous?.force || options.force),
      })
      if (previous && (!options.force || previous.force)) return
      const next = new Set(ancestors).add(entry.edge)
      all
        .filter(
          (child) =>
            child.source.nodeId === entry.edge.id ||
            child.target.nodeId === entry.edge.id,
        )
        .forEach((child) =>
          include(child, { reason: 'parent', force: options.force }, next),
        )
    }
    requests.forEach((options, edge) => {
      if (graph.getCellById(edge.id) === edge)
        include(byId.get(edge.id), options)
    })
    const fixed = all
      .filter((entry) => !active.has(entry.edge))
      .map((entry) => ({
        edge: entry.edge,
        points: getExistingRoutePoints(graph, entry),
      }))
      .filter((entry) => entry.points.length > 1)
    const remaining = new Set(active.keys())
    // Parents are committed first, then branch anchors are read from their updated geometry.
    while (remaining.size && epoch === state.epoch && !state.disposed) {
      const ready = [...remaining].filter(
        (edge) =>
          !remaining.has(graph.getCellById(edge.getSourceCellId())) &&
          !remaining.has(graph.getCellById(edge.getTargetCellId())),
      )
      if (!ready.length) break // Invalid cyclic edge dependencies must not loop or clear paths.
      const automatic = []
      for (const edge of ready) {
        remaining.delete(edge)
        if (graph.getCellById(edge.id) !== edge || state.editing.has(edge))
          continue
        const source = getTerminalInfo(graph, edge, 'source')
        const target = getTerminalInfo(graph, edge, 'target')
        if (!source || !target) continue
        alignBranchDirections(source, target)
        const entry = { edge, source, target }
        const options = active.get(edge)
        const snapshot = state.snapshots.get(edge)
        const manual =
          !options.force && (snapshot?.mode ?? routingMode(edge)) === 'manual'
        const current = getExistingRoutePoints(graph, entry)
        let points = null
        if (
          !options.force &&
          options.preserveVertices &&
          validRoute(current, entry, nodeBoxes(graph))
        ) {
          points = current
        } else if (manual) {
          points = repairManualRoute(
            entry,
            snapshot ?? { source, target, points: current },
            (partial) =>
              routeWithAvoidAttempt(graph, [partial], avoid, 0, 0, fixed)[0]
                ?.points,
            nodeBoxes(graph),
          )
        }
        if (points) {
          applyRoutes([{ ...entry, points }], {
            mode: manual ? 'manual' : routingMode(edge),
          })
          fixed.push({ edge, points })
        } else if (hasBranchTerminal(entry) && !manual) {
          fallbackEdgeToManhattan(edge, source.direction, target.direction)
          edge.setData(
            { routingMode: 'auto' },
            { routingWrite: true, undo: !isInsertionPreview(edge) },
          )
          graph.findViewByCell(edge)?.update?.()
          fixed.push({ edge, points: getExistingRoutePoints(graph, entry) })
        } else automatic.push({ ...entry, manual })
      }
      const revision = state.revision
      const routes = routeWithAvoid(graph, automatic, avoid, fixed)
      if (epoch !== state.epoch || state.disposed) break
      if (revision !== state.revision) {
        active.forEach((options, edge) => {
          if (graph.getCellById(edge.id) === edge && !state.editing.has(edge))
            state.pending.set(edge, options)
        })
        break
      }
      for (const route of routes) {
        if (
          graph.getCellById(route.edge.id) !== route.edge ||
          state.editing.has(route.edge)
        )
          continue
        applyRoutes([route], { mode: route.manual ? 'manual' : 'auto' })
        fixed.push({ edge: route.edge, points: route.points })
      }
      ready.forEach((edge) => graph.findViewByCell(edge)?.update?.())
    }
    active.forEach((_, edge) => {
      if (!state.snapshots.get(edge)?.gesture) state.snapshots.delete(edge)
    })
  }
}
function nodeBoxes(graph) {
  return graph
    .getNodes()
    .filter(isRoutingNode)
    .map((node) => ({ ...getRotatedNodeBBox(node), id: node.id }))
}
function isInsertionPreview(edge) {
  return edge.getData()?.[INSERT_PREVIEW] === true
}
function routeWriteOptions(edge) {
  return {
    ui: true,
    ignore: true,
    routingWrite: true,
    ...(isInsertionPreview(edge) ? { undo: false } : {}),
  }
}
function getExistingRoutePoints(graph, { edge, source, target }) {
  if (edge.getRouter()) {
    const view = graph.findViewByCell(edge)
    // routePoints is X6's routed polyline before jumpover/corner decoration.
    if (view?.routePoints)
      return dedupePoints([
        view.sourcePoint,
        ...view.routePoints,
        view.targetPoint,
      ])
  }
  return dedupePoints([source.point, ...edge.getVertices(), target.point])
}
function getRoutableEdges(graph) {
  return graph
    .getEdges()
    .map((edge) => {
      if (isPreviewEdge(edge)) return null
      if (edge.isVisible?.() === false) return null
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
function routeWithAvoid(graph, routableEdges, avoid, fixed = []) {
  if (!routableEdges.length) return []
  const routes = routeWithAvoidAttempt(
    graph,
    routableEdges,
    avoid,
    undefined,
    undefined,
    fixed,
  )
  const failed = routableEdges.filter((_, index) => !routes[index])
  if (failed.length) {
    const completed = routes
      .filter(Boolean)
      .map((route) => ({ edge: route.edge, points: route.points }))
    const relaxed = routeWithAvoidAttempt(graph, failed, avoid, 0, 0, [
      ...fixed,
      ...completed,
    ])
    let retryIndex = 0
    routes.forEach((route, index) => {
      if (!route) routes[index] = relaxed[retryIndex++]
    })
  }
  const completed = [
    ...fixed,
    ...routes
      .filter(Boolean)
      .map((route) => ({ edge: route.edge, points: route.points })),
  ]
  return routes.map((route, index) => ({
    ...(route ??
      createOrthogonalFallback(graph, routableEdges[index], completed)),
    manual: routableEdges[index].manual,
  }))
}
function routeWithAvoidAttempt(
  graph,
  routableEdges,
  avoid,
  edgeToNodeGap = ROUTE_OPTIONS.edgeToNodeGap,
  edgeToEdgeGap = ROUTE_OPTIONS.edgeToEdgeGap,
  fixed = [],
) {
  if (!routableEdges.length) return []
  const router = new avoid.Router(avoid.RouterFlag.OrthogonalRouting.value)
  try {
    configureAvoidRouter(avoid, router, edgeToNodeGap, edgeToEdgeGap)
    for (const path of fixed) {
      if (path.points.length < 2) continue
      const first = new avoid.Point(path.points[0].x, path.points[0].y)
      const last = new avoid.Point(path.points.at(-1).x, path.points.at(-1).y)
      const source = new avoid.ConnEnd(first),
        target = new avoid.ConnEnd(last)
      const connection = new avoid.ConnRef(router, source, target)
      connection.setRoutingType(avoid.ConnType.ConnType_Orthogonal.value)
      const polygon = new avoid.Polygon(path.points.length)
      path.points.forEach((point, index) => {
        const native = new avoid.Point(point.x, point.y)
        polygon.setPoint(index, native)
        native.delete()
      })
      connection.setFixedRoute(polygon)
      polygon.delete()
      source.delete()
      target.delete()
      first.delete()
      last.delete()
    }
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
          shapes.set(terminal.routeNodeId, createAvoidBox(avoid, router, bbox))
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
      sourceEnd.delete()
      targetEnd.delete()
      conn.setRoutingType(avoid.ConnType.ConnType_Orthogonal.value)
      conn.setHateCrossings(ROUTE_OPTIONS.crossingPenalty > 0)
      return { conn, routeEdge }
    })
    try {
      router.processTransaction()
    } catch (error) {
      console.warn('[avoid-route] transaction failed', error)
      return routableEdges.map(() => null)
    }
    return connectors.map(({ conn, routeEdge }) => {
      try {
        const polyline = conn.displayRoute()
        let points
        try {
          points = avoidRouteToPoints(polyline)
        } finally {
          polyline.delete()
        }
        assertOrthogonalRoute(routeEdge.edge, points)
        const terminalPoints = applyTerminalGeometry(routeEdge, points)
        assertTerminalStubRoute(routeEdge, terminalPoints)
        return {
          edge: routeEdge.edge,
          points: terminalPoints,
          source: routeEdge.source,
          target: routeEdge.target,
        }
      } catch (error) {
        console.warn('[avoid-route] invalid result', error)
        return null
      }
    })
  } finally {
    router.delete?.()
  }
}
function ensureAvoidReady() {
  if (!avoidInitPromise) {
    avoidInitPromise = AvoidLib.load()
      .then(() => AvoidLib.getInstance())
      .catch((error) => {
        avoidInitPromise = null
        throw error
      })
  }
  return avoidInitPromise
}
async function ensureRoutingReady() {
  await ensureAvoidReady()
}
function configureAvoidRouter(
  avoid,
  router,
  edgeToNodeGap = ROUTE_OPTIONS.edgeToNodeGap,
  edgeToEdgeGap = ROUTE_OPTIONS.edgeToEdgeGap,
) {
  router.setRoutingParameter(
    avoid.RoutingParameter.shapeBufferDistance,
    edgeToNodeGap,
  )
  router.setRoutingParameter(
    avoid.RoutingParameter.idealNudgingDistance,
    edgeToEdgeGap,
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
  router.setRoutingParameter(
    avoid.RoutingParameter.fixedSharedPathPenalty,
    1500,
  )
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
  return createAvoidBox(avoid, router, getRotatedNodeBBox(node))
}
function createAvoidBox(avoid, router, bbox) {
  const first = new avoid.Point(bbox.x, bbox.y)
  const last = new avoid.Point(bbox.x + bbox.width, bbox.y + bbox.height)
  const rectangle = new avoid.Rectangle(first, last)
  try {
    return new avoid.ShapeRef(router, rectangle)
  } finally {
    rectangle.delete()
    first.delete()
    last.delete()
  }
}
function createAvoidEndpointShape(avoid, router, point) {
  return createAvoidBox(avoid, router, {
    x: point.x - 0.5,
    y: point.y - 0.5,
    width: 1,
    height: 1,
  })
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
function createOrthogonalFallback(graph, routeEdge, fixed = []) {
  const { source, target, edge } = routeEdge
  const sourceStub = source.hasStub ? source.stubPoint : source.point
  const targetStub = target.hasStub ? target.stubPoint : target.point
  const boxes = [
    ...graph.getNodes().filter(isRoutingNode).map(getRotatedNodeBBox),
    ...[source, target]
      .filter((terminal) => terminal.kind === 'virtualNode')
      .map((terminal) => terminal.bbox),
  ]
  const margin = ROUTE_OPTIONS.stubSize + ROUTE_OPTIONS.edgeToNodeGap
  const left =
    Math.min(sourceStub.x, targetStub.x, ...boxes.map((box) => box.x)) - margin
  const right =
    Math.max(
      sourceStub.x,
      targetStub.x,
      ...boxes.map((box) => box.x + box.width),
    ) + margin
  const top =
    Math.min(sourceStub.y, targetStub.y, ...boxes.map((box) => box.y)) - margin
  const bottom =
    Math.max(
      sourceStub.y,
      targetStub.y,
      ...boxes.map((box) => box.y + box.height),
    ) + margin
  const middleX = (sourceStub.x + targetStub.x) / 2
  const middleY = (sourceStub.y + targetStub.y) / 2
  const candidates = [
    [sourceStub, { x: targetStub.x, y: sourceStub.y }, targetStub],
    [sourceStub, { x: sourceStub.x, y: targetStub.y }, targetStub],
    ...[middleX, left, right].map((x) => [
      sourceStub,
      { x, y: sourceStub.y },
      { x, y: targetStub.y },
      targetStub,
    ]),
    ...[middleY, top, bottom].map((y) => [
      sourceStub,
      { x: sourceStub.x, y },
      { x: targetStub.x, y },
      targetStub,
    ]),
  ]
  const routes = candidates.map((candidate) =>
    dedupePoints([source.point, ...candidate, target.point]),
  )
  const valid = routes.filter((candidate) =>
    validRoute(candidate, routeEdge, boxes),
  )
  const candidatesWithValidTerminals = routes.filter((candidate) =>
    validRoute(candidate, routeEdge, []),
  )
  const pool = valid.length
    ? valid
    : candidatesWithValidTerminals.length
      ? candidatesWithValidTerminals
      : routes
  const points = pool.reduce((best, candidate) =>
    scoreOrthogonalFallback(candidate, boxes) +
      scoreFixedPaths(candidate, fixed) <
    scoreOrthogonalFallback(best, boxes) + scoreFixedPaths(best, fixed)
      ? candidate
      : best,
  )
  assertTerminalStubRoute(routeEdge, points)
  return { edge, points, source, target }
}
function scoreOrthogonalFallback(points, boxes) {
  let score = 0
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]
    const current = points[index]
    score += Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)
    for (const box of boxes) {
      if (previous.y === current.y) {
        if (previous.y <= box.y || previous.y >= box.y + box.height) continue
        score +=
          1000 *
          Math.max(
            0,
            Math.min(Math.max(previous.x, current.x), box.x + box.width) -
              Math.max(Math.min(previous.x, current.x), box.x),
          )
      } else {
        if (previous.x <= box.x || previous.x >= box.x + box.width) continue
        score +=
          1000 *
          Math.max(
            0,
            Math.min(Math.max(previous.y, current.y), box.y + box.height) -
              Math.max(Math.min(previous.y, current.y), box.y),
          )
      }
    }
  }
  return score + points.length * 5
}
function avoidRouteToPoints(polyline) {
  const points = []
  for (let index = 0; index < polyline.size(); index++) {
    const point = polyline.at(index)
    points.push({ x: point.x, y: point.y })
    point.delete?.()
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
    default:
      return 15
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
function applyRoutes(routes, { mode = 'auto' } = {}) {
  routes.forEach(({ edge, points, source, target }) => {
    const routedPoints =
      ROUTE_OPTIONS.gridSize > 0
        ? points.map((point) => snapPoint(point, ROUTE_OPTIONS.gridSize))
        : points
    const normalized = dedupePoints(routedPoints)
    // 端口 stub 必须留在路径里；其余共线中间点会破坏整段拖动。
    const protectedIndices = new Set([0, normalized.length - 1])
    if (source.hasStub) protectedIndices.add(1)
    if (target.hasStub) protectedIndices.add(normalized.length - 2)
    const vertices = simplifyRoutePoints(normalized, protectedIndices).slice(
      1,
      -1,
    )
    const options = routeWriteOptions(edge)
    edge.removeRouter(options)
    if (!sameVertices(edge.getVertices(), vertices))
      edge.setVertices(vertices, options)
    if (edge.getData()?.routingMode !== mode)
      edge.setData({ routingMode: mode }, options)
    if (edge.attr('line/visibility') !== 'hidden') {
      edge.attr('line/visibility', 'visible', options)
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
  const options = routeWriteOptions(edge)
  edge.setVertices([], options)
  edge.setRouter('manhattan', args, options)
  edge.attr('line/visibility', 'visible', options)
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
    routeWriteOptions(edge),
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
// 只删除未保护的重合点或同向共线中间点，保留端口方向约束点。
function simplifyRoutePoints(points, protectedIndices = new Set()) {
  const entries = points.map((point, index) => ({
    point,
    protected: protectedIndices.has(index),
  }))
  let index = 0
  while (index < entries.length) {
    if (
      index + 1 < entries.length &&
      samePoint(entries[index].point, entries[index + 1].point)
    ) {
      const removeIndex = !entries[index].protected
        ? index
        : !entries[index + 1].protected
          ? index + 1
          : -1
      if (removeIndex >= 0) {
        entries.splice(removeIndex, 1)
        index = Math.max(0, index - 1)
        continue
      }
    }
    if (index > 0 && index + 1 < entries.length && !entries[index].protected) {
      const a = entries[index - 1].point
      const b = entries[index].point
      const c = entries[index + 1].point
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
      const forward = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)
      if (Math.abs(cross) < 0.01 && forward >= 0) {
        entries.splice(index, 1)
        index = Math.max(0, index - 1)
        continue
      }
    }
    index += 1
  }
  return entries.map(({ point }) => point)
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
  simplifyRoutePoints,
  ensureRoutingReady,
  isCompleteNodeEdge,
  isRoutingNode,
  routeAllEdges,
  routeEdge,
  routeEdges,
  routeNodeEdges,
  captureNodeRoutes,
  captureEdgeRoutes,
  finishNodeRoutes,
  finishEdgeRoutes,
  beginManualEdgeEdit,
  finishManualEdgeEdit,
  routeDependentEdges,
  getRoutingSession,
  invalidateRouting,
  isRoutingReplay,
}
