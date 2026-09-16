import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('deployment endpoint overrides', () => {
  it('retains the hs bundled catalog when no override is supplied', async () => {
    vi.stubEnv('VITE_M2PLINK_API_BASE', undefined)
    const request = vi.fn().mockImplementation(() => Promise.resolve(Response.json([])))
    vi.stubGlobal('fetch', request)
    const { assetUrl } = await import('../src/api/platform')
    const { fetchBlocks, fetchBlockLibrary } = await import('../src/api/blocks')
    await fetchBlocks()
    await fetchBlockLibrary()
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      assetUrl('catalog/blocks.json'), assetUrl('catalog/libraries.json'),
    ])
  })

  it('routes both catalog requests through the configured prefix', async () => {
    vi.stubEnv('VITE_M2PLINK_API_BASE', '/m2plab/m2plink-service/')
    const request = vi.fn().mockImplementation(() => Promise.resolve(Response.json([])))
    vi.stubGlobal('fetch', request)
    const { fetchBlocks, fetchBlockLibrary } = await import('../src/api/blocks')
    await fetchBlocks()
    await fetchBlockLibrary()
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      '/m2plab/m2plink-service/antvblocks', '/m2plab/m2plink-service/library',
    ])
  })

  it.each([
    ['https:', undefined, 'wss://lab.example/m2plab/matlab/websocketsimulatert'],
    ['http:', undefined, 'ws://lab.example/m2plab/matlab/websocketsimulatert'],
    ['https:', '/m2plab/m2plink-service/websocketsimulatert', 'wss://lab.example/m2plab/m2plink-service/websocketsimulatert'],
    ['https:', 'wss://upstream.example/sim', 'wss://upstream.example/sim'],
  ])('resolves the WebSocket endpoint for %s and %s', async (protocol, override, expected) => {
    const location = { protocol, host: 'lab.example' }
    vi.stubGlobal('location', location)
    vi.stubGlobal('window', { location })
    vi.stubEnv('VITE_M2PLINK_SIMULATION_WS', override)
    const { SIMULATION_WS_URL } = await import('../src/api/simulation')
    expect(SIMULATION_WS_URL).toBe(expected)
  })
})
