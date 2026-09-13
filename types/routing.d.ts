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

  export {
    fallbackEdgeToManhattan,
    getPortRouteGeometry,
    isCompleteNodeEdge,
    isRoutingNode,
    type PortRouteGeometry,
    routeAllEdges,
  }
}
