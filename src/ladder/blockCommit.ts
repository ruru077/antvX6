import { assertLadderBlock } from './block'
import type { LadderBlockData } from './block'
import type { Graph, Node } from '@antv/x6'

/** Validate before opening a batch: a failed edit must leave both program and wires intact. */
export function assertLadderConnectionSafety(
  graph: Graph,
  node: Node,
  next: LadderBlockData,
) {
  assertLadderBlock(next)
  const ports = new Map(next.interfacePorts.map((p) => [p.id, p]))
  const old = node.getData().ladder as LadderBlockData
  const removed = old.interfacePorts.filter(
    (p) => !ports.has(p.id) || ports.get(p.id)!.direction !== p.direction,
  )
  const connected = removed.filter((p) =>
    graph
      .getConnectedEdges(node)
      .some(
        (edge) =>
          (edge.getSourceCellId() === node.id &&
            edge.getSourcePortId() === p.id) ||
          (edge.getTargetCellId() === node.id &&
            edge.getTargetPortId() === p.id),
      ),
  )
  if (connected.length)
    throw new Error(
      `请先在父画布断开端口连线，再删除或改变方向：${connected.map((p) => p.variable).join('、')}`,
    )
}

export async function commitLadderBlock(
  graph: Graph,
  node: Node,
  next: LadderBlockData,
  ports: unknown,
  name: string,
  afterUpdate?: () => Promise<void>,
) {
  assertLadderConnectionSafety(graph, node, next)
  if (!graph.isHistoryEnabled())
    throw new Error('画布正在切换，请稍后重新应用梯形图')
  const previousHistorySize = graph.getUndoStackSize()
  let failed = false
  graph.startBatch('edit-ladder-controller')
  try {
    node.setData(
      { ...node.getData(), ladder: structuredClone(next) },
      { overwrite: true },
    )
    node.prop('ports', ports)
    node.attr('label/text', name.trim() || 'LAD Controller')
    const count = Math.max(...next.interfacePorts.map((p) => p.order), 0)
    node.resize(
      Math.max(node.getSize().width, 180),
      Math.max(96, count * 26 + 24),
    )
    await afterUpdate?.()
  } catch (error) {
    failed = true
    throw error
  } finally {
    graph.stopBatch('edit-ladder-controller')
    if (failed && graph.getUndoStackSize() > previousHistorySize)
      graph.undoAndCancel()
  }
}
