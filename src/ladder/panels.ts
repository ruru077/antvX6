export type LadPanel = 'left' | 'right' | 'bottom'
export type LadPanelSizes = Record<LadPanel, number>
export type LadPanelViewport = {
  bodyWidth: number
  centerHeight: number
  canvasChromeHeight?: number
}

export const LAD_PANELS_STORAGE_KEY = 'm2plink.ladder.panels.v1'
export const LAD_PANEL_SEPARATOR_SIZE = 6
export const LAD_PANEL_DEFAULTS: Readonly<LadPanelSizes> = {
  left: 188,
  right: 242,
  bottom: 280,
}
const MINIMUM = { left: 140, right: 180, bottom: 120 }
const MAXIMUM = { left: 480, right: 520, bottom: 800 }
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))
const dimension = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0

/** UI preferences only; they never enter the model, undo history, or runtime state. */
export function sanitizePanelSizes(value: unknown): LadPanelSizes {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const read = (panel: LadPanel) => {
    const size = Object.hasOwn(source, panel) ? source[panel] : undefined
    return typeof size === 'number' && Number.isFinite(size)
      ? Math.round(clamp(size, 0, MAXIMUM[panel]))
      : LAD_PANEL_DEFAULTS[panel]
  }
  return { left: read('left'), right: read('right'), bottom: read('bottom') }
}

export function parsePanelPreferences(raw: string | null): LadPanelSizes {
  if (!raw || raw.length > 2048) return { ...LAD_PANEL_DEFAULTS }
  try {
    const value: unknown = JSON.parse(raw)
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Object.hasOwn(value, 'version') ||
      (value as { version?: unknown }).version !== 1
    )
      return { ...LAD_PANEL_DEFAULTS }
    return sanitizePanelSizes((value as { sizes?: unknown }).sizes)
  } catch {
    return { ...LAD_PANEL_DEFAULTS }
  }
}

export function serializePanelPreferences(sizes: LadPanelSizes): string {
  return JSON.stringify({ version: 1, sizes: sanitizePanelSizes(sizes) })
}

/** Preserve 320 px of drawing space when possible, 160 px before compressing sidebars. */
export function sidebarBudget(bodyWidth: number): number {
  const usable = Math.max(
    0,
    dimension(bodyWidth) - LAD_PANEL_SEPARATOR_SIZE * 2,
  )
  const canvas = Math.min(
    usable,
    clamp(usable - MINIMUM.left - MINIMUM.right, 160, 320),
  )
  return Math.max(0, usable - canvas)
}

function maximumBottom(viewport: LadPanelViewport): number {
  const chrome = Number.isFinite(viewport.canvasChromeHeight)
    ? Math.max(0, viewport.canvasChromeHeight!)
    : 31
  return Math.max(
    0,
    Math.min(
      MAXIMUM.bottom,
      dimension(viewport.centerHeight) -
        chrome -
        160 -
        LAD_PANEL_SEPARATOR_SIZE,
    ),
  )
}

/** Viewport fitting does not overwrite saved preferences; widening restores the preferred sizes. */
export function fitPanelSizes(
  preferences: LadPanelSizes,
  viewport: LadPanelViewport,
): LadPanelSizes {
  const preferred = sanitizePanelSizes(preferences)
  let left = clamp(preferred.left, MINIMUM.left, MAXIMUM.left)
  let right = clamp(preferred.right, MINIMUM.right, MAXIMUM.right)
  const budget = sidebarBudget(viewport.bodyWidth)
  if (left + right > budget) {
    if (budget >= MINIMUM.left + MINIMUM.right) {
      const leftRoom = left - MINIMUM.left,
        rightRoom = right - MINIMUM.right
      const remaining = budget - MINIMUM.left - MINIMUM.right
      const totalRoom = leftRoom + rightRoom
      left = MINIMUM.left + (totalRoom ? (remaining * leftRoom) / totalRoom : 0)
      right = budget - left
    } else {
      left = (budget * MINIMUM.left) / (MINIMUM.left + MINIMUM.right)
      right = budget - left
    }
  }
  const bottomMax = maximumBottom(viewport)
  return {
    left: Math.floor(left),
    right: Math.floor(right),
    bottom: Math.floor(
      clamp(preferred.bottom, Math.min(MINIMUM.bottom, bottomMax), bottomMax),
    ),
  }
}

export function panelRange(
  panel: LadPanel,
  sizes: LadPanelSizes,
  viewport: LadPanelViewport,
) {
  const max = Math.floor(
    panel === 'bottom'
      ? maximumBottom(viewport)
      : Math.max(
          0,
          Math.min(
            MAXIMUM[panel],
            sidebarBudget(viewport.bodyWidth) -
              sizes[panel === 'left' ? 'right' : 'left'],
          ),
        ),
  )
  return { min: Math.min(MINIMUM[panel], max, sizes[panel]), max }
}

export function resizePanel(
  sizes: LadPanelSizes,
  panel: LadPanel,
  desired: number,
  viewport: LadPanelViewport,
): LadPanelSizes {
  const current = fitPanelSizes(sizes, viewport),
    range = panelRange(panel, current, viewport)
  return {
    ...current,
    [panel]: Number.isFinite(desired)
      ? Math.round(clamp(desired, range.min, range.max))
      : current[panel],
  }
}

export function panelPointerSize(
  panel: LadPanel,
  startSize: number,
  startX: number,
  startY: number,
  x: number,
  y: number,
): number {
  return (
    startSize +
    (panel === 'left'
      ? x - startX
      : panel === 'right'
        ? startX - x
        : startY - y)
  )
}

export function panelKeyboardDelta(
  panel: LadPanel,
  key: string,
  shift: boolean,
): number | null {
  const step = shift ? 40 : 10
  if (panel === 'bottom')
    return key === 'ArrowUp' ? step : key === 'ArrowDown' ? -step : null
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
  return (key === 'ArrowRight' ? 1 : -1) * (panel === 'left' ? 1 : -1) * step
}
