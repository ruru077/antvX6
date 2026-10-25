import { create } from 'zustand'
import type { LadderBlockData } from './block'

export type LadderEditorTarget = {
  graphId: string
  nodeId: string
  name: string
  ladder: LadderBlockData
}
export const useLadderBlockEditorStore = create<{
  target: LadderEditorTarget | null
  open: (target: LadderEditorTarget) => void
  close: () => void
}>((set) => ({
  target: null,
  open: (target) => set({ target: structuredClone(target) }),
  close: () => set({ target: null }),
}))
