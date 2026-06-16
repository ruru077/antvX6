import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { Node } from '@antv/x6'

/** lucide arrow-big-down */
const ARROW_D =
  'M9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 0 1 1h3.293a.707.707 0 0 1 .5 1.207l-7.086 7.086a1 1 0 0 1-1.414 0l-7.086-7.086a.707.707 0 0 1 .5-1.207H8a1 1 0 0 0 1-1z'

const NS = 'http://www.w3.org/2000/svg'

function svgEl(tag: string, attrs: Record<string, string> = {}) {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

/**
 * 在子系统节点右下角添加「查看内部封装」箭头。
 * 直接追加到节点自身的 SVG container 内（非 tools 层），
 * 继承节点的 z-order，被其他节点遮挡时箭头一并被遮挡。
 */
export function addMaskToNode(node: Node) {
  const graph = useGraphStore.getState().graph
  const view = graph.findViewByCell(node)
  if (!view) return

  const g = svgEl('g', { class: 'subsystem-mask' })

  const title = svgEl('title')
  title.textContent = '查看内部封装'

  const rect = svgEl('rect', {
    width: '20',
    height: '20',
    rx: '4',
    fill: 'transparent',
    'stroke-width': '1',
    style: 'cursor:pointer',
  })

  const path = svgEl('path', {
    d: ARROW_D,
    fill: '#D1D1D1',
    stroke: '#AEAEAE',
    'stroke-width': '2',
    transform: 'translate(2, 3) scale(0.75)',
    style: 'cursor:pointer',
  })

  g.append(title, rect, path)

  const bbox = node.getBBox()
  g.setAttribute(
    'transform',
    `translate(${bbox.width - 22}, ${bbox.height - 22})`,
  )

  g.addEventListener('click', (e) => {
    e.stopPropagation()
    useSubGraphStore.getState().changeGraphView(node.id)
  })

  view.container.appendChild(g)
}
