import type { Graph, Node } from '@antv/x6'
import { create } from 'zustand'

type GraphJSON = ReturnType<Graph['toJSON']>
const ROOT_ID = 'root'
/**
 * @description 子系统全局数据 Store
 */
interface SubsystemStore {
  // 当前所在的Graph ID
  currentGraphId: string
  // 从根Graph到当前Graph的路径ID列表
  currentPathIds: string[]
  // Entry Graph ID
  rootId: string
  // 所有subGraph的信息
  subGraphs: Record<string, subGraphItem>
  // 导出EntryGraphModel
  exportEntryGraphModel: () => EntryGraphModel
  // 加载EntryGraphModel
  loadEntryGraphModel: (model: EntryGraphModel) => void
  // 同步当前Layer Graph数据
  syncGraph: (graphJson: GraphJSON) => void
  // 同步新增SubGraph数据
  syncSubGraph: (subGraphNode: Node) => void
}

interface subGraphItem {
  id: string
  name: string
  deep: number
  parentId: string | null
  childrenIds: string[]
  graphJson: GraphJSON
}

interface EntryGraphModel {
  currentGraphId: string
  rootId: string
  subGraphs: Record<string, subGraphItem>
}

// ─── private ────────────────────────────────────────────────────────────────
function createSubGraphItem(subGraphNode: Node): subGraphItem {
  const { currentGraphId, subGraphs } = useSubsystemStore.getState()
  const deep = subGraphs[currentGraphId].deep + 1
  return {
    id: subGraphNode.id,
    name: subGraphNode.attr<string>('text/text'),
    deep,
    parentId: currentGraphId,
    childrenIds: [],
    graphJson: { ...subGraphNode.getData().graphJson },
  }
}
// ─── store ───────────────────────────────────────────────────────────────────
const useSubsystemStore = create<SubsystemStore>((set, get) => ({
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
    return {
      currentGraphId,
      rootId,
      subGraphs,
    }
  },
  loadEntryGraphModel: (model) => {
    set({
      currentGraphId: model.currentGraphId,
      rootId: model.rootId,
      subGraphs: model.subGraphs,
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
  syncSubGraph: (subGraphNode) => {
    const { subGraphs } = get()
    set({
      subGraphs: {
        ...subGraphs,
        [subGraphNode.id]: createSubGraphItem(subGraphNode),
      },
    })
    console.log({
      subGraphs: {
        ...subGraphs,
        [subGraphNode.id]: createSubGraphItem(subGraphNode),
      },
    })
  },
}))

export type { EntryGraphModel, subGraphItem, GraphJSON }
export { useSubsystemStore }
