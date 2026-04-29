import type { Edge, Node } from '@antv/x6'

type UnconnectedPortInfo = {
  nodeId: string
  portId: string
  group: string | undefined
}

/** 每个 port 占用的最小高度（px） */
const PORT_MIN_SPACING = 20
/** 节点上下内边距（px） */
const PORT_PADDING = 10

function createCommonService() {
  /**
   * @description 根据节点端口数量调整节点高度，确保端口之间有足够的间距
   */
  function resize(node: Node) {
    const ports = node.getPorts()
    const inCount = ports.filter((p) =>
      p.group?.toLowerCase().includes('in'),
    ).length
    const outCount = ports.filter((p) =>
      p.group?.toLowerCase().includes('out'),
    ).length
    const maxCount = Math.max(inCount, outCount, 1)
    const requiredHeight = maxCount * PORT_MIN_SPACING + PORT_PADDING * 2
    const currentHeight = node.getSize().height
    if (currentHeight < requiredHeight) {
      node.setSize({ width: node.getSize().width, height: requiredHeight })
    }
  }

  /**
   * 统计节点列表中未连接的 in/out port
   * @param nodes 节点数组
   * @param internalEdges 边数组，过滤已连接的端口
   */
  function getUnconnectedPorts(
    nodes: Node[],
    internalEdges?: Edge[],
  ): {
    unconnectedInPorts: Map<string, UnconnectedPortInfo>
    unconnectedOutPorts: Map<string, UnconnectedPortInfo>
  } {
    const unconnectedInPorts = new Map<string, UnconnectedPortInfo>()
    const unconnectedOutPorts = new Map<string, UnconnectedPortInfo>()

    nodes.forEach((node) => {
      node.getPorts().forEach((port) => {
        if (!port.id) return
        const g = port.group
        const portInfo: UnconnectedPortInfo = {
          nodeId: node.id,
          portId: port.id,
          group: port.group,
        }
        if (g?.toLowerCase().includes('in')) {
          unconnectedInPorts.set(port.id, portInfo)
        } else if (g?.toLowerCase().includes('out')) {
          unconnectedOutPorts.set(port.id, portInfo)
        } else {
          // fallback: 未标识的 port group
          console.error('存在未标识的 port group', {
            nodeId: node.id,
            portId: port.id,
          })
        }
      })
    })
    // 过滤已连接的端口
    if (internalEdges) {
      for (const edge of internalEdges) {
        const src = edge.getSourcePortId()
        const tgt = edge.getTargetPortId()
        if (src) unconnectedOutPorts.delete(src)
        if (tgt) unconnectedInPorts.delete(tgt)
      }
    }

    return { unconnectedInPorts, unconnectedOutPorts }
  }

  return {
    resize,
    getUnconnectedPorts,
  }
}

export { createCommonService }
