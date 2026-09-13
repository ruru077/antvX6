import type { Edge, Graph } from '@antv/x6'

interface EdgeOutlineAdapterContext {
  getFilterWidth: (width: number) => number
}

interface EdgeToolsAdapterContext {
  graph: Graph
  isPreview: boolean
  isBranchEdge: boolean
}

interface GraphInteractionAdapter {
  addEdgeOutline: (edge: Edge, context: EdgeOutlineAdapterContext) => void
  removeEdgeOutline: (edge: Edge) => void
  initializeEdgeTools: (edge: Edge, context: EdgeToolsAdapterContext) => void
}

let activeAdapter: GraphInteractionAdapter | null = null

/** 注册非默认输入模式的 Graph 交互实现；默认 Web 行为仍由原 service 维护。 */
function registerGraphInteractionAdapter(adapter: GraphInteractionAdapter) {
  if (activeAdapter && activeAdapter !== adapter)
    throw new Error('Graph interaction adapter is already registered')

  activeAdapter = adapter
  return () => {
    if (activeAdapter === adapter) activeAdapter = null
  }
}

function getGraphInteractionAdapter() {
  return activeAdapter
}

export { getGraphInteractionAdapter, registerGraphInteractionAdapter }
export type {
  EdgeOutlineAdapterContext,
  EdgeToolsAdapterContext,
  GraphInteractionAdapter,
}
