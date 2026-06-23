import { Model, StringExt } from '@antv/x6'
import { formalLink, signalPortGroups } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { snapshotToDataURL } from '@/services/snapshot-service'
import {
  buildPaths,
  createSubGraphItem,
  useSubGraphStore,
} from '@/store/subGraphStore'
import { _patchScrollerForceUpdate } from '@/utils/plugin/X6patch'
import type { Cell, Edge, Graph, History, Node, Scroller } from '@antv/x6'
import type { HistoryCommands } from '@antv/x6/lib/plugin/history/type'
import type { EntryGraphModel, GraphJSON } from '~/types'

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

  function createIONodeJson(dir: 'in' | 'out', nodeId: string, portId: string) {
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

  for (const { nodeId, portId } of unconnectedInPorts.values()) {
    createIONodeJson('in', nodeId, portId)
  }
  for (const { nodeId, portId } of unconnectedOutPorts.values()) {
    createIONodeJson('out', nodeId, portId)
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
        label: 'New Subsystem',
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

export { changeGraphView, loadEntryGraphModel, mergeToSubsystem }
