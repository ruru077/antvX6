import { Graph } from '@antv/x6'

// ── Simulink 端口箭头 path ─────────────────────────────────────────────────
const ARROW_LEFT = 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z' // 左入
const ARROW_BOTTOM = 'M 0 0 -5 9 -3 9 0 3 3 9 5 9 z' // 下入
const ARROW_RIGHT = 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z' // 右出

// ── DiagramModel5 ────────────────────────────────────────────────────────────
// 只验证 label 位置: 固定 left/bottom/right 端口 + inside label
function DiagramModel() {
  const graphContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!graphContainerRef.current) return

    const graph = new Graph({
      container: graphContainerRef.current,
      autoResize: true,
      grid: { visible: true, size: 15 },
    })

    graph.addNode({
      shape: 'ellipse',
      x: 300,
      y: 220,
      width: 60,
      height: 60,
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
          inAdd: {
            position: { name: 'left' },
            label: {
              position: { name: 'inside', args: { offset: 5 } },
              markup: [{ tagName: 'text', selector: 'portLabel' }],
            },
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: { d: ARROW_LEFT },
              },
            ],
            attrs: {
              text: {}, // ← existPortLabel 硬编码检查 port.attrs.text，必须有此 key
              portBody: {
                magnet: true,
                fill: '#000',
                stroke: '#000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
              portLabel: { fontSize: 18, fontWeight: 'bold', fill: '#13c2c2' },
            },
          },
          inSub: {
            position: { name: 'bottom' },
            label: {
              position: { name: 'inside', args: { offset: 3 } },
              markup: [{ tagName: 'text', selector: 'portLabel' }],
            },
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: { d: ARROW_BOTTOM },
              },
            ],
            attrs: {
              text: {}, // ← existPortLabel 硬编码检查
              portBody: {
                magnet: true,
                fill: '#000',
                stroke: '#000',
                strokeWidth: 10,
                strokeOpacity: 0,
              },
              portLabel: { fontSize: 18, fontWeight: 'bold', fill: '#fa8c16' },
            },
          },
          out: {
            position: { name: 'right' },
            label: { position: { name: 'right' } },
            markup: [
              {
                tagName: 'path',
                selector: 'portBody',
                attrs: { d: ARROW_RIGHT },
              },
            ],
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
        items: [
          { group: 'inAdd', attrs: { portLabel: { text: '+' } } },
          { group: 'inSub', attrs: { portLabel: { text: '-' } } },
          { group: 'out' },
        ],
      },
    })

    return () => graph.dispose()
  }, [])

  return (
    <div ref={graphContainerRef} style={{ width: '100%', height: '100%' }} />
  )
}

export default DiagramModel
export { DiagramModel as Component } // Router Lazy
