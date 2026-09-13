import type { GraphModelDTO } from '~/types/dto/graphModel'

// 本地服务器版
// const SIMULATION_WS_URL = 'wss://stencil.top/NCSLabLink/websocketsimulatert'
// 0902 bugfix版
const SIMULATION_WS_URL = 'wss://stencil.top/NCSLabLink0902/websocketsimulatert'
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

    const finish = (results: SimulationResults) => {
      completed = true
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
          reject(error)
          socket.close()
          return
        }

        if (type === 'scope_update') {
          const results = normalizeResults(message.scopeData)
          if (results) onResults(results)
        }

        if (type === 'final_results') {
          const results =
            normalizeResults(message.data) ??
            normalizeResults(message.results) ??
            normalizeResults(message)
          if (!results) {
            completed = true
            reject(new Error('仿真完成，但返回结果中没有 scopes 数据'))
            socket.close()
            return
          }
          finish(results)
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
      if (!completed)
        reject(new Error(`无法连接仿真服务：${SIMULATION_WS_URL}`))
    }

    socket.onclose = (event) => {
      if (!completed && event.code !== 1000) {
        reject(new Error('仿真 WebSocket 连接意外关闭'))
      }
    }
  })
}

export { SIMULATION_WS_URL, startSimulation }
export type { ScopeResult, SimulationProgress, SimulationResults }
