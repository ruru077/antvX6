import { StringExt } from '@antv/x6'
import { create } from 'zustand'
import {
  buildSubsystemMarkup,
  maskArrowAttrs,
  MASK_SELECTOR,
} from '@/assets/x6Model'
import type { Node } from '@antv/x6'
import type {
  EntryGraphModel,
  GraphJSON,
  SubGraphItem,
  SubGraphMap,
} from '~/types'

/**
 * @description 子系统全局数据 Store
 */
interface SubGraphStore {
  // 当前所在的Graph ID
  currentGraphId: string
  // 从根Graph到当前Graph的路径ID列表
  currentPathIds: string[]
  // Entry Graph ID
  rootId: string
  // 所有subGraph的信息
  subGraphs: SubGraphMap
  // 导出EntryGraphModel
  exportEntryGraphModel: () => EntryGraphModel
  // 同步当前Layer Graph数据
  syncGraph: (graphJson: GraphJSON) => void
  // 同步新增SubGraph数据
  syncSubGraph: (
    subGraphNode: Node,
    action: 'add' | 'delete',
    initialGraphJson?: GraphJSON,
  ) => boolean
  // 同步子系统展示名称
  syncSubGraphName: (subGraphId: string, name: string) => void
  // 添加 mask 工具
  addMaskToSubsystem: (node: Node) => void
}

interface CreateSubGraphItemOptions {
  /** 指定 id，仅 GraphJSON 重载生效；Node 重载始终使用 node.id */
  id?: string
  /** 覆盖默认名称 */
  name?: string
  /** 初始子系统 id 集合，默认空集 */
  childrenIds?: string[]
  /** Node 注册为子系统时使用的初始内部图 */
  graphJson?: GraphJSON
}

/**
 * 子系统封装的Block同步函数
 * @arg subGraphNode 子系统节点
 * GraphJson 生成子系统
 * @arg graphJson 需要转化为子系统的Graph JSON数据
 * @param options : CreateSubGraphItemOptions
 * @returns subGraphItem
 */
function createSubGraphItem(
  subGraphNode: Node,
  options?: CreateSubGraphItemOptions,
): SubGraphItem
function createSubGraphItem(
  graphJson: GraphJSON,
  options?: CreateSubGraphItemOptions,
): SubGraphItem
function createSubGraphItem(
  arg: Node | GraphJSON,
  options: CreateSubGraphItemOptions = {},
): SubGraphItem {
  const { currentGraphId, subGraphs } = useSubGraphStore.getState()
  const deep = subGraphs[currentGraphId].deep + 1
  // 默认值
  const {
    id = StringExt.uuid(),
    name = 'New Subsystem',
    childrenIds = [],
    graphJson: initialGraphJson,
  } = options
  // Node
  if ('isNode' in arg && arg.isNode()) {
    const graphJson = cloneSubGraphJson(initialGraphJson)
    const nestedSubGraphs = collectNestedSubGraphs(graphJson, arg.id, deep + 1)
    return {
      id: arg.id,
      name: arg.attr<string>('label/text') || 'Subsystem',
      deep,
      parentId: currentGraphId,
      // Test
      childrenIds: childrenIds.length
        ? childrenIds
        : Object.values(nestedSubGraphs)
            .filter((subGraph) => subGraph.parentId === arg.id)
            .map((subGraph) => subGraph.id),
      graphJson,
    }
  }
  // GraphJSON
  return {
    id: id,
    name: name,
    deep,
    parentId: currentGraphId,
    childrenIds,
    graphJson: arg,
  }
}

/**
 * 复制子系统 graphJson，并重写内部 cell id 引用
 * @param graphJson 原始子系统 graphJson
 * @returns 新 id 的 graphJson
 * @author codex
 */
function cloneSubGraphJson(graphJson?: GraphJSON): GraphJSON {
  const next = JSON.parse(
    JSON.stringify(graphJson ?? ({ cells: [] } as GraphJSON)),
  ) as GraphJSON
  const cells = next.cells ?? []
  const idMap = new Map<string, string>()

  cells.forEach((cell) => {
    if (cell.id) idMap.set(cell.id, StringExt.uuid())
  })

  cells.forEach((cell) => {
    if (cell.id) cell.id = idMap.get(cell.id) ?? cell.id
    if (cell.parent) cell.parent = idMap.get(cell.parent) ?? cell.parent
    if ('children' in cell && Array.isArray(cell.children)) {
      cell.children = cell.children.map((id) => idMap.get(id) ?? id)
    }
    if (cell.shape === 'edge') {
      if (typeof cell.source === 'string') {
        cell.source = idMap.get(cell.source) ?? cell.source
      } else if (cell.source?.cell) {
        cell.source = {
          ...cell.source,
          cell: idMap.get(cell.source.cell) ?? cell.source.cell,
        }
      }

      if (typeof cell.target === 'string') {
        cell.target = idMap.get(cell.target) ?? cell.target
      } else if (cell.target?.cell) {
        cell.target = {
          ...cell.target,
          cell: idMap.get(cell.target.cell) ?? cell.target.cell,
        }
      }
    }
    if (cell.data?.graphJson) {
      cell.data.graphJson = cloneSubGraphJson(cell.data.graphJson)
    }
  })

  return next
}

/**
 * 收集 graphJson 中直接/嵌套的子系统图层
 * @param graphJson 待扫描的 graphJson
 * @param parentId 当前 graphJson 所属的子系统 id
 * @param deep 子系统深度
 * @returns 子系统 id -> 子系统图层
 * @author codex
 */
function collectNestedSubGraphs(
  graphJson: GraphJSON,
  parentId: string,
  deep: number,
): SubGraphMap {
  const result: SubGraphMap = {}
  const cells = graphJson.cells ?? []

  cells.forEach((cell) => {
    if (
      cell.shape === 'edge' ||
      cell.data?.blockType !== 'Subsystem' ||
      !cell.id
    )
      return

    const childGraphJson = cell.data.graphJson ?? ({ cells: [] } as GraphJSON)
    const nestedSubGraphs = collectNestedSubGraphs(
      childGraphJson,
      cell.id,
      deep + 1,
    )
    const text = cell.attrs?.label?.text
    result[cell.id] = {
      id: cell.id,
      name: typeof text === 'string' && text ? text : 'Subsystem',
      deep,
      parentId,
      childrenIds: Object.values(nestedSubGraphs)
        .filter((subGraph) => subGraph.parentId === cell.id)
        .map((subGraph) => subGraph.id),
      graphJson: childGraphJson,
    }
    Object.assign(result, nestedSubGraphs)
  })

  return result
}
/**
 *
 * @param subGraphs subGraphs Records
 * @param subGraphId 建立的目标subGraph节点Id
 * @returns path: rootId -> subGraphId
 */
function buildPaths(subGraphs: SubGraphMap, subGraphId: string) {
  const pathIds = [subGraphId]
  let parentId = subGraphs[subGraphId].parentId
  while (parentId) {
    pathIds.unshift(parentId)
    parentId = subGraphs[parentId].parentId
  }
  return pathIds
}
const ROOT_ID = 'root'

// 压缩 JSON
function zipGraphModelJson(obj: EntryGraphModel): EntryGraphModel {
  function zip(val: unknown): unknown {
    if (Array.isArray(val)) return val.map(zip)
    if (val !== null && typeof val === 'object') {
      return Object.fromEntries(
        Object.entries(val as Record<string, unknown>)
          .filter(([, v]) => v !== null)
          .map(([k, v]) => [k, zip(v)]),
      )
    }
    return val
  }
  return zip(obj) as EntryGraphModel
}
// ─── store ───────────────────────────────────────────────────────────────────
const useSubGraphStore = create<SubGraphStore>((set, get) => ({
  currentGraphId: ROOT_ID,
  currentPathIds: [ROOT_ID],
  rootId: ROOT_ID,
  subGraphs: {
    [ROOT_ID]: {
      id: ROOT_ID,
      name: 'root',
      deep: 0,
      parentId: null,
      childrenIds: [],
      graphJson: { cells: [] },
    },
  },

  exportEntryGraphModel: () => {
    const { currentGraphId, rootId, subGraphs } = get()
    return zipGraphModelJson({
      currentGraphId,
      rootId,
      subGraphs,
    })
  },
  syncGraph: (graphJson) => {
    const { currentGraphId, subGraphs } = get()
    set({
      subGraphs: {
        ...subGraphs,
        [currentGraphId]: {
          ...subGraphs[currentGraphId],
          graphJson,
        },
      },
    })
  },
  syncSubGraph: (subGraphNode, action, initialGraphJson) => {
    const { currentGraphId, subGraphs } = get()

    if (action === 'add') {
      // 如果已经存在，则不重复添加
      if (subGraphs[subGraphNode.id]) return false

      // subGraph 加入当前Layer
      const currentSubGraphItem = subGraphs[currentGraphId]
      const subGraphItem = createSubGraphItem(subGraphNode, {
        graphJson: initialGraphJson,
      })
      const nestedSubGraphs = collectNestedSubGraphs(
        subGraphItem.graphJson,
        subGraphItem.id,
        subGraphItem.deep + 1,
      )
      set({
        subGraphs: {
          ...subGraphs,
          [currentGraphId]: {
            ...currentSubGraphItem,
            childrenIds: [...currentSubGraphItem.childrenIds, subGraphNode.id],
          },
          [subGraphNode.id]: subGraphItem,
          ...nestedSubGraphs,
        },
      })
      return true
    } else if (action === 'delete') {
      const nextSubGraphs = { ...subGraphs }
      delete nextSubGraphs[subGraphNode.id]
      const parentId = subGraphs[subGraphNode.id].parentId!

      set({
        subGraphs: {
          ...nextSubGraphs,
          [parentId]: {
            ...subGraphs[parentId],
            childrenIds: subGraphs[parentId].childrenIds.filter(
              (id) => id !== subGraphNode.id,
            ),
          },
        },
      })
      return true
    }
    return false
  },
  syncSubGraphName: (subGraphId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return

    const { subGraphs } = get()
    const subGraph = subGraphs[subGraphId]
    if (!subGraph || subGraph.name === trimmed) return

    set({
      subGraphs: {
        ...subGraphs,
        [subGraphId]: {
          ...subGraph,
          name: trimmed,
        },
      },
    })
  },
  addMaskToSubsystem: (node) => {
    if (node.getData()?.blockType !== 'Subsystem') return

    const markup = node.getMarkup()
    if (typeof markup === 'string') return

    const markupItems = Array.isArray(markup) ? markup : [markup]
    const alreadyHasMask = markupItems.some(
      (item) => item.selector === MASK_SELECTOR,
    )
    if (alreadyHasMask) return

    node.setMarkup(buildSubsystemMarkup(true))
    node.attr(maskArrowAttrs)
  },
}))

export type { EntryGraphModel, SubGraphItem, GraphJSON }
export { useSubGraphStore, createSubGraphItem, buildPaths }
