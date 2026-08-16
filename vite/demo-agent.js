import { randomUUID } from 'node:crypto'

const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODELS = new Set(['deepseek-v4-flash', 'deepseek-v4-pro'])
const DEEPSEEK_REASONING_EFFORTS = new Set(['none', 'low', 'high', 'max'])
const MAX_REQUEST_BYTES = 1024 * 1024

function createDemoAgentPlugin(apiKey) {
  return {
    name: 'antv-link-demo-agent',
    configureServer(server) {
      server.middlewares.use('/api/demo-agent', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.setHeader('Allow', 'POST')
          response.end('Method Not Allowed')
          return
        }

        if (!apiKey) {
          sendJsonError(
            response,
            503,
            'DEEPSEEK_API_KEY is not configured on the development server.',
          )
          return
        }

        let input
        try {
          input = await readJsonBody(request)
        } catch (error) {
          sendJsonError(
            response,
            400,
            error instanceof Error ? error.message : 'Invalid request body.',
          )
          return
        }

        const messages = normalizeMessages(input.messages)
        if (!messages.some((message) => message.role === 'user')) {
          sendJsonError(response, 400, 'The run contains no user message.')
          return
        }

        if (typeof input.threadId !== 'string' || !input.threadId) {
          sendJsonError(response, 400, 'The run contains no threadId.')
          return
        }

        const model = input.forwardedProps?.modelName
        if (typeof model !== 'string' || !DEEPSEEK_MODELS.has(model)) {
          sendJsonError(response, 400, 'The run contains no supported model.')
          return
        }

        const reasoningEffort = input.forwardedProps?.reasoningEffort
        if (
          typeof reasoningEffort !== 'string' ||
          !DEEPSEEK_REASONING_EFFORTS.has(reasoningEffort)
        ) {
          sendJsonError(
            response,
            400,
            'The run contains no supported reasoning effort.',
          )
          return
        }

        const abortController = new AbortController()
        response.on('close', () => abortController.abort())

        let deepseekResponse
        try {
          deepseekResponse = await fetch(DEEPSEEK_CHAT_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              thinking: {
                type: reasoningEffort === 'none' ? 'disabled' : 'enabled',
              },
              ...(reasoningEffort === 'none'
                ? {}
                : { reasoning_effort: reasoningEffort }),
              messages,
              stream: true,
            }),
            signal: abortController.signal,
          })
        } catch (error) {
          if (abortController.signal.aborted) return
          sendJsonError(
            response,
            502,
            error instanceof Error
              ? error.message
              : 'Failed to reach DeepSeek.',
          )
          return
        }

        if (!deepseekResponse.ok || !deepseekResponse.body) {
          const detail = await deepseekResponse.text()
          sendJsonError(
            response,
            deepseekResponse.status || 502,
            detail || 'DeepSeek returned an empty response.',
          )
          return
        }

        response.statusCode = 200
        response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
        response.setHeader('Cache-Control', 'no-cache, no-transform')
        response.setHeader('Connection', 'keep-alive')
        response.flushHeaders()

        const runId =
          typeof input.runId === 'string' && input.runId
            ? input.runId
            : randomUUID()
        const threadId = input.threadId
        const messageId = randomUUID()
        let messageStarted = false
        let runFinished = false

        function startMessage() {
          if (messageStarted) return
          messageStarted = true
          sendEvent(response, { type: 'RUN_STARTED', threadId, runId })
          sendEvent(response, {
            type: 'TEXT_MESSAGE_START',
            messageId,
            role: 'assistant',
          })
        }

        function finishRun() {
          if (runFinished) return
          startMessage()
          runFinished = true
          sendEvent(response, { type: 'TEXT_MESSAGE_END', messageId })
          sendEvent(response, {
            type: 'RUN_FINISHED',
            threadId,
            runId,
            outcome: { type: 'success' },
          })
          response.end()
        }

        try {
          await consumeDeepSeekStream(deepseekResponse.body, (delta) => {
            startMessage()
            sendEvent(response, {
              type: 'TEXT_MESSAGE_CONTENT',
              messageId,
              delta,
            })
          })
          finishRun()
        } catch (error) {
          if (abortController.signal.aborted) return
          startMessage()
          sendEvent(response, {
            type: 'RUN_ERROR',
            message:
              error instanceof Error
                ? error.message
                : 'DeepSeek stream failed.',
          })
          response.end()
        }
      })
    },
  }
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return []

  return messages.flatMap((message) => {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)) {
      return []
    }

    const content = normalizeContent(message.content)
    return content ? [{ role: message.role, content }] : []
  })
}

function normalizeContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .filter(
      (part) => part && part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('')
}

async function readJsonBody(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) {
      throw new Error('Request body is too large.')
    }
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new Error('Request body is not valid JSON.')
  }
}

async function consumeDeepSeekStream(stream, onDelta) {
  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const done = consumeDeepSeekLine(line, onDelta)
      if (done) return
    }
  }

  buffer += decoder.decode()
  consumeDeepSeekLine(buffer, onDelta)
}

function consumeDeepSeekLine(line, onDelta) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return false

  const data = trimmed.slice(5).trim()
  if (data === '[DONE]') return true
  if (!data) return false

  const chunk = JSON.parse(data)
  const delta = chunk.choices?.[0]?.delta?.content
  if (typeof delta === 'string' && delta) onDelta(delta)
  return false
}

function sendEvent(response, event) {
  response.write(`data: ${JSON.stringify(event)}\n\n`)
}

function sendJsonError(response, statusCode, message) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify({ error: message }))
}

export { createDemoAgentPlugin }
