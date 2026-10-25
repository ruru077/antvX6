import { isFunctionBlock } from './model'
import type { LadDropTarget } from './drag'
import type { LadElement, LadNetwork, LadProgram } from './model'

const LEAF_W = 124
const LEAF_H = 86
const GAP = 24
export function measureElement(element: LadElement): {
  width: number
  height: number
} {
  if (element.type === 'contact' || element.type === 'not')
    return { width: LEAF_W, height: LEAF_H }
  if (isFunctionBlock(element)) return { width: 188, height: 148 }
  const boxes = (element.children ?? []).map(measureElement)
  if (!boxes.length) return { width: LEAF_W, height: LEAF_H }
  if (element.type === 'series')
    return {
      width: boxes.reduce((sum, box) => sum + box.width, 0),
      height: Math.max(...boxes.map((box) => box.height)),
    }
  return {
    width: Math.max(...boxes.map((box) => box.width)) + 48,
    height:
      boxes.reduce((sum, box) => sum + box.height, 0) +
      GAP * (boxes.length - 1),
  }
}

export type CanvasPoint = { x: number; y: number }
export type CanvasRect = CanvasPoint & { width: number; height: number }
export type LadDropZone = CanvasRect & {
  target: LadDropTarget
  label: string
  marker: 'vertical' | 'horizontal' | 'coil'
  anchor: CanvasPoint
  priority: number
}
export type LadCanvasRow = {
  network: LadNetwork
  index: number
  y: number
  box: { width: number; height: number }
  top: number
  height: number
}
export function layoutCanvas(program: LadProgram) {
  const width =
    Math.max(
      540,
      ...program.networks.map((n) => measureElement(n.condition).width),
    ) + 264
  let top = 45
  const rows: LadCanvasRow[] = program.networks.map((network, index) => {
    const box = measureElement(network.condition),
      height = box.height + 60
    const row = {
      network,
      index,
      y: top + 28 + box.height / 2,
      box,
      top,
      height,
    }
    top += height
    return row
  })
  return { width, height: top + 20, bottom: top, rows }
}
export function dropTargetKey(target: LadDropTarget): string {
  return target.kind === 'network'
    ? `network:${target.index}`
    : target.kind === 'coil'
      ? `coil:${target.networkId}`
      : `element:${target.networkId}:${target.elementId}:${target.mode}`
}

/** Uses exactly the symbol layout coordinates; no DOM element order determines a drop. */
export function canvasDropZones(program: LadProgram): LadDropZone[] {
  const { width, rows, bottom } = layoutCanvas(program),
    zones: LadDropZone[] = []
  function elementZones(
    network: LadNetwork,
    element: LadElement,
    x: number,
    y: number,
    depth: number,
  ) {
    const size = measureElement(element),
      leaf = !['series', 'parallel'].includes(element.type)
    for (const mode of ['before', 'after'] as const) {
      const cx = mode === 'before' ? x : x + size.width
      zones.push({
        x: cx - 12,
        y: y - 25,
        width: 24,
        height: 50,
        anchor: { x: cx, y },
        target: {
          kind: 'element',
          networkId: network.id,
          elementId: element.id,
          mode,
        },
        label:
          element.type === 'series'
            ? mode === 'before'
              ? '在此串联组内开头插入'
              : '在此串联组内末尾插入'
            : mode === 'before'
              ? '在此元件前串联插入'
              : '在此元件后串联插入',
        marker: 'vertical',
        priority: (leaf ? 200 : 100) + depth,
      })
    }
    const mode = element.type === 'parallel' ? 'branch' : 'parallel'
    const cy = y + size.height / 2 + 8
    zones.push({
      x: x + 12,
      y: cy - 9,
      width: Math.max(28, size.width - 24),
      height: 18,
      anchor: { x: x + size.width / 2, y: cy },
      target: {
        kind: 'element',
        networkId: network.id,
        elementId: element.id,
        mode,
      },
      label:
        mode === 'branch' ? '在此并联组追加支路' : '在此元件下方添加并联支路',
      marker: 'horizontal',
      priority: 150 + depth,
    })
    if (element.type === 'series') {
      let offset = x
      for (const child of element.children ?? []) {
        elementZones(network, child, offset, y, depth + 1)
        offset += measureElement(child).width
      }
    } else if (element.type === 'parallel') {
      let top = y - size.height / 2
      for (const child of element.children ?? []) {
        const box = measureElement(child)
        elementZones(network, child, x + 22, top + box.height / 2, depth + 1)
        top += box.height + GAP
      }
    }
  }
  for (const row of rows) {
    elementZones(row.network, row.network.condition, 96, row.y, 1)
    zones.push({
      x: width - 172,
      y: row.y - 43,
      width: 88,
      height: 86,
      anchor: { x: width - 128, y: row.y },
      target: { kind: 'coil', networkId: row.network.id },
      label: '替换此网络的输出线圈',
      marker: 'coil',
      priority: 300,
    })
  }
  for (let index = 0; index <= rows.length; index++) {
    const y = (rows[index]?.top ?? bottom) - 6
    zones.push({
      x: 8,
      y: y - 10,
      width: width - 16,
      height: 20,
      anchor: { x: 96, y },
      target: { kind: 'network', index },
      label: index === 0 ? '移到第一条网络之前' : `移到第 ${index} 条网络之后`,
      marker: 'horizontal',
      priority: 400,
    })
  }
  return zones
}

export function pointInside(point: CanvasPoint, rect: CanvasRect): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  )
}

/** At a shared boundary prefer the deepest element, then "before", irrespective of enumeration order. */
export function hitTestCanvasDrop(
  zones: readonly LadDropZone[],
  point: CanvasPoint,
): LadDropZone | null {
  const distance = (zone: LadDropZone) =>
    zone.marker === 'vertical'
      ? Math.abs(point.x - zone.anchor.x)
      : zone.marker === 'horizontal'
        ? Math.abs(point.y - zone.anchor.y)
        : 0
  return (
    zones
      .filter((zone) => pointInside(point, zone))
      .sort(
        (a, b) =>
          distance(a) - distance(b) ||
          b.priority - a.priority ||
          (a.target.kind === 'element' && a.target.mode === 'before' ? -1 : 0) -
            (b.target.kind === 'element' && b.target.mode === 'before'
              ? -1
              : 0) ||
          dropTargetKey(a.target).localeCompare(dropTargetKey(b.target)),
      )[0] ?? null
  )
}

/** Inverse screen CTM handles CSS scale, browser zoom, and the current scroll translation. */
export function clientPointToSvg(
  point: CanvasPoint,
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
): CanvasPoint | null {
  const { a, b, c, d, e, f } = matrix,
    determinant = a * d - b * c
  if (
    ![point.x, point.y, a, b, c, d, e, f, determinant].every(Number.isFinite) ||
    Math.abs(determinant) < 1e-12
  )
    return null
  const x = point.x - e,
    y = point.y - f
  return { x: (d * x - c * y) / determinant, y: (-b * x + a * y) / determinant }
}

export function edgeScrollDelta(
  point: CanvasPoint,
  viewport: CanvasRect,
): CanvasPoint {
  if (!pointInside(point, viewport)) return { x: 0, y: 0 }
  const speed = (value: number, start: number, length: number) => {
    const threshold = Math.min(36, length / 4)
    if (value < start + threshold)
      return -12 * (1 - (value - start) / threshold)
    if (value > start + length - threshold)
      return 12 * (1 - (start + length - value) / threshold)
    return 0
  }
  return {
    x: speed(point.x, viewport.x, viewport.width),
    y: speed(point.y, viewport.y, viewport.height),
  }
}
