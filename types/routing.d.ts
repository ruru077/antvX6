declare module '@/services/routing-service' {
  import type { Edge, Graph, Node } from '@antv/x6'

  type PortDirection = 'left' | 'right' | 'top' | 'bottom'
  type RoutePoint = { x: number; y: number }
  type RouteVector = { x: number; y: number }

  type PortRouteGeometry = {
    point: RoutePoint
    normal: RouteVector
    direction: PortDirection
    stubPoint: RoutePoint
    checkpoint: RoutePoint
  }

  type RoutingOptions = {
    reason?:
      | 'global'
      | 'node'
      | 'parent'
      | 'connect'
      | 'terminal'
      | 'preview'
      | 'insert'
      | 'copy'
      | 'rotate'
      | 'resize'
      | 'ports'
      | 'subsystem'
    force?: boolean
    preserveVertices?: boolean
  }
  function routeAllEdges(graph: Graph): Promise<void>
  function routeEdge(edge: Edge, options?: RoutingOptions): Promise<void>
  function routeEdges(
    graph: Graph,
    edges: Edge[],
    options?: RoutingOptions,
  ): Promise<void>
  function routeNodeEdges(
    graph: Graph,
    nodes: Node[],
    options?: RoutingOptions,
  ): Promise<void>
  function captureNodeRoutes(graph: Graph, nodes: Node[]): void
  function captureEdgeRoutes(
    graph: Graph,
    edges: Edge[],
    options?: { gesture?: boolean },
  ): void
  function finishEdgeRoutes(graph: Graph, edges: Edge[]): void
  function finishNodeRoutes(graph: Graph, nodes: Node[]): void
  function beginManualEdgeEdit(edge: Edge): void
  function finishManualEdgeEdit(
    edge: Edge,
    original: RoutePoint[],
  ): Promise<void>
  function routeDependentEdges(edge: Edge): Promise<void>
  function getRoutingSession(graph: Graph): { dispose(): void }
  function invalidateRouting(graph: Graph): void
  function isRoutingReplay(graph: Graph): boolean
  function ensureRoutingReady(): Promise<void>
  function fallbackEdgeToManhattan(
    edge: Edge,
    sourceDirection?: PortDirection,
    targetDirection?: PortDirection,
  ): void
  function isCompleteNodeEdge(edge: Edge): boolean
  function isRoutingNode(node: Node): boolean
  function getPortRouteGeometry(
    node: Node,
    portId: string,
  ): PortRouteGeometry | null
  function simplifyRoutePoints(
    points: RoutePoint[],
    protectedIndices?: Set<number>,
  ): RoutePoint[]

  export {
    fallbackEdgeToManhattan,
    getPortRouteGeometry,
    simplifyRoutePoints,
    ensureRoutingReady,
    isCompleteNodeEdge,
    isRoutingNode,
    type PortRouteGeometry,
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
    type RoutingOptions,
  }
}
