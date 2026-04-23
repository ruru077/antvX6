import type { Graph } from '@antv/x6'
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
  // 进入子系统
  enterSubsystem?: (id: string) => void
  // 同步当前Layer Graph数据
  syncGraph: (graphJson: GraphJSON) => void
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
    // TODO : 子系统兼容
    // 1️⃣ 用户拖动 stencil 中的 Block 节点

    // 2️⃣ X6 自动生成新的 graph node（id: 'node-xxx-123'）
    //    node.data = { kind: 'block', name: 'Calculator', blockId: 'calc-module' }

    // 3️⃣ graph 触发 'cell:add' 事件

    // 4️⃣ useGraphListener 中的 handleNodeAdded 被执行

    // 5️⃣ graph.on('cell:change:*') 触发

    // 6️⃣ syncGraph(graph.toJSON()) 被调用

    // 7️⃣ store 检测到 graphJson.cells 中有新的 kind='block' 节点

    // 8️⃣ store 创建对应的 subGraphItem:
    //    {
    //      id: 'node-xxx-123',
    //      name: 'Calculator',
    //      deep: 1,
    //      parentId: 'root',
    //      childrenIds: [],
    //      graphJson: { cells: [初始模板单元] }
    //    }

    // 9️⃣ root 的 childrenIds 加上 'node-xxx-123'

    // 🔟 用户双击画布中的 Calculator 节点

    // 1️⃣1️⃣ useGraphListener 中的 node:dblclick 触发
    //    检测 data.kind === 'subsystem' 失败
    //    → 改为检测 data.kind === 'block'
    //    → 调用 enterSubsystem('node-xxx-123', 'Calculator')

    // 1️⃣2️⃣ currentGraphId 切换到 'node-xxx-123'

    // 1️⃣3️⃣ 用户看到 Calculator Block 的内部图
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
}))

export type { EntryGraphModel, subGraphItem, GraphJSON }
export { useSubsystemStore }
