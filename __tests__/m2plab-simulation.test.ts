import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { GraphModelDTO } from '../types/dto/graphModel'

class Socket {
  static instance: Socket
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onclose?: (event: { code: number }) => void
  send = vi.fn()
  close = vi.fn()
  constructor(public url: string) { Socket.instance = this }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }) }
}
beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'https://m2plab.aim.sustech.edu.cn' } })
  vi.stubGlobal('WebSocket', Socket)
})
afterEach(() => vi.unstubAllGlobals())
describe('production Link simulation protocol', () => {
  it('reads nested streaming scopes and final results', async () => {
    const { startSimulation } = await import('../src/api/simulation')
    const onResults = vi.fn()
    const promise = startSimulation({ model: {testRig:0} as GraphModelDTO, onProgress:vi.fn(), onResults })
    const result = { scopes: [{uuid:'scope',time:[0,0.1],data:[1,1]}] }
    Socket.instance.message({msg:'scope_update',data:{scopeData:result}})
    expect(onResults).toHaveBeenCalledWith(result)
    Socket.instance.message({msg:'final_results',data:result})
    await expect(promise).resolves.toEqual(result)
    expect(Socket.instance.url).toContain('/m2plab/matlab/websocketsimulatert')
  })
  it('does not leave the Run button pending when a socket closes without results', async () => {
    const { startSimulation } = await import('../src/api/simulation')
    const promise = startSimulation({model:{} as GraphModelDTO,onProgress:vi.fn(),onResults:vi.fn()})
    Socket.instance.onclose?.({code:1000})
    await expect(promise).rejects.toThrow('连接意外关闭')
  })
})
