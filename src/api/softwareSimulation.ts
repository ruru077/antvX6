import { linkWsUrl } from './endpoints'
import type {
  ScopeResult,
  SimulationProgress,
  SimulationResults,
} from './simulation'
import type { GraphModelDTO } from '~/types/dto/graphModel'

export const MAX_SOFTWARE_RESULT_BYTES = 64 * 1024 * 1024

export async function readSoftwareResult(
  response: Response,
): Promise<ArrayBuffer> {
  const oversized = () =>
    new Error('软件仿真结果超过 64 MiB，请减少仿真时长或最大采样点数')
  if (
    Number(response.headers.get('Content-Length')) > MAX_SOFTWARE_RESULT_BYTES
  ) {
    await response.body?.cancel()
    throw oversized()
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('软件仿真结果文件为空')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_SOFTWARE_RESULT_BYTES) {
        await reader.cancel()
        throw oversized()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const buffer = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  return buffer.buffer
}

/** Existing Linux C results.bin format: little-endian headers and double samples. */
export function decodeSimulationResults(
  buffer: ArrayBuffer,
): SimulationResults {
  if (buffer.byteLength > MAX_SOFTWARE_RESULT_BYTES)
    throw new Error('软件仿真结果超过 64 MiB')
  const view = new DataView(buffer)
  let offset = 0
  const requireBytes = (length: number) => {
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > view.byteLength - offset
    )
      throw new Error('软件仿真结果文件不完整或格式无效')
  }
  const int = () => {
    requireBytes(4)
    const value = view.getInt32(offset, true)
    offset += 4
    return value
  }
  const double = () => {
    requireBytes(8)
    const value = view.getFloat64(offset, true)
    offset += 8
    return value
  }
  const text = (length: number) => {
    requireBytes(length)
    const value = new TextDecoder('utf-8', { fatal: true }).decode(
      new Uint8Array(buffer, offset, length),
    )
    offset += length
    return value
  }
  const count = int()
  if (count < 0 || count > (view.byteLength - offset) / 32)
    throw new Error('软件仿真结果的终端数量无效')
  const scopes: ScopeResult[] = []
  for (let terminal = 0; terminal < count; terminal++) {
    const type = int()
    const nameLength = int(),
      uuidLength = int(),
      size = int(),
      maximum = int()
    const width = int(),
      height = int(),
      full = int()
    if (
      type !== 0 ||
      nameLength < 0 ||
      uuidLength < 0 ||
      size < 0 ||
      maximum < size ||
      width < 1 ||
      height < 1 ||
      (full !== 0 && full !== 1)
    )
      throw new Error('软件仿真结果的 Scope 信息无效')
    const channels = width * height
    requireBytes(nameLength + uuidLength + size * (channels + 1) * 8)
    const name = text(nameLength),
      uuid = text(uuidLength)
    const time: number[] = [],
      data: number[] = []
    let previousTime = -Infinity
    for (let row = 0; row < size; row++) {
      const timestamp = double()
      if (!Number.isFinite(timestamp) || timestamp < previousTime)
        throw new Error('软件仿真结果的时间顺序无效')
      time.push(timestamp)
      previousTime = timestamp
      for (let channel = 0; channel < channels; channel++) data.push(double())
    }
    scopes.push({ name, uuid, width, height, time, data })
  }
  if (offset !== view.byteLength)
    throw new Error('软件仿真结果包含无法识别的数据')
  return { scopes }
}

export function softwareResultUrl(
  path: unknown,
  model: Pick<GraphModelDTO, 'userId' | 'modelId'>,
): string {
  if (
    !Number.isSafeInteger(model.userId) ||
    model.userId <= 0 ||
    !Number.isSafeInteger(model.modelId) ||
    model.modelId <= 0 ||
    path !== `/CCode/${model.userId}/${model.modelId}/results.bin`
  )
    throw new Error('软件仿真返回了不匹配的结果文件')
  return new URL(
    `/m2plab/matlab/simulation-results/${model.userId}/${model.modelId}/results.bin`,
    window.location.origin,
  ).toString()
}

export function annotateSoftwareScopes(
  results: SimulationResults,
  model: GraphModelDTO,
): SimulationResults {
  const blocks = new Map(model.blocks.map((block) => [block.blockUUID, block]))
  // ToWorkspace/ToFile/Display also serialize ScopeStruct (terminal type 0).
  // Decode them normally, then keep only the parent's visible Scope blocks.
  const scopes = results.scopes
    .filter((scope) => blocks.get(scope.uuid ?? '')?.blockType === 'Scope')
    .map((scope) => {
      const input = /^in([1-9][0-9]*)$/.exec(scope.name ?? '')?.[1]
      const lines = model.lines.filter(
        (line) =>
          line.toBlockUUID === scope.uuid &&
          (!input || line.toPortNo === input),
      )
      const held =
        lines.length > 0 &&
        lines.every(
          (line) =>
            blocks.get(line.fromBlockUUID)?.blockType === 'LadderController',
        )
      return held ? { ...scope, sampleHold: true } : scope
    })
  const expected = model.blocks.filter((block) => block.blockType === 'Scope')
  if (
    expected.some(
      (block) => !scopes.some((scope) => scope.uuid === block.blockUUID),
    )
  )
    throw new Error('软件仿真结果与当前模型的 Scope 不匹配')
  return { scopes }
}

const progress: Record<string, number> = {
  start: 5,
  generating: 10,
  generated: 25,
  compiling: 35,
  compiled: 60,
  simulating: 70,
  simulated: 90,
}

/** C software simulation has a file-result protocol, separate from device compilation. */
export function startSoftwareSimulation({
  model,
  onProgress,
  onResults,
  onWarning,
}: {
  model: GraphModelDTO
  onProgress: (value: SimulationProgress) => void
  onResults: (value: SimulationResults) => void
  onWarning?: (message: string) => void
}): Promise<SimulationResults> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(linkWsUrl('websocketsimulate'))
    let completed = false
    let downloading = false
    const fail = (error: unknown) => {
      if (completed) return
      completed = true
      socket.close()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          com: 'start',
          language: 'c',
          mdlData: { jsonData: JSON.stringify(model) },
        }),
      )
    socket.onmessage = ({ data }) => {
      if (completed || downloading) return
      try {
        const message = JSON.parse(String(data))
        const type = message.msg ?? message.message_type ?? message.type
        if (type === 'error')
          return fail(
            new Error(
              String(message.error ?? message.message ?? '软件仿真失败'),
            ),
          )
        if (type === 'warning') {
          onWarning?.(
            String(message.message ?? message.warning ?? '软件仿真警告'),
          )
          return
        }
        if (type === 'result') {
          const url = softwareResultUrl(message.resultsFile, model)
          downloading = true
          onProgress({ message: '正在读取软件仿真结果', percent: 95 })
          void (async () => {
            const response = await fetch(url, {
              credentials: 'same-origin',
              cache: 'no-store',
              redirect: 'error',
              headers: { Accept: 'application/octet-stream' },
              signal: AbortSignal.timeout(30000),
            })
            if (!response.ok)
              throw new Error(`读取软件仿真结果失败（${response.status}）`)
            const results = annotateSoftwareScopes(
              decodeSimulationResults(await readSoftwareResult(response)),
              model,
            )
            if (completed) return
            onResults(results)
            onProgress({ message: '软件仿真完成', percent: 100 })
            completed = true
            socket.close(1000)
            resolve(results)
          })().catch(fail)
          return
        }
        if (progress[type] !== undefined)
          onProgress({ message: type, percent: progress[type] })
      } catch (error) {
        fail(error)
      }
    }
    socket.onerror = () => {
      if (!downloading) fail(new Error('无法连接 C 软件仿真服务'))
    }
    socket.onclose = () => {
      if (!completed && !downloading)
        fail(new Error('C 软件仿真连接在返回结果前关闭'))
    }
  })
}
