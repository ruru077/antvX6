import type { Cell, Edge, Graph, Node } from '@antv/x6'

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

  function addOutline(cell: Cell) {
    if (cell.isNode()) {
      cell.attr(
        'body/filter',
        { name: 'outline', args: { color: '#77caeb', width: 4, margin: 0 } },
        { undo: false },
      )
    } else if (cell.isEdge()) {
      cell.attr(
        'line/filter',
        {
          name: 'outline',
          args: { color: '#77caeb', width: 2, margin: 0 },
          attrs: {
            filterUnits: 'userSpaceOnUse',
            x: -9999,
            y: -9999,
            width: 19998,
            height: 19998,
          },
        },
        { undo: false },
      )
    }
  }

  function removeOutline(cell: Cell) {
    if (cell.isNode()) cell.attr('body/filter', null, { undo: false })
    else if (cell.isEdge()) cell.attr('line/filter', null, { undo: false })
  }
  /**
   * @description 判断鼠标在节点外的距离是否超过阈值
   * @param e 事件对象
   * @param threshold 阈值
   * @returns 是否在节点外
   */
  function isMouseOutCell(
    e: MouseEvent,
    graph: Graph,
    cell: Node,
    threshold: number,
  ): boolean {
    const p = graph.pageToLocal(e.pageX, e.pageY)
    const b = cell.getBBox()
    return (
      p.x < b.x - threshold ||
      p.x > b.x + b.width + threshold ||
      p.y < b.y - threshold ||
      p.y > b.y + b.height + threshold
    )
  }
  /**
   * 获取指定坐标点下的节点
   * @returns 节点对象 Node | null
   */
  function getNodeAtPoint(e: MouseEvent, graph: Graph): Node | null {
    const p = graph.pageToLocal(e.pageX, e.pageY)
    return (
      graph.getNodes().find((n) => {
        const b = n.getBBox()
        return (
          p.x >= b.x &&
          p.x <= b.x + b.width &&
          p.y >= b.y &&
          p.y <= b.y + b.height
        )
      }) ?? null
    )
  }
  /**
   * @param node 目标节点
   * @description 在节点上添加边界工具，不加入undoStack
   */
  function addBoundaryTool(cell: Cell) {
    cell.addTools(
      {
        name: 'boundary',
        args: {
          padding: 5,
          attrs: {
            fill: '#7c68fc',
            stroke: '#333',
            strokeWidth: 0.5,
            fillOpacity: 0.2,
          },
        },
      },
      { undo: false },
    )
  }
  return {
    resize,
    getUnconnectedPorts,
    addOutline,
    removeOutline,
    isMouseOutCell,
    getNodeAtPoint,
    addBoundaryTool,
  }
}

export { createCommonService }
