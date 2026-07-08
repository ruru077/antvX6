import { EDGE_WRAPPER_WIDTH } from '@/assets/constant'
import { electricalPortGroups, signalPortGroups } from '@/assets/x6Model'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { Edge, Node } from '@antv/x6'
import type { TextMatchOptions } from '~/types/common/text'

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
  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 文本匹配逻辑：
   * - keyword 为空时，直接视为匹配
   * - regex=true 时，把 keyword 当作正则表达式原文使用
   * - wholeWord=true 时，会加上单词边界 \b，要求完整词命中
   * - caseSensitive 控制是否区分大小写
   * - 都不启用时，按普通包含关系匹配
   */
  function isTextMatched(
    text: string,
    keyword: string,
    options: TextMatchOptions,
  ): boolean {
    if (!keyword) return true

    if (options.regex || options.wholeWord) {
      // caseSensitive=true 时只加 u；否则同时加 i + u
      // i: 忽略大小写
      // u: 启用 Unicode 语义，避免部分字符处理异常
      const flags = options.caseSensitive ? 'u' : 'iu'
      const source = options.regex
        ? options.wholeWord
          ? // regex + wholeWord：保留原正则内容，但在外层加单词边界
            `\\b(?:${keyword})\\b`
          : keyword
        : // 非 regex：先转义，再加单词边界，避免用户输入把正则语法打乱
          `\\b${escapeRegExp(keyword)}\\b`

      try {
        return new RegExp(source, flags).test(text)
      } catch {
        return false
      }
    }

    // 普通字符串匹配：按包含关系判断，支持大小写敏感/不敏感
    return options.caseSensitive
      ? text.includes(keyword)
      : text.toLowerCase().includes(keyword.toLowerCase())
  }

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
        const group = getPortGroup(port)
        const key = `${node.id}:${port.id}`
        const portInfo: UnconnectedPortInfo = {
          nodeId: node.id,
          portId: port.id,
          group: port.group,
        }
        if (group === 'in') {
          unconnectedInPorts.set(key, portInfo)
        } else if (group === 'out') {
          unconnectedOutPorts.set(key, portInfo)
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
        const srcCell = edge.getSourceCellId()
        const src = edge.getSourcePortId()
        const tgtCell = edge.getTargetCellId()
        const tgt = edge.getTargetPortId()
        if (srcCell && src) unconnectedOutPorts.delete(`${srcCell}:${src}`)
        if (tgtCell && tgt) unconnectedInPorts.delete(`${tgtCell}:${tgt}`)
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
   * svg字符串转换为路径数据，提取d属性值
   * @param svg import svg from url
   * @returns svg Path
   */
  function svgToPath(svg: string): string | null {
    const match = svg.match(/\bd="([^"]+)"/)
    if (match) {
      return match[1]
    } else {
      console.error('无法解析 SVG 路径', { svg })
      return null
    }
  }
  /**
   * 获取 port group 分组
   * @param port
   * @returns group 分组 'in' | 'out' | null
   */
  function getPortGroup(
    port: { group?: string } | undefined | null,
  ): 'in' | 'out' | null {
    if (!port?.group) return null
    const lower = port.group.toLowerCase()
    if (lower.startsWith('in')) return 'in'
    if (lower.startsWith('out')) return 'out'
    return null
  }
  /**
   * 根据已有标签生成唯一标签
   * @param rawLabel 原始 label
   * @param labels 已存在的 labels
   * @param allowOneSelf 是否允许当前 label 已存在一次
   */
  function getUniqueLabel(
    rawLabel: string,
    labels: string[],
    allowOneSelf = false,
  ): string {
    const usedCount = labels.filter((label) => label === rawLabel).length
    if (allowOneSelf ? usedCount <= 1 : usedCount === 0) return rawLabel

    const existingLabels = new Set(labels)
    const baseLabel = rawLabel.replace(/\d+$/, '')
    let counter = 1
    while (existingLabels.has(`${baseLabel}${counter}`)) counter++
    return `${baseLabel}${counter}`
  }

  /**
   * 判断标签在指定子图内是否唯一
   * @param rawLabel 原始 label
   * @param subGraphId 子图 ID
   */
  function isLabelUnique(rawLabel: string, subGraphId: string): boolean {
    const labels =
      useSubGraphStore
        .getState()
        .subGraphs[subGraphId]?.graphJson.cells.filter(
          (cell) => cell.shape !== 'edge',
        )
        .map((cell) => cell.attrs?.label?.text)
        .filter((label): label is string => typeof label === 'string') ?? []

    return labels.filter((label) => label === rawLabel).length <= 1
  }

  /**
   * 确保标签在指定子图内唯一，重复时自动递增
   * @param rawLabel 原始 label
   * @param subGraphId 子图 ID
   */
  function ensureLabelUnique(rawLabel: string, subGraphId: string): string {
    const labels =
      useSubGraphStore
        .getState()
        .subGraphs[subGraphId]?.graphJson.cells.filter(
          (cell) => cell.shape !== 'edge',
        )
        .map((cell) => cell.attrs?.label?.text)
        .filter((label): label is string => typeof label === 'string') ?? []

    return getUniqueLabel(rawLabel, labels, true)
  }

  /**
   * 复制文本到剪贴板
   * - string 直接复制
   * - 对象/数组自动 JSON.stringify
   */
  async function copyText(data: any): Promise<void> {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)

    if (!navigator.clipboard?.writeText) {
      throw new Error(
        '当前环境不支持 Clipboard API（需现代浏览器或 HTTPS/localhost）',
      )
    }

    return navigator.clipboard.writeText(text)
  }
  return {
    resize,
    isTextMatched,
    getUnconnectedPorts,
    isMouseOutCell,
    getNodeAtPoint,
    addPort,
    svgToPath,
    getPortGroup,
    getUniqueLabel,
    ensureLabelUnique,
    isLabelUnique,
    copyText,
  }
}

export { createCommonService }
