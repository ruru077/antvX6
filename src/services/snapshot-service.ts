import { Export, Graph } from '@antv/x6'
import '@antv/x6/lib/plugin/export/api'
import type { ExportToImageOptions } from '@antv/x6/lib/plugin/export/type'
import type { GraphJSON } from '~/types'

/**
 * 离屏渲染 graphJson，返回 PNG data URL
 * 用于子系统 Block 的缩略图预览
 */
export async function snapshotToDataURL(graphJson: GraphJSON): Promise<string> {
  const container = document.createElement('div')
  container.style.cssText =
    'position:fixed;left:0;top:0;width:800px;height:600px;pointer-events:none;opacity:1;z-index:-9999;'
  document.body.appendChild(container)

  const graph = new Graph({ container, width: 800, height: 600 })
  graph.use(new Export())

  try {
    graph.fromJSON(graphJson)
  } catch (e) {
    graph.dispose()
    document.body.removeChild(container)
    throw e
  }

  // 等待一帧：fromJSON 后 cell views 需要一次 rAF 才挂载到 SVG DOM
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  // 从 cell 数据算 viewBox（照抄 CanvasToolbars 的 getExportViewBox 逻辑）
  type CellLike = {
    shape?: string
    position?: { x: number; y: number }
    size?: { width: number; height: number }
  }
  const nodeCells = (graphJson.cells as CellLike[]).filter(
    (c) => c.shape !== 'edge',
  )
  const xs = nodeCells.map((c) => c.position?.x ?? 0)
  const ys = nodeCells.map((c) => c.position?.y ?? 0)
  const x2s = nodeCells.map((c) => (c.position?.x ?? 0) + (c.size?.width ?? 0))
  const y2s = nodeCells.map((c) => (c.position?.y ?? 0) + (c.size?.height ?? 0))
  const viewBox = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...x2s) - Math.min(...xs),
    height: Math.max(...y2s) - Math.min(...ys),
  }

  const options: ExportToImageOptions = {
    padding: 30,
    backgroundColor: '#ffffff',
    copyStyles: false,
    preserveDimensions: true,
    viewBox,
  }

  try {
    const dataUrl = await graph.toPNGAsync(options)

    // 调试：下载 PNG 查看内容
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `subsystem-snapshot-${Date.now()}.png`
    a.click()

    return dataUrl
  } finally {
    graph.dispose()
    document.body.removeChild(container)
  }
}
