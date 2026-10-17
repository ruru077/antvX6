import { isEqual } from 'lodash-es'
import { isSameGraphModel } from '@/store/subGraphStore'
import type { InterpreterConfig } from '@/store/interpreterStore'
import type { EntryGraphModel } from '~/types'

export type ModelContent = {
  graphModel: EntryGraphModel
  config: InterpreterConfig
}

export type ModelAutosaveInfo = {
  content: ModelContent
  savedAt: number | null
  sizeBytes: number
}

function autosaveKey(userId: number | string, modelId: number | string) {
  return `antv-link:autosave:v1:${encodeURIComponent(userId)}:${encodeURIComponent(modelId)}`
}

export function isSameModelContent(left: ModelContent, right: ModelContent) {
  return (
    isSameGraphModel(left.graphModel, right.graphModel) &&
    isEqual(left.config, right.config)
  )
}

export function readModelAutosave(
  userId: number | string,
  modelId: number | string,
): ModelContent | null {
  const raw = localStorage.getItem(autosaveKey(userId, modelId))
  if (!raw) return null
  const content = JSON.parse(raw) as ModelContent
  const graphModel = content?.graphModel
  if (
    !graphModel ||
    !content.config ||
    typeof content.config !== 'object' ||
    !graphModel.subGraphs?.[graphModel.currentGraphId] ||
    !graphModel.subGraphs?.[graphModel.rootId] ||
    !Object.values(graphModel.subGraphs).every((item) =>
      Array.isArray(item?.graphJson?.cells),
    )
  ) {
    throw new Error('本地自动保存数据格式无效')
  }
  return content
}

export function writeModelAutosave(
  userId: number | string,
  modelId: number | string,
  content: ModelContent,
) {
  localStorage.setItem(autosaveKey(userId, modelId), JSON.stringify(content))
  localStorage.setItem(
    `${autosaveKey(userId, modelId)}:savedAt`,
    String(Date.now()),
  )
}

export function readModelAutosaveInfo(
  userId: number | string,
  modelId: number | string,
): ModelAutosaveInfo | null {
  const content = readModelAutosave(userId, modelId)
  if (!content) return null
  const raw = localStorage.getItem(autosaveKey(userId, modelId))!
  const timestamp = Number(
    localStorage.getItem(`${autosaveKey(userId, modelId)}:savedAt`),
  )
  return {
    content,
    savedAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null,
    sizeBytes: new Blob([raw]).size,
  }
}

export function removeModelAutosave(
  userId: number | string,
  modelId: number | string,
) {
  localStorage.removeItem(autosaveKey(userId, modelId))
  localStorage.removeItem(`${autosaveKey(userId, modelId)}:savedAt`)
}
