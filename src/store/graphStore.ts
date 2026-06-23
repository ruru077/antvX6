import { create } from 'zustand'
import { createAndSetupGraph } from '@/services/graph-service'
import type { Graph as GraphType } from '@antv/x6'

interface GraphStore {
  graph: GraphType
  /** 在挂载的容器上创建 Graph 并完成所有初始化 */
  initGraph: (container: HTMLElement) => void
  /** 销毁 Graph 实例 */
  destroyGraph: () => void
  // 缩放比
  zoom: number
  setZoom: (zoom: number) => void
}

const useGraphStore = create<GraphStore>((set, get) => ({
  // TS检查越狱
  graph: null as unknown as GraphType,
  zoom: 100,
  initGraph: (container) => {
    const graph = createAndSetupGraph(container, (zoom) => get().setZoom(zoom))
    set({ graph })
  },

  destroyGraph: () => {
    get().graph.dispose()
  },

  setZoom: (zoom) => set({ zoom }),
}))

export { useGraphStore }
