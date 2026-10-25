import { antvApiUrl } from '@/api/endpoints'
import type { LadIssue, LadProgram, LadSnapshot, LadSummary } from './model'

export class LadApiError extends Error {
  status: number
  issues: LadIssue[]
  constructor(status: number, message: string, issues: LadIssue[] = []) {
    super(message)
    this.status = status
    this.issues = issues
  }
}
async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(antvApiUrl('/ladder' + path), {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-Antv-Request': '1',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.status === 204) return undefined as T
    const result = await response.json().catch(() => null)
    if (!response.ok)
      throw new LadApiError(
        response.status,
        result?.message ?? '请求失败（' + response.status + '）',
        Array.isArray(result?.errors) ? result.errors : [],
      )
    if (!result) throw new Error('服务器未返回有效 JSON')
    return result as T
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('请求超时，扫描已暂停；请检查本地服务后重试')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
export const ladApi = {
  models: () => request<{ models: LadSummary[] }>('/models'),
  open: (id: number) =>
    request<LadSummary & { program: LadProgram }>('/models/' + id),
  save: (id: number | null, modelName: string, program: LadProgram) =>
    request<LadSummary>(
      id === null ? '/models' : '/models/' + id,
      id === null ? 'POST' : 'PUT',
      { modelName, description: '', program },
    ),
  remove: (id: number) => request<void>('/models/' + id, 'DELETE'),
  validate: (program: LadProgram) =>
    request<{ valid: boolean; errors: LadIssue[] }>(
      '/runtime/validate',
      'POST',
      { program },
    ),
  session: (program: LadProgram) =>
    request<{ sessionId: string; snapshot: LadSnapshot }>(
      '/runtime/session',
      'POST',
      { program },
    ),
  step: (sessionId: string, inputs: Record<string, boolean>) =>
    request<{ snapshot: LadSnapshot }>('/runtime/step', 'POST', {
      sessionId,
      inputs,
    }),
  reset: (sessionId: string) =>
    request<{ snapshot: LadSnapshot }>('/runtime/reset', 'POST', { sessionId }),
  close: (sessionId: string) =>
    request<{ closed: boolean }>('/runtime/close', 'POST', { sessionId }),
  compile: (program: LadProgram) =>
    request<{ source: string; language: 'c'; validated: boolean }>(
      '/runtime/compile',
      'POST',
      { program },
    ),
}
