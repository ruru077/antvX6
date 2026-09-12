import { create } from 'zustand'
import { usePlatformStore } from '@/store/platformStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { GraphModelDTO } from '~/types'

type StepType = 'VariableStep' | 'FixedStep'

type SimulationConfig = GraphModelDTO['config'] & { Step: StepType }
type CompileConfig = Pick<GraphModelDTO['saveInfo'], 'stepTime' | 'packetSize'>

interface InterpreterStore {
  config: SimulationConfig
  compileConfig: CompileConfig
  setConfig: (config: SimulationConfig) => void
  setCompileConfig: (config: CompileConfig) => void
}

const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  Step: 'VariableStep',
  FixedStep: 'auto',
  Solver: 'auto',
  StartTime: '0.0',
  StopTime: '10.0',
  MaxDataPoints: '10000',
  MaxStep: 'auto',
  MinStep: 'auto',
  InitialStep: 'auto',
  RelTol: '1e-3',
  AbsTol: 'auto',
}

const DEFAULT_COMPILE_CONFIG: CompileConfig = {
  stepTime: 0.01,
  packetSize: 10,
}

const useInterpreterStore = create<InterpreterStore>((set) => ({
  config: DEFAULT_SIMULATION_CONFIG,
  compileConfig: DEFAULT_COMPILE_CONFIG,
  setConfig: (config) => {
    set({ config })
    usePlatformStore.setState({ settingsDirty: true })
    useSubGraphStore.getState().recomputeDirty()
  },
  setCompileConfig: (compileConfig) => {
    set({ compileConfig })
    usePlatformStore.setState({ settingsDirty: true })
    useSubGraphStore.getState().recomputeDirty()
  },
}))

export {
  DEFAULT_COMPILE_CONFIG,
  DEFAULT_SIMULATION_CONFIG,
  useInterpreterStore,
}
export type { CompileConfig, InterpreterStore, SimulationConfig, StepType }
