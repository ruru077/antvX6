import type { GraphModelDTO } from '~/types/dto/graphModel'

const COMPILATION_WS_URL = 'ws://localhost:8071/NCSLabLink/websocketcompile'

interface CompilationProgress {
  message: string
  percent: number
}

interface StartCompilationOptions {
  model: GraphModelDTO
  onProgress: (progress: CompilationProgress) => void
  onWarning?: (warning: string, blocks?: string[]) => void
}

const progressByMessage: Record<string, CompilationProgress> = {
  start: { message: '开始编译', percent: 10 },
  generating: { message: '正在生成代码', percent: 20 },
  generated: { message: '代码生成完成', percent: 40 },
  compiling: { message: '正在编译代码', percent: 60 },
  compiled: { message: '代码编译完成', percent: 80 },
  'database inserting': { message: '正在保存编译结果', percent: 90 },
  'database inserted': { message: '编译结果保存完成', percent: 95 },
  finished: { message: '编译完成', percent: 100 },
}

function messageText(value: unknown, fallback: string): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback
}

function startCompilation({
  model,
  onProgress,
  onWarning,
}: StartCompilationOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(COMPILATION_WS_URL)
    let completed = false

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
      try {
        const response = JSON.parse(String(data)) as Record<string, unknown>
        const type = messageText(
          response.msg ?? response.message_type ?? response.type,
          'unknown',
        )

        if (type === 'error') {
          fail(
            new Error(
              messageText(response.error ?? response.message, '编译失败'),
            ),
          )
          return
        }

        if (type === 'warning') {
          const warning = messageText(
            response.message ?? response.warning,
            '编译警告',
          )
          const dataValue = response.data
          const blocks =
            dataValue && typeof dataValue === 'object'
              ? (dataValue as { blocks?: unknown }).blocks
              : undefined
          onWarning?.(
            warning,
            Array.isArray(blocks)
              ? blocks.filter(
                  (block): block is string => typeof block === 'string',
                )
              : undefined,
          )
          return
        }

        const progress = progressByMessage[type]
        if (progress) onProgress(progress)

        if (type === 'finished') {
          completed = true
          resolve()
          socket.close(1000)
        }
      } catch (error) {
        console.error('无法解析编译 WebSocket 消息', error)
      }
    }

    socket.onerror = () => {
      fail(new Error(`无法连接编译服务：${COMPILATION_WS_URL}`))
    }

    socket.onclose = (event) => {
      if (!completed) {
        fail(
          new Error(
            event.reason || `编译 WebSocket 连接意外关闭（${event.code}）`,
          ),
        )
      }
    }
  })
}

export { COMPILATION_WS_URL, startCompilation }
export type { CompilationProgress }
