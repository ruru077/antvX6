import type { Cell, Edge, Graph, History, Node } from '@antv/x6'
import { Model, StringExt } from '@antv/x6'
import type { HistoryCommands } from '@antv/x6/lib/plugin/history/type'
import { create } from 'zustand'
import type {
  EntryGraphModel,
  GraphJSON,
  GraphModelDTO,
  SubGraphItem,
  SubGraphMap,
} from '~/types'
import { createCommonService } from '@/services/common-service'
import { useGraphStore } from './graphStore'

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
  // GraphModelDTO 导出方法
  // exportGraphModelDTO: () => GraphModelDTO
  // 加载EntryGraphModel
  loadEntryGraphModel: (model: EntryGraphModel) => void
  // 同步当前Layer Graph数据
  syncGraph: (graphJson: GraphJSON) => void
  // 同步新增SubGraph数据
  syncSubGraph: (subGraphNode: Node, action: 'add' | 'delete') => void
  // 切换视图
  changeGraphView: (subGraphId: string) => void
  // 将框选的节点转为子系统
  mergeToSubsystem: (cells: Cell[]) => void
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
// ─── 各图层独立 Undo/Redo 历史栈───
const layerHistoryStacks = new Map<
  string,
  { undoStack: HistoryCommands[]; redoStack: HistoryCommands[] }
>()
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
    return {
      currentGraphId,
      rootId,
      subGraphs,
    }
  },
  loadEntryGraphModel: (model) => {
    // 清除所有图层的历史栈快照（旧 Cell 引用已失效）
    layerHistoryStacks.clear()
    useGraphStore.getState().graph?.cleanHistory()

    set({
      currentGraphId: model.currentGraphId,
      currentPathIds: buildPaths(model.subGraphs, model.currentGraphId),
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
  changeGraphView: (subGraphId) => {
    const { currentGraphId, subGraphs, syncGraph } = get()
    const graph = useGraphStore.getState().graph

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

    // 切换期间禁用 history，过滤 fromJSON 进入历史栈
    graph.disableHistory()
    graph.fromJSON(subGraphs[subGraphId].graphJson)
    graph.enableHistory()

    // 恢复目标图层的历史栈
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

    // 1. 获取包围盒位置，作为新子系统节点的位置
    const bbox = graph.getCellsBBox(cells)
    const { x, y, width, height } = bbox

    // fix: 框选不带edge
    const nodes = cells.filter((c) => c.isNode())
    const nodeIds = nodes.map((c) => c.id)
    const edgeSet: Edge[] = []
    nodes.forEach((node) => {
      // TODO: 注释节点等非Node类型的Cell也可能带edge
      const edges = graph.getIncomingEdges(node) ?? []
      edges.forEach((edge) => {
        // 双连接 内部Edge
        if (
          nodeIds.includes(edge.getSourceCellId()) &&
          nodeIds.includes(edge.getTargetCellId())
        ) {
          edgeSet.push(edge)
        }
      })
    })

    // 统计未连接 port
    const { unconnectedInPorts, unconnectedOutPorts } =
      commonService.getUnconnectedPorts(nodes, edgeSet)

    // 为未连接 port 生成 InPort/OutPort IO 节点及连线，加入 extraCells
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))
    const portCircleAttrs = {
      r: 4,
      magnet: true,
      stroke: '#31d0c6',
      strokeWidth: 2,
    }
    const nodeInIdx = new Map<string, number>()
    const nodeOutIdx = new Map<string, number>()
    const extraCells = []

    for (const { nodeId, portId } of unconnectedInPorts.values()) {
      const node = nodeMap.get(nodeId)
      if (!node) continue
      const pos = node.getPosition()
      const idx = nodeInIdx.get(nodeId) ?? 0
      nodeInIdx.set(nodeId, idx + 1)
      const ioNodeId = StringExt.uuid()
      const ioPortId = StringExt.uuid()
      extraCells.push({
        id: ioNodeId,
        shape: 'circle',
        position: { x: pos.x - 50, y: pos.y + idx * 50 },
        size: { width: 50, height: 40 },
        attrs: {
          text: { text: 'in' },
          body: { fill: '#fff', stroke: '#8f8f8f', strokeWidth: 1 },
        },
        data: { type: 'InPort' },
        ports: {
          groups: {
            out: { position: 'right', attrs: { circle: portCircleAttrs } },
          },
          items: [{ group: 'out', id: ioPortId }],
        },
      })
      extraCells.push({
        id: StringExt.uuid(),
        shape: 'edge',
        source: { cell: ioNodeId, port: ioPortId },
        target: { cell: nodeId, port: portId },
        attrs: { line: { stroke: '#8f8f8f', strokeWidth: 1 } },
      })
    }

    for (const { nodeId, portId } of unconnectedOutPorts.values()) {
      const node = nodeMap.get(nodeId)
      if (!node) continue
      const pos = node.getPosition()
      const size = node.getSize()
      const idx = nodeOutIdx.get(nodeId) ?? 0
      nodeOutIdx.set(nodeId, idx + 1)
      const ioNodeId = StringExt.uuid()
      const ioPortId = StringExt.uuid()
      extraCells.push({
        id: ioNodeId,
        shape: 'circle',
        position: { x: pos.x + size.width + 50, y: pos.y + idx * 50 },
        size: { width: 50, height: 40 },
        attrs: {
          text: { text: 'out' },
          body: { fill: '#fff', stroke: '#8f8f8f', strokeWidth: 1 },
        },
        data: { type: 'OutPort' },
        ports: {
          groups: {
            in: { position: 'left', attrs: { circle: portCircleAttrs } },
          },
          items: [{ group: 'in', id: ioPortId }],
        },
      })
      extraCells.push({
        id: StringExt.uuid(),
        shape: 'edge',
        source: { cell: nodeId, port: portId },
        target: { cell: ioNodeId, port: ioPortId },
        attrs: { line: { stroke: '#8f8f8f', strokeWidth: 1 } },
      })
    }

    const allCells = [...nodes, ...edgeSet]
    const graphJson = Model.toJSON(allCells)
    graphJson.cells.push(...extraCells)

    // 2. 找出被合并 nodes 中属于子系统的节点
    const mergedSubsystemIds = nodes
      .filter((node) => node.getData()?.type === 'SubsystemBlock')
      .map((node) => node.id)

    // 3. 生成当前 subGraphItem
    const subGraphItem = createSubGraphItem(graphJson, {
      childrenIds: mergedSubsystemIds,
    })

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
      childrenIds: [
        ...currentItem.childrenIds.filter(
          (id) => !mergedSubsystemIds.includes(id),
        ),
        subGraphItem.id,
      ],
    }

    // 5c. 注册新子系统
    nextSubGraphs[subGraphItem.id] = subGraphItem

    set({ subGraphs: nextSubGraphs })

    // 6. 构建子系统节点的 ports（与内部 IO 节点一一对应）
    const subsystemPortCircle = {
      r: 4,
      magnet: true,
      stroke: '#5f95ff',
      strokeWidth: 1,
      fill: '#fff',
    }
    const subsystemPortItems = [
      ...Array.from(unconnectedInPorts.values()).map(() => ({
        group: 'in',
        id: StringExt.uuid(),
      })),
      ...Array.from(unconnectedOutPorts.values()).map(() => ({
        group: 'out',
        id: StringExt.uuid(),
      })),
    ]

    // 7. Batch 更新
    graph.batchUpdate(() => {
      graph.cleanSelection()
      graph.removeCells(allCells, { ignore: true })
      const subsystemNode = graph.addNode(
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
          ports: {
            groups: {
              in: {
                position: 'left',
                attrs: { circle: subsystemPortCircle },
              },
              out: {
                position: 'right',
                attrs: { circle: subsystemPortCircle },
              },
            },
            items: subsystemPortItems,
          },
        },
        { ignore: true },
      )
      commonService.resize(subsystemNode)
    })
  },
  // exportGraphModelDTO: () => {
  //   const { rootId, subGraphs } = get()
  //   const rootGraph = subGraphs[rootId]

  //   // ── 辅助：识别子系统节点 ──────────────────────────────────────
  //   function isSubsystemBlock(cell: any): boolean {
  //     return (
  //       cell.data?.type === 'SubsystemBlock' || cell.data?.kind === 'subsystem'
  //     )
  //   }

  //   // ── 辅助：识别 IO 节点（in/out 端口块） ──────────────────────
  //   function isIONode(cell: any): boolean {
  //     return (
  //       cell.data?.type === 'InPort' ||
  //       cell.data?.type === 'OutPort' ||
  //       cell.attrs?.text?.text === 'in' ||
  //       cell.attrs?.text?.text === 'out'
  //     )
  //   }

  //   // ── 辅助：获取某侧端口在 ports.items 中的顺序索引 ────────────
  //   function getPortIndex(
  //     cell: any,
  //     portId: string,
  //     side: 'in' | 'out',
  //   ): number {
  //     const items: any[] = cell.ports?.items ?? []
  //     const isInGroup = (g: string) =>
  //       side === 'in'
  //         ? g === 'in' || g === 'left'
  //         : g === 'out' || g === 'right'
  //     const sideItems = items.filter((p: any) => isInGroup(p.group ?? ''))
  //     return sideItems.findIndex((p: any) => p.id === portId)
  //   }

  //   // ── 辅助：从 graphJson cells 中取第 n 个 InPort / OutPort 节点 ─
  //   function getNthIONode(
  //     cells: any[],
  //     n: number,
  //     side: 'in' | 'out',
  //   ): any | null {
  //     const isTarget =
  //       side === 'in'
  //         ? (c: any) =>
  //             c.data?.type === 'InPort' || c.attrs?.text?.text === 'in'
  //         : (c: any) =>
  //             c.data?.type === 'OutPort' || c.attrs?.text?.text === 'out'
  //     const ioNodes = cells.filter(
  //       (c: any) => c.shape !== 'edge' && isTarget(c),
  //     )
  //     return ioNodes[n] ?? null
  //   }

  //   // ── 核心递归：将一个端点解析到真实 Block ─────────────────────
  //   // 返回 { blockId, portId } 或 null（无法解析时）
  //   function resolveEndpoint(
  //     cellId: string,
  //     portId: string,
  //     dir: 'source' | 'target',
  //     graphId: string,
  //     depth = 0,
  //   ): { blockId: string; portId: string } | null {
  //     if (depth > 32) {
  //       console.warn('[exportGraphModelDTO] resolveEndpoint 递归深度超限，终止')
  //       return null
  //     }
  //     const layer = subGraphs[graphId]
  //     if (!layer) return null
  //     const cells: any[] = layer.graphJson.cells ?? []
  //     const cellMap = new Map<string, any>(cells.map((c: any) => [c.id, c]))
  //     const cell = cellMap.get(cellId)
  //     if (!cell) return null

  //     // 普通 Block：直接返回
  //     if (!isSubsystemBlock(cell) && !isIONode(cell)) {
  //       return { blockId: cellId, portId }
  //     }

  //     // SubsystemBlock：穿透进入子图层
  //     if (isSubsystemBlock(cell)) {
  //       const innerGraphId = cellId // subGraphs 的 key 即节点 id
  //       const innerLayer = subGraphs[innerGraphId]
  //       if (!innerLayer) return null
  //       const innerCells: any[] = innerLayer.graphJson.cells ?? []

  //       if (dir === 'target') {
  //         // 信号流入子系统：找对应的 InPort 节点（按 'in' 端口排序）
  //         const portIndex = getPortIndex(cell, portId, 'in')
  //         if (portIndex < 0) return null
  //         const ioNode = getNthIONode(innerCells, portIndex, 'in')
  //         if (!ioNode) return null
  //         // 找 InPort 的出边（从 InPort 流向下一个节点）
  //         const outEdge = innerCells.find(
  //           (c: any) => c.shape === 'edge' && c.source?.cell === ioNode.id,
  //         )
  //         if (!outEdge) return null
  //         return resolveEndpoint(
  //           outEdge.target?.cell,
  //           outEdge.target?.port ?? '',
  //           'target',
  //           innerGraphId,
  //           depth + 1,
  //         )
  //       } else {
  //         // 信号流出子系统：找对应的 OutPort 节点（按 'out' 端口排序）
  //         const portIndex = getPortIndex(cell, portId, 'out')
  //         if (portIndex < 0) return null
  //         const ioNode = getNthIONode(innerCells, portIndex, 'out')
  //         if (!ioNode) return null
  //         // 找 OutPort 的入边（从上一个节点流向 OutPort）
  //         const inEdge = innerCells.find(
  //           (c: any) => c.shape === 'edge' && c.target?.cell === ioNode.id,
  //         )
  //         if (!inEdge) return null
  //         return resolveEndpoint(
  //           inEdge.source?.cell,
  //           inEdge.source?.port ?? '',
  //           'source',
  //           innerGraphId,
  //           depth + 1,
  //         )
  //       }
  //     }

  //     return null
  //   }

  //   // ── Phase 1：收集所有真实 blocks（递归所有图层）────────────────
  //   const blocks: any[] = []
  //   for (const layer of Object.values(subGraphs)) {
  //     for (const cell of layer.graphJson.cells ?? []) {
  //       if (cell.shape === 'edge') continue
  //       if (isSubsystemBlock(cell)) continue
  //       if (isIONode(cell)) continue
  //       blocks.push({
  //         blockType: cell.data?.type ?? '',
  //         srcBlock: cell.data?.srcBlock ?? '',
  //         blockName:
  //           cell.attrs?.label?.text ?? cell.attrs?.text?.text ?? cell.id,
  //         paramValues: cell.data?.paramValues ?? {},
  //         blockPath: rootId,
  //         blockUUID: cell.id,
  //       })
  //     }
  //   }

  //   // ── Phase 2：收集解析后的 lines（递归所有图层）────────────────
  //   const lines: any[] = []
  //   for (const layer of Object.values(subGraphs)) {
  //     const cells: any[] = layer.graphJson.cells ?? []
  //     const cellMap = new Map<string, any>(cells.map((c: any) => [c.id, c]))
  //     for (const cell of cells) {
  //       if (cell.shape !== 'edge') continue
  //       const srcCell = cellMap.get(cell.source?.cell)
  //       const tgtCell = cellMap.get(cell.target?.cell)
  //       // 跳过两端含 IO 节点的内部穿透边
  //       if (srcCell && isIONode(srcCell)) continue
  //       if (tgtCell && isIONode(tgtCell)) continue

  //       const resolvedSrc = resolveEndpoint(
  //         cell.source?.cell,
  //         cell.source?.port ?? '',
  //         'source',
  //         layer.id,
  //       )
  //       const resolvedTgt = resolveEndpoint(
  //         cell.target?.cell,
  //         cell.target?.port ?? '',
  //         'target',
  //         layer.id,
  //       )
  //       if (!resolvedSrc || !resolvedTgt) continue

  //       lines.push({
  //         fromBlockName: resolvedSrc.blockId,
  //         fromPortNo: resolvedSrc.portId || '1',
  //         toBlockName: resolvedTgt.blockId,
  //         toPortNo: resolvedTgt.portId || '1',
  //         linePath: rootId,
  //         fromBlockUUID: resolvedSrc.blockId,
  //         toBlockUUID: resolvedTgt.blockId,
  //       })
  //     }
  //   }

  //   // 构建DTO对象 - 需要从其他地方补充userId, modelId等信息
  //   const dto: GraphModelDTO = {
  //     userId: 0, // TODO: 从用户context中获取
  //     testRig: 0, // TODO: 从配置中获取
  //     copyNum: -1,
  //     modelId: 0, // TODO: 从模型配置中获取
  //     modelName: rootGraph.name,
  //     uuid: 0, // TODO: 从模型配置中获取
  //     modelRealName: rootGraph.name,
  //     templateName: 'BlockDiagram',
  //     config: {
  //       Step: 'VariableStep',
  //       FixedStep: 'auto',
  //       Solver: 'VariableStepAuto',
  //       StartTime: '0.0',
  //       StopTime: '20.0',
  //       MaxDataPoints: '1000',
  //       MaxStep: 'auto',
  //       MinStep: 'auto',
  //       InitialStep: 'auto',
  //       RelTol: '1e-3',
  //       AbsTol: 'auto',
  //     },
  //     blocks,
  //     lines,
  //     option: {},
  //     saveInfo: {
  //       uuid: 0,
  //       userId: 0,
  //       modelId: 0,
  //       modelRealName: rootGraph.name,
  //       stepTime: 0.1,
  //       packetSize: 10,
  //       targetPlatform: 1,
  //       publicFlag: 0,
  //       testRig: 0,
  //       copyNum: -1,
  //       description: '',
  //     },
  //   }

  //   return dto
  // },
}))

export type { EntryGraphModel, SubGraphItem, GraphJSON }
export { useSubGraphStore }
