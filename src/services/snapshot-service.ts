import { Export, Graph } from '@antv/x6'
import { EDGE_TARGET_CP_OFFSET } from '@/assets/constant'
import {
  SUBSYSTEM_BACKGROUND_BOTTOM,
  SUBSYSTEM_BACKGROUND_TOP,
} from '@/assets/x6Model'
import type { ExportToImageOptions } from '@antv/x6/lib/plugin/export/type'
import type { GraphJSON } from '~/types'
import '@antv/x6/lib/plugin/export/api'

const SNAPSHOT_WIDTH = 800
const SNAPSHOT_HEIGHT = 600
const SNAPSHOT_PADDING_RATIO = 0.1

type SnapshotSize = {
  width: number
  height: number
}

type SnapshotViewBox = SnapshotSize & {
  x: number
  y: number
}

type SnapshotCell = {
  shape?: string
  position?: { x: number; y: number }
  size?: { width: number; height: number }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function applySnapshotSimpleView(container: HTMLElement) {
  const hiddenSelectors = [
    '.x6-node text',
    '.x6-node image',
    '.x6-node foreignObject',
    '.x6-edge text',
    '.x6-edge foreignObject',
    '.x6-port-label',
  ]

  container
    .querySelectorAll<Element>(hiddenSelectors.join(','))
    .forEach((elem) => elem.setAttribute('display', 'none'))
}

function getSnapshotViewBox(
  nodeCells: SnapshotCell[],
  targetSize: SnapshotSize,
): SnapshotViewBox {
  if (!nodeCells.length) {
    return { x: 0, y: 0, ...targetSize }
  }

  const xs = nodeCells.map((cell) => cell.position?.x ?? 0)
  const ys = nodeCells.map((cell) => cell.position?.y ?? 0)
  const x2s = nodeCells.map(
    (cell) => (cell.position?.x ?? 0) + (cell.size?.width ?? 0),
  )
  const y2s = nodeCells.map(
    (cell) => (cell.position?.y ?? 0) + (cell.size?.height ?? 0),
  )
  const contentWidth = Math.max(1, Math.max(...x2s) - Math.min(...xs))
  const contentHeight = Math.max(1, Math.max(...y2s) - Math.min(...ys))
  let width = contentWidth * (1 + SNAPSHOT_PADDING_RATIO * 2)
  let height = contentHeight * (1 + SNAPSHOT_PADDING_RATIO * 2)
  const targetRatio = targetSize.width / targetSize.height

  if (width / height > targetRatio) {
    height = width / targetRatio
  } else {
    width = height * targetRatio
  }

  const centerX = (Math.min(...xs) + Math.max(...x2s)) / 2
  const centerY = (Math.min(...ys) + Math.max(...y2s)) / 2
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  }
}

function getExportSize(targetSize: SnapshotSize): SnapshotSize {
  const ratio = targetSize.width / targetSize.height
  return ratio >= 1
    ? {
        width: SNAPSHOT_WIDTH,
        height: Math.max(1, Math.round(SNAPSHOT_WIDTH / ratio)),
      }
    : {
        width: Math.max(1, Math.round(SNAPSHOT_HEIGHT * ratio)),
        height: SNAPSHOT_HEIGHT,
      }
}

function decorateSnapshot(svg: SVGSVGElement, viewBox: SnapshotViewBox) {
  const ns = 'http://www.w3.org/2000/svg'
  const gradientId = `subsystem-snapshot-gradient-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS(ns, 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }

  const gradient = document.createElementNS(ns, 'linearGradient')
  gradient.setAttribute('id', gradientId)
  gradient.setAttribute('x1', '0')
  gradient.setAttribute('y1', '0')
  gradient.setAttribute('x2', '0')
  gradient.setAttribute('y2', '1')

  const top = document.createElementNS(ns, 'stop')
  top.setAttribute('offset', '0%')
  top.setAttribute('stop-color', SUBSYSTEM_BACKGROUND_TOP)
  const bottom = document.createElementNS(ns, 'stop')
  bottom.setAttribute('offset', '100%')
  bottom.setAttribute('stop-color', SUBSYSTEM_BACKGROUND_BOTTOM)
  gradient.append(top, bottom)
  defs.appendChild(gradient)

  const stage = svg.querySelector<SVGGElement>('.x6-graph-svg-stage')
  if (stage) {
    const background = document.createElementNS(ns, 'rect')
    background.setAttribute('x', String(viewBox.x))
    background.setAttribute('y', String(viewBox.y))
    background.setAttribute('width', String(viewBox.width))
    background.setAttribute('height', String(viewBox.height))
    background.setAttribute('fill', `url(#${gradientId})`)
    stage.insertBefore(background, stage.firstChild)
  }

  svg
    .querySelectorAll<SVGElement>(
      '.x6-node [data-selector="body"], .x6-node [data-selector="portBody"]',
    )
    .forEach((element) => {
      element.setAttribute('stroke', '#777777')
      element.setAttribute('stroke-width', '1')
    })
}

/**
 * 离屏渲染 graphJson，返回 PNG data URL
 * 用于子系统 Block 的缩略图预览
 */
export async function snapshotToDataURL(
  graphJson: GraphJSON,
  targetSize: SnapshotSize,
): Promise<string> {
  const nodeCells = ((graphJson.cells ?? []) as SnapshotCell[]).filter(
    (cell) => cell.shape !== 'edge',
  )

  const container = document.createElement('div')
  container.style.cssText = `position:fixed;left:-10000px;top:-10000px;width:${SNAPSHOT_WIDTH}px;height:${SNAPSHOT_HEIGHT}px;pointer-events:none;z-index:-1;`
  document.body.appendChild(container)

  const graph = new Graph({
    container,
    width: SNAPSHOT_WIDTH,
    height: SNAPSHOT_HEIGHT,
    interacting: false,
    connecting: {
      allowNode: false,
      // TODO Edge 拉线反接
      allowEdge: false,
      allowMulti: 'withPort',
      allowLoop: true,
      sourceConnectionPoint: 'anchor',
      targetConnectionPoint: {
        name: 'anchor',
        args: {
          offset: EDGE_TARGET_CP_OFFSET,
        },
      },
    },
  })
  graph.use(new Export())

  try {
    graph.fromJSON(graphJson)

    // fromJSON 后 cell views 需要等 DOM 挂载和 foreignObject 文本落位。
    await nextFrame()
    await nextFrame()
    applySnapshotSimpleView(container)

    const viewBox = getSnapshotViewBox(nodeCells, targetSize)
    const exportSize = getExportSize(targetSize)

    const options: ExportToImageOptions = {
      ...exportSize,
      backgroundColor: '#ffffff',
      copyStyles: false,
      viewBox,
      beforeSerialize(svg) {
        decorateSnapshot(svg, viewBox)
      },
    }

    return graph.toPNGAsync(options)
  } finally {
    graph.dispose()
    container.remove()
  }
}

export type { SnapshotSize }
