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

  function routeAllEdges(graph: Graph): Promise<void> | null
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
  }
}
