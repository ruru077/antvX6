import type { Graph } from '@antv/x6'
import { create } from 'zustand'

interface GraphStore {
  graph: Graph | null
  zoom: number
  /** 空白处点击记录的粘贴目标位置 */
  pasteTarget: { x: number; y: number } | null
  setGraph: (graph: Graph | null) => void
  setZoom: (zoom: number) => void
  setPasteTarget: (pos: { x: number; y: number } | null) => void
}

const useGraphStore = create<GraphStore>((set) => ({
  graph: null,
  zoom: 100,
  pasteTarget: null,
  setGraph: (graph) => set({ graph }),
  setZoom: (zoom) => set({ zoom }),
  setPasteTarget: (pos) => set({ pasteTarget: pos }),
}))

export { useGraphStore }
