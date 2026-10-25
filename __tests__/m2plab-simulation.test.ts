import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { GraphModelDTO } from '../types/dto/graphModel'

class Socket {
  static instance: Socket
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onerror?: () => void
  onclose?: (event: { code: number }) => void
  send = vi.fn()
  close = vi.fn()
  url: string
  constructor(url: string) {
    this.url = url
    Socket.instance = this
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) })
  }
}
beforeEach(() => {
  vi.stubGlobal('window', {
    location: { origin: 'https://m2plab.aim.sustech.edu.cn' },
  })
  vi.stubGlobal('WebSocket', Socket)
})
afterEach(() => vi.unstubAllGlobals())
describe('production Link simulation protocol', () => {
  it('terminates a failed transport before a stale result can update the next run', async () => {
    const { startSimulation } = await import('../src/api/simulation')
    const onResults = vi.fn()
    const promise = startSimulation({
      model: {} as GraphModelDTO,
      onProgress: vi.fn(),
      onResults,
    })
    Socket.instance.onerror?.()
    await expect(promise).rejects.toThrow('无法连接')
    Socket.instance.message({ type: 'final_results', data: { scopes: [] } })
    expect(onResults).not.toHaveBeenCalled()
    expect(Socket.instance.close).toHaveBeenCalledOnce()
  })
  it('delivers LAD updates by parent run and ignores stale runs and messages after completion', async () => {
    const { startSimulation } = await import('../src/api/simulation')
    const onLadderUpdate = vi.fn()
    const promise = startSimulation({
      model: {} as GraphModelDTO,
      onProgress: vi.fn(),
      onResults: vi.fn(),
      onLadderUpdate,
    })
    const update = {
      type: 'ladder_update',
      runId: 'run-a',
      time: 0,
      controllers: [
        {
          blockUUID: 'controller-a',
          snapshot: {
            scanIndex: 1,
            timeMs: 0,
            variables: { Motor: true },
            trace: {},
            outputs: { Motor: true },
          },
        },
      ],
    }
    Socket.instance.message(update)
    Socket.instance.message({ ...update, runId: 'stale-run' })
    expect(onLadderUpdate).toHaveBeenCalledExactlyOnceWith(update)
    Socket.instance.message({ type: 'final_results', data: { scopes: [] } })
    await promise
    Socket.instance.message(update)
    expect(onLadderUpdate).toHaveBeenCalledTimes(1)
  })
  it('reads nested streaming scopes and final results', async () => {
    const { startSimulation } = await import('../src/api/simulation')
    const onResults = vi.fn()
    const promise = startSimulation({
      model: { testRig: 0 } as GraphModelDTO,
      onProgress: vi.fn(),
      onResults,
    })
    const result = { scopes: [{ uuid: 'scope', time: [0, 0.1], data: [1, 1] }] }
    Socket.instance.message({
      msg: 'scope_update',
      data: { scopeData: result },
    })
    expect(onResults).toHaveBeenCalledWith(result)
    Socket.instance.message({ msg: 'final_results', data: result })
    await expect(promise).resolves.toEqual(result)
    expect(Socket.instance.url).toContain('/m2plab/matlab/websocketsimulatert')
  })
  it('does not leave the Run button pending when a socket closes without results', async () => {
    const { startSimulation } = await import('../src/api/simulation')
    const promise = startSimulation({
      model: {} as GraphModelDTO,
      onProgress: vi.fn(),
      onResults: vi.fn(),
    })
    Socket.instance.onclose?.({ code: 1000 })
    await expect(promise).rejects.toThrow('连接意外关闭')
  })
})
