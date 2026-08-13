import { Graph } from '@antv/x6'
import { getTextBlockMarkup } from '@antv/x6/es/shape/text-block'
import { registerEdgeEditTool } from '@/utils/plugin/EdgeEditTool'

const _tmpl = getTextBlockMarkup(true)

registerEdgeEditTool()

// ── DiagramModel3 ────────────────────────────────────────────────────────────
// node label: 固定存在，空内容保留占位（可继续编辑）
// edge label: 双击 edge 动态追加，blur 时空内容则自动移除
// 访问路径: /model
// ─────────────────────────────────────────────────────────────────────────────
function DiagramModel() {
  const graphContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!graphContainerRef.current) return

    const graph = new Graph({
      container: graphContainerRef.current,
      autoResize: true,
      grid: { visible: true, size: 15 },
    })

    // ── 两个节点 + 一条边 ── //
    const node1 = graph.addNode({
      shape: 'text-block',
      x: 100,
      y: 100,
      width: 160,
      height: 60,
      markup: [
        { tagName: 'rect', selector: 'body' },
        {
          ..._tmpl,
          selector: 'label_centerFo',
          children: [
            {
              ..._tmpl.children![0],
              selector: 'label_center',
              style: {
                ..._tmpl.children![0].style!,
                transform: 'translate(0, -50%)',
              },
            },
          ],
        },
        {
          ..._tmpl,
          selector: 'label_bottomFo',
          children: [
            {
              ..._tmpl.children![0],
              selector: 'label_bottom',
            },
          ],
        },
      ],
      attrs: {
        body: {
          style: { filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))' },
        },
        label_centerFo: { refWidth: '100%', refHeight: null, refY: '50%' },
        label_bottomFo: {
          refWidth: '100%',
          refHeight: null,
          refY: '100%',
          refY2: 5,
        },
        label_center: {
          text: 'click to edit (50%)',
          style: { whiteSpace: 'pre' },
        },
        label_bottom: {
          text: 'click to edit (100%)',
          style: { whiteSpace: 'pre' },
        },
      },
    })

    const node2 = graph.addNode({
      shape: 'text-block',
      x: 380,
      y: 100,
      width: 160,
      height: 60,
      markup: [
        { tagName: 'rect', selector: 'body' },
        {
          ..._tmpl,
          selector: 'label_centerFo',
          children: [
            {
              ..._tmpl.children![0],
              selector: 'label_center',
              style: {
                ..._tmpl.children![0].style!,
                transform: 'translate(0, -50%)',
              },
            },
          ],
        },
      ],
      attrs: {
        body: { style: { filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))' } },
        label_centerFo: { refWidth: '100%', refHeight: null, refY: '50%' },
        label_center: { text: 'target', style: { whiteSpace: 'pre' } },
      },
    })

    graph.addEdge({
      source: { cell: node1.id },
      target: { cell: node2.id },
      style: { stroke: '#13c2c2', strokeWidth: 2 },
      tools: [{ name: 'edge-edit', args: { text: 'Hello' } }],
    })

    // ── node label setup（固定存在，空内容不删除） ── //
    requestAnimationFrame(() => {
      const view1 = graph.findViewByCell(node1)
      const view2 = graph.findViewByCell(node2)
      if (!view1 || !view2) return

      const setupNodeLabel = (
        view: ReturnType<typeof graph.findViewByCell>,
        cell: typeof node1,
        selector: string,
        attrPath: string,
      ) => {
        if (!view) return
        const labelDiv = view._getSelectors()[selector]
        if (!(labelDiv instanceof HTMLElement)) return
        labelDiv.contentEditable = 'plaintext-only'
        const plainText = labelDiv.textContent ?? ''
        labelDiv.replaceChildren(document.createTextNode(plainText))
        Object.assign(labelDiv.style, {
          cursor: 'text',
          userSelect: 'text',
          outline: 'none',
          width: 'fit-content',
          height: 'auto',
          marginLeft: '50%',
          transform:
            selector === 'label_center'
              ? 'translate(-50%, -50%)'
              : 'translateX(-50%)',
        })
        labelDiv.addEventListener('mousedown', (ev) => ev.stopPropagation())
        labelDiv.addEventListener('focus', () => {
          labelDiv.style.outline = '2px solid #20cde3'
        })
        labelDiv.addEventListener('blur', () => {
          labelDiv.style.outline = 'none'
          cell.attr(attrPath, labelDiv.textContent ?? '')
          window.getSelection()?.removeAllRanges()
        })
      }

      setupNodeLabel(view1, node1, 'label_center', 'label_center/text')
      setupNodeLabel(view1, node1, 'label_bottom', 'label_bottom/text')
      setupNodeLabel(view2, node2, 'label_center', 'label_center/text')
    })

    return () => {
      graph.dispose()
    }
  }, [])

  return (
    <div ref={graphContainerRef} style={{ width: '100%', height: '100%' }} />
  )
}

export default DiagramModel
export { DiagramModel as Component } // Router Lazy
