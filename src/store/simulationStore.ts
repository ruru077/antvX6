import { create } from 'zustand'
import type { SimulationProgress, SimulationResults } from '@/api/simulation'

interface SimulationState {
  isRunning: boolean
  progress: SimulationProgress | null
  results: SimulationResults | null
  error: string | null
  selectedScopeId: string | null
  setRunning: (isRunning: boolean) => void
  setProgress: (progress: SimulationProgress) => void
  setResults: (results: SimulationResults) => void
  setError: (error: string | null) => void
  openScope: (scopeId: string) => void
  closeScope: () => void
}

const useSimulationStore = create<SimulationState>((set) => ({
  isRunning: false,
  progress: null,
  results: null,
  error: null,
  selectedScopeId: null,
  setRunning: (isRunning) => set({ isRunning }),
  setProgress: (progress) => set({ progress }),
  setResults: (results) => set({ results }),
  setError: (error) => set({ error }),
  openScope: (selectedScopeId) => set({ selectedScopeId }),
  closeScope: () => set({ selectedScopeId: null }),
}))

export { useSimulationStore }
