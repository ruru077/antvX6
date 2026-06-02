import { Graph } from '@antv/x6'
import { getTextBlockMarkup } from '@antv/x6/es/shape/text-block'

const _getTextBlockMarkup = getTextBlockMarkup(true)

// ── DiagramModel ─────────────────────────────────────────────────────────────
// 最小调试沙盒：验证 text-block / foreignObject + contenteditable 双击编辑效果。
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

    // ── 测试节点：两个 foreignObject 文本，分别位于 50% 和 100% ── //
    const node = graph.addNode({
      shape: 'text-block',
      x: 100,
      y: 100,
      width: 160,
      height: 60,
      markup: [
        {
          tagName: 'rect',
          selector: 'body',
        },
        {
          ..._getTextBlockMarkup,
          selector: 'label_centerFo',
          children: [
            {
              ..._getTextBlockMarkup.children![0],
              selector: 'label_center',
              style: {
                ..._getTextBlockMarkup.children![0].style,
                transform: 'translate(0, -50%)',
              },
            },
          ],
        },
        {
          ..._getTextBlockMarkup,
          selector: 'label_bottomFo',
          children: [
            {
              ..._getTextBlockMarkup.children![0],
              selector: 'label_bottom',
            },
          ],
        },
      ],
      attrs: {
        body: {
          style: { filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))' },
        },
        // 第一个文本：相当于 refY: 50%
        label_centerFo: {
          refWidth: '100%',
          refHeight: null,
          refY: '50%',
        },
        // 第二个文本：相当于 refY: 100%
        label_bottomFo: {
          refWidth: '100%',
          refHeight: null,
          refY: '100%',
          refY2: 5,
        },
        label_center: {
          text: 'click to edit (50%)',
        },
        label_bottom: {
          text: 'click to edit (100%)',
        },
      },
    })
    // ── addNode 后用 rAF 等视图真正挂载到 DOM，再取 selectors ─────── //
    // node:added 触发时 view 尚未 mount，selectors 为空；rAF 保证 DOM 就绪。
    requestAnimationFrame(() => {
      const view = graph.findViewByCell(node)
      if (!view) return
      const selectors = view._getSelectors()

      const setupEditableLabel = (selector: string, attrPath: string) => {
        const labelDiv = selectors[selector]
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
          whiteSpace: 'pre',
          marginLeft: '50%',
          transform:
            selector === 'label_center'
              ? 'translate(-50%, -50%)'
              : 'translateX(-50%)',
        })

        // 阻止 mousedown 冒泡，防止 X6 把 label 区域的点击解读为拖拽
        labelDiv.addEventListener('mousedown', (ev) => ev.stopPropagation())

        // focus/blur 只切换描边
        labelDiv.addEventListener('focus', () => {
          labelDiv.style.outline = '2px solid #20cde3'
        })
        labelDiv.addEventListener('blur', () => {
          labelDiv.style.outline = 'none'
          node.attr(attrPath, labelDiv.textContent ?? '')
          // 失焦时清除文本选区
          window.getSelection()?.removeAllRanges()
        })
      }

      setupEditableLabel('label_center', 'label_center/text')
      setupEditableLabel('label_bottom', 'label_bottom/text')
    })
    graph.on('node:click', ({ view, e }) => {
      const target = e.target
      console.log(view)
      const els = Object.values(view._getSelectors()).flat()
      const dom = els.find((el) => el.contains(target))
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
