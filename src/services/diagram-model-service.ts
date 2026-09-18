import { useNcslabContextStore } from '@/services/ncslab-context-service'
import type { InterpreterConfig } from '@/store/interpreterStore'
import type { EntryGraphModel } from '~/types'

const MODEL_SERVER = import.meta.env.DEV
  ? 'http://localhost:8080'
  : 'https://www.stencil.top'

type DiagramVisibility = 'public' | 'private'

type DiagramModelSummary = {
  id: number | string
  modelName: string
  description: string
  author?: string
  creatorId: number | string
  visibility: DiagramVisibility
  lastUpdate: string
}

type DiagramModelDetail = DiagramModelSummary & {
  graphModel: EntryGraphModel
  config: InterpreterConfig
}

type DiagramModelList = {
  publicModels: DiagramModelSummary[]
  privateModels: DiagramModelSummary[]
}

class DiagramModelRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DiagramModelRequestError'
    this.status = status
  }
}

async function requestDiagramModel<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const context = useNcslabContextStore.getState().context
  if (!context) throw new Error('缺少 userId、plantId 上下文')
  const url = new URL(path, MODEL_SERVER)
  url.searchParams.set('userId', String(context.user.id))
  url.searchParams.set('plantId', String(context.plant.id))
  const response = await fetch(url, {
    ...init,
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new DiagramModelRequestError(
      response.status,
      body?.message || `请求失败（${response.status}）`,
    )
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function listDiagramModels(plantId: number | string) {
  return requestDiagramModel<DiagramModelList>(
    `/diagram-models?plantId=${encodeURIComponent(plantId)}`,
  )
}

function getDiagramModel(id: number | string) {
  return requestDiagramModel<DiagramModelDetail>(
    `/diagram-models/${encodeURIComponent(id)}`,
  )
}

function createDiagramModel(input: {
  plantId: number | string
  modelName: string
  description: string
  graphModel: EntryGraphModel
  config: InterpreterConfig
}) {
  return requestDiagramModel<DiagramModelSummary>('/diagram-models', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

function updateDiagramModel(
  id: number | string,
  input: { modelName?: string; description?: string },
) {
  return requestDiagramModel<DiagramModelSummary>(
    `/diagram-models/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
}

function deleteDiagramModel(id: number | string) {
  return requestDiagramModel<void>(
    `/diagram-models/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  )
}

export {
  createDiagramModel,
  deleteDiagramModel,
  DiagramModelRequestError,
  getDiagramModel,
  listDiagramModels,
  requestDiagramModel,
  updateDiagramModel,
}
export type {
  DiagramModelDetail,
  DiagramModelList,
  DiagramModelSummary,
  DiagramVisibility,
}
