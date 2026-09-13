import { MASK_SELECTOR } from '@/assets/x6Model'
import type { NodeProperties } from '@antv/x6'
import type { SubGraphItem, SubGraphMap } from '~/types'

type MaskParamMap = Record<string, string>
type MaskParamOverrides = Record<string, MaskParamMap>

interface MaskScope {
  subsystemId: string
  params: MaskParamMap
}

function normalizeMaskParamMap(maskParam: unknown): MaskParamMap {
  if (!maskParam || Array.isArray(maskParam) || typeof maskParam !== 'object') {
    return {}
  }
  return Object.fromEntries(
    Object.entries(maskParam).map(([name, value]) => [
      name,
      String(value ?? ''),
    ]),
  )
}

class MaskParamResolutionError extends Error {
  readonly reference: string
  readonly subsystemId: string

  constructor(
    reference: string,
    subsystemId: string,
    message = `找不到 Mask 参数“${reference}”`,
  ) {
    super(message)
    this.reference = reference
    this.subsystemId = subsystemId
    this.name = 'MaskParamResolutionError'
  }
}

function getMaskParam(cell: NodeProperties): MaskParamMap {
  return normalizeMaskParamMap(cell.data?.maskParam)
}

function hasMask(cell: NodeProperties): boolean {
  const markup = cell.markup
  return (
    Array.isArray(markup) &&
    markup.some(
      (item) => typeof item === 'object' && item?.selector === MASK_SELECTOR,
    )
  )
}

/**
 * 从当前子系统向最外层收集 Mask 工作区。
 * 每层参数保持独立，只在解析一个引用时按此顺序逐层查找。
 */
function getMaskScopes(
  subsystemId: string,
  subGraphs: SubGraphMap,
  overrides: MaskParamOverrides = {},
): MaskScope[] {
  const scopes: MaskScope[] = []
  const visited = new Set<string>()
  let currentId: string | null = subsystemId

  while (currentId) {
    if (visited.has(currentId)) {
      throw new Error(`Subsystem hierarchy contains a cycle at ${currentId}`)
    }
    visited.add(currentId)

    const current: SubGraphItem | undefined = subGraphs[currentId]
    if (!current) throw new Error(`Subsystem ${currentId} is required`)
    if (!current.parentId) break

    const parent = subGraphs[current.parentId]
    if (!parent) {
      throw new Error(`Subsystem ${current.parentId} is required`)
    }

    const subsystem = parent.graphJson.cells.find(
      (cell): cell is NodeProperties =>
        cell.shape !== 'edge' && cell.id === currentId,
    )
    if (!subsystem) {
      throw new Error(
        `Subsystem node ${currentId} is required in ${current.parentId}`,
      )
    }

    if (hasMask(subsystem) || Object.hasOwn(overrides, currentId)) {
      scopes.push({
        subsystemId: currentId,
        params: Object.hasOwn(overrides, currentId)
          ? normalizeMaskParamMap(overrides[currentId])
          : getMaskParam(subsystem),
      })
    }
    currentId = current.parentId
  }

  return scopes
}

function isMaskParamReference(value: string): boolean {
  return /^[A-Za-z_]\w*$/.test(value.trim())
}

function normalizeNumericValue(
  value: string,
  reference: string,
  subsystemId: string,
): string {
  const normalized = value.trim()
  if (!normalized || !Number.isFinite(Number(normalized))) {
    throw new MaskParamResolutionError(
      reference,
      subsystemId,
      `参数“${reference}”的解析结果必须为数值`,
    )
  }
  return normalized
}

/**
 * 解析模块参数或 Mask 参数的实际值。
 * 查找顺序固定为当前层到最外层；同名参数找到后立即停止。
 */
function resolveMaskParamValue(
  value: string,
  subsystemId: string,
  subGraphs: SubGraphMap,
  overrides: MaskParamOverrides = {},
): string {
  const scopes = getMaskScopes(subsystemId, subGraphs, overrides)
  const reference = value.trim()
  if (!isMaskParamReference(reference)) {
    return normalizeNumericValue(value, reference, subsystemId)
  }

  function resolveReference(name: string, startIndex: number): string {
    for (let index = startIndex; index < scopes.length; index += 1) {
      const scope = scopes[index]
      if (!Object.hasOwn(scope.params, name)) continue

      const resolved = scope.params[name] ?? ''
      const nextReference = resolved.trim()
      if (!isMaskParamReference(nextReference)) {
        return normalizeNumericValue(resolved, name, scope.subsystemId)
      }

      return resolveReference(nextReference, index + 1)
    }

    throw new MaskParamResolutionError(name, subsystemId)
  }

  return resolveReference(reference, 0)
}

/** 模块参数仅替换可成功解析的 Mask 引用，其余原值交由后端校验。 */
function resolveModuleParamValue(
  value: string,
  subsystemId: string,
  subGraphs: SubGraphMap,
): string {
  if (!isMaskParamReference(value)) return value

  try {
    return resolveMaskParamValue(value, subsystemId, subGraphs)
  } catch (error) {
    if (error instanceof MaskParamResolutionError) return value
    throw error
  }
}

/**
 * 使用直接父级子系统的 mask 参数解析当前图层模块参数
 */
/** 使用嵌套 Mask 作用域解析副本，保留工作区中的原始表达式。 */
function resolveSubGraphMaskParams(subGraphs: SubGraphMap): SubGraphMap {
  const resolvedSubGraphs = structuredClone(subGraphs)

  for (const layer of Object.values(resolvedSubGraphs)) {
    if (getMaskScopes(layer.id, resolvedSubGraphs).length === 0) continue

    for (const cell of layer.graphJson.cells) {
      if (
        cell.shape === 'edge' ||
        !cell.data?.paramValues ||
        Array.isArray(cell.data.paramValues)
      ) {
        continue
      }

      const paramValues = cell.data.paramValues as Record<string, string>
      const paramOptions = cell.data.paramOptions as
        | Record<string, string[]>
        | undefined
      cell.data.paramValues = Object.fromEntries(
        Object.entries(paramValues).map(([name, value]) => {
          const normalizedValue = String(value ?? '')
          return [
            name,
            paramOptions?.[name]?.length
              ? normalizedValue
              : resolveModuleParamValue(
                  normalizedValue,
                  layer.id,
                  resolvedSubGraphs,
                ),
          ]
        }),
      )
    }
  }

  return resolvedSubGraphs
}

export {
  isMaskParamReference,
  MaskParamResolutionError,
  resolveMaskParamValue,
  resolveSubGraphMaskParams,
}
