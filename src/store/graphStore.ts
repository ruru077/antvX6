import type { Graph } from '@antv/x6'
import { create } from 'zustand'

interface GraphStore {
  graph: Graph | null
  zoom: number
  setGraph: (graph: Graph | null) => void
  setZoom: (zoom: number) => void
}

const useGraphStore = create<GraphStore>((set) => ({
  graph: null,
  zoom: 100,
  setGraph: (graph) => set({ graph }),
  setZoom: (zoom) => set({ zoom }),
}))

export { useGraphStore }
