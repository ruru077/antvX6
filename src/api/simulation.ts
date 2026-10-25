import { linkWsUrl } from './endpoints'
import type { LadSnapshot } from '@/ladder/model'
import type { GraphModelDTO } from '~/types/dto/graphModel'

const SIMULATION_WS_URL = linkWsUrl('websocketsimulatert')

// 本地服务器版
// const SIMULATION_WS_URL = 'wss://stencil.top/NCSLabLink/websocketsimulatert'
// 0902 bugfix版 似乎没什么区别
// const SIMULATION_WS_URL = 'wss://stencil.top/NCSLabLink0902/websocketsimulatert'
// 本地调试版
// const SIMULATION_WS_URL = 'ws://localhost:8071/NCSLabLink/websocketsimulatert'
interface ScopeResult {
  uuid?: string
  path?: string
  name?: string
  width?: number
  height?: number
  sampleHold?: boolean
  time: number[]
  data: number[] | number[][]
}

interface SimulationResults {
  scopes: ScopeResult[]
}

export interface LadderUpdate {
  runId: string
  time: number
  controllers: { blockUUID: string; snapshot: LadSnapshot }[]
}

interface SimulationProgress {
  message: string
  percent: number
}

interface StartSimulationOptions {
  model: GraphModelDTO
  onProgress: (progress: SimulationProgress) => void
  onResults: (results: SimulationResults) => void
  onLadderUpdate?: (update: LadderUpdate) => void
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

function getSimulationWsUrl(): string {
  // Production requests always use the gateway; a persisted local-debug preference must not bypass authentication.
  // Manual local debugging: return `ws://localhost:8071/NCSLabLink/websocketsimulatert`
  return linkWsUrl('websocketsimulatert')
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
  onLadderUpdate,
}: StartSimulationOptions): Promise<SimulationResults> {
  return new Promise((resolve, reject) => {
    const simulationWsUrl = getSimulationWsUrl()
    const socket = new WebSocket(simulationWsUrl)
    let completed = false
    let ladderRunId: string | null = null

    const finish = (results: SimulationResults) => {
      completed = true
      onResults(results)
      resolve(results)
      socket.close()
    }
    const fail = (error: Error) => {
      if (completed) return
      completed = true
      reject(error)
      socket.close()
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
      if (completed) return
      try {
        const message = JSON.parse(String(data)) as Record<string, unknown>
        const type = messageText(
          message.msg ?? message.message_type ?? message.type,
          'unknown',
        )

        if (type === 'ladder_update') {
          const update = (message.controllers ? message : message.data) as
            | LadderUpdate
            | undefined
          if (
            !update ||
            typeof update.runId !== 'string' ||
            !Number.isFinite(update.time) ||
            !Array.isArray(update.controllers)
          )
            return
          if (ladderRunId !== null && ladderRunId !== update.runId) return
          if (
            update.controllers.some(
              (item) =>
                !item ||
                typeof item.blockUUID !== 'string' ||
                !item.snapshot ||
                !Number.isInteger(item.snapshot.scanIndex) ||
                !Number.isFinite(item.snapshot.timeMs) ||
                !item.snapshot.variables ||
                !item.snapshot.trace ||
                !item.snapshot.outputs ||
                typeof item.snapshot.variables !== 'object' ||
                typeof item.snapshot.trace !== 'object' ||
                typeof item.snapshot.outputs !== 'object',
            )
          )
            return
          ladderRunId = update.runId
          onLadderUpdate?.(update)
          return
        }

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
          const payload = message.data as { scopeData?: unknown } | undefined
          const results = normalizeResults(
            message.scopeData ?? payload?.scopeData,
          )
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
      fail(new Error(`无法连接仿真服务：${simulationWsUrl}`))
    }

    socket.onclose = (event) => {
      if (!completed) {
        fail(new Error('仿真 WebSocket 连接意外关闭'))
      }
    }
  })
}

export { getSimulationWsUrl, SIMULATION_WS_URL, startSimulation }
export type { ScopeResult, SimulationProgress, SimulationResults }
