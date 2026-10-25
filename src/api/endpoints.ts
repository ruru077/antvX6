// Active: authenticated, same-origin M2PLab gateway (also works under the NCSLab host).
// Stencil direct HTTP: https://www.stencil.top/{antvblocks,library,diagram-models}
// Local direct HTTP: http://localhost:8080/{antvblocks,library,diagram-models}
// Stencil direct WS: wss://stencil.top/NCSLabLink/{websocketsimulatert,websocketcompile}
// Local direct WS: ws://localhost:8071/NCSLabLink/{websocketsimulatert,websocketcompile}
export function antvApiUrl(path: string): URL {
  return new URL(`/m2plab/api/antv${path}`, window.location.origin)
}

export function linkWsUrl(
  endpoint: 'websocketsimulatert' | 'websocketsimulate' | 'websocketcompile',
): string {
  const url = new URL(`/m2plab/matlab/${endpoint}`, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
