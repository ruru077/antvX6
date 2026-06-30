import { create } from 'zustand'
import { GAP_SIZE, GRAPH_GRID } from '@/assets/constant'

type RouteEngine = 'off' | 'obstacle'

type RouteDemoOptions = {
  engine: RouteEngine
  edgeToNodeGap: number
  edgeToEdgeGap: number
  stubSize: number
  segmentPenalty: number
  anglePenalty: number
  crossingPenalty: number
  reverseDirectionPenalty: number
  portDirectionPenalty: number
  gridSize: number
  gapSize: number
  cornerRadius: number
  hateCrossings: boolean
  realtime: boolean
}

type RouteDemoParams = Omit<RouteDemoOptions, 'engine'>
type PersistedRouteDemoState = {
  engine?: RouteEngine
  obstacle?: Partial<RouteDemoParams>
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
  crossingPenalty: 0,
  reverseDirectionPenalty: 0,
  portDirectionPenalty: 100,
  gridSize: GRAPH_GRID,
  gapSize: GAP_SIZE,
  cornerRadius: 0,
  hateCrossings: false,
  realtime: false,
}

const DEFAULT_ROUTE_DEMO_OPTIONS: RouteDemoOptions = {
  engine: 'obstacle',
  ...DEFAULT_ROUTE_DEMO_PARAMS,
}

function canPersistEngine(engine: RouteEngine) {
  return engine === 'obstacle'
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
  return {
    ...DEFAULT_ROUTE_DEMO_PARAMS,
    ...(persisted[engine] ?? {}),
  }
}

function createInitialState(): RouteDemoOptions {
  const persisted = readPersistedState()
  const engine =
    persisted.engine === 'off' || persisted.engine === 'obstacle'
      ? persisted.engine
      : DEFAULT_ROUTE_DEMO_OPTIONS.engine
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
