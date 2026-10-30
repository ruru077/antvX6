import { EdgeView } from '@antv/x6'
import type { Graph } from '@antv/x6'

/**
 * Chrome 不遵循 shape-rendering: crispEdges，画布缩放（如 120%）或平移后，
 * Edge 折线的设备像素坐标常落在 .25/.75 上，1px 描边会被抗锯齿成 2 行灰色，
 * 选中时 feMorphology 滤镜还会把它放大成"模糊 + 色偏"。
 * 这里把折线顶点吸附到设备像素中心（整数 + 0.5），1px 描边即可锐利渲染。
 *
 * 只改写 DOM 中的 d，不触碰 Model / 路由结果；X6 重绘后会重新吸附。
 */

const ONLY_LINE_SEGMENTS = /^[ML\d\s.,-]+$/
const NUMBER_PAIR = /(-?[\d.]+)[\s,]+(-?[\d.]+)/g

const cache = new WeakMap<SVGPathElement, { orig: string; snapped: string }>()

function snap(value: number, scale: number, offset: number) {
  if (!scale) return value
  return (Math.floor(scale * value + offset) + 0.5 - offset) / scale
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}

function snapPath(path: SVGPathElement): boolean {
  const current = path.getAttribute('d')
  if (!current || !ONLY_LINE_SEGMENTS.test(current)) return true
  const ctm = path.getCTM()
  if (!ctm) return false
  // 带旋转/倾斜时无法对齐到像素网格
  if (ctm.b || ctm.c) return true

  let entry = cache.get(path)
  if (!entry || entry.snapped !== current) {
    entry = { orig: current, snapped: current }
  }
  const snapped = entry.orig.replace(NUMBER_PAIR, (_, x, y) => {
    const sx = round(snap(Number(x), ctm.a, ctm.e))
    const sy = round(snap(Number(y), ctm.d, ctm.f))
    return `${sx} ${sy}`
  })
  entry.snapped = snapped
  cache.set(path, entry)
  if (snapped !== current) path.setAttribute('d', snapped)
  return true
}

function snapEdgeView(view: EdgeView) {
  const paths = view.container.querySelectorAll<SVGPathElement>(':scope > path')
  let pending = false
  paths.forEach((path) => {
    if (!snapPath(path)) pending = true
  })
  return pending
}

const edgeViewProto = EdgeView.prototype as unknown as Record<string, any>

if (!edgeViewProto._pixelSnapPatched) {
  const originalUpdate = edgeViewProto.update as (
    this: EdgeView,
    ...args: unknown[]
  ) => unknown
  edgeViewProto.update = function (this: EdgeView, ...args: unknown[]) {
    const result = originalUpdate.apply(this, args)
    // 首次渲染时容器可能还未挂到 DOM，getCTM 为空，下一帧再吸附。
    if (snapEdgeView(this)) {
      requestAnimationFrame(() => snapEdgeView(this))
    }
    return result
  }
  edgeViewProto._pixelSnapPatched = true
}

/** 缩放/平移会改变设备像素对齐，需要对现有 Edge 重新吸附。 */
export function registerEdgePixelSnap(graph: Graph) {
  let frame = 0
  const snapAll = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      graph.getEdges().forEach((edge) => {
        const view = graph.findViewByCell(edge) as EdgeView | null
        if (view) snapEdgeView(view)
      })
    })
  }
  graph.on('scale', snapAll)
  graph.on('translate', snapAll)
  snapAll()
  return () => {
    graph.off('scale', snapAll)
    graph.off('translate', snapAll)
    if (frame) cancelAnimationFrame(frame)
  }
}
