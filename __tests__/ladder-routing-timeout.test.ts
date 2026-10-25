import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { withRoutingTimeout } from '../src/services/routing-loader'

afterEach(() => vi.useRealTimers())
describe('routing engine readiness', () => {
  it('bounds a stalled WASM loader and releases its timer after failure', async () => {
    vi.useFakeTimers()
    const result = withRoutingTimeout(new Promise<never>(() => {}), 50)
    const expectation = expect(result).rejects.toThrow('加载超时')
    await vi.advanceTimersByTimeAsync(50)
    await expectation
    expect(vi.getTimerCount()).toBe(0)
  })
  it('preserves an engine load failure and leaves successful operations untouched', async () => {
    await expect(
      withRoutingTimeout(Promise.reject(new Error('invalid wasm'))),
    ).rejects.toThrow('invalid wasm')
    const engine = { ready: true }
    await expect(withRoutingTimeout(Promise.resolve(engine))).resolves.toBe(
      engine,
    )
  })
})
