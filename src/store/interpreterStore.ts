import { create } from 'zustand'
type StepType = 'VariableStep' | 'FixedStep'

interface InterpreterConfig {
  Step: StepType
  SimFixedStep: string
  SimSolver: string
  StartTime: string
  StopTime: string
  MaxDataPoints: string
  SimMaxStep: string
  SimMinStep: string
  SimInitialStep: string
  SimRelTol: string
  SimAbsTol: string
  ComFixedStep: string
  ComSolver: string
  SystemTargetFile: string
  PacketSize: string
}

interface InterpreterStore {
  config: InterpreterConfig
  setConfig: (config: InterpreterConfig) => void
}

const DEFAULT_INTERPRETER_CONFIG: InterpreterConfig = {
  // 仿真参数
  Step: 'VariableStep',
  SimFixedStep: 'auto',
  SimSolver: 'auto',
  StartTime: '0.0',
  StopTime: '10.0',
  MaxDataPoints: '10000',
  SimMaxStep: 'auto',
  SimMinStep: 'auto',
  SimInitialStep: 'auto',
  SimRelTol: '1e-3',
  SimAbsTol: 'auto',
  // 编译参数
  ComFixedStep: '0.01',
  ComSolver: 'ode5',
  SystemTargetFile: 'PowerSim',
  PacketSize: '10',
}

const useInterpreterStore = create<InterpreterStore>((set) => ({
  config: DEFAULT_INTERPRETER_CONFIG,
  setConfig: (config) => set({ config }),
}))

export { DEFAULT_INTERPRETER_CONFIG, useInterpreterStore }
export type { InterpreterConfig, InterpreterStore, StepType }
