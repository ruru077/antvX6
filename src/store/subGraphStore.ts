import type { Cell, Graph, History, Node } from '@antv/x6'
import { Model, StringExt } from '@antv/x6'
import type { HistoryCommands } from '@antv/x6/lib/plugin/history/type'
import { create } from 'zustand'
import { useGraphStore } from './graphStore'

type GraphJSON = ReturnType<Graph['toJSON']>
const ROOT_ID = 'root'
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
interface CreateSubGraphItemOptions {
  /** 指定 id，仅 GraphJSON 重载生效；Node 重载始终使用 node.id */
  id?: string
  /** 覆盖默认名称 */
  name?: string
  /** 初始子系统 id 集合，默认空集 */
  childrenIds?: Set<string>
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
): subGraphItem
function createSubGraphItem(
  graphJson: GraphJSON,
  options?: CreateSubGraphItemOptions,
): subGraphItem
function createSubGraphItem(
  arg: Node | GraphJSON,
  options: CreateSubGraphItemOptions = {},
): subGraphItem {
  const { currentGraphId, subGraphs } = useSubGraphStore.getState()
  const deep = subGraphs[currentGraphId].deep + 1
  // 默认值
  const {
    id = StringExt.uuid(),
    name = 'New Subsystem',
    childrenIds = new Set<string>(),
  } = options
  // Node
  if ('isNode' in arg && arg.isNode()) {
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
// ─── 各图层独立 Undo/Redo 历史栈───
const layerHistoryStacks = new Map<
  string,
  { undoStack: HistoryCommands[]; redoStack: HistoryCommands[] }
>()

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

    // 清除所有图层的历史栈快照（旧 Cell 引用已失效）
    layerHistoryStacks.clear()
    const graph = useGraphStore.getState().graph
    graph?.cleanHistory()

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
  },
  changeGraphView: (subGraphId) => {
    const { currentGraphId, subGraphs, syncGraph } = get()
    const graph = useGraphStore.getState().graph
    if (!graph) return

    /**
     * @description History 的 undoStack/redoStack 为protected属性
     * console.log(history)
     */
    const history = graph.getPlugin<History>('history')
    if (history) {
      layerHistoryStacks.set(currentGraphId, {
        undoStack: [...history['undoStack']],
        redoStack: [...history['redoStack']],
      })
    }

    syncGraph(graph.toJSON())

    // 切换期间禁用 history，防止 fromJSON 产生的 cell:added 污染历史栈
    graph.disableHistory()
    graph.fromJSON(subGraphs[subGraphId].graphJson)
    graph.enableHistory()

    // 恢复目标图层的历史栈（首次进入则为空栈）
    if (history) {
      const saved = layerHistoryStacks.get(subGraphId) ?? {
        undoStack: [],
        redoStack: [],
      }
      history['undoStack'] = saved.undoStack
      history['redoStack'] = saved.redoStack
      graph.trigger('history:change', { cmds: null, options: {} })
    }

    graph.centerContent()
    set({
      currentGraphId: subGraphId,
      currentPathIds: buildPaths(subGraphs, subGraphId),
    })
  },
  mergeToSubsystem: (cells) => {
    const { currentGraphId, subGraphs } = get()
    const graph = useGraphStore.getState().graph
    if (!graph) return

    // 1. 获取包围盒位置，作为新子系统节点的位置
    const bbox = graph.getCellsBBox(cells)
    const { x, y, width, height } = bbox

    const graphJson: GraphJSON = Model.toJSON(cells)

    // 2. 找出被合并 cells 中属于子系统的节点
    const mergedSubsystemIds = new Set(
      cells
        .filter(
          (cell) => cell.isNode() && cell.getData()?.type === 'SubsystemBlock',
        )
        .map((cell) => cell.id),
    )

    // 3. 生成新 subGraphItem（childrenIds 初始化为被合并的子系统 id 集合）
    const subGraphItem = createSubGraphItem(graphJson, {
      childrenIds: mergedSubsystemIds,
    })
    // 5. 构建更新后的 subGraphs
    const nextSubGraphs = { ...subGraphs }

    // 5a. 被合并的子系统：deep +1，parentId 指向新节点
    for (const subsystemId of mergedSubsystemIds) {
      const preSubGraphItem = subGraphs[subsystemId]
      nextSubGraphs[subsystemId] = {
        ...preSubGraphItem,
        deep: preSubGraphItem.deep + 1,
        parentId: subGraphItem.id,
      }
    }

    // 5b. 当前层：从 childrenIds 移除被合并的子系统，加入新子系统
    const currentItem = subGraphs[currentGraphId]
    nextSubGraphs[currentGraphId] = {
      ...currentItem,
      childrenIds: new Set([
        ...Array.from(currentItem.childrenIds).filter(
          (id) => !mergedSubsystemIds.has(id),
        ),
        subGraphItem.id,
      ]),
    }

    // 5c. 注册新子系统
    nextSubGraphs[subGraphItem.id] = subGraphItem

    set({ subGraphs: nextSubGraphs })

    // 6. 清理画布选中项，移除框选图元
    graph.cleanSelection()
    graph.removeCells(cells, { ignoreSync: true })

    // 7. 添加代表新子系统的节点
    graph.addNode(
      {
        id: subGraphItem.id,
        shape: 'rect',
        x,
        y,
        width,
        height,
        label: 'New Subsystem',
        data: {
          type: 'SubsystemBlock',
          graphJson,
        },
      },
      { ignoreSync: true },
    )
  },
}))

export type { EntryGraphModel, subGraphItem, GraphJSON }
export { useSubGraphStore }
