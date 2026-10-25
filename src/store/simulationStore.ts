import { create } from 'zustand'
import type { SimulationProgress, SimulationResults } from '@/api/simulation'
import type { LadderUpdate } from '@/api/simulation'
import type { LadSnapshot } from '@/ladder/model'

interface SimulationState {
  ladderRunId: string | null
  ladderSnapshots: Record<string, LadSnapshot>
  setLadderUpdate: (update: LadderUpdate) => void
  clearLadderSnapshots: () => void
  isRunning: boolean
  progress: SimulationProgress | null
  results: SimulationResults | null
  error: string | null
  openScopeIds: string[]
  setRunning: (isRunning: boolean) => void
  setProgress: (progress: SimulationProgress) => void
  setResults: (results: SimulationResults) => void
  setError: (error: string | null) => void
  openScope: (scopeId: string) => void
  closeScope: (scopeId: string) => void
}

const useSimulationStore = create<SimulationState>((set) => ({
  ladderRunId: null,
  ladderSnapshots: {},
  clearLadderSnapshots: () => set({ ladderRunId: null, ladderSnapshots: {} }),
  setLadderUpdate: (update) =>
    set((state) => {
      if (state.ladderRunId !== null && state.ladderRunId !== update.runId)
        return state
      const snapshots: Record<string, LadSnapshot> = Object.assign(
        Object.create(null),
        state.ladderSnapshots,
      )
      for (const controller of update.controllers) {
        if (
          !snapshots[controller.blockUUID] ||
          snapshots[controller.blockUUID].scanIndex <=
            controller.snapshot.scanIndex
        )
          snapshots[controller.blockUUID] = controller.snapshot
      }
      return { ladderRunId: update.runId, ladderSnapshots: snapshots }
    }),
  isRunning: false,
  progress: null,
  results: null,
  error: null,
  openScopeIds: [],
  setRunning: (isRunning) => set({ isRunning }),
  setProgress: (progress) => set({ progress }),
  setResults: (results) => set({ results }),
  setError: (error) => set({ error }),
  openScope: (scopeId) =>
    set((state) => ({
      openScopeIds: state.openScopeIds.includes(scopeId)
        ? state.openScopeIds
        : [...state.openScopeIds, scopeId],
    })),
  closeScope: (scopeId) =>
    set((state) => ({
      openScopeIds: state.openScopeIds.filter((id) => id !== scopeId),
    })),
}))

export { useSimulationStore }
