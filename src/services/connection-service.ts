import { PREVIEW_PORT_SNAP_RADIUS, RED } from '@/assets/constant'
import { previewLinkAttrs } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import {
  ensureRoutingReady,
  getPortRouteGeometry,
  routeEdges,
} from '@/services/routing-service'
import { addEdgeEditTool } from '@/utils/plugin/EdgeEditTool'
import type { Edge, Graph, Node } from '@antv/x6'

const commonService = createCommonService()
const interactiveService = createInteractiveService()

/** 从分支 Edge 回溯到真正的上游输出端口。 */
function resolveSourceFromUpstreamEdge(
  startEdge: Edge,
): { cell: Node; portId: string } | null {
  let current: Edge | null = startEdge

  while (current) {
    const sourceCell = current.getSourceCell() as Node | Edge | null
    const sourcePortId = current.getSourcePortId()
    if (!sourceCell) return null
    if (sourceCell.isNode()) {
      if (!sourcePortId) return null
      return { cell: sourceCell, portId: sourcePortId }
    }
    current = sourceCell
  }

  return null
}

/** 校验连接方向与端口占用。 */
function isConnectionValid(
  graph: Graph,
  sourceCell: Node | Edge | null | undefined,
  sourcePort: string | null | undefined,
  targetCell: Node | null | undefined,
  targetPort: string | null | undefined,
  edge?: Edge | null,
) {
  const currentEdgeId = edge?.id
  const isPortOccupied = (cell: Node, portId: string) =>
    graph
      .getConnectedEdges(cell)
      .some(
        (connectedEdge) =>
          connectedEdge.id !== currentEdgeId &&
          ((connectedEdge.getSourceCell()?.id === cell.id &&
            connectedEdge.getSourcePortId() === portId) ||
            (connectedEdge.getTargetCell()?.id === cell.id &&
              connectedEdge.getTargetPortId() === portId)),
      )

  // previewEdge 的 source 端尚未绑定时，暂时无法做完整的 source -> target 校验。
  // 此时只校验当前候选 target：它必须是一个未被其他 Edge 占用的 in 端口。
  if (!sourceCell) {
    // target 节点或 target 端口也不存在，说明当前没有可校验的候选端口。
    if (!targetCell || targetPort == null) return false
    // target 端只能连接 in 端口，out 端口不能作为终点。
    if (commonService.getPortGroup(targetCell.getPort(targetPort)) !== 'in')
      return false
    return !isPortOccupied(targetCell, targetPort)
  }

  const sourcePortInfo = sourceCell.isNode()
    ? { cell: sourceCell, portId: sourcePort! }
    : resolveSourceFromUpstreamEdge(sourceCell as Edge)
  if (!sourcePortInfo) return false

  const sourceDirection = commonService.getPortGroup(
    sourcePortInfo.cell.getPort(sourcePortInfo.portId),
  )

  // previewEdge 的 target 端尚未绑定时，只校验已经确定的 source：
  // 它必须是一个未被其他 Edge 占用的 out 端口。
  if (!targetCell) {
    if (sourceDirection !== 'out') return false
    return !isPortOccupied(sourcePortInfo.cell, sourcePortInfo.portId)
  }

  // targetCell 已存在但没有 targetPort，表示命中的是节点本身而不是具体端口。
  if (targetPort == null) return false
  const targetDirection = commonService.getPortGroup(
    targetCell.getPort(targetPort),
  )
  if (
    !sourceDirection ||
    !targetDirection ||
    sourceDirection === targetDirection
  ) {
    return false
  }

  if (sourceCell.isNode()) {
    if (isPortOccupied(sourcePortInfo.cell, sourcePortInfo.portId)) return false
  }

  return !isPortOccupied(targetCell, targetPort)
}

/** 按端口 ID 顺序连接两个模块当前可用的 out -> in 端口。 */
async function connectAvailablePorts(
  graph: Graph,
  sourceNode: Node,
  targetNode: Node,
) {
  if (sourceNode.id === targetNode.id) return
  await ensureRoutingReady()
  if (!graph.hasCell(sourceNode) || !graph.hasCell(targetNode)) return

  const targetPorts = targetNode
    .getPorts()
    .filter(
      (port) => port.id !== null && commonService.getPortGroup(port) === 'in',
    )
    .sort((a, b) => a.id!.localeCompare(b.id!, undefined, { numeric: true }))
  const sourcePorts = sourceNode
    .getPorts()
    .filter(
      (port) => port.id !== null && commonService.getPortGroup(port) === 'out',
    )
    .sort((a, b) => a.id!.localeCompare(b.id!, undefined, { numeric: true }))

  const connected: Edge[] = []
  graph.startBatch('connect-available-ports')
  try {
    for (const targetPort of targetPorts) {
      const sourcePort = sourcePorts.find((port) =>
        isConnectionValid(
          graph,
          sourceNode,
          port.id,
          targetNode,
          targetPort.id!,
        ),
      )
      if (!sourcePort) continue

      const edge = graph.addEdge({
        source: { cell: sourceNode.id, port: sourcePort.id },
        ...previewLinkAttrs,
      })
      edge.setTarget({ cell: targetNode.id, port: targetPort.id })
      addEdgeEditTool(edge)
      interactiveService.initializeEdgeTools(edge)
      connected.push(edge)
    }
    await routeEdges(graph, connected, { reason: 'connect' })
  } finally {
    graph.stopBatch('connect-available-ports')
  }
}

/** 放置模块后，将附近的预览线坐标端点连接到方向匹配的空闲端口。 */
function connectNearbyPreviewPorts(graph: Graph, node: Node) {
  if (!graph.hasCell(node)) return
  const candidates: Array<{
    edge: Edge
    terminal: 'source' | 'target'
    portId: string
    distance: number
  }> = []
  for (const port of node.getPorts()) {
    if (!port.id) continue
    const group = commonService.getPortGroup(port)
    if (!group) continue
    const geometry = getPortRouteGeometry(node, port.id)
    if (!geometry) continue
    const portPoint = graph.localToClient(geometry.point)
    const terminal = group === 'out' ? 'source' : 'target'
    for (const edge of graph.getEdges()) {
      if (edge.getAttrs()?.line?.stroke !== RED) continue
      if (edge.getData()?.edgeInsertionPreview) continue
      const endpoint = edge.getTerminal(terminal)
      if ('cell' in endpoint || !('x' in endpoint) || !('y' in endpoint))
        continue
      if (typeof endpoint.x !== 'number' || typeof endpoint.y !== 'number')
        continue
      const point = graph.localToClient(endpoint.x, endpoint.y)
      const distance = Math.hypot(point.x - portPoint.x, point.y - portPoint.y)
      if (distance <= PREVIEW_PORT_SNAP_RADIUS)
        candidates.push({ edge, terminal, portId: port.id, distance })
    }
  }
  candidates.sort((a, b) => a.distance - b.distance)
  if (!candidates.length) return
  graph.startBatch('connect-preview-ports')
  try {
    for (const { edge, terminal, portId } of candidates) {
      if ('cell' in edge.getTerminal(terminal)) continue
      const source =
        terminal === 'source'
          ? node
          : (edge.getSourceCell() as Node | Edge | null)
      const target = terminal === 'target' ? node : edge.getTargetCell()
      if (source?.id === target?.id || (target && !target.isNode())) continue
      if (
        !isConnectionValid(
          graph,
          source,
          terminal === 'source' ? portId : edge.getSourcePortId(),
          target as Node | null,
          terminal === 'target' ? portId : edge.getTargetPortId(),
          edge,
        )
      )
        continue
      // 使用原 Edge，保留其 ID、分支及已有编辑数据。
      if (terminal === 'source') edge.setSource({ cell: node.id, port: portId })
      else edge.setTarget({ cell: node.id, port: portId })
      interactiveService.initializeEdgeTools(edge)
    }
  } finally {
    graph.stopBatch('connect-preview-ports')
  }
}

export { connectAvailablePorts, connectNearbyPreviewPorts, isConnectionValid }
