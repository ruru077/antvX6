import { StringExt } from '@antv/x6'
import { create } from 'zustand'
import { arrowMarkup, maskArrowAttrs, MASK_SELECTOR } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
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
  syncSubGraph: (subGraphNode: Node, action: 'add' | 'delete') => void
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
}

/**
 * 子系统封装的Block同步函数
 * @arg subGraphNode 子系统节点
 * 框选元素合并子系统
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
  } = options
  // Node
  if ('isNode' in arg && arg.isNode()) {
    console.log('hel')
    return {
      id: arg.id,
      name: arg.attr<string>('text/text') || 'Subsystem',
      deep,
      parentId: currentGraphId,
      childrenIds,
      graphJson: { ...arg.getData().graphJson },
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
const commonService = createCommonService()
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
    return commonService.zipGraphModelJson({
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
  syncSubGraph: (subGraphNode, action: 'add' | 'delete') => {
    const { currentGraphId, subGraphs } = get()

    if (action === 'add') {
      // subGraph 加入当前Layer
      const currentSubGraphItem = subGraphs[currentGraphId]
      set({
        subGraphs: {
          ...subGraphs,
          [currentGraphId]: {
            ...currentSubGraphItem,
            childrenIds: [...currentSubGraphItem.childrenIds, subGraphNode.id],
          },
          [subGraphNode.id]: createSubGraphItem(subGraphNode),
        },
      })
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
    }
  },
  addMaskToSubsystem: (node) => {
    const raw = node.getMarkup()
    // 暂不使用 XML 作为 markup
    if (typeof raw === 'string') return
    const markup = Array.isArray(raw) ? raw : [raw]
    // 已有则跳过
    if (markup.some((m) => m.selector === MASK_SELECTOR)) return

    node.setMarkup([...markup, ...arrowMarkup])
    node.attr(maskArrowAttrs)
  },
}))

export type { EntryGraphModel, SubGraphItem, GraphJSON }
export { useSubGraphStore, createSubGraphItem, buildPaths }
