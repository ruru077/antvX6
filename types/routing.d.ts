declare module '@/services/routing-service' {
  import type { Edge, Graph } from '@antv/x6'

  type PortDirection = 'left' | 'right' | 'top' | 'bottom'

  function routeAllEdges(graph: Graph): Promise<void> | null
  function fallbackEdgeToManhattan(
    edge: Edge,
    sourceDirection?: PortDirection,
    targetDirection?: PortDirection,
  ): void
  function isCompleteNodeEdge(edge: Edge): boolean

  export { fallbackEdgeToManhattan, isCompleteNodeEdge, routeAllEdges }
}
