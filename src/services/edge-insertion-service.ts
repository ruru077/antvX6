import { EDGE_TARGET_CP_OFFSET, RED, SNAP_RADIUS } from '@/assets/constant'
import { previewLinkAttrs } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { isConnectionValid } from '@/services/connection-service'
import {
  fallbackEdgeToManhattan,
  isCompleteNodeEdge,
  routeAllEdges,
} from '@/services/routing-service'
import type { Edge, EdgeView, Graph, Node } from '@antv/x6'
/**
 * Edge-Insertion Service
 * @description 将模块插入到两条连线之间的进行连接。提供预览和提交功能。
 * @author codex
 */
const commonService = createCommonService()
const INSERT_PREVIEW = 'edgeInsertionPreview'
const INSERT_PREVIEW_TERMINALS = 'edgeInsertionPreviewTerminals'

type Point = { x: number; y: number }

type PreviewState = {
  nodeId: string
  ownerWasInGraph: boolean
  targetEdge: Edge
  snapPoint: Point
  previewEdges: Edge[]
}

const previewStates = new WeakMap<Graph, PreviewState>()

function isPreviewEdge(edge: Edge) {
  return edge.getData()?.[INSERT_PREVIEW] === true
}

function getInsertPorts(graph: Graph, node: Node) {
  const inputPorts = node
    .getPorts()
    .filter((port) => commonService.getPortGroup(port) === 'in')
  const outputPorts = node
    .getPorts()
    .filter((port) => commonService.getPortGroup(port) === 'out')
  if (inputPorts.length !== 1 || outputPorts.length !== 1) return null

  if (graph.getCellById(node.id) === node) {
    const occupied = graph
      .getConnectedEdges(node)
      .some((edge) => !isPreviewEdge(edge))
    if (occupied) return null
  }

  const inputPortId = inputPorts[0].id
  const outputPortId = outputPorts[0].id
  if (!inputPortId || !outputPortId) return null
  return { inputPortId, outputPortId }
}

function canInsertNodeOnEdge(graph: Graph, node: Node) {
  return getInsertPorts(graph, node) !== null
}

function hasBranch(graph: Graph, targetEdge: Edge) {
  return graph
    .getEdges()
    .some(
      (edge) =>
        edge.id !== targetEdge.id &&
        !isPreviewEdge(edge) &&
        (edge.getSourceCellId() === targetEdge.id ||
          edge.getTargetCellId() === targetEdge.id),
    )
}

function isInsertTargetValid(
  graph: Graph,
  node: Node,
  edge: Edge,
  inputPortId: string,
  outputPortId: string,
) {
  if (isPreviewEdge(edge)) return false
  if (edge.getAttrs()?.line?.stroke === RED) return false
  if (!isCompleteNodeEdge(edge) || hasBranch(graph, edge)) return false

  const sourceNode = edge.getSourceCell() as Node
  const targetNode = edge.getTargetCell() as Node
  const sourcePortId = edge.getSourcePortId()
  const targetPortId = edge.getTargetPortId()
  if (!sourcePortId || !targetPortId) return false
  if (commonService.getPortGroup(sourceNode.getPort(sourcePortId)) !== 'out')
    return false
  if (commonService.getPortGroup(targetNode.getPort(targetPortId)) !== 'in')
    return false

  return (
    isConnectionValid(
      graph,
      sourceNode,
      sourcePortId,
      node,
      inputPortId,
      edge,
    ) &&
    isConnectionValid(graph, node, outputPortId, targetNode, targetPortId, edge)
  )
}

function getPortPoint(node: Node, portId: string) {
  const port = node.getPort(portId)
  if (!port?.group) throw new Error(`Port group is missing: ${portId}`)
  const layout = node.getPortsPosition(port.group)[portId]
  const position = node.getPosition()
  return {
    x: position.x + layout.position.x,
    y: position.y + layout.position.y,
  }
}

function getPortDirection(node: Node, portId: string) {
  const port = node.getPort(portId)
  const position = port?.group
    ? node.ports.groups?.[port.group]?.position
    : null
  const name =
    typeof position === 'string'
      ? position
      : position && 'name' in position
        ? position.name
        : null
  if (
    name === 'left' ||
    name === 'right' ||
    name === 'top' ||
    name === 'bottom'
  ) {
    return name
  }

  const point = getPortPoint(node, portId)
  const bbox = node.getBBox()
  const distances: Array<{
    direction: 'left' | 'right' | 'top' | 'bottom'
    distance: number
  }> = [
    { direction: 'left', distance: Math.abs(point.x - bbox.x) },
    {
      direction: 'right',
      distance: Math.abs(point.x - (bbox.x + bbox.width)),
    },
    { direction: 'top', distance: Math.abs(point.y - bbox.y) },
    {
      direction: 'bottom',
      distance: Math.abs(point.y - (bbox.y + bbox.height)),
    },
  ]
  return distances.sort((a, b) => a.distance - b.distance)[0].direction
}

function getPreviewTerminal(node: Node, portId: string) {
  const bbox = node.getBBox()
  return {
    nodeId: node.id,
    portId,
    direction: getPortDirection(node, portId),
    bbox: {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    },
  }
}

function getPreviewTargetPoint(node: Node, portId: string) {
  const point = getPortPoint(node, portId)
  const distance = -EDGE_TARGET_CP_OFFSET
  switch (getPortDirection(node, portId)) {
    case 'left':
      return { x: point.x - distance, y: point.y }
    case 'right':
      return { x: point.x + distance, y: point.y }
    case 'top':
      return { x: point.x, y: point.y - distance }
    case 'bottom':
      return { x: point.x, y: point.y + distance }
  }
}

function snapNode(node: Node, point: Point) {
  const size = node.getSize()
  node.position(point.x - size.width / 2, point.y - size.height / 2, {
    ignore: true,
    undo: false,
  })
}

function clearEdgeInsertionPreview(graph: Graph, ownerNodeId?: string) {
  const state = previewStates.get(graph)
  if (!state) return
  if (ownerNodeId && state.nodeId !== ownerNodeId) return
  state.targetEdge.attr('line/visibility', 'visible', {
    ignore: true,
    undo: false,
  })
  graph.removeCells(state.previewEdges, { ignore: true, undo: false })
  previewStates.delete(graph)
}

function createPreview(
  graph: Graph,
  node: Node,
  targetEdge: Edge,
  snapPoint: Point,
  inputPortId: string,
  outputPortId: string,
) {
  snapNode(node, snapPoint)
  const nodeInGraph = graph.getCellById(node.id) === node
  const inputTerminal = nodeInGraph
    ? { cell: node.id, port: inputPortId }
    : getPreviewTargetPoint(node, inputPortId)
  const outputTerminal = nodeInGraph
    ? { cell: node.id, port: outputPortId }
    : getPortPoint(node, outputPortId)

  targetEdge.attr('line/visibility', 'hidden', {
    ignore: true,
    undo: false,
  })
  // 两条拆分预览 Edge 都写入 data.edgeInsertionPreview。路由层据此将它们
  // 与普通红色拉线预览区分，并允许这两条完整预览线参与 Avoid 路由。
  const upstream = graph.addEdge(
    {
      source: targetEdge.getSource(),
      target: inputTerminal,
      data: {
        [INSERT_PREVIEW]: true,
        ...(nodeInGraph
          ? {}
          : {
              [INSERT_PREVIEW_TERMINALS]: {
                target: getPreviewTerminal(node, inputPortId),
              },
            }),
      },
      ...previewLinkAttrs,
    },
    { ignore: true, undo: false },
  )
  const downstream = graph.addEdge(
    {
      source: outputTerminal,
      target: targetEdge.getTarget(),
      data: {
        [INSERT_PREVIEW]: true,
        ...(nodeInGraph
          ? {}
          : {
              [INSERT_PREVIEW_TERMINALS]: {
                source: getPreviewTerminal(node, outputPortId),
              },
            }),
      },
      ...previewLinkAttrs,
    },
    { ignore: true, undo: false },
  )
  fallbackEdgeToManhattan(upstream)
  fallbackEdgeToManhattan(downstream)

  previewStates.set(graph, {
    nodeId: node.id,
    ownerWasInGraph: nodeInGraph,
    targetEdge,
    snapPoint,
    previewEdges: [upstream, downstream],
  })
  // 原 Edge 保持隐藏且不参与本轮路由；两条 insertion 预览 Edge 作为特例
  // 进入 Avoid，因此预览与松手后生成的正式 Edge 使用同一套路由规则。
  void routeAllEdges(graph)
}

function updateEdgeInsertionPreview(graph: Graph, node: Node) {
  const point = node.getBBox().getCenter()
  const nodeInGraph = graph.getCellById(node.id) === node
  const existingPreview = previewStates.get(graph)

  // Stencil 拖拽节点不属于 targetGraph。它的 move/cleanup 事件可能与画布
  // 右键复制的拖拽事件交错，但不能因此清理另一个节点持有的预览。
  if (existingPreview && existingPreview.nodeId !== node.id && !nodeInGraph) {
    return false
  }

  const ports = getInsertPorts(graph, node)
  if (!ports) {
    clearEdgeInsertionPreview(graph)
    return false
  }

  const candidates = graph
    .getEdges()
    .filter((edge) => !isPreviewEdge(edge) && isCompleteNodeEdge(edge))
    .map((edge) => {
      const view = graph.findViewByCell(edge) as EdgeView | null
      const closest = view?.getClosestPoint(point)
      return closest
        ? { edge, closest, distance: closest.distance(point) }
        : null
    })
    .filter((candidate) => candidate != null)
    .sort((a, b) => a.distance - b.distance)

  const candidate = candidates[0]
  if (!candidate || candidate.distance > SNAP_RADIUS) {
    clearEdgeInsertionPreview(graph)
    return false
  }

  const current = existingPreview
  if (
    current?.targetEdge.id === candidate.edge.id &&
    current.nodeId === node.id
  ) {
    current.snapPoint = candidate.closest
    snapNode(node, candidate.closest)
    if (graph.getCellById(node.id) !== node) {
      current.previewEdges[0].setTarget(
        getPreviewTargetPoint(node, ports.inputPortId),
        {
          ignore: true,
          undo: false,
        },
      )
      current.previewEdges[0].setData(
        {
          [INSERT_PREVIEW]: true,
          [INSERT_PREVIEW_TERMINALS]: {
            target: getPreviewTerminal(node, ports.inputPortId),
          },
        },
        { ignore: true, undo: false },
      )
      current.previewEdges[1].setSource(
        getPortPoint(node, ports.outputPortId),
        {
          ignore: true,
          undo: false,
        },
      )
      current.previewEdges[1].setData(
        {
          [INSERT_PREVIEW]: true,
          [INSERT_PREVIEW_TERMINALS]: {
            source: getPreviewTerminal(node, ports.outputPortId),
          },
        },
        { ignore: true, undo: false },
      )
      fallbackEdgeToManhattan(current.previewEdges[0])
      fallbackEdgeToManhattan(current.previewEdges[1])
    }
    void routeAllEdges(graph)
    return true
  }

  clearEdgeInsertionPreview(graph)
  if (
    !isInsertTargetValid(
      graph,
      node,
      candidate.edge,
      ports.inputPortId,
      ports.outputPortId,
    )
  ) {
    return false
  }
  createPreview(
    graph,
    node,
    candidate.edge,
    candidate.closest,
    ports.inputPortId,
    ports.outputPortId,
  )
  return true
}

function commitEdgeInsertion(graph: Graph, node: Node) {
  const state = previewStates.get(graph)
  if (!state) return false
  if (state.nodeId !== node.id && state.ownerWasInGraph) return false
  if (graph.getCellById(state.targetEdge.id) !== state.targetEdge) {
    clearEdgeInsertionPreview(graph)
    return false
  }

  clearEdgeInsertionPreview(graph)
  snapNode(node, state.snapPoint)
  const ports = getInsertPorts(graph, node)
  if (!ports) return false
  if (
    !isInsertTargetValid(
      graph,
      node,
      state.targetEdge,
      ports.inputPortId,
      ports.outputPortId,
    )
  ) {
    return false
  }

  const source = {
    cell: state.targetEdge.getSourceCellId()!,
    port: state.targetEdge.getSourcePortId()!,
  }
  let upstream: Edge
  graph.startBatch('insert-node-on-edge')
  try {
    state.targetEdge.setSource({ cell: node.id, port: ports.outputPortId })
    upstream = graph.addEdge({ source, ...previewLinkAttrs })
    upstream.setTarget({ cell: node.id, port: ports.inputPortId })
  } finally {
    graph.stopBatch('insert-node-on-edge')
  }
  void routeAllEdges(graph)
  return true
}

export {
  canInsertNodeOnEdge,
  clearEdgeInsertionPreview,
  commitEdgeInsertion,
  updateEdgeInsertionPreview,
}
