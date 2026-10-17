import { describe, it, expect, vi, afterEach } from 'vite-plus/test'
import { antvApiUrl, linkWsUrl } from '../src/api/endpoints'

afterEach(() => vi.unstubAllGlobals())
describe('same-origin deployment endpoints', () => {
  for (const origin of ['https://m2plab.aim.sustech.edu.cn', 'https://ncslab.sdim.sustech.edu.cn']) {
    it(`uses the authenticated gateway on ${origin}`, () => {
      vi.stubGlobal('window', { location: { origin } })
      expect(antvApiUrl('/diagram-models').toString()).toBe(`${origin}/m2plab/api/antv/diagram-models`)
      expect(linkWsUrl('websocketsimulatert')).toBe(`${origin.replace('https:', 'wss:')}/m2plab/matlab/websocketsimulatert`)
      expect(linkWsUrl('websocketcompile')).toBe(`${origin.replace('https:', 'wss:')}/m2plab/matlab/websocketcompile`)
    })
  }
})
