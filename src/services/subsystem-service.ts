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
import type { HistoryCommands } from '@antv/x6/lib/plugin/history/type'
import type {
  EntryGraphModel,
  GraphModelDTO,
  GraphJSON,
  SubGraphMap,
} from '~/types'

const commonService = createCommonService()

// ─── 各图层独立 Undo/Redo 历史栈───
const layerHistoryStacks = new Map<
  string,
  { undoStack: HistoryCommands[]; redoStack: HistoryCommands[] }
>()

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

/** 为未连接的端口生成 IO 节点 + 连线的 JSON 数据 */
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
  const offsetX = isIn ? pos.x - 200 : pos.x + node.getSize().width + 200
  extraJson.push({
    id: ioNodeId,
    shape: 'circle',
    position: { x: offsetX, y: pos.y },
    size: { width: 50, height: 40 },
    attrs: {
      text: { text: dir },
      body: { fill: '#fff', stroke: '#8f8f8f', strokeWidth: 1 },
    },
    data: { type: isIn ? 'InPort' : 'OutPort' },
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
    commonService.resize(subsystemNode)
    commonService.addPort(subsystemNode, unconnectedInPorts.size, {
      group: 'in',
    })
    commonService.addPort(subsystemNode, unconnectedOutPorts.size, {
      group: 'out',
    })
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
      ? (n: NodeProperties) =>
          n.data?.type === 'InPort' || n.attrs?.text?.text === 'in'
      : (n: NodeProperties) =>
          n.data?.type === 'OutPort' || n.attrs?.text?.text === 'out'
  return nodes.filter(isTarget)
}

/** 获取子系统内部的实际 block（排除 IO 节点和边） */
function getInnerBlocks(cells: CellProperties[]): NodeProperties[] {
  return cells.filter(
    (c) => c.shape !== 'edge' && !isIONode(c),
  ) as NodeProperties[]
}

// ─── 识别 ──────────────────────────────────────────────────────────────

function isSubsystemBlock(node: NodeProperties): boolean {
  return node.data?.type === 'SubsystemBlock' || node.data?.kind === 'subsystem'
}

/** 判断子系统是否为直通（内部无实际 block，仅含 IO 节点） */
function isPassthroughSubsystem(
  subsystemId: string,
  subGraphs: SubGraphMap,
): boolean {
  const cells = getInnerCells(subsystemId, subGraphs)
  return getInnerBlocks(cells).length === 0
}

function isIONode(node: NodeProperties): boolean {
  return (
    node.data?.type === 'InPort' ||
    node.data?.type === 'OutPort' ||
    node.attrs?.text?.text === 'in' ||
    node.attrs?.text?.text === 'out'
  )
}

/** 判断子系统节点是否已添加封装（markup 中存在 MASK_SELECTOR） */
function hasSubsystemMask(node: Node): boolean {
  const raw = node.getMarkup()
  if (typeof raw === 'string') return false
  const markup = Array.isArray(raw) ? raw : [raw]
  return markup.some((m) => m.selector === MASK_SELECTOR)
}

// ─── 端口映射 ────────────────────────────────────────────────────────────

/** 获取节点指定 side 的第 N 个端口 ID */
function getNthPort(
  node: NodeProperties,
  n: number,
  side: 'in' | 'out',
): string | null {
  const raw = node.ports
  const items = (Array.isArray(raw) ? raw : raw?.items) ?? []
  const isInGroup = (g: string) =>
    side === 'in' ? g === 'in' || g === 'left' : g === 'out' || g === 'right'
  return (
    items.filter((p: { group?: string }) => isInGroup(p.group ?? ''))[n]?.id ??
    null
  )
}

/** 获取指定端口在指定 side 中的序号 */
function getPortIndex(
  node: NodeProperties,
  portId: string,
  side: 'in' | 'out',
): number {
  const raw = node.ports
  const items = (Array.isArray(raw) ? raw : raw?.items) ?? []
  const isInGroup = (g: string) =>
    side === 'in' ? g === 'in' || g === 'left' : g === 'out' || g === 'right'
  return items
    .filter((p: { group?: string }) => isInGroup(p.group ?? ''))
    .findIndex((p: { id?: string }) => p.id === portId)
}

/**
 * 外层端口 → 内部 IO 节点
 * 信号进入子系统时，外层 portId 映射到内部第 N 个 IO 节点
 */
function portToIONode(
  subsystem: NodeProperties,
  portId: string,
  side: 'in' | 'out',
  subGraphs: SubGraphMap,
): NodeProperties | null {
  const index = getPortIndex(subsystem, portId, side)
  if (index < 0) return null
  const cells = getInnerCells(subsystem.id ?? '', subGraphs)
  return getIONodes(cells, side)[index] ?? null
}

/**
 * 内部 IO 节点 → 外层端口 ID
 * 信号流出子系统时，内部 IO 节点映射回外层第 N 个端口
 */
function ioNodeToPortId(
  ioNodeId: string,
  subsystem: NodeProperties,
  cells: CellProperties[],
): string | null {
  const ioNode = cells.find((c) => c.id === ioNodeId) as
    | NodeProperties
    | undefined
  if (!ioNode) return null
  const isInPort =
    ioNode.data?.type === 'InPort' || ioNode.attrs?.text?.text === 'in'
  const side = isInPort ? 'in' : 'out'
  const index = getIONodes(cells, side).findIndex((n) => n.id === ioNodeId)
  if (index < 0) return null
  return getNthPort(subsystem, index, side)
}

// ─── 信号追踪 ────────────────────────────────────────────────────────────

type ResolvedEndpoint = { blockId: string; portId: string }

/**
 * 从指定 cell 出发，沿信号方向找到下一个端点
 * @param fromCellId 起始 cell ID
 * @param dir 'target' = 信号流出（找出边的 target）；'source' = 信号流入（找入边的 source）
 * @param cells 当前层的 cells
 */
function traceSignalFlow(
  fromCellId: string,
  dir: 'source' | 'target',
  cells: CellProperties[],
): ResolvedEndpoint | null {
  const edge = cells.find(
    (c) =>
      c.shape === 'edge' &&
      (dir === 'target'
        ? (c as EdgeProperties).source?.cell === fromCellId
        : (c as EdgeProperties).target?.cell === fromCellId),
  ) as EdgeProperties | undefined
  if (!edge) return null
  const endpoint =
    dir === 'target'
      ? {
          blockId: edge.target?.cell ?? '',
          portId: edge.target?.port ?? '',
        }
      : {
          blockId: edge.source?.cell ?? '',
          portId: edge.source?.port ?? '',
        }
  return endpoint.blockId ? endpoint : null
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
  const layer = subGraphs[graphId]
  if (!layer) return null
  const cells = getInnerCells(graphId, subGraphs)
  const cellMap = new Map<string, CellProperties>(
    cells.map((c) => [c.id ?? '', c]),
  )
  const cell = cellMap.get(cellId)
  if (!cell) return null
  const node = cell as NodeProperties

  // 普通 block：直接返回
  if (!isSubsystemBlock(node) && !isIONode(node)) {
    return { blockId: cellId, portId }
  }

  // 子系统：端口重映射 → 追踪内部信号
  if (isSubsystemBlock(node)) {
    const side = dir === 'target' ? 'in' : 'out'
    const ioNode = portToIONode(node, portId, side, subGraphs)
    if (!ioNode) return null
    const innerCells = getInnerCells(cellId, subGraphs)
    const next = traceSignalFlow(ioNode.id ?? '', dir, innerCells)
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

  return null
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
 * 同步子系统外层端口与内部 IO 节点数量
 * 当内部增删 IO 节点后调用
 */
function syncSubsystemPorts(
  subsystemId: string,
  graph: Graph,
  subGraphs: SubGraphMap,
) {
  const subsystemNode = graph.getCellById(subsystemId) as Node | null
  if (!subsystemNode) return

  const cells = getInnerCells(subsystemId, subGraphs)
  const inCount = getIONodes(cells, 'in').length
  const outCount = getIONodes(cells, 'out').length
  const currentPorts = subsystemNode.getPorts()
  const currentIn = currentPorts.filter((p) =>
    p.group?.toLowerCase().includes('in'),
  ).length
  const currentOut = currentPorts.filter((p) =>
    p.group?.toLowerCase().includes('out'),
  ).length

  // 补充缺失端口
  if (inCount > currentIn)
    commonService.addPort(subsystemNode, inCount - currentIn, { group: 'in' })
  if (outCount > currentOut)
    commonService.addPort(subsystemNode, outCount - currentOut, {
      group: 'out',
    })

  // 移除多余端口
  if (currentIn > inCount) {
    const inPorts = currentPorts.filter((p) =>
      p.group?.toLowerCase().includes('in'),
    )
    for (let i = inPorts.length - 1; i >= inCount; i--) {
      if (inPorts[i].id) subsystemNode.removePort(inPorts[i].id!)
    }
  }
  if (currentOut > outCount) {
    const outPorts = currentPorts.filter((p) =>
      p.group?.toLowerCase().includes('out'),
    )
    for (let i = outPorts.length - 1; i >= outCount; i--) {
      if (outPorts[i].id) subsystemNode.removePort(outPorts[i].id!)
    }
  }
  commonService.resize(subsystemNode)
}

// ─── 验证 ────────────────────────────────────────────────────────────────

/**
 * 找出未连接的 IO 节点
 * InPort 需要有出边（信号流入内部），OutPort 需要有入边（信号流出外部）
 */
function getUnconnectedIONodes(cells: CellProperties[]): {
  inPorts: NodeProperties[]
  outPorts: NodeProperties[]
} {
  const ioNodes = getIONodes(cells)
  const edges = cells.filter((c) => c.shape === 'edge') as EdgeProperties[]
  const inPorts = ioNodes.filter(
    (node) =>
      (node.data?.type === 'InPort' || node.attrs?.text?.text === 'in') &&
      !edges.some((e) => e.source?.cell === node.id),
  )
  const outPorts = ioNodes.filter(
    (node) =>
      (node.data?.type === 'OutPort' || node.attrs?.text?.text === 'out') &&
      !edges.some((e) => e.target?.cell === node.id),
  )
  return { inPorts, outPorts }
}

// ─── DTO 导出 ──────────────────────────────────────────────────────────────

function collectBlocks(subGraphs: SubGraphMap, rootId: string) {
  const blocks: any[] = []
  for (const layer of Object.values(subGraphs)) {
    const cells = getInnerCells(layer.id, subGraphs)
    for (const node of getInnerBlocks(cells)) {
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
  for (const layer of Object.values(subGraphs)) {
    const cells = getInnerCells(layer.id, subGraphs)
    const cellMap = new Map<string, CellProperties>(
      cells.map((c) => [c.id ?? '', c]),
    )
    for (const cell of cells) {
      if (cell.shape !== 'edge') continue
      const edge = cell as EdgeProperties
      const srcCell = cellMap.get(edge.source?.cell)
      const tgtCell = cellMap.get(edge.target?.cell)
      if (
        (srcCell &&
          srcCell.shape !== 'edge' &&
          isIONode(srcCell as NodeProperties)) ||
        (tgtCell &&
          tgtCell.shape !== 'edge' &&
          isIONode(tgtCell as NodeProperties))
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
        edge.target?.port ?? '',
        'target',
        layer.id,
        subGraphs,
      )
      if (!resolvedSrc || !resolvedTgt) continue

      lines.push({
        fromBlockName: resolvedSrc.blockId,
        fromPortNo: resolvedSrc.portId || '1',
        toBlockName: resolvedTgt.blockId,
        toPortNo: resolvedTgt.portId || '1',
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
  ioNodeToPortId,
  traceSignalFlow,
  resolveEndpoint,
  getUnconnectedIONodes,
}
