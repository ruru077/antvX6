import type { GraphModelDTO } from '~/types/dto/graphModel'

// 本地服务器版
// const SIMULATION_WS_URL = 'wss://stencil.top/NCSLabLink/websocketsimulatert'
// 0902 bugfix版
// Standalone default: wss://stencil.top/NCSLabLink0902/websocketsimulatert
// hs keeps its platform endpoint unless an explicit deployment override is supplied.
const configuredSimulationUrl = import.meta.env.VITE_M2PLINK_SIMULATION_WS
const SIMULATION_WS_URL = configuredSimulationUrl
  ? new URL(configuredSimulationUrl, `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`).href
  : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/m2plab/matlab/websocketsimulatert`
// 本地调试版
// const SIMULATION_WS_URL = 'ws://localhost:8071/NCSLabLink/websocketsimulatert'
interface ScopeResult {
  uuid?: string
  path?: string
  name?: string
  width?: number
  height?: number
  time: number[]
  data: number[] | number[][]
}

interface SimulationResults {
  scopes: ScopeResult[]
}

interface SimulationProgress {
  message: string
  percent: number
}

interface StartSimulationOptions {
  model: GraphModelDTO
  onProgress: (progress: SimulationProgress) => void
  onResults: (results: SimulationResults) => void
}

const progressByMessage: Record<string, number> = {
  start: 10,
  generating: 20,
  generated: 30,
  compiling: 40,
  compiled: 60,
  simulating: 70,
  simulated: 90,
  saving: 93,
  finished: 100,
}

function normalizeResults(value: unknown): SimulationResults | null {
  if (!value || typeof value !== 'object') return null
  const results = value as Partial<SimulationResults>
  return Array.isArray(results.scopes) ? { scopes: results.scopes } : null
}

function messageText(value: unknown, fallback: string): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback
}

function startSimulation({
  model,
  onProgress,
  onResults,
}: StartSimulationOptions): Promise<SimulationResults> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(SIMULATION_WS_URL)
    let completed = false
    let lastResults: SimulationResults | null = null
    const timer = setTimeout(() => {
      completed = true
      reject(new Error('仿真超过 120 秒，请缩短仿真时间后重试'))
      socket.close()
    }, 120000)

    const finish = (results: SimulationResults) => {
      completed = true
      clearTimeout(timer)
      onResults(results)
      resolve(results)
      socket.close(1000)
    }

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          com: 'start',
          mdlData: {
            jsonData: JSON.stringify(model),
            plantInfo: { id: model.testRig },
          },
        }),
      )
    }

    socket.onmessage = ({ data }) => {
      try {
        const message = JSON.parse(String(data)) as Record<string, unknown>
        const type = messageText(
          message.msg ?? message.message_type ?? message.type,
          'unknown',
        )

        if (type === 'error') {
          const error = new Error(
            messageText(message.error ?? message.message, '仿真失败'),
          )
          completed = true
          clearTimeout(timer)
          reject(error)
          socket.close()
          return
        }

        if (type === 'scope_update') {
          const results =
            normalizeResults(message.scopeData) ??
            normalizeResults(
              (message.data as Record<string, unknown> | undefined)?.scopeData,
            )
          if (results) {
            lastResults = results
            onResults(results)
          }
        }

        if (type === 'final_results') {
          const results =
            normalizeResults(message.data) ??
            normalizeResults(message.results) ??
            normalizeResults(message)
          if (!results) {
            completed = true
            clearTimeout(timer)
            reject(new Error('仿真完成，但返回结果中没有 scopes 数据'))
            socket.close()
            return
          }
          finish(results)
          return
        }
        if (type === 'simulated' && lastResults) {
          finish(lastResults)
          return
        }

        const basePercent = progressByMessage[type]
        if (basePercent !== undefined) {
          const time = Number(message.time)
          const timeLength = Number(message.timeLength)
          const percent =
            type === 'simulating' && timeLength > 0
              ? Math.min(90, basePercent + Math.round((time / timeLength) * 20))
              : basePercent
          onProgress({ message: type, percent })
        }
      } catch (error) {
        console.error('无法解析仿真 WebSocket 消息', error)
      }
    }

    socket.onerror = () => {
      clearTimeout(timer)
      if (!completed)
        reject(new Error(`无法连接仿真服务：${SIMULATION_WS_URL}`))
    }

    socket.onclose = (event) => {
      clearTimeout(timer)
      if (!completed)
        reject(
          new Error(
            lastResults
              ? '仿真连接在完成前关闭'
              : '仿真结束但没有收到结果，请检查模型中是否有 Scope',
          ),
        )
    }
  })
}

export { SIMULATION_WS_URL, startSimulation }
export type { ScopeResult, SimulationProgress, SimulationResults }
