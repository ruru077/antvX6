import { Graph, Node } from '@antv/x6'
import type {
  PortLayoutCommonArgs,
  PortLayoutResult,
  Rectangle,
} from '@antv/x6'
import { Button, Input, Space } from 'antd'

interface LeftArcArgs extends PortLayoutCommonArgs {
  compensateRotate?: boolean
  start?: number
  range?: number
  dr?: number
  [key: string]: unknown
}

// ── 自定义 leftArc port 布局 ────────────────────────────────────────────────
// 左半弧: 从底部 → 左侧 → 顶部, 跨度随端口数自适应
Graph.registerPortLayout(
  'leftArc',
  (
    portsArgs: LeftArcArgs[],
    elemBBox: Rectangle,
    groupArgs: LeftArcArgs,
  ): PortLayoutResult[] => {
    const count = portsArgs.length
    const range = groupArgs.range ?? Math.min(180, (count - 1) * 90)
    const startAngle = groupArgs.start ?? 180 // 首个端口从底部开始
    const step = count > 1 ? range / (count - 1) : 0

    const center = elemBBox.getCenter()
    const topCenter = elemBBox.getTopCenter()
    const ratio = elemBBox.width / elemBBox.height

    return portsArgs.map((item, idx) => {
      const angle = startAngle + idx * step
      const p = topCenter.clone().rotate(-angle, center).scale(ratio, 1, center)

      // 箭头旋转 180° + 计算指向圆心方向
      const dx = center.x - p.x
      const dy = center.y - p.y
      const mathAngle = Math.atan2(dy, dx) * (180 / Math.PI)
      const theta = item.compensateRotate ? 180 + mathAngle + 180 : 0

      if (item.dx || item.dy) p.translate(item.dx || 0, item.dy || 0)
      if (item.dr) p.move(center, item.dr)
      return { angle: theta, position: p.round().toJSON() }
    })
  },
)

// ── Simulink Sum 端口图形 path ──────────────────────────────────────────────
// 输入箭头: 尖端在原点(0,0), 指向左, compensateRotate 旋转到朝向圆心
const PORT_ARROW_IN = 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z'

// sign 标记颜色
const PLUS_COLOR = '#13c2c2'
const MINUS_COLOR = '#fa8c16'

// ── DiagramModel4 ────────────────────────────────────────────────────────────
// 验证: Simulink Sum block + leftArc 布局 + 动态增删端口
function DiagramModel() {
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const nodeRef = useRef<Node | null>(null)
  const [signs, setSigns] = useState('+-') // e.g. "+-", "++-", "+++-+"

  // ── 同步端口: 按 signs 字符串重建 in 端口 ── //
  function syncPorts(node: Node, signStr: string) {
    const chars = signStr.split('')
    node
      .getPorts()
      .filter((p) => p.group === 'in')
      .forEach((p) => node.removePort(p.id!))
    chars.forEach((ch) => {
      node.addPort({
        group: 'in',
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: PORT_ARROW_IN },
          },
        ],
        attrs: {
          portLabel: { text: ch, fill: ch === '+' ? PLUS_COLOR : MINUS_COLOR },
        },
      })
    })
  }

  useEffect(() => {
    if (!graphContainerRef.current) return

    const graph = new Graph({
      container: graphContainerRef.current,
      autoResize: true,
      grid: { visible: true, size: 15 },
    })

    const node = graph.addNode({
      shape: 'ellipse', // 用 ellipse + refRX=refRY='50%' → circle
      x: 300,
      y: 220,
      width: 1600,
      height: 1600,
      label: 'Sum',
      markup: [
        { tagName: 'ellipse', selector: 'body' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: {
          refRX: '50%',
          refRY: '50%',
          refCX: '50%',
          refCY: '50%',
          fill: '#fff',
          stroke: '#000',
          strokeWidth: 2,
          filter: {
            name: 'dropShadow',
            args: {
              dx: 2.5,
              dy: 2.5,
              blur: 1.25,
              color: '#000',
              opacity: 0.55,
            },
          },
        },
        label: {
          fill: '#000',
          refX: '50%',
          refY: '120%',
          fontSize: 14,
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
        },
      },
      ports: {
        groups: {
          in: {
            position: {
              name: 'leftArc',
              args: { compensateRotate: true } as LeftArcArgs,
            },
            label: {
              position: { name: 'radial', args: { offset: -30 } },
              markup: [{ tagName: 'text', selector: 'portLabel' }],
            },
            attrs: {
              text: {}, // ← existPortLabel 硬编码检查
              portBody: {
                magnet: true,
                fill: '#000',
                stroke: '#000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
            },
          },
          out: {
            position: { name: 'right' },
            label: { position: { name: 'radial' } },
            attrs: {
              portBody: {
                magnet: true,
                fill: '#000',
                stroke: '#000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
            },
          },
        },
        items: [{ group: 'out', id: 'out' }],
      },
    })

    nodeRef.current = node

    // 根据 signs 字符串初始化端口
    syncPorts(node, signs)

    return () => graph.dispose()
  }, [])

  // ── 控制 ── //
  const handleSignsChange = (val: string) => {
    const filtered = val.replace(/[^+-]/g, '')
    setSigns(filtered || '+')
    const node = nodeRef.current
    if (node) syncPorts(node, filtered || '+')
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Space style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
        <span style={{ color: '#666', fontSize: 13 }}>端口符号:</span>
        <Input
          size="small"
          style={{ width: 120 }}
          value={signs}
          onChange={(e) => handleSignsChange(e.target.value)}
          placeholder="e.g. ++-+"
        />
        <Button size="small" onClick={() => handleSignsChange(signs + '+')}>
          追加 +
        </Button>
        <Button size="small" onClick={() => handleSignsChange(signs + '-')}>
          追加 -
        </Button>
        <Button
          size="small"
          danger
          onClick={() => {
            if (signs.length <= 1) return
            handleSignsChange(signs.slice(0, -1))
          }}
        >
          移除
        </Button>
      </Space>
      <div ref={graphContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default DiagramModel
export { DiagramModel as Component } // Router Lazy
