import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  annotateSoftwareScopes,
  decodeSimulationResults,
  MAX_SOFTWARE_RESULT_BYTES,
  readSoftwareResult,
  softwareResultUrl,
  startSoftwareSimulation,
} from '../src/api/softwareSimulation'
import type { GraphModelDTO } from '../types/dto/graphModel'

function resultsBin() {
  const name = new TextEncoder().encode('LAD 输出')
  const uuid = new TextEncoder().encode('scope')
  const buffer = new ArrayBuffer(4 + 32 + name.length + uuid.length + 3 * 16)
  const view = new DataView(buffer)
  let offset = 0
  for (const value of [1, 0, name.length, uuid.length, 3, 100, 1, 1, 0]) {
    view.setInt32(offset, value, true)
    offset += 4
  }
  new Uint8Array(buffer, offset, name.length).set(name)
  offset += name.length
  new Uint8Array(buffer, offset, uuid.length).set(uuid)
  offset += uuid.length
  for (const value of [0, 0, 0.3, 1, 0.4, 1]) {
    view.setFloat64(offset, value, true)
    offset += 8
  }
  return buffer
}

const model = {
  userId: 990001,
  modelId: 29,
  blocks: [
    { blockUUID: 'lad', blockType: 'LadderController' },
    { blockUUID: 'scope', blockType: 'Scope' },
  ],
  lines: [{ fromBlockUUID: 'lad', toBlockUUID: 'scope' }],
} as GraphModelDTO

class Socket {
  static instance: Socket
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onerror?: () => void
  onclose?: () => void
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
  vi.stubGlobal('window', { location: { origin: 'https://m2plab.test' } })
  vi.stubGlobal('WebSocket', Socket)
})
afterEach(() => vi.unstubAllGlobals())

describe('production C software simulation', () => {
  it('filters workspace/file terminals while preserving multiple Scope inputs and their own signal kind', () => {
    const mixedModel = {
      ...model,
      blocks: [
        ...model.blocks,
        { blockUUID: 'plant', blockType: 'Integrator' },
        { blockUUID: 'workspace', blockType: 'ToWorkspace' },
        { blockUUID: 'file', blockType: 'ToFile' },
      ],
      lines: [
        { fromBlockUUID: 'lad', toBlockUUID: 'scope', toPortNo: '1' },
        { fromBlockUUID: 'plant', toBlockUUID: 'scope', toPortNo: '2' },
      ],
    } as GraphModelDTO
    const scope = decodeSimulationResults(resultsBin()).scopes[0]
    const results = annotateSoftwareScopes(
      {
        scopes: [
          { ...scope, name: 'in1' },
          { ...scope, name: 'in2' },
          { ...scope, uuid: 'workspace' },
          { ...scope, uuid: 'file' },
        ],
      },
      mixedModel,
    )
    expect(results.scopes.map((item) => [item.name, item.sampleHold])).toEqual([
      ['in1', true],
      ['in2', undefined],
    ])
  })

  it('bounds downloads by both declared and actual streamed bytes', async () => {
    await expect(
      readSoftwareResult(
        new Response('', {
          headers: { 'Content-Length': String(MAX_SOFTWARE_RESULT_BYTES + 1) },
        }),
      ),
    ).rejects.toThrow('64 MiB')
    let sent = 0
    const cancel = vi.fn()
    const chunk = new Uint8Array(1024 * 1024)
    const stream = new ReadableStream({
      pull(controller) {
        // Reuse one chunk to test the limit without creating a huge fixture.
        controller.enqueue(chunk)
        if (++sent === 66) controller.close()
      },
      cancel,
    })
    await expect(readSoftwareResult(new Response(stream))).rejects.toThrow(
      '64 MiB',
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('decodes the existing binary schema and annotates only direct LAD output scopes', () => {
    const results = decodeSimulationResults(resultsBin())
    expect(results.scopes[0]).toMatchObject({
      name: 'LAD 输出',
      uuid: 'scope',
      time: [0, 0.3, 0.4],
      data: [0, 1, 1],
    })
    expect(annotateSoftwareScopes(results, model).scopes[0].sampleHold).toBe(
      true,
    )
    const continuous = {
      ...model,
      lines: [{ fromBlockUUID: 'plant', toBlockUUID: 'scope' }],
    } as GraphModelDTO
    expect(
      annotateSoftwareScopes(results, continuous).scopes[0].sampleHold,
    ).toBeUndefined()
    expect(results.scopes[0].sampleHold).toBeUndefined()
  })

  it('rejects truncated, impossible and unrelated result data', () => {
    const buffer = resultsBin()
    expect(() => decodeSimulationResults(buffer.slice(0, -1))).toThrow()
    new DataView(buffer).setInt32(24, 0x7fffffff, true)
    expect(() => decodeSimulationResults(buffer)).toThrow()
    expect(() => annotateSoftwareScopes({ scopes: [] }, model)).toThrow('Scope')
  })

  it('accepts only the authenticated model result path and never a supplied remote URL', () => {
    expect(softwareResultUrl('/CCode/990001/29/results.bin', model)).toBe(
      'https://m2plab.test/m2plab/matlab/simulation-results/990001/29/results.bin',
    )
    for (const path of [
      '/CCode/990002/29/results.bin',
      '/CCode/990001/30/results.bin',
      'https://untrusted.test/result.bin',
      '/CCode/990001/29/../results.bin',
    ]) {
      expect(() => softwareResultUrl(path, model)).toThrow('不匹配')
    }
  })

  it('runs language c on the software endpoint and waits for the authenticated download after WS close', async () => {
    let finishDownload!: (response: Response) => void
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finishDownload = resolve
        }),
    )
    vi.stubGlobal('fetch', fetch)
    const onResults = vi.fn(),
      onProgress = vi.fn(),
      onWarning = vi.fn()
    const pending = startSoftwareSimulation({
      model,
      onProgress,
      onResults,
      onWarning,
    })
    Socket.instance.onopen?.()
    expect(Socket.instance.url).toBe(
      'wss://m2plab.test/m2plab/matlab/websocketsimulate',
    )
    const sent = JSON.parse(Socket.instance.send.mock.calls[0][0])
    expect(sent.language).toBe('c')
    expect(JSON.parse(sent.mdlData.jsonData)).toEqual(model)
    Socket.instance.message({ msg: 'compiled' })
    Socket.instance.message({ msg: 'warning', message: 'notice' })
    Socket.instance.message({
      msg: 'result',
      resultsFile: '/CCode/990001/29/results.bin',
    })
    Socket.instance.onclose?.()
    expect(onResults).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/simulation-results/990001/29/results.bin'),
      expect.objectContaining({
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
      }),
    )
    finishDownload(new Response(resultsBin()))
    const results = await pending
    expect(results.scopes[0].sampleHold).toBe(true)
    expect(onResults).toHaveBeenCalledOnce()
    expect(onProgress).toHaveBeenLastCalledWith({
      message: '软件仿真完成',
      percent: 100,
    })
    expect(onWarning).toHaveBeenCalledWith('notice')
    Socket.instance.message({
      msg: 'result',
      resultsFile: '/CCode/990001/29/results.bin',
    })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('fails on a result-download error without publishing old results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 403 })),
    )
    const onResults = vi.fn()
    const pending = startSoftwareSimulation({
      model,
      onProgress: vi.fn(),
      onResults,
    })
    Socket.instance.message({
      msg: 'result',
      resultsFile: '/CCode/990001/29/results.bin',
    })
    Socket.instance.onclose?.()
    await expect(pending).rejects.toThrow('403')
    expect(onResults).not.toHaveBeenCalled()
  })

  it('does not treat compiled or a premature close as a successful simulation', async () => {
    const pending = startSoftwareSimulation({
      model,
      onProgress: vi.fn(),
      onResults: vi.fn(),
    })
    Socket.instance.message({ msg: 'compiled' })
    Socket.instance.onclose?.()
    await expect(pending).rejects.toThrow('返回结果前关闭')
  })
})
