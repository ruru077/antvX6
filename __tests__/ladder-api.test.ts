import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { LadApiError, ladApi } from '../src/ladder/api'
import { demoProgram } from '../src/ladder/model'

afterEach(() => vi.unstubAllGlobals())
function stub(result: unknown, status = 200) {
  vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:15173' } })
  const fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => result,
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
describe('LAD authenticated API boundaries', () => {
  it('uses same-origin cookies and never supplies an owner from model context', async () => {
    const fetch = stub({ sessionId: 'one', snapshot: {} })
    await ladApi.session(demoProgram())
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe(
      'http://127.0.0.1:15173/m2plab/api/antv/ladder/runtime/session',
    )
    expect(init.credentials).toBe('same-origin')
    expect(init.headers['X-Authenticated-User-ID']).toBeUndefined()
    expect(JSON.parse(init.body).program.kind).toBe('ladder')
  })
  it('sends one step and explicit boolean inputs, without browser-side simulation', async () => {
    const fetch = stub({ snapshot: { scanIndex: 1 } })
    expect(await ladApi.step('test', { Start: true })).toEqual({
      snapshot: { scanIndex: 1 },
    })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      sessionId: 'test',
      inputs: { Start: true },
    })
  })
  it('distinguishes create from update while preserving program format', async () => {
    const fetch = stub({ id: 123 })
    const program = demoProgram()
    await ladApi.save(null, 'self_hold', program)
    await ladApi.save(123, 'self_hold', program)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(fetch.mock.calls[1][1].method).toBe('PUT')
    expect(String(fetch.mock.calls[1][0])).toContain('/models/123')
    expect(JSON.parse(fetch.mock.calls[1][1].body).program).toEqual(program)
  })
  it('preserves structured backend validation errors', async () => {
    stub(
      {
        message: 'Invalid program',
        errors: [{ path: 'networks[0].coil', message: 'input is read-only' }],
      },
      422,
    )
    try {
      await ladApi.session(demoProgram())
      throw new Error('expected failure')
    } catch (error) {
      expect(error).toBeInstanceOf(LadApiError)
      expect((error as LadApiError).issues[0].path).toBe('networks[0].coil')
    }
  })
  it('does not turn an unauthenticated response into empty model data', async () => {
    stub({ message: 'Unauthenticated' }, 401)
    await expect(ladApi.models()).rejects.toMatchObject({
      status: 401,
      message: 'Unauthenticated',
    })
  })
  it('handles a successful empty delete response', async () => {
    stub(null, 204)
    await expect(ladApi.remove(123)).resolves.toBeUndefined()
  })
})
