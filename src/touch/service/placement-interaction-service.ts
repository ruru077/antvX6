import type { Graph } from '@antv/x6'

type PlacementHandler = (clientX: number, clientY: number) => void

const placementHandlers = new WeakMap<Graph, PlacementHandler>()

/** 注册当前 Graph 正在等待的坐标放置操作，与鼠标或触控输入方式无关。 */
function registerPlacementHandler(graph: Graph, handler: PlacementHandler) {
  placementHandlers.set(graph, handler)
  return () => {
    if (placementHandlers.get(graph) === handler)
      placementHandlers.delete(graph)
  }
}

function getPlacementHandler(graph: Graph) {
  return placementHandlers.get(graph)
}

export { getPlacementHandler, registerPlacementHandler }
export type { PlacementHandler }
