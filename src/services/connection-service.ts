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
    : resolveSourceFromUpstreamEdge(sourceCell as Edge)!

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
