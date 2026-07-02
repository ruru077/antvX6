import { create } from 'zustand'
import { GAP_SIZE, GRAPH_GRID } from '@/assets/constant'

type RouteEngine = 'off' | 'obstacle' | 'avoid' | 'orth' | 'manhattan'
type PersistedRouteEngine = RouteEngine | 'simulink'

type RouteDemoOptions = {
  engine: RouteEngine
  edgeToNodeGap: number
  edgeToEdgeGap: number
  stubSize: number
  segmentPenalty: number
  anglePenalty: number
  simulinkCrossingPenalty: number
  reverseDirectionPenalty: number
  portDirectionPenalty: number
  gridSize: number
  gapSize: number
  cornerRadius: number
  x6RouterPadding: number
  x6RouterStep: number
  x6RouterMaxLoopCount: number
  x6RouterPrecision: number
  x6RouterMaxDirectionChange: number
  x6RouterPerpendicular: boolean
  x6RouterSnapToGrid: boolean
  realtime: boolean
}

type RouteDemoParams = Omit<RouteDemoOptions, 'engine'>
type PersistedRouteDemoState = {
  engine?: PersistedRouteEngine
  obstacle?: Partial<RouteDemoParams>
  avoid?: Partial<RouteDemoParams>
  simulink?: Partial<RouteDemoParams>
  orth?: Partial<RouteDemoParams>
  manhattan?: Partial<RouteDemoParams>
}

type RouteDemoStore = RouteDemoOptions & {
  revision: number
  setEngine: (engine: RouteEngine) => void
  setOption: <K extends keyof RouteDemoOptions>(
    key: K,
    value: RouteDemoOptions[K],
  ) => void
}

const ROUTE_DEMO_STORAGE_KEY = 'link-codex:route-demo-options'

const DEFAULT_ROUTE_DEMO_PARAMS: RouteDemoParams = {
  edgeToNodeGap: 8,
  edgeToEdgeGap: 10,
  stubSize: 24,
  segmentPenalty: 10,
  anglePenalty: 0,
  simulinkCrossingPenalty: 200,
  reverseDirectionPenalty: 0,
  portDirectionPenalty: 100,
  gridSize: GRAPH_GRID,
  gapSize: GAP_SIZE,
  cornerRadius: 0,
  x6RouterPadding: 20,
  x6RouterStep: 10,
  x6RouterMaxLoopCount: 2000,
  x6RouterPrecision: 1,
  x6RouterMaxDirectionChange: 90,
  x6RouterPerpendicular: true,
  x6RouterSnapToGrid: true,
  realtime: false,
}

const DEFAULT_ROUTE_DEMO_OPTIONS: RouteDemoOptions = {
  engine: 'obstacle',
  ...DEFAULT_ROUTE_DEMO_PARAMS,
}

function canPersistEngine(engine: RouteEngine) {
  return (
    engine === 'obstacle' ||
    engine === 'avoid' ||
    engine === 'orth' ||
    engine === 'manhattan'
  )
}

function readPersistedState(): PersistedRouteDemoState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(ROUTE_DEMO_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedRouteDemoState) : {}
  } catch {
    return {}
  }
}

function writePersistedState(next: PersistedRouteDemoState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROUTE_DEMO_STORAGE_KEY, JSON.stringify(next))
}

function getPersistedParams(
  engine: RouteEngine,
  persisted: PersistedRouteDemoState,
) {
  if (!canPersistEngine(engine)) return DEFAULT_ROUTE_DEMO_PARAMS
  const params = {
    ...DEFAULT_ROUTE_DEMO_PARAMS,
    ...(engine === 'avoid'
      ? (persisted.avoid ?? persisted.simulink ?? {})
      : (persisted[engine] ?? {})),
  }
  if (engine === 'avoid' && params.segmentPenalty < 1) {
    params.segmentPenalty = 1
  }
  return params
}

function normalizePersistedEngine(
  engine: PersistedRouteEngine | undefined,
): RouteEngine {
  if (engine === 'simulink') return 'avoid'
  if (
    engine === 'off' ||
    engine === 'obstacle' ||
    engine === 'avoid' ||
    engine === 'orth' ||
    engine === 'manhattan'
  ) {
    return engine
  }
  return DEFAULT_ROUTE_DEMO_OPTIONS.engine
}

function createInitialState(): RouteDemoOptions {
  const persisted = readPersistedState()
  const engine = normalizePersistedEngine(persisted.engine)
  return {
    engine,
    ...getPersistedParams(engine, persisted),
  }
}

const useRouteDemoStore = create<RouteDemoStore>((set) => ({
  ...createInitialState(),
  revision: 0,
  setEngine: (engine) =>
    set((state) => {
      const persisted = readPersistedState()
      writePersistedState({ ...persisted, engine })
      return {
        engine,
        ...getPersistedParams(engine, persisted),
        revision: state.revision + 1,
      }
    }),
  setOption: (key, value) =>
    set((state) => {
      if (key === 'engine') {
        const engine = value as RouteEngine
        const persisted = readPersistedState()
        writePersistedState({ ...persisted, engine })
        return {
          engine,
          ...getPersistedParams(engine, persisted),
          revision: state.revision + 1,
        }
      }

      const nextState = {
        ...state,
        [key]: value,
        revision: state.revision + 1,
      }

      if (canPersistEngine(state.engine)) {
        const persisted = readPersistedState()
        writePersistedState({
          ...persisted,
          engine: state.engine,
          [state.engine]: {
            ...getPersistedParams(state.engine, persisted),
            [key]: value,
          },
        })
      }

      return nextState
    }),
}))

export type { RouteDemoOptions, RouteDemoParams, RouteEngine }
export { DEFAULT_ROUTE_DEMO_OPTIONS, useRouteDemoStore }
