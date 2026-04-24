import type { Cell, Graph, Node } from '@antv/x6'
import { StringExt } from '@antv/x6'
import { create } from 'zustand'
import { useGraphStore } from './graphStore'

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
  syncSubGraph: (
    subGraphNode: Node,
    action: 'add' | 'delete' | 'update',
  ) => void
  // 切换视图
  changeGraphView: (subGraphId: string) => void
  // 将框选的节点转为子系统
  mergeToSubsystem: (cells: Cell[]) => void
}

interface subGraphItem {
  id: string
  name: string
  deep: number
  parentId: string | null
  childrenIds: Set<string>
  graphJson: GraphJSON
}

interface EntryGraphModel {
  currentGraphId: string
  rootId: string
  subGraphs: Record<
    string,
    Omit<subGraphItem, 'childrenIds'> & { childrenIds: string[] }
  >
}

// ─── private ────────────────────────────────────────────────────────────────
/**
 * 子系统封装的Block同步函数
 * @arg subGraphNode 子系统节点
 * @arg graphJson 框选的节点边数据
 * @returns subGraphItem
 */
function createSubGraphItem(subGraphNode: Node): subGraphItem
function createSubGraphItem(graphJson: GraphJSON): subGraphItem
function createSubGraphItem(arg: Node | GraphJSON): subGraphItem {
  const { currentGraphId, subGraphs } = useSubsystemStore.getState()
  const graph = useGraphStore.getState().graph
  const deep = subGraphs[currentGraphId].deep + 1

  if ('isNode' in arg && arg.isNode()) {
    // 传入的是 Node
    return {
      id: arg.id,
      name: arg.attr<string>('text/text') || 'Subsystem',
      deep,
      parentId: currentGraphId,
      childrenIds: new Set<string>([]),
      graphJson: { ...arg.getData().graphJson },
    }
  }

  // 传入的是 GraphJSON
  const id = StringExt.uuid()
  return {
    id,
    name: 'New Subsystem',
    deep,
    parentId: currentGraphId,
    childrenIds: new Set<string>([]),
    graphJson: arg,
  }
}
/**
 *
 * @param subGraphs subGraphs Records
 * @param subGraphId 建立的目标subGraph节点Id
 * @returns path: rootId -> subGraphId
 */
function buildPaths(
  subGraphs: Record<string, subGraphItem>,
  subGraphId: string,
) {
  const pathIds = [subGraphId]
  let parentId = subGraphs[subGraphId].parentId
  while (parentId) {
    pathIds.unshift(parentId)
    parentId = subGraphs[parentId].parentId
  }
  return pathIds
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
      childrenIds: new Set<string>([]),
      graphJson: { cells: [] },
    },
  },

  exportEntryGraphModel: () => {
    const { currentGraphId, rootId, subGraphs } = get()
    // set 序列化
    const serializableSubGraphs = Object.fromEntries(
      Object.entries(subGraphs).map(([id, item]) => [
        id,
        {
          ...item,
          childrenIds: Array.from(item.childrenIds),
        },
      ]),
    )

    return {
      currentGraphId,
      rootId,
      subGraphs: serializableSubGraphs,
    }
  },
  loadEntryGraphModel: (model) => {
    // set 序列化
    const serializableSubGraphs = Object.fromEntries(
      Object.entries(model.subGraphs).map(([id, item]) => [
        id,
        {
          ...item,
          childrenIds: new Set(item.childrenIds),
        },
      ]),
    )

    set({
      currentGraphId: model.currentGraphId,
      currentPathIds: buildPaths(serializableSubGraphs, model.currentGraphId),
      rootId: model.rootId,
      subGraphs: serializableSubGraphs,
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
  syncSubGraph: (subGraphNode, action: 'add' | 'delete' | 'update') => {
    const { currentGraphId, subGraphs } = get()

    if (action === 'add') {
      // subGraph 加入当前Layer
      const currentSubGraphItem = subGraphs[currentGraphId]
      set({
        subGraphs: {
          ...subGraphs,
          [currentGraphId]: {
            ...currentSubGraphItem,
            childrenIds: new Set([
              ...Array.from(currentSubGraphItem.childrenIds),
              subGraphNode.id,
            ]),
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
            childrenIds: new Set(
              [...subGraphs[parentId].childrenIds].filter(
                (id) => id !== subGraphNode.id,
              ),
            ),
          },
        },
      })
    }
    // TODO: 子系统更新
    // else if (action === 'update') {
    //   const targetItem = subGraphs[subGraphNode.id]
    //   set({
    //     subGraphs: {
    //       ...subGraphs,
    //       [subGraphNode.id]: {
    //         ...targetItem,
    //         ...createSubGraphItem(subGraphNode),
    //       },
    //     },
    //   })
    // }
  },
  changeGraphView: (subGraphId) => {
    const { subGraphs, syncGraph } = get()
    const graph = useGraphStore.getState().graph
    if (!graph) return

    syncGraph(graph.toJSON())
    graph.clearCells({ ignoreSync: true })
    graph.fromJSON(subGraphs[subGraphId].graphJson)
    graph.centerContent()
    set({
      currentGraphId: subGraphId,
      currentPathIds: buildPaths(subGraphs, subGraphId),
    })
  },
  mergeToSubsystem: (cells) => {
    const { currentGraphId, subGraphs } = get()
    const graph = useGraphStore.getState().graph
    if (!graph || cells.length === 0) return

    // 1. 获取包围盒位置，作为新子系统节点的位置
    const bbox = graph.getCellsBBox(cells)
    const x = bbox ? bbox.x : 40
    const y = bbox ? bbox.y : 40

    // 2. 将选中的 cell 转为 graphJson
    const graphJson: GraphJSON = {
      cells: cells.map((cell) => cell.toJSON()),
    }

    // 3. 构建 subGraphItem 内部数据对象
    const subGraphItem = createSubGraphItem(graphJson)

    // 4. 清理画布选中项
    graph.cleanSelection()

    // 5. 移除画布中现有的框选图元
    graph.removeCells(cells)

    // 6. 添加代表此子系统的统一新节点，其中 data 初始化时带上我们刚生成的 id 和 graphJson
    // 此处 addNode 将触发 useGraphListener 的 add 同步分支，此时它会自动从 target 的 data 中恢复出子图信息
    graph.addNode({
      id: subGraphItem.id,
      shape: 'rect', // 或您的图元定义, 这里同 stencil-service 里的
      x,
      y,
      width: 80,
      height: 40,
      label: 'New Subsystem',
      data: {
        type: 'SubsystemBlock',
        graphJson,
      },
    })
  },
}))

export type { EntryGraphModel, subGraphItem, GraphJSON }
export { useSubsystemStore }
