import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useKeepAliveGraphViewport } from '@/utils/hooks/useKeepAliveGraphViewport'
import type { EntryGraphModel } from '~/types'

const mocks = vi.hoisted(() => ({
  effect: undefined as undefined | (() => void | (() => void)),
  dependencies: [] as unknown[],
  setStage: vi.fn(),
  refresh: vi.fn(),
  scroller: {},
  graph: { getPlugin: vi.fn(), zoomToFit: vi.fn() },
}))

vi.mock('react', () => ({
  useState: () => ['initializing', mocks.setStage],
  useLayoutEffect: (effect: typeof mocks.effect, dependencies: unknown[]) => {
    mocks.effect = effect
    mocks.dependencies = dependencies
  },
}))
vi.mock('@/store/graphStore', () => ({
  useGraphStore: (selector: (state: unknown) => unknown) =>
    selector({ graph: mocks.graph }),
}))
vi.mock('@/utils/plugin/X6patch', () => ({
  _patchScrollerForceUpdate: mocks.refresh,
}))

let nextFrame: number
let frames: Map<number, FrameRequestCallback>
function advanceFrame() {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((callback) => callback(0))
}
function enter(model?: EntryGraphModel) {
  useKeepAliveGraphViewport(true, true, model)
  return mocks.effect?.()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.graph.getPlugin.mockReturnValue(mocks.scroller)
  frames = new Map()
  nextFrame = 1
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrame++
    frames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})
afterEach(() => vi.unstubAllGlobals())

describe('KeepAlive graph viewport', () => {
  it('waits for layout, refreshes the scroller and then fits the canvas', () => {
    enter()
    expect(mocks.graph.zoomToFit).not.toHaveBeenCalled()
    advanceFrame()
    expect(mocks.graph.zoomToFit).not.toHaveBeenCalled()
    advanceFrame()
    expect(mocks.refresh).toHaveBeenCalledWith(mocks.scroller)
    expect(mocks.graph.zoomToFit).toHaveBeenCalledOnce()
    expect(mocks.refresh.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.graph.zoomToFit.mock.invocationCallOrder[0],
    )
    expect(mocks.setStage).toHaveBeenLastCalledWith('ready')
  })

  it('fits again on re-entry and uses model changes as an effect dependency', () => {
    const modelA = {} as EntryGraphModel
    const modelB = {} as EntryGraphModel
    const cleanup = enter(modelA)
    advanceFrame()
    advanceFrame()
    cleanup?.()
    useKeepAliveGraphViewport(false, true, modelA)
    mocks.effect?.()
    expect(frames.size).toBe(0)

    enter(modelB)
    expect(mocks.dependencies).toContain(modelB)
    advanceFrame()
    advanceFrame()
    expect(mocks.graph.zoomToFit).toHaveBeenCalledTimes(2)
  })

  it('cancels pending fitting when leaving before layout finishes', () => {
    const cleanup = enter()
    advanceFrame()
    cleanup?.()
    advanceFrame()
    expect(mocks.graph.zoomToFit).not.toHaveBeenCalled()
  })

  it('waits for stencil layout and does not fit an inactive workspace', () => {
    useKeepAliveGraphViewport(true, false)
    mocks.effect?.()
    expect(frames.size).toBe(0)
    useKeepAliveGraphViewport(false, true)
    mocks.effect?.()
    expect(mocks.graph.zoomToFit).not.toHaveBeenCalled()
    expect(mocks.setStage).toHaveBeenLastCalledWith('ready')
  })
})
