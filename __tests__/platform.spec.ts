import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { getPlatformUser, platformRequest } from '../src/api/platform'

afterEach(() => vi.unstubAllGlobals())
describe('existing platform API contracts', () => {
  it('uses authenticated identity headers without decrypting profile data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 204,
          headers: { 'X-Authenticated-User-ID': '42' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    await expect(getPlatformUser()).resolves.toEqual({ id: 42 })
    expect(fetchMock).toHaveBeenCalledWith(
      '/m2plab/api/auth-context',
      expect.objectContaining({ credentials: 'same-origin' }),
    )
  })
  it.each([null, '0', '-1', 'NaN'])(
    'rejects invalid authenticated identity %s',
    async (id) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(null, {
              status: 204,
              headers: id ? { 'X-Authenticated-User-ID': id } : {},
            }),
          ),
      )
      await expect(getPlatformUser()).rejects.toThrow('无法读取登录用户')
    },
  )
  it('does not mistake an HTML fallback page for a successful save', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<html>login</html>', { status: 200 })),
    )
    await expect(
      platformRequest('/filesystem-link/file', 'POST', { content: '{}' }),
    ).rejects.toThrow('服务返回异常')
  })
  it('preserves cloud file content from the established response envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            code: 100,
            data: { content: '{"format":"m2psim-x6"}' },
          }),
        ),
    )
    await expect(
      platformRequest('/filesystem-link/file/M2PSim/example.x6.json'),
    ).resolves.toEqual({ content: '{"format":"m2psim-x6"}' })
  })
  it('rejects expired sessions and business errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ message: 'unauthorized' }, { status: 401 }),
        )
        .mockResolvedValueOnce(
          Response.json({ code: 400, message: '目录不可写' }),
        ),
    )
    await expect(platformRequest('/filesystem-link/file')).rejects.toThrow(
      '登录已过期',
    )
    await expect(platformRequest('/filesystem-link/file')).rejects.toThrow(
      '目录不可写',
    )
  })
})
