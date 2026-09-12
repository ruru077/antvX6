const API_BASE = '/m2plab/api'

export class PlatformError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function getPlatformUser() {
  // The platform's login endpoint encrypts profile data. Its existing minimal
  // auth-context endpoint validates the same session and returns only the ID.
  const response = await fetch(`${API_BASE}/auth-context`, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok)
    throw new PlatformError(
      response.status === 401
        ? '登录已过期，请返回平台重新登录'
        : '暂时无法验证登录状态',
      response.status,
    )
  const id = Number(response.headers.get('X-Authenticated-User-ID'))
  if (!Number.isInteger(id) || id <= 0) throw new Error('无法读取登录用户')
  return { id }
}

export async function platformRequest(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  })
  const payload = await response.json().catch(() => {
    throw new PlatformError(
      '服务返回异常，请稍后重试；模型尚未保存',
      response.status,
    )
  })
  if (
    !response.ok ||
    (payload.code !== undefined && Number(payload.code) !== 100)
  ) {
    throw new PlatformError(
      response.status === 401
        ? '登录已过期，请返回平台重新登录'
        : payload.message || `请求失败 (${response.status})`,
      response.status,
    )
  }
  return payload.data ?? payload
}

export const assetUrl = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
