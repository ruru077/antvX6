import { Model, StringExt } from '@antv/x6'
import { message } from 'antd'
import {
  formalLinkAttrs,
  Inport,
  MASK_SELECTOR,
  Outport,
  subsystemPortGroups,
} from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { useGraphStore } from '@/store/graphStore'
import {
  buildPaths,
  createSubGraphItem,
  useSubGraphStore,
} from '@/store/subGraphStore'
import {
  _patchScrollerForceUpdate,
  mergePortMetadata,
} from '@/utils/plugin/X6patch'
import type {
  Cell,
  CellProperties,
  Edge,
  EdgeProperties,
  Graph,
  History,
  Node,
  NodeProperties,
  Scroller,
} from '@antv/x6'
import type { PortMetadata } from '@antv/x6/lib/model/port'
import type { HistoryCommands } from '@antv/x6/lib/plugin/history/type'
import type { MarkupJSONMarkup } from '@antv/x6/lib/view/markup'
import type {
  EntryGraphModel,
  GraphModelDTO,
  GraphJSON,
  SubGraphMap,
} from '~/types'
import type { BlockDTO, LineDTO } from '~/types/dto/graphModel'

const commonService = createCommonService()
const SUBSYSTEM_IO_OFFSET = 140

type PortGroup = 'in' | 'out'
type IOPortSide = 'in' | 'out'
type IOLabels = Record<IOPortSide, string[]>
/**
 * 获取子系统port Label
 * @param port 子系统Port
 * @returns port-label
 */
// label: {
//   markup: {
//     tagName: 'text',
//     selector: 'text',
//     textContent: 'In1',
//   },
// }
function getSubPortLabel(port: PortMetadata): string {
  const markup = port?.label?.markup as MarkupJSONMarkup
  // 不可重名 不可为 ''
  if (!markup?.textContent) {
    throw new Error('Inport/Outport 不合法')
  }
  return markup.textContent
}

/**
 * 获取节点的label
 * @param node 节点
 * @returns node_label
 */
// attrs: {
//   label: {
//     text: 'In',
//   },
// },
function getBlockLabel(node: NodeProperties): string {
  const text = node.attrs?.label?.text
  if (text && typeof text === 'string') return text
  else {
    throw new Error('[getBlockLabel]unexpected')
  }
}
/**
 * @description 获取模块指定group的端口
 * @param node NodeProperties
 * @param group PortGroup
 * @returns PortMetadata[] | undefined 端口列表
 */
function getPortsByGroup(
  node: NodeProperties,
  group?: PortGroup,
): PortMetadata[] | undefined {
  const ports = node.ports
  const items = Array.isArray(ports)
    ? ports
    : ports?.items?.map((item) => mergePortMetadata(item, ports.groups))
  if (!group) return items
  return items?.filter((port) => {
    const _group = port.group?.toLowerCase()
    if (!_group) throw new Error('Port group is missing')
    return group === 'in' ? _group.includes('in') : _group.includes('out')
  })
}
// 获取 IO 节点
function getIONodes(
  cells: CellProperties[],
  side?: IOPortSide,
): NodeProperties[] {
  return cells.filter(
    (cell): cell is NodeProperties =>
      cell.shape !== 'edge' && isIONode(cell, side),
  )
}

function validateIOLabels(cells: CellProperties[]): IOLabels | null {
  const used = new Set<string>()
  const labels: IOLabels = { in: [], out: [] }

  for (const node of getIONodes(cells)) {
    const label = getBlockLabel(node)
    if (!label) {
      message.error('In/Out 节点 label 不能为空')
      return null
    }
    if (used.has(label)) {
      message.error(`In/Out 节点 label 不允许重名：${label}`)
      return null
    }
    used.add(label)
    if (isIONode(node, 'in')) labels.in.push(label)
    if (isIONode(node, 'out')) labels.out.push(label)
  }
  return labels
}

/**
 * @description 根据端口标签查找端口
 * @param node NodeProperties
 * @param label string
 * @param side PortSide
 * @returns PortMetadata
 */
function findIOByLabel(
  label: string,
  subId: string,
  subGraphs: SubGraphMap,
): NodeProperties | undefined {
  const cells = getInnerCells(subId, subGraphs)
  return getIONodes(cells).find((cell) => getBlockLabel(cell) === label)
}

/**
 * @description 创建图层历史栈
 * @param graph Graph
 * @returns void
 */
// ─── 各图层独立 Undo/Redo 历史栈───
const layerHistoryStacks = new Map<
  string,
  { undoStack: HistoryCommands[]; redoStack: HistoryCommands[] }
>()

/**
 * @description 加载入口图模型
 * @param model EntryGraphModel
 * @param graph Graph
 * @returns void
 */
// ─── 加载模型 ─────────────────────────────────────────────────────────────

function loadEntryGraphModel(model: EntryGraphModel, graph: Graph) {
  // 清除所有图层的历史栈快照（旧 Cell 引用已失效）
  layerHistoryStacks.clear()
  graph.cleanHistory()

  useSubGraphStore.setState({
    currentGraphId: model.currentGraphId,
    currentPathIds: buildPaths(model.subGraphs, model.currentGraphId),
    rootId: model.rootId,
    subGraphs: model.subGraphs,
  })
}

// ─── 切换视图 ─────────────────────────────────────────────────────────────
/**
 * @description 切换图层视图
 * @param subGraphId string
 * @param graph Graph
 * @returns void
 */
function changeGraphView(subGraphId: string, graph: Graph) {
  const { currentGraphId, subGraphs, syncGraph } = useSubGraphStore.getState()

  /**
   * @description History 的 undoStack/redoStack 为protected属性
   */
  const history = graph.getPlugin<History>('history')
  if (history) {
    layerHistoryStacks.set(currentGraphId, {
      undoStack: [...history['undoStack']],
      redoStack: [...history['redoStack']],
    })
  }
  graph.cleanSelection()
  const currentGraphJson = graph.toJSON()
  syncGraph(currentGraphJson)

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
    // 通知X6 更新撤销/重做按钮状态
    void graph.trigger('history:change', { cmds: null, options: {} })
  }
  // 强制刷新视图，确保 centerContent 拿到正确的滚动范围。
  const scrollerPlugin = graph.getPlugin<Scroller>('scroller')
  if (scrollerPlugin) _patchScrollerForceUpdate(scrollerPlugin)

  graph.centerContent()
  useSubGraphStore.setState({
    currentGraphId: subGraphId,
    currentPathIds: buildPaths(subGraphs, subGraphId),
  })
}

// ─── 合并为子系统 ─────────────────────────────────────────────────────────
/**
 * @param node 节点
 * @param portId 端口 ID
 * @returns 端口的绝对坐标点 {x, y}
 */
function getPortPoint(node: Node, portId: string) {
  const port = node.getPort(portId)
  if (!port?.group) return { x: 0, y: 0 }
  const layout = node.getPortsPosition(port.group)[portId]
  const pos = node.getPosition()
  return {
    x: pos.x + layout.position.x,
    y: pos.y + layout.position.y,
  }
}
/**
 * @param graph 工作 graph 示例
 * @param dir Inport / outport
 * @param nodeId 节点 ID
 * @param portId 端口 ID
 * @param usedLabels 已使用的标签
 * @returns 对齐的输入/输出节点和连接线
 */
function createIOCells(
  graph: Graph,
  dir: IOPortSide,
  nodeId: string,
  portId: string,
  usedLabels: Set<string>,
): GraphJSON['cells'] {
  const node = graph.getCellById(nodeId) as Node
  const isIn = dir === 'in'
  const ioNode = JSON.parse(
    JSON.stringify(isIn ? Inport : Outport),
  ) as NodeProperties
  const label = commonService.getUniqueLabel(isIn ? 'In' : 'Out', [
    ...usedLabels,
  ])
  usedLabels.add(label)

  // 创建和原端口水平对齐的内部 In/Out 节点
  ioNode.id = StringExt.uuid()
  ioNode.position = {
    x:
      node.getPosition().x +
      (isIn ? -SUBSYSTEM_IO_OFFSET : SUBSYSTEM_IO_OFFSET),
    y: getPortPoint(node, portId)?.y - (ioNode.size?.height ?? 0) / 2,
  }
  ioNode.attrs = {
    ...ioNode.attrs,
    label: {
      ...ioNode.attrs?.label,
      text: label,
    },
  }

  // 用一条内部边把新 IO 节点和原端口接起来
  return [
    ioNode,
    {
      id: StringExt.uuid(),
      shape: 'edge',
      source: isIn
        ? { cell: ioNode.id, port: 'o1' }
        : { cell: nodeId, port: portId },
      target: isIn
        ? { cell: nodeId, port: portId }
        : { cell: ioNode.id, port: 'i1' },
      ...formalLinkAttrs,
    } as EdgeProperties,
  ]
}

/**
 * 选中的元素合并为子系统
 * @param cells 合并的 cells
 * @param graph 图示例
 * @returns SubSystem Node
 */
function mergeToSubsystem(cells: Cell[], graph: Graph) {
  const { currentGraphId, subGraphs } = useSubGraphStore.getState()
  // 1. 获取包围盒位置，作为新子系统节点的位置
  const bbox = graph.getCellsBBox(cells)
  const { x, y, width, height } = bbox

  const nodes = cells.filter((c) => c.isNode())
  const nodeIds = nodes.map((c) => c.id)
  const internalEdges = graph
    .getEdges()
    .filter(
      (edge) =>
        nodeIds.includes(edge.getSourceCellId()) &&
        nodeIds.includes(edge.getTargetCellId()),
    )

  // 统计未连接 port
  const nodesNeedIO = nodes.filter((node) => !isIONode(node))
  const { unconnectedInPorts, unconnectedOutPorts } =
    commonService.getUnconnectedPorts(nodesNeedIO, internalEdges)

  const allCells = [...nodes, ...internalEdges]

  // 清除 outline
  // TODO 手动 Hack 应该统一处理
  graph.cleanSelection()

  const graphJson = Model.toJSON(allCells)
  const usedIOLabels = new Set<string>()
  // 选中的节点中 已有 IO 节点
  nodes.forEach((node) => {
    if (!isIONode(node)) return
    const label = node.attr<string>('label/text')
    if (label) usedIOLabels.add(label)
  })

  for (const { nodeId, portId } of unconnectedInPorts.values()) {
    graphJson.cells.push(
      ...createIOCells(graph, 'in', nodeId, portId, usedIOLabels),
    )
  }
  for (const { nodeId, portId } of unconnectedOutPorts.values()) {
    graphJson.cells.push(
      ...createIOCells(graph, 'out', nodeId, portId, usedIOLabels),
    )
  }

  const ioLabels = validateIOLabels(graphJson.cells)
  if (!ioLabels) return

  // 2. 找出被合并 nodes 中属于子系统的节点
  const mergedSubsystemIds = nodes
    .filter((node) => node.getData()?.blockType === 'Subsystem')
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
  useSubGraphStore.setState({ subGraphs: nextSubGraphs })

  // 7. Batch 更新
  graph.batchUpdate(() => {
    graph.removeCells(allCells, { ignore: true })
    const subsystemNode = graph.addNode(
      {
        id: subGraphItem.id,
        shape: 'subsystem-block',
        x,
        y,
        width,
        height,
        attrs: {
          foreignObject: {
            refWidth: '100%',
            refHeight: null,
            refY: '100%',
          },
          label: {
            text: 'Subsystem',
            style: {
              width: 'fit-content',
              height: 'auto',
              whiteSpace: 'pre',
              marginLeft: '50%',
              transform: 'translateX(-50%)',
            },
          },
        },
        data: {
          title: 'Subsystem',
          srcBlock: 'simulink/Ports & Subsystems/Subsystem',
          blockType: 'Subsystem',
          description: 'Subsystem',
          paramLables: [],
          paramValues: [],
          level: 10,
          graphJson,
        },
      },
      { ignore: true },
    )
    applySubsystemPortsByLabels(subsystemNode, ioLabels)
  })
  useSubGraphStore.getState().syncGraph(graph.toJSON())
}
// ─── 结构查询 ──────────────────────────────────────────────────────────

/** 获取子系统内部所有 cells */
function getInnerCells(
  subsystemId: string,
  subGraphs: SubGraphMap,
): CellProperties[] {
  return subGraphs[subsystemId]?.graphJson.cells ?? []
}

/** 获取全部图层的所有 cells Json*/
function getAllCellsFromSubGraphs(subGraphs: SubGraphMap): CellProperties[] {
  return Object.values(subGraphs).flatMap(
    (subGraph) => subGraph.graphJson.cells,
  )
}

// ─── 识别 ──────────────────────────────────────────────────────────────

function isSubsystemBlock(node: NodeProperties): boolean {
  return node.data?.blockType === 'Subsystem'
}

function isIONode(node: NodeProperties | Node, side?: IOPortSide): boolean {
  const blockType =
    'getData' in node ? node.getData()?.blockType : node.data?.blockType
  if (blockType !== 'In' && blockType !== 'Out') return false
  if (side === 'in') return blockType === 'In'
  if (side === 'out') return blockType === 'Out'
  return true
}

/** 判断子系统节点是否已添加封装（markup 中存在 MASK_SELECTOR） */
function hasSubsystemMask(node: Node): boolean {
  const raw = node.getMarkup()
  if (typeof raw === 'string') return false
  const markup = Array.isArray(raw) ? raw : [raw]
  return markup.some((m) => m.selector === MASK_SELECTOR)
}

/**
 * 在所有子系统图中查找节点定义
 */
function getCellFromSubGraphs(
  nodeId: string,
  subGraphs: SubGraphMap,
): NodeProperties | undefined {
  for (const subGraph of Object.values(subGraphs)) {
    const node = subGraph.graphJson.cells.find(
      (cell) => cell.shape !== 'edge' && cell.id === nodeId,
    )
    if (node) return node as NodeProperties
  }
  return undefined
}
/**
 *
 */
function hasPort(
  nodeId: string,
  dir: 'in' | 'out',
  subGraphs: SubGraphMap,
): boolean {
  const node = getCellFromSubGraphs(nodeId, subGraphs)
  if (!node) {
    throw new Error('搜索不存在的目标节点cell')
  }
  return dir === 'in'
    ? !!getPortsByGroup(node, 'in')?.length
    : !!getPortsByGroup(node, 'out')?.length
}
// ─── 端口映射 ────────────────────────────────────────────────────────────
/**
 * 子系统端口 → 内部 IO 节点
 * @param port 子系统port
 * @returns 子系统port 对应的 IO 节点
 */
function portToIONode(
  port: PortMetadata,
  subsystem: NodeProperties,
  subGraphs: SubGraphMap,
): NodeProperties | undefined {
  if (!subsystem.id) throw new Error('Subsystem id is required')
  const label = getSubPortLabel(port)
  return findIOByLabel(label, subsystem.id, subGraphs)
}

/**
 * 内部 IO 节点 → 子系统端口
 * @param ioNode 内部 IO 节点
 * @returns 内部 IO 节点对应的子系统端口
 */
function ioNodeToPort(
  ioNode: NodeProperties,
  subsystem: NodeProperties,
): PortMetadata | undefined {
  const label = getBlockLabel(ioNode)
  return getPortsByGroup(subsystem)?.find(
    (port) => getSubPortLabel(port) === label,
  )
}

// ─── 信号追踪 ────────────────────────────────────────────────────────────

type TraceRole = 'source' | 'target'

interface FlowChain {
  edges: LineDTO[]
  sourceNodeId: string
  sinkNodeId: string
}

interface DTOResult {
  blocks: BlockDTO[]
  lines: LineDTO[]
}
/**
 * @param lines flatGraph 的平铺图lineDTO[]
 * @returns 模块出度edge 模块入读 有效nodes
 */
function buildDfsData(
  lines: LineDTO[],
  subGraphs: SubGraphMap,
): {
  outBySource: Map<string, LineDTO[]>
  sources: string[]
} {
  const outBySource = new Map<string, LineDTO[]>()
  const nodes = new Set<string>()

  for (const line of lines) {
    const from = line.fromBlockUUID
    const to = line.toBlockUUID
    if (!line.linePath || !from || !to) continue
    nodes.add(from)
    nodes.add(to)

    const outList = outBySource.get(from)
    if (outList) outList.push(line)
    else outBySource.set(from, [line])
  }

  // 只对 source 模块 dfs
  const sources = Array.from(nodes).filter(
    (nodeId) =>
      !hasPort(nodeId, 'in', subGraphs) && hasPort(nodeId, 'out', subGraphs),
  )

  return { outBySource, sources }
}

function isComputedBlock(node: NodeProperties): boolean {
  return !isIONode(node) && !isSubsystemBlock(node)
}

/**
 * 穿透获取跟踪信号得到的第一个工作Block
 * @param port 子系统端口
 * @param cell 子系统
 * @param role 当前正在重映射外层 edge 的 source 端还是 target 端
 * @param visitedEdges 已处理过的 edge id 集合
 * @returns
 */
interface TraceResult {
  block: NodeProperties
  portId: string
}

function traceSignalBlock(
  port: PortMetadata,
  cell: NodeProperties,
  subGraphs: SubGraphMap,
  role: TraceRole,
  visitedEdges: Set<string>,
): TraceResult | null {
  if (!cell.id) return null

  let graphId = cell.id
  let current = isSubsystemBlock(cell)
    ? portToIONode(port, cell, subGraphs)
    : cell
  let currentPortId: string | undefined

  while (current) {
    if (isComputedBlock(current))
      return { block: current, portId: (currentPortId ?? port.id) || '' }
    if (!current.id) return null

    const cells = getInnerCells(graphId, subGraphs)
    const edge = cells.find((cell) => {
      if (cell.shape !== 'edge' || !cell.id || visitedEdges.has(cell.id)) {
        return false
      }
      const endpoint = role === 'target' ? cell.source : cell.target
      if (endpoint?.cell !== current?.id) return false
      return currentPortId ? endpoint.port === currentPortId : true
    })

    if (!edge?.id) {
      const parentId = subGraphs[graphId]?.parentId
      if (!parentId || !isIONode(current)) return null

      const parentCells = getInnerCells(parentId, subGraphs)
      const subsystemNode = parentCells.find(
        (cell): cell is NodeProperties =>
          cell.shape !== 'edge' && cell.id === graphId,
      )
      if (!subsystemNode) return null

      const parentPort = ioNodeToPort(current, subsystemNode)
      if (!parentPort) return null

      graphId = parentId
      current = subsystemNode
      currentPortId = parentPort.id
      continue
    }
    visitedEdges.add(edge.id)

    const nextEndpoint = role === 'target' ? edge.target : edge.source
    const nextNode = cells.find(
      (cell): cell is NodeProperties =>
        cell.shape !== 'edge' && cell.id === nextEndpoint?.cell,
    )
    if (!nextNode) return null

    if (isSubsystemBlock(nextNode)) {
      const nextPort = getPortsByGroup(nextNode)?.find(
        (port) => port.id === nextEndpoint?.port,
      )
      if (!nextNode.id || !nextPort) return null
      graphId = nextNode.id
      current = portToIONode(nextPort, nextNode, subGraphs)
      currentPortId = undefined
    } else if (isIONode(nextNode)) {
      current = nextNode
    } else {
      return { block: nextNode, portId: nextEndpoint?.port ?? '' }
    }
  }

  return null
}
/**
 * @description Edges remap for Graph
 * @return 平铺图的边映射结果集
 */
function flatGraph(
  subGraphs: SubGraphMap,
  rootId: string,
  graph: Graph,
): LineDTO[] {
  const result: LineDTO[] = []
  const visited = new Set<string>()
  const allCells = getAllCellsFromSubGraphs(subGraphs)
  for (const layer of Object.values(subGraphs)) {
    const edgesPro = layer.graphJson.cells.filter((c) => c.shape === 'edge')
    for (const edgePro of edgesPro) {
      // pre-solve
      if (!edgePro.id) throw new Error('Edge id is required')
      if (visited.has(edgePro.id)) continue
      visited.add(edgePro.id)
      // remap
      let { cell: sourceCellId, port: sourcePortId } = edgePro.source
      const { cell: targetCellId, port: targetPortId } = edgePro.target

      // source 有可能为 Edge
      let sourceCell = allCells.find((cell) => cell.id === sourceCellId) as
        | NodeProperties
        | EdgeProperties
      const targetNode = allCells.find(
        (cell) => cell.id === targetCellId,
      ) as NodeProperties
      // Edge 连线处理
      while (sourceCell?.shape === 'edge') {
        sourcePortId = sourceCell.source?.port
        // 所有的 sourceCell 都在 allCells 中，必定能找到
        sourceCell = allCells.find(
          (cell) => cell.id === sourceCell?.source?.cell,
        )!
      }
      const sourcePort = getPortsByGroup(sourceCell)?.find(
        (port) => port.id === sourcePortId,
      )
      const targetPort = getPortsByGroup(targetNode)?.find(
        (port) => port.id === targetPortId,
      )
      if (!sourcePort || !targetPort) throw new Error('存在 src/tgt 绕过port')
      const srcResult = traceSignalBlock(
        sourcePort,
        sourceCell,
        subGraphs,
        'source',
        visited,
      )
      const tgtResult = traceSignalBlock(
        targetPort,
        targetNode,
        subGraphs,
        'target',
        visited,
      )
      if (!srcResult || !tgtResult) continue

      const dto: LineDTO = {
        fromBlockName: getBlockLabel(srcResult.block),
        fromPortNo: srcResult.portId.replace(/\D/g, ''),
        toBlockName: getBlockLabel(tgtResult.block),
        toPortNo: tgtResult.portId.replace(/\D/g, ''),
        linePath: edgePro.id,
        fromBlockUUID: srcResult.block.id ?? '',
        toBlockUUID: tgtResult.block.id ?? '',
      }
      result.push(dto)
    }
  }
  return result
}
/**
 * @description 根据边映射结果，对 source 模块进行 dfs 构建联通子图
 */
function buildFlowChain(lines: LineDTO[], graph: Graph): FlowChain[] {
  const { subGraphs } = useSubGraphStore.getState()
  const { outBySource, sources } = buildDfsData(lines, subGraphs)

  const chains: FlowChain[] = []
  const dfs = (sourceNodeId: string, path: LineDTO[]) => {
    const lastEdge = path[path.length - 1]
    const fromNodeId = lastEdge.toBlockUUID
    const nextEdges = outBySource.get(fromNodeId) ?? []
    const usable = nextEdges.filter(
      (line) => !path.some((p) => p.linePath === line.linePath),
    )

    if (usable.length === 0) {
      const sinkNodeId = lastEdge.toBlockUUID
      // 没有 sink 模块
      if (
        hasPort(sinkNodeId, 'out', subGraphs) ||
        !hasPort(sinkNodeId, 'in', subGraphs)
      )
        return
      chains.push({
        edges: path,
        sourceNodeId,
        sinkNodeId,
      })
      return
    }

    for (const edge of usable) {
      dfs(sourceNodeId, [...path, edge])
    }
  }

  for (const sourceNodeId of sources) {
    const firstEdges = outBySource.get(sourceNodeId) ?? []
    for (const firstEdge of firstEdges) {
      dfs(sourceNodeId, [firstEdge])
    }
  }

  return chains
}

function flowChainToDTO(
  flowChain: FlowChain[],
  subGraphs: SubGraphMap,
): DTOResult {
  const blockSet = new Map<string, BlockDTO>()
  const lineSet = new Map<string, LineDTO>()
  for (const chain of flowChain) {
    for (const edge of chain.edges) {
      if (edge.linePath) lineSet.set(edge.linePath, edge)
      // ts 经过buildFlowChain后，edge.fromBlockUUID/toBlockUUID必定存在
      const block = [
        getCellFromSubGraphs(edge.fromBlockUUID, subGraphs)!,
        getCellFromSubGraphs(edge.toBlockUUID, subGraphs)!,
      ]
      block.forEach((b) => {
        blockSet.set(b.id!, {
          blockType: b.data?.blockType ?? 'error',
          srcBlock: b.data?.srcBlock ?? 'error',
          blockName: getBlockLabel(b),
          paramValues: b.data?.paramValues ?? {},
          blockPath: edge.linePath,
          blockUUID: b.id!,
        })
      })
    }
  }
  return {
    lines: Array.from(lineSet.values()),
    blocks: Array.from(blockSet.values()),
  }
}
// ─── 变更 ────────────────────────────────────────────────────────────────

/** 移除子系统 mask（封装） */
function removeMask(node: Node) {
  const raw = node.getMarkup()
  if (typeof raw === 'string') return
  const markup = Array.isArray(raw) ? raw : [raw]
  if (!markup.some((m) => m.selector === MASK_SELECTOR)) return
  node.setMarkup(markup.filter((m) => m.selector !== MASK_SELECTOR))
  node.attr(`${MASK_SELECTOR}`, null)
  node.attr('maskBg', null)
  node.attr('maskArrow', null)
}

/**
 * 解构子系统：将内部 cells 释放回外层
 * - 将内部 block 搬到外层（保持相对位置）
 * - 重连外层边到内部 block（通过 resolveEndpoint 解析）
 * - 删除子系统节点 + 清理 subGraphs
 * X6 群组
 */
// function unmergeSubsystem(subsystemId: string, graph: Graph) {

// }

/**
 * 同步子系统外层端口与内部 IO 节点
 * 内部 InPort/OutPort 数量决定外层端口数量，端口 label 与内部 IO label 保持一致。
 */
function createPortsByLabels(
  side: IOPortSide,
  labels: string[],
): PortMetadata[] {
  return labels.map((label, index) => {
    return {
      id: `${side === 'in' ? 'i' : 'o'}${index + 1}`,
      group: side === 'in' ? 'inSYS' : 'outSYS',
      label: {
        markup: {
          tagName: 'text',
          selector: 'text',
          textContent: label,
        },
      },
    }
  })
}

//返回一个 ports 已按 IO labels 同步后的 NodeProperties
function withSyncedSubsystemPorts(
  subsystem: NodeProperties,
  labels: IOLabels,
): NodeProperties {
  const inPorts = createPortsByLabels('in', labels.in)
  const outPorts = createPortsByLabels('out', labels.out)

  return {
    ...subsystem,
    ports: {
      groups: subsystemPortGroups,
      items: [...inPorts, ...outPorts],
    },
  }
}

// 子系统端口处理入口
function applySubsystemPortsByLabels(subsystemNode: Node, labels: IOLabels) {
  const subsystem = withSyncedSubsystemPorts(
    subsystemNode.toJSON() as NodeProperties,
    labels,
  )
  subsystemNode.prop('ports', subsystem.ports)
  commonService.resize(subsystemNode)
}

// 子系统内部 IO 节点与外层端口同步
function syncParentSubsystemPorts(graph: Graph): boolean {
  const { currentGraphId, subGraphs, syncGraph } = useSubGraphStore.getState()
  const parentId = subGraphs[currentGraphId]?.parentId
  if (!parentId) return true

  syncGraph(graph.toJSON())
  const latestSubGraphs = useSubGraphStore.getState().subGraphs
  const labels = validateIOLabels(
    getInnerCells(currentGraphId, latestSubGraphs),
  )
  if (!labels) return false

  const parentItem = latestSubGraphs[parentId]
  const nextParentCells = parentItem.graphJson.cells.map((cell) => {
    if (cell.shape === 'edge' || cell.id !== currentGraphId) return cell
    const subsystem = withSyncedSubsystemPorts(cell as NodeProperties, labels)
    return {
      ...subsystem,
      data: {
        ...subsystem.data,
        graphJson: latestSubGraphs[currentGraphId].graphJson,
      },
    }
  })

  useSubGraphStore.setState({
    subGraphs: {
      ...latestSubGraphs,
      [parentId]: {
        ...parentItem,
        graphJson: {
          ...parentItem.graphJson,
          cells: nextParentCells,
        },
      },
    },
  })
  return true
}

// ─── DTO 导出 ──────────────────────────────────────────────────────────────
/**
 * @description 图解构输出（flatGraph -> buildFlowChain -> flowChainToDTO）
 * @param subGraphs 子系统图树
 * @param rootId 根图 id
 * @param graph X6 Graph 实例，用于 remap 边索引回溯
 */
function solve(subGraphs: SubGraphMap, rootId: string, graph: Graph) {
  // 1) 平铺所有边到 remap 结果
  const linesDTO = flatGraph(subGraphs, rootId, graph)
  // 2) 按连通性构造 flow chain
  const flowChain = buildFlowChain(linesDTO, graph)
  // 3) 验证并去噪
  const { lines, blocks } = flowChainToDTO(flowChain, subGraphs)
  return {
    lines,
    blocks,
  }
}

async function buildGraphModelDTO(graph: Graph): Promise<GraphModelDTO> {
  const { rootId, subGraphs } = useSubGraphStore.getState()
  const rootGraph = subGraphs[rootId]
  const { blocks, lines } = solve(subGraphs, rootId, graph)
  await commonService.copyText({ lines, blocks })
  return {
    userId: 0, // TODO: 从用户context中获取
    testRig: 0, // TODO: 从配置中获取
    copyNum: -1, // TODO: 从模型配置中获取
    modelId: 0, // TODO: 从模型配置中获取
    modelName: 'name', // TODO: 从模型配置中获取
    uuid: 0, // TODO: 从模型配置中获取
    modelRealName: rootGraph.name,
    templateName: 'BlockDiagram', // TODO: 从模型配置中获取
    config: {
      Step: 'VariableStep',
      FixedStep: 'auto',
      Solver: 'VariableStepAuto',
      StartTime: '0.0',
      StopTime: '20.0',
      MaxDataPoints: '1000',
      MaxStep: 'auto',
      MinStep: 'auto',
      InitialStep: 'auto',
      RelTol: '1e-3',
      AbsTol: 'auto',
    },
    blocks,
    lines,
    option: {},
    saveInfo: {
      uuid: 0,
      userId: 0,
      modelId: 0,
      modelRealName: rootGraph.name,
      stepTime: 0.1,
      packetSize: 10,
      targetPlatform: 1,
      publicFlag: 0,
      testRig: 0,
      copyNum: -1,
      description: '',
    },
  }
}

export {
  changeGraphView,
  loadEntryGraphModel,
  mergeToSubsystem,
  // unmergeSubsystem,
  hasSubsystemMask,
  removeMask,
  syncParentSubsystemPorts,
  withSyncedSubsystemPorts,
  buildGraphModelDTO,
  getInnerCells,
  portToIONode,
  ioNodeToPort,
  isIONode,
  flatGraph,
  buildFlowChain,
  flowChainToDTO,
}
