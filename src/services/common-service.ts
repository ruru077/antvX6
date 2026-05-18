import type { Edge, Node } from '@antv/x6'
import type { EntryGraphModel } from '~/types/common/subGraph'
import { EDGE_WRAPPER_WIDTH } from '@/assets/constant'
import { electricalPortGroups, signalPortGroups } from '@/assets/x6Model'
import { useGraphStore } from '@/store/graphStore'

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

  /**
   * @description 判断鼠标在节点外的距离是否超过阈值
   * @param e 事件对象
   * @param threshold 阈值
   * @returns 是否在节点外
   */
  function isMouseOutCell(
    e: MouseEvent,
    cell: Node,
    threshold: number,
  ): boolean {
    const graph = useGraphStore.getState().graph
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
  function getNodeAtPoint(e: MouseEvent): Node | null {
    const graph = useGraphStore.getState().graph
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
  type AddPortOptions = { group?: string; groups?: 'signal' | 'electrical' }
  /**
   * @description 合并子系统增缺失的端口
   * @param count 增加的端口数量
   * @param options
   */
  function addPort(
    node: Node,
    count: number,
    options: AddPortOptions = { group: 'in', groups: 'signal' },
  ) {
    const { group, groups } = options
    const isElectrical = groups === 'electrical'
    const portGroups = isElectrical ? electricalPortGroups : signalPortGroups
    node.prop('ports/groups', portGroups)
    const existing = node.getPorts().filter((p) => p.group === group).length
    for (let i = 1; i <= count; i++) {
      node.addPort({ id: `${group}${existing + i}`, group })
    }
  }

  /**
   * 递归移除对象中所有值为 null 的字段
   * null 在 X6 attrs 中表示"清除该属性"，导出时不存在该字段效果等同
   */
  function zipGraphModelJson(obj: EntryGraphModel): EntryGraphModel {
    function zip(val: unknown): unknown {
      if (Array.isArray(val)) return val.map(zip)
      if (val !== null && typeof val === 'object') {
        return Object.fromEntries(
          Object.entries(val as Record<string, unknown>)
            .filter(([, v]) => v !== null)
            .map(([k, v]) => [k, zip(v)]),
        )
      }
      return val
    }
    return zip(obj) as EntryGraphModel
  }
  return {
    resize,
    getUnconnectedPorts,
    isMouseOutCell,
    getNodeAtPoint,
    addPort,
    zipGraphModelJson,
  }
}

export { createCommonService }
