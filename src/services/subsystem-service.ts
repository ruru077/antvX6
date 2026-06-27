import { Model, StringExt } from '@antv/x6'
import { formalLink, MASK_SELECTOR, signalPortGroups } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { snapshotToDataURL } from '@/services/snapshot-service'
import {
  buildPaths,
  createSubGraphItem,
  useSubGraphStore,
} from '@/store/subGraphStore'
import { _patchScrollerForceUpdate } from '@/utils/plugin/X6patch'
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

const commonService = createCommonService()

type PortSide = 'in' | 'out'
// label: {
//   markup: {
//     tagName: 'text',
//     selector: 'text',
//     textContent: 'In1',
//   },
// }
function getPortLabel(port: PortMetadata | undefined): string {
  const markup = port?.label?.markup as MarkupJSONMarkup
  return markup?.textContent ?? (port?.attrs?.label?.text as string)
}

/**
 * 按 portId 获取端口 label。
 * Port item 自身可能没有 label（stencil 初始端口只有 id + group），
 * 需回退到 group 定义中的 attrs.text.text。
 */
function getPortLabelById(node: NodeProperties, portId: string): string {
  const ports = node.ports
  const items: PortMetadata[] = Array.isArray(ports)
    ? ports
    : (ports?.items ?? [])
  const port = items.find((p) => p.id === portId)
  if (!port) return ''

  // 1. Port item: label.markup.textContent 或 attrs.label.text
  const direct = getPortLabel(port)
  if (direct) return direct

  // 2. Group 定义: attrs.text.text（stencil 初始端口）
  const groups = !Array.isArray(ports) ? ports?.groups : undefined
  const groupDef = groups?.[port.group ?? '']
  const groupText = (groupDef?.attrs as any)?.text?.text as string
  if (groupText) return groupText

  return ''
}
// attrs: {
//   label: {
//     text: 'In',
//   },
// },
function getIONodeLabel(node: NodeProperties): string {
  return (node.attrs?.label?.text as string) ?? ''
}
/**
 * @description 判断端口是否在指定侧
 * @param port PortMetadata
 * @param side PortSide
 * @returns true 表示端口在指定侧，false 表示端口在非指定侧
 */
function isPortSide(port: PortMetadata, side: PortSide): boolean {
  const group = port.group?.toLowerCase() ?? ''
  return side === 'in' ? group.includes('in') : group.includes('out')
}
/**
 * @description 获取模块指定侧的端口
 * @param node NodeProperties
 * @param side PortSide
 * @returns PortMetadata[] 指定侧的端口列表
 */
function getPorts(node: NodeProperties, side: PortSide): PortMetadata[] {
  const ports = node.ports
  const items = Array.isArray(ports) ? ports : (ports?.items ?? [])
  return items.filter((port) => isPortSide(port, side))
}

/**
 * @description 根据端口标签查找端口
 * @param node NodeProperties
 * @param label string
 * @param side PortSide
 * @returns PortMetadata
 */
function findPortByLabel(
  node: NodeProperties,
  label: string,
  side: PortSide,
): PortMetadata | undefined {
  return getPorts(node, side).find(
    (port) => getPortLabelById(node, port.id ?? '') === label,
  )
}

/**
 * @description 创建子系统端口
 * @param side PortSide
 * @param label string
 * @returns PortMetadata
 */
function createSubsystemPort(side: PortSide, _label: string): PortMetadata {
  return {
    id: StringExt.uuid(),
    group: side,
    attrs: { label: { text: _label } },
  }
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
function createIONodeJson(
  graph: Graph,
  extraJson: GraphJSON['cells'],
  dir: 'in' | 'out',
  nodeId: string,
  portId: string,
) {
  const node = graph.getCellById(nodeId) as Node
  const pos = node.getPosition()
  const ioNodeId = StringExt.uuid()
  const isIn = dir === 'in'
  const portLabel = getPortLabel(node.getPort(portId))
  const offsetX = isIn ? pos.x - 200 : pos.x + node.getSize().width + 200
  extraJson.push({
    id: ioNodeId,
    shape: 'circle',
    position: { x: offsetX, y: pos.y },
    size: { width: 50, height: 40 },
    attrs: {
      label: { text: portLabel },
      body: { fill: '#fff', stroke: '#8f8f8f', strokeWidth: 1 },
    },
    data: { blockType: isIn ? 'In' : 'Out' },
    ports: {
      groups: signalPortGroups,
      items: [{ id: isIn ? 'out1' : 'in1', group: isIn ? 'out' : 'in' }],
    },
  })
  extraJson.push({
    id: StringExt.uuid(),
    shape: 'edge',
    source: isIn
      ? { cell: ioNodeId, port: 'out1' }
      : { cell: nodeId, port: portId },
    target: isIn
      ? { cell: nodeId, port: portId }
      : { cell: ioNodeId, port: 'in1' },
    ...formalLink,
  })
}

function mergeToSubsystem(cells: Cell[], graph: Graph) {
  const { currentGraphId, subGraphs } = useSubGraphStore.getState()

  // 1. 获取包围盒位置，作为新子系统节点的位置
  const bbox = graph.getCellsBBox(cells)
  const { x, y, width, height } = bbox

  const nodes = cells.filter((c) => c.isNode())
  const nodeIds = nodes.map((c) => c.id)
  const edgeSet: Edge[] = []
  nodes.forEach((node) => {
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

  // 加入 extraJson
  const extraJson: GraphJSON['cells'] = []

  for (const { nodeId, portId } of unconnectedInPorts.values()) {
    createIONodeJson(graph, extraJson, 'in', nodeId, portId)
  }
  for (const { nodeId, portId } of unconnectedOutPorts.values()) {
    createIONodeJson(graph, extraJson, 'out', nodeId, portId)
  }

  const allCells = [...nodes, ...edgeSet]
  // 清除 outline
  graph.cleanSelection()
  const graphJson = Model.toJSON(allCells)
  graphJson.cells.push(...extraJson)

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
        text: 'Subsystem',
        data: {
          blockType: 'Subsystem',
          graphJson,
        },
      },
      { ignore: true },
    )
    syncSubsystemPorts(subGraphItem.id, graph, nextSubGraphs)
  })

  // 8. 离屏渲染快照，回填缩略图
  snapshotToDataURL(graphJson)
    .then((dataUrl) => {
      const node = graph.getCellById(subGraphItem.id) as Node
      node?.setAttrs({ thumb: { xlinkHref: dataUrl } })
    })
    .catch((e) => console.warn('[snapshot] 子系统缩略图生成失败', e))
}
// ─── 结构查询 ──────────────────────────────────────────────────────────

/** 获取子系统内部所有 cells */
function getInnerCells(
  subsystemId: string,
  subGraphs: SubGraphMap,
): CellProperties[] {
  return subGraphs[subsystemId]?.graphJson.cells ?? []
}

/** 获取内部 IO 节点（InPort/OutPort），可按 side 过滤 */
function getIONodes(
  cells: CellProperties[],
  side?: 'in' | 'out',
): NodeProperties[] {
  const nodes = cells.filter((c) => c.shape !== 'edge' && isIONode(c))
  if (!side) return nodes
  const isTarget =
    side === 'in'
      ? (n: NodeProperties) => n.data?.blockType === 'In'
      : (n: NodeProperties) => n.data?.blockType === 'Out'
  return nodes.filter(isTarget)
}

/** 获取子系统内部的实际 block */
function getInnerBlocks(cells: CellProperties[]): NodeProperties[] {
  return cells.filter((c) => c.shape !== 'edge' && !isIONode(c))
}

// ─── 识别 ──────────────────────────────────────────────────────────────

function isSubsystemBlock(node: NodeProperties): boolean {
  return node.data?.blockType === 'Subsystem'
}

/**
 * 剔除图中未连接任何边的空连接节点
 * 空连接节点不影响信号流，可安全移除
 */
function removeDisconnectedBlocks(cells: CellProperties[]): CellProperties[] {
  const edges = cells.filter((c) => c.shape === 'edge')
  const connectedCellIds = new Set<string>()

  edges.forEach((edge) => {
    if (edge.source?.cell) connectedCellIds.add(edge.source.cell)
    if (edge.target?.cell) connectedCellIds.add(edge.target.cell)
  })

  return cells.filter((cell) => {
    if (cell.shape === 'edge') return true
    return connectedCellIds.has(cell.id ?? '')
  })
}

/**
 * 保留子系统内真实信号通路上的 cells。
 * 有效通路必须从 InPort 可达，并且能继续到达 OutPort；孤岛连线不导出。
 */
function keepSignalPathCells(cells: CellProperties[]): CellProperties[] {
  const edges = cells.filter((c) => c.shape === 'edge')
  const inNodeIds = new Set(
    getIONodes(cells, 'in').map((node) => node.id ?? ''),
  )
  const outNodeIds = new Set(
    getIONodes(cells, 'out').map((node) => node.id ?? ''),
  )

  if (inNodeIds.size === 0 || outNodeIds.size === 0) return cells

  const forward = new Set(inNodeIds)
  let changed = true
  while (changed) {
    changed = false
    edges.forEach((edge) => {
      const sourceId = edge.source?.cell
      const targetId = edge.target?.cell
      if (!sourceId || !targetId) return
      if (!forward.has(sourceId) || forward.has(targetId)) return
      forward.add(targetId)
      changed = true
    })
  }

  const backward = new Set(outNodeIds)
  changed = true
  while (changed) {
    changed = false
    edges.forEach((edge) => {
      const sourceId = edge.source?.cell
      const targetId = edge.target?.cell
      if (!sourceId || !targetId) return
      if (!backward.has(targetId) || backward.has(sourceId)) return
      backward.add(sourceId)
      changed = true
    })
  }

  const signalCellIds = new Set<string>()
  const signalEdgeIds = new Set<string>()
  edges.forEach((edge) => {
    const sourceId = edge.source?.cell
    const targetId = edge.target?.cell
    if (!sourceId || !targetId) return
    if (!forward.has(sourceId) || !backward.has(targetId)) return
    signalEdgeIds.add(edge.id ?? '')
    signalCellIds.add(sourceId)
    signalCellIds.add(targetId)
  })

  console.log('[keepSignalPathCells]', {
    inNodeIds: Array.from(inNodeIds),
    outNodeIds: Array.from(outNodeIds),
    forward: Array.from(forward),
    backward: Array.from(backward),
    signalCellIds: Array.from(signalCellIds),
    signalEdgeIds: Array.from(signalEdgeIds),
  })

  return cells.filter((cell) =>
    cell.shape === 'edge'
      ? signalEdgeIds.has(cell.id ?? '')
      : signalCellIds.has(cell.id ?? ''),
  )
}

/**
 * 判断子系统是否为直通（passthrough）
 * 条件：
 *   1. 内部允许有普通 block，但必须是未连接的空 block（会被自动剔除）
 *   2. In 节点数量等于 Out 节点数量
 *   3. 每条边必须是：In(label) -> Out(label) 且 label 完全相同
 *   4. 所有 In 节点都必须有对应的 Out 节点配对
 */
function isPassthroughSubsystem(
  subsystemId: string,
  subGraphs: SubGraphMap,
): boolean {
  const rawCells = getInnerCells(subsystemId, subGraphs)
  const cells = removeDisconnectedBlocks(rawCells)
  const inNodeMap = new Map(
    getIONodes(cells, 'in').map((n) => [n.id, getIONodeLabel(n)]),
  )
  const outNodeMap = new Map(
    getIONodes(cells, 'out').map((n) => [n.id, getIONodeLabel(n)]),
  )
  if (inNodeMap.size === 0 || inNodeMap.size !== outNodeMap.size) return false

  const edges = cells.filter((c) => c.shape === 'edge')

  // 提取 label 中的序号（如 "In1" -> "1", "Out2" -> "2"）
  function extractLabelNumber(label: string): string {
    const match = label.match(/(\d+)$/)
    return match ? match[1] : label
  }

  // 每条边必须是 In -> Out 且序号相同（如 In1 -> Out1）
  const validPairs = new Set<string>()
  for (const edge of edges) {
    const srcLabel = inNodeMap.get(edge.source?.cell ?? '')
    const tgtLabel = outNodeMap.get(edge.target?.cell ?? '')
    if (
      srcLabel &&
      tgtLabel &&
      extractLabelNumber(srcLabel) === extractLabelNumber(tgtLabel)
    ) {
      validPairs.add(srcLabel)
    }
  }

  // 所有 In 节点都必须有对应的 Out 节点配对
  const allInLabels = new Set(inNodeMap.values())
  return validPairs.size === allInLabels.size
}

function isIONode(node: NodeProperties): boolean {
  return node.data?.blockType === 'In' || node.data?.blockType === 'Out'
}

/** 判断子系统节点是否已添加封装（markup 中存在 MASK_SELECTOR） */
function hasSubsystemMask(node: Node): boolean {
  const raw = node.getMarkup()
  if (typeof raw === 'string') return false
  const markup = Array.isArray(raw) ? raw : [raw]
  return markup.some((m) => m.selector === MASK_SELECTOR)
}

// ─── 端口映射 ────────────────────────────────────────────────────────────

/**
 * 外层端口 → 内部 IO 节点
 * 外层端口 label 与内部 IO 节点 label 保持同步，因此按 label 映射。
 */
function portToIONode(
  subsystem: NodeProperties,
  portId: string,
  side: PortSide,
  subGraphs: SubGraphMap,
): NodeProperties | null {
  const label = getPortLabelById(subsystem, portId)
  const cells = getInnerCells(subsystem.id ?? '', subGraphs)
  const ioNodes = getIONodes(cells, side)
  const ioNode = ioNodes.find((node) => getIONodeLabel(node) === label) ?? null

  console.log('[portToIONode]', {
    subsystemId: subsystem.id,
    portId,
    side,
    label,
    ioNodes: ioNodes.map((node) => ({
      id: node.id,
      label: getIONodeLabel(node),
      blockType: node.data?.blockType,
    })),
    result: ioNode?.id ?? null,
  })

  return ioNode
}

/**
 * 内部 IO 节点 → 外层端口 ID
 * 内部 IO 节点 label 与外层端口 label 唯一同步，因此按 label 映射回外层端口。
 */
function ioNodeToPort(
  ioNodeId: string,
  subsystem: NodeProperties,
  cells: CellProperties[],
): PortMetadata | undefined {
  const ioNode = cells.find((c) => c.id === ioNodeId) as NodeProperties
  const isInPort = ioNode.data?.blockType === 'In'
  const side: PortSide = isInPort ? 'in' : 'out'
  const port = findPortByLabel(subsystem, getIONodeLabel(ioNode), side)
  return port
}

// ─── 信号追踪 ────────────────────────────────────────────────────────────

type ResolvedEndpoint = {
  blockId: string
  portId: string
  blockName: string
  portNo: string
}

type SignalHop = { blockId: string; portId: string }

/**
 * 从指定 cell 出发，沿信号方向找到下一个端点。
 * - dir='target'：信号流出——找 source 端为本 cell 的边，返回其 target
 * - dir='source'：信号流入——找 target 端为本 cell 的边，返回其 source
 * @param fromCellId 起始 cell ID
 * @param dir 追踪方向
 * @param cells 当前层的 cells
 */
function traceSignalFlow(
  fromCellId: string,
  dir: 'source' | 'target',
  cells: CellProperties[],
): SignalHop | null {
  const edges = cells.filter((c) => c.shape === 'edge')
  const edge = edges.find((e) =>
    dir === 'target'
      ? e.source?.cell === fromCellId
      : e.target?.cell === fromCellId,
  )
  const end = dir === 'target' ? edge?.target : edge?.source

  console.log('[traceSignalFlow]', {
    fromCellId,
    dir,
    edge: edge
      ? {
          id: edge.id,
          source: edge.source,
          target: edge.target,
        }
      : null,
    end,
  })

  const blockId = end?.cell ?? ''
  const portId = end?.port ?? ''
  return blockId ? { blockId, portId } : null
}

/**
 * 递归解析端点：穿透子系统/IO 节点，找到真正的 block
 * 重构为 portToIONode + traceSignalFlow 的组合
 */
function resolveEndpoint(
  cellId: string,
  portId: string,
  dir: 'source' | 'target',
  graphId: string,
  subGraphs: SubGraphMap,
  depth = 0,
): ResolvedEndpoint | null {
  if (depth > 32) {
    console.warn('[resolveEndpoint] 递归深度超限')
    return null
  }

  const cells = getInnerCells(graphId, subGraphs)
  const cell = cells.find((c) => c.id === cellId)

  console.log('[resolveEndpoint:start]', {
    cellId,
    portId,
    dir,
    graphId,
    depth,
    cellShape: cell?.shape,
    blockType: cell?.data?.blockType,
    isSubsystem: cell ? isSubsystemBlock(cell) : false,
    isIO: cell ? isIONode(cell) : false,
  })

  // ── 前置守卫 ──
  if (!subGraphs[graphId]) return null
  if (!cell) return null

  // IO 节点：穿透到父层继续追踪
  // 内部信号到达 IO 节点说明信号穿过了整个子系统，需映射回外层端口在父层继续追踪
  if (isIONode(cell)) {
    const parentId = subGraphs[graphId]?.parentId
    if (!parentId) return null

    const parentCells = getInnerCells(parentId, subGraphs)
    const subsystemNode = parentCells.find((c) => c.id === graphId) as
      | NodeProperties
      | undefined
    if (!subsystemNode) return null

    // IO 节点 → 子系统外层端口
    const port = ioNodeToPort(cellId, subsystemNode, cells)
    console.log('[resolveEndpoint:io]', {
      cellId,
      dir,
      graphId,
      parentId,
      ioLabel: getIONodeLabel(cell),
      subsystemId: subsystemNode.id,
      mappedPortId: port?.id ?? null,
      mappedPortLabel: port?.id
        ? getPortLabelById(subsystemNode, port.id)
        : undefined,
    })

    // 在父层沿信号方向继续追踪
    const next = traceSignalFlow(graphId, dir, parentCells)
    if (!next) return null

    return resolveEndpoint(
      next.blockId,
      next.portId,
      dir,
      parentId,
      subGraphs,
      depth + 1,
    )
  }

  // 普通 block：非子系统、非 IO，直接返回
  if (!isSubsystemBlock(cell)) {
    return {
      blockId: cellId,
      portId,
      blockName: (cell.attrs?.label?.text as string) ?? cellId,
      portNo: getPortLabelById(cell, portId) || portId,
    }
  }

  // ── 子系统：端口重映射 → 追踪内部信号 ──
  const side = dir === 'target' ? 'in' : 'out'
  const ioNode = portToIONode(cell, portId, side, subGraphs)
  console.log('[resolveEndpoint:subsystem]', {
    cellId,
    portId,
    dir,
    graphId,
    side,
    ioNodeId: ioNode?.id ?? null,
    ioNodeLabel: ioNode ? getIONodeLabel(ioNode) : null,
  })
  if (!ioNode) return null

  const innerCells = getInnerCells(cellId, subGraphs)
  const next = traceSignalFlow(ioNode.id ?? 'error', dir, innerCells)
  console.log('[resolveEndpoint:subsystem-next]', {
    cellId,
    ioNodeId: ioNode.id,
    dir,
    next,
  })
  if (!next) return null

  return resolveEndpoint(
    next.blockId,
    next.portId,
    dir,
    cellId,
    subGraphs,
    depth + 1,
  )
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
 */
function unmergeSubsystem(subsystemId: string, graph: Graph) {
  const { currentGraphId, subGraphs } = useSubGraphStore.getState()
  const subsystemNode = graph.getCellById(subsystemId) as Node | null
  if (!subsystemNode) return

  const innerCells = getInnerCells(subsystemId, subGraphs)
  const innerBlocks = getInnerBlocks(innerCells)
  const outerEdges = graph.getConnectedEdges(subsystemNode)
  const pos = subsystemNode.getPosition()
  const bbox = subsystemNode.getBBox()

  graph.batchUpdate(() => {
    // 1. 将内部 block 加到外层（保持相对位置）
    innerBlocks.forEach((blockProps) => {
      const bx =
        (
          blockProps as NodeProperties & {
            position?: { x: number; y: number }
          }
        ).position?.x ?? 0
      const by =
        (
          blockProps as NodeProperties & {
            position?: { x: number; y: number }
          }
        ).position?.y ?? 0
      graph.addNode({
        ...blockProps,
        position: { x: pos.x + (bx - bbox.x), y: pos.y + (by - bbox.y) },
      })
    })

    // 2. 重连外层边到内部 block
    outerEdges.forEach((edge) => {
      if (edge.getSourceCellId() === subsystemId) {
        const resolved = resolveEndpoint(
          subsystemId,
          edge.getSourcePortId() ?? '',
          'source',
          currentGraphId,
          subGraphs,
        )
        if (resolved)
          edge.setSource({ cell: resolved.blockId, port: resolved.portId })
      }
      if (edge.getTargetCellId() === subsystemId) {
        const resolved = resolveEndpoint(
          subsystemId,
          edge.getTargetPortId() ?? '',
          'target',
          currentGraphId,
          subGraphs,
        )
        if (resolved)
          edge.setTarget({ cell: resolved.blockId, port: resolved.portId })
      }
    })

    // 3. 删除子系统节点
    graph.removeCell(subsystemNode, { ignore: true })
  })

  // 4. 更新 subGraphs
  const nextSubGraphs = { ...subGraphs }
  const parentId = subGraphs[subsystemId].parentId
  delete nextSubGraphs[subsystemId]
  if (parentId) {
    nextSubGraphs[parentId] = {
      ...nextSubGraphs[parentId],
      childrenIds: nextSubGraphs[parentId].childrenIds.filter(
        (id) => id !== subsystemId,
      ),
    }
  }
  useSubGraphStore.setState({ subGraphs: nextSubGraphs })
}

/**
 * 同步子系统外层端口与内部 IO 节点
 * 内部 InPort/OutPort 数量决定外层端口数量，端口 label 与内部 IO label 保持一致。
 */
function syncSubsystemPorts(
  subsystemId: string,
  graph: Graph,
  subGraphs: SubGraphMap,
) {
  const subsystemNode = graph.getCellById(subsystemId) as Node | null
  if (!subsystemNode) return

  const node = subsystemNode
  const cells = getInnerCells(subsystemId, subGraphs)

  function syncSide(side: PortSide) {
    const labels = getIONodes(cells, side).map(getIONodeLabel).filter(Boolean)
    const labelSet = new Set(labels)
    const ports = node.getPorts().filter((port) => isPortSide(port, side))

    ports.forEach((port) => {
      if (labelSet.has(getPortLabel(port))) return
      if (!port.id) return
      node.removePort(port.id)
    })

    const currentLabels = new Set(
      node
        .getPorts()
        .filter((port) => isPortSide(port, side))
        .map(getPortLabel),
    )

    labels.forEach((label) => {
      if (currentLabels.has(label)) return
      node.addPort(createSubsystemPort(side, label))
    })
  }

  subsystemNode.prop('ports/groups', signalPortGroups)
  syncSide('in')
  syncSide('out')
  commonService.resize(subsystemNode)
}

// ─── DTO 导出 ──────────────────────────────────────────────────────────────

function collectBlocks(subGraphs: SubGraphMap, rootId: string) {
  const blocks: any[] = []
  for (const layer of Object.values(subGraphs)) {
    const rawCells = removeDisconnectedBlocks(
      getInnerCells(layer.id, subGraphs),
    )
    const cells = layer.id === rootId ? rawCells : keepSignalPathCells(rawCells)
    for (const node of getInnerBlocks(cells)) {
      if (isSubsystemBlock(node)) continue
      blocks.push({
        blockType: node.data?.type ?? '',
        srcBlock: node.data?.srcBlock ?? '',
        blockName: node.attrs?.label?.text ?? node.attrs?.text?.text ?? node.id,
        paramValues: node.data?.paramValues ?? {},
        blockPath: rootId,
        blockUUID: node.id,
      })
    }
  }
  return blocks
}

function collectLines(subGraphs: SubGraphMap, rootId: string) {
  const lines: any[] = []
  const lineKeys = new Set<string>()
  for (const layer of Object.values(subGraphs)) {
    const rawCells = getInnerCells(layer.id, subGraphs)
    const cells = layer.id === rootId ? rawCells : keepSignalPathCells(rawCells)
    const cellMap = new Map<string, CellProperties>(
      cells.map((c) => [c.id ?? '', c]),
    )
    for (const cell of cells) {
      if (cell.shape !== 'edge') continue
      const edge = cell
      const srcCell = cellMap.get(edge.source?.cell)
      const tgtCell = cellMap.get(edge.target?.cell)
      if (
        (srcCell && srcCell.shape !== 'edge' && isIONode(srcCell)) ||
        (tgtCell && isIONode(tgtCell))
      )
        continue

      const resolvedSrc = resolveEndpoint(
        edge.source?.cell,
        edge.source?.port ?? '',
        'source',
        layer.id,
        subGraphs,
      )
      const resolvedTgt = resolveEndpoint(
        edge.target?.cell,
        edge.target?.port,
        'target',
        layer.id,
        subGraphs,
      )
      console.log('[collectLines:edge]', {
        layerId: layer.id,
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        srcCell: srcCell
          ? {
              id: srcCell.id,
              shape: srcCell.shape,
              blockType: srcCell.data?.blockType,
            }
          : null,
        tgtCell: tgtCell
          ? {
              id: tgtCell.id,
              shape: tgtCell.shape,
              blockType: tgtCell.data?.blockType,
            }
          : null,
        resolvedSrc,
        resolvedTgt,
      })
      if (!resolvedSrc || !resolvedTgt) continue

      const lineKey = [
        resolvedSrc.blockId,
        resolvedSrc.portId,
        resolvedTgt.blockId,
        resolvedTgt.portId,
      ].join('->')
      if (lineKeys.has(lineKey)) {
        console.log('[collectLines:duplicate]', {
          layerId: layer.id,
          edgeId: edge.id,
          lineKey,
          resolvedSrc,
          resolvedTgt,
        })
        continue
      }
      lineKeys.add(lineKey)

      lines.push({
        fromBlockName: resolvedSrc.blockName,
        fromPortNo: resolvedSrc.portNo,
        toBlockName: resolvedTgt.blockName,
        toPortNo: resolvedTgt.portNo,
        linePath: rootId,
        fromBlockUUID: resolvedSrc.blockId,
        toBlockUUID: resolvedTgt.blockId,
      })
    }
  }
  return lines
}

function buildGraphModelDTO(): GraphModelDTO {
  const { rootId, subGraphs } = useSubGraphStore.getState()
  const rootGraph = subGraphs[rootId]
  const blocks = collectBlocks(subGraphs, rootId)
  const lines = collectLines(subGraphs, rootId)

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
  unmergeSubsystem,
  hasSubsystemMask,
  removeMask,
  syncSubsystemPorts,
  buildGraphModelDTO,
  getInnerCells,
  getIONodes,
  getInnerBlocks,
  isPassthroughSubsystem,
  portToIONode,
  ioNodeToPort,
  traceSignalFlow,
  resolveEndpoint,
}
