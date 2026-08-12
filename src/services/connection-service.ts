import { previewLinkAttrs } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import { routeAllEdges } from '@/services/routing-service'
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
    const sourceCell = current.getSourceCell() as Node | Edge
    const sourcePortId = current.getSourcePortId()
    if (sourceCell.isNode()) {
      return { cell: sourceCell, portId: sourcePortId }
    }
    current = sourceCell
  }

  return null
}

/** 校验连接方向与端口占用。 */
function isConnectionValid(
  graph: Graph,
  sourceCell: Node | Edge,
  sourcePort: string | null | undefined,
  targetCell: Node,
  targetPort: string,
  edge?: Edge | null,
) {
  const sourcePortInfo = sourceCell.isNode()
    ? { cell: sourceCell, portId: sourcePort! }
    : resolveSourceFromUpstreamEdge(sourceCell as Edge)!

  const sourceDirection = commonService.getPortGroup(
    sourcePortInfo.cell.getPort(sourcePortInfo.portId),
  )
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

  const currentEdgeId = edge?.id
  if (sourceCell.isNode()) {
    const sourcePortOccupied = graph
      .getConnectedEdges(sourcePortInfo.cell)
      .some(
        (connectedEdge) =>
          connectedEdge.id !== currentEdgeId &&
          ((connectedEdge.getSourceCell()?.id === sourcePortInfo.cell.id &&
            connectedEdge.getSourcePortId() === sourcePortInfo.portId) ||
            (connectedEdge.getTargetCell()?.id === sourcePortInfo.cell.id &&
              connectedEdge.getTargetPortId() === sourcePortInfo.portId)),
      )
    if (sourcePortOccupied) return false
  }

  return !graph
    .getConnectedEdges(targetCell)
    .some(
      (connectedEdge) =>
        connectedEdge.id !== currentEdgeId &&
        ((connectedEdge.getSourceCell()?.id === targetCell.id &&
          connectedEdge.getSourcePortId() === targetPort) ||
          (connectedEdge.getTargetCell()?.id === targetCell.id &&
            connectedEdge.getTargetPortId() === targetPort)),
    )
}

/** 按端口 ID 顺序连接两个模块当前可用的 out -> in 端口。 */
async function connectAvailablePorts(
  graph: Graph,
  sourceNode: Node,
  targetNode: Node,
) {
  if (sourceNode.id === targetNode.id) return

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

  let connected = false
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
      connected = true
    }
    if (connected) await routeAllEdges(graph)
  } finally {
    graph.stopBatch('connect-available-ports')
  }
}

export { connectAvailablePorts, isConnectionValid }
