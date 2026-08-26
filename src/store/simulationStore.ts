import { create } from 'zustand'
import type { SimulationProgress, SimulationResults } from '@/api/simulation'

interface SimulationState {
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
