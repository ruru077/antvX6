import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import PanelResizeHandle from '../src/ladder/PanelResizeHandle'
import {
  fitPanelSizes,
  LAD_PANEL_DEFAULTS,
  LAD_PANEL_SEPARATOR_SIZE,
  LAD_PANELS_STORAGE_KEY,
  panelKeyboardDelta,
  panelPointerSize,
  panelRange,
  parsePanelPreferences,
  resizePanel,
  sanitizePanelSizes,
  serializePanelPreferences,
  sidebarBudget,
} from '../src/ladder/panels'
import type { LadPanelSizes } from '../src/ladder/panels'

const viewport = { bodyWidth: 1200, centerHeight: 640, canvasChromeHeight: 31 }

describe('LAD panel geometry without touching document or runtime state', () => {
  it('keeps the agreed default sizes with enough workspace', () => {
    expect(fitPanelSizes({ ...LAD_PANEL_DEFAULTS }, viewport)).toEqual({
      left: 188,
      right: 242,
      bottom: 280,
    })
    expect(LAD_PANEL_SEPARATOR_SIZE).toBe(6)
  })

  it('reduces the drawing-area reserve before shrinking sidebars below normal minima', () => {
    const sizes = fitPanelSizes(
      { ...LAD_PANEL_DEFAULTS },
      { ...viewport, bodyWidth: 600 },
    )
    expect(sizes.left).toBe(140)
    expect(sizes.right).toBe(180)
    expect(600 - 12 - sizes.left - sizes.right).toBe(268)
  })

  it('proportionally compresses sidebars on narrow windows and never consumes the drawing area', () => {
    for (const width of [
      13, 100, 172, 200, 300, 400, 490, 600, 652, 800, 1200, 2200,
    ]) {
      const sizes = fitPanelSizes(
        { left: 480, right: 520, bottom: 280 },
        { ...viewport, bodyWidth: width },
      )
      expect(sizes.left).toBeGreaterThanOrEqual(0)
      expect(sizes.right).toBeGreaterThanOrEqual(0)
      expect(sizes.left + sizes.right).toBeLessThanOrEqual(sidebarBudget(width))
      const canvas = width - 12 - sizes.left - sizes.right
      expect(canvas).toBeGreaterThanOrEqual(Math.min(160, width - 12))
      if (width >= 652) expect(canvas).toBeGreaterThanOrEqual(320)
    }
  })

  it('reserves center header, separator and at least 160 pixels of canvas when possible', () => {
    expect(
      fitPanelSizes(
        { ...LAD_PANEL_DEFAULTS, bottom: 800 },
        { ...viewport, centerHeight: 500 },
      ).bottom,
    ).toBe(303)
    expect(
      fitPanelSizes(
        { ...LAD_PANEL_DEFAULTS },
        { ...viewport, centerHeight: 300 },
      ).bottom,
    ).toBe(103)
    expect(
      fitPanelSizes(
        { ...LAD_PANEL_DEFAULTS },
        { ...viewport, centerHeight: 190 },
      ).bottom,
    ).toBe(0)
    expect(
      fitPanelSizes(
        { ...LAD_PANEL_DEFAULTS },
        { ...viewport, centerHeight: 500, canvasChromeHeight: 60 },
      ).bottom,
    ).toBe(274)
  })

  it('clamps one-panel resize to available space without moving another panel', () => {
    const initial = fitPanelSizes({ ...LAD_PANEL_DEFAULTS }, viewport)
    const resized = resizePanel(initial, 'left', 99999, viewport)
    expect(resized.left).toBe(480)
    expect(resized.right).toBe(initial.right)
    expect(resized.bottom).toBe(initial.bottom)
    const reduced = resizePanel(initial, 'right', -1000, viewport)
    expect(reduced.right).toBe(180)
    expect(reduced.left).toBe(initial.left)
    expect(resizePanel(initial, 'bottom', Infinity, viewport)).toEqual(initial)
  })

  it('reports a valid dynamic separator range even below normal minimum widths', () => {
    const small = { bodyWidth: 300, centerHeight: 280, canvasChromeHeight: 31 }
    const sizes = fitPanelSizes({ ...LAD_PANEL_DEFAULTS }, small)
    for (const panel of ['left', 'right', 'bottom'] as const) {
      const range = panelRange(panel, sizes, small)
      expect(range.min).toBeLessThanOrEqual(range.max)
      expect(sizes[panel]).toBeGreaterThanOrEqual(range.min)
      expect(sizes[panel]).toBeLessThanOrEqual(range.max)
      expect(
        resizePanel(sizes, panel, 10000, small)[panel],
      ).toBeLessThanOrEqual(range.max)
    }
  })

  it('keeps saved preferences unchanged when the viewport temporarily shrinks', () => {
    const preferences: LadPanelSizes = { left: 350, right: 450, bottom: 400 }
    const before = JSON.stringify(preferences)
    const small = fitPanelSizes(preferences, {
      bodyWidth: 420,
      centerHeight: 320,
    })
    expect(small.left).toBeLessThan(preferences.left)
    expect(small.bottom).toBeLessThan(preferences.bottom)
    expect(JSON.stringify(preferences)).toBe(before)
    expect(
      fitPanelSizes(preferences, { bodyWidth: 1800, centerHeight: 900 }),
    ).toEqual(preferences)
  })

  it('maps pointer movements to the panel edge, including bottom upward enlargement', () => {
    expect(panelPointerSize('left', 188, 200, 300, 240, 300)).toBe(228)
    expect(panelPointerSize('right', 242, 1000, 300, 960, 300)).toBe(282)
    expect(panelPointerSize('bottom', 280, 600, 500, 600, 450)).toBe(330)
  })

  it('uses arrows in visual edge direction and Shift for a larger step', () => {
    expect(panelKeyboardDelta('left', 'ArrowRight', false)).toBe(10)
    expect(panelKeyboardDelta('left', 'ArrowLeft', true)).toBe(-40)
    expect(panelKeyboardDelta('right', 'ArrowLeft', false)).toBe(10)
    expect(panelKeyboardDelta('right', 'ArrowRight', true)).toBe(-40)
    expect(panelKeyboardDelta('bottom', 'ArrowUp', true)).toBe(40)
    expect(panelKeyboardDelta('bottom', 'ArrowDown', false)).toBe(-10)
    expect(panelKeyboardDelta('left', 'ArrowUp', false)).toBeNull()
    expect(panelKeyboardDelta('bottom', 'Home', false)).toBeNull()
  })

  it('handles absent or nonfinite measurements without negative dimensions', () => {
    for (const width of [0, -1, NaN, Infinity]) {
      const sizes = fitPanelSizes(
        { ...LAD_PANEL_DEFAULTS },
        { bodyWidth: width, centerHeight: NaN },
      )
      expect(sizes).toEqual({ left: 0, right: 0, bottom: 0 })
    }
  })
})

describe('versioned local panel preferences and accessible handles', () => {
  it('uses a dedicated key and round-trips only known layout numbers', () => {
    expect(LAD_PANELS_STORAGE_KEY).toBe('m2plink.ladder.panels.v1')
    const sizes = { left: 230, right: 310, bottom: 360 }
    expect(parsePanelPreferences(serializePanelPreferences(sizes))).toEqual(
      sizes,
    )
    expect(Object.keys(JSON.parse(serializePanelPreferences(sizes)))).toEqual([
      'version',
      'sizes',
    ])
  })

  it('rejects malformed JSON, unsupported versions and arrays without breaking the editor', () => {
    for (const raw of [
      null,
      '',
      '{bad',
      'null',
      '[]',
      'true',
      '{"version":2,"sizes":{"left":300}}',
      '{"version":"1"}',
      'x'.repeat(2049),
    ])
      expect(parsePanelPreferences(raw)).toEqual(LAD_PANEL_DEFAULTS)
  })

  it('does not coerce strings or booleans and bounds oversized stored sizes', () => {
    expect(
      parsePanelPreferences(
        '{"version":1,"sizes":{"left":"300","right":false,"bottom":1e309}}',
      ),
    ).toEqual(LAD_PANEL_DEFAULTS)
    expect(
      sanitizePanelSizes({ left: -10, right: 999999, bottom: 299.8 }),
    ).toEqual({ left: 0, right: 520, bottom: 300 })
    expect(sanitizePanelSizes(Object.create({ left: 300 }))).toEqual(
      LAD_PANEL_DEFAULTS,
    )
    expect(
      parsePanelPreferences(
        '{"version":1,"sizes":{"left":210,"other":"ignored"}}',
      ),
    ).toEqual({ left: 210, right: 242, bottom: 280 })
  })

  it('announces separator orientation, current range and a concise name', () => {
    const vertical = renderToStaticMarkup(
      createElement(PanelResizeHandle, {
        panel: 'left',
        value: 188,
        minimum: 140,
        maximum: 480,
        active: false,
      }),
    )
    expect(vertical).toContain('role="separator"')
    expect(vertical).toContain('tabindex="0"')
    expect(vertical).toContain('aria-orientation="vertical"')
    expect(vertical).toContain('aria-label="调整左侧面板宽度"')
    expect(vertical).toContain('aria-valuenow="188"')
    expect(vertical).toContain('aria-valuemin="140"')
    expect(vertical).toContain('aria-valuemax="480"')
    const horizontal = renderToStaticMarkup(
      createElement(PanelResizeHandle, {
        panel: 'bottom',
        value: 280,
        minimum: 120,
        maximum: 443,
        active: true,
      }),
    )
    expect(horizontal).toContain('aria-orientation="horizontal"')
    expect(horizontal).toContain('is-active')
    expect(horizontal).toContain('height:6px')
  })
})
