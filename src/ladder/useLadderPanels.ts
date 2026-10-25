import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fitPanelSizes,
  LAD_PANEL_DEFAULTS,
  LAD_PANELS_STORAGE_KEY,
  panelKeyboardDelta,
  panelPointerSize,
  panelRange,
  parsePanelPreferences,
  resizePanel,
  serializePanelPreferences,
} from './panels'
import type { PanelResizeHandleProps } from './PanelResizeHandle'
import type { LadPanel, LadPanelSizes, LadPanelViewport } from './panels'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

type ResizeGesture = {
  panel: LadPanel
  pointerId: number
  element: HTMLDivElement
  startX: number
  startY: number
  startSizes: LadPanelSizes
  before: LadPanelSizes
  draft: LadPanelSizes
}
type Options = { canvasChromeHeight?: number }
type PanelStyle = CSSProperties &
  Record<
    '--lad-left-width' | '--lad-right-width' | '--lad-bottom-height',
    string
  >

function initialPreferences() {
  try {
    return parsePanelPreferences(
      typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(LAD_PANELS_STORAGE_KEY),
    )
  } catch {
    return { ...LAD_PANEL_DEFAULTS }
  }
}
function persist(sizes: LadPanelSizes) {
  try {
    window.localStorage.setItem(
      LAD_PANELS_STORAGE_KEY,
      serializePanelPreferences(sizes),
    )
  } catch {
    /* Private mode or storage policy must not prevent resizing. */
  }
}
function release(gesture: ResizeGesture) {
  try {
    if (gesture.element.hasPointerCapture(gesture.pointerId))
      gesture.element.releasePointerCapture(gesture.pointerId)
  } catch {
    /* A detached handle may already have lost its capture. */
  }
}

export function useLadderPanels(options: Options = {}) {
  const bodyRef = useRef<HTMLDivElement>(null),
    centerRef = useRef<HTMLElement>(null)
  const [preferences, setPreferences] = useState(initialPreferences)
  const preferencesRef = useRef(preferences)
  const [viewport, setViewport] = useState<LadPanelViewport>({
    bodyWidth: 1024,
    centerHeight: 640,
  })
  const dimensionsRef = useRef(viewport)
  const chromeRef = useRef(options.canvasChromeHeight ?? 31)
  chromeRef.current = options.canvasChromeHeight ?? 31
  const [activePanel, setActivePanel] = useState<LadPanel | null>(null)
  const gesture = useRef<ResizeGesture | null>(null)
  const effectiveViewport = {
    ...viewport,
    canvasChromeHeight: options.canvasChromeHeight ?? 31,
  }
  dimensionsRef.current = effectiveViewport
  const sizes = useMemo(
    () => fitPanelSizes(preferences, effectiveViewport),
    [
      preferences,
      viewport.bodyWidth,
      viewport.centerHeight,
      options.canvasChromeHeight,
    ],
  )

  const setSizes = useCallback((next: LadPanelSizes, save = false) => {
    preferencesRef.current = next
    setPreferences(next)
    if (save) persist(next)
  }, [])
  const cancel = useCallback(() => {
    const current = gesture.current
    if (!current) return
    gesture.current = null
    setSizes(current.before)
    setActivePanel(null)
    release(current)
  }, [setSizes])

  useEffect(() => {
    const measure = () => {
      const body = bodyRef.current,
        center = centerRef.current
      if (!body || !center) return
      const next = {
        bodyWidth: body.clientWidth,
        centerHeight: center.clientHeight,
        canvasChromeHeight: chromeRef.current,
      }
      dimensionsRef.current = next
      setViewport((old) =>
        old.bodyWidth === next.bodyWidth &&
        old.centerHeight === next.centerHeight
          ? old
          : next,
      )
    }
    measure()
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (bodyRef.current) observer?.observe(bodyRef.current)
    if (centerRef.current) observer?.observe(centerRef.current)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = gesture.current
      if (!current || event.pointerId !== current.pointerId) return
      event.preventDefault()
      current.draft = resizePanel(
        current.startSizes,
        current.panel,
        panelPointerSize(
          current.panel,
          current.startSizes[current.panel],
          current.startX,
          current.startY,
          event.clientX,
          event.clientY,
        ),
        dimensionsRef.current,
      )
      setSizes(current.draft)
    }
    const finish = (event: PointerEvent) => {
      const current = gesture.current
      if (!current || event.pointerId !== current.pointerId) return
      move(event)
      gesture.current = null
      const changed = (['left', 'right', 'bottom'] as const).some(
        (panel) => current.draft[panel] !== current.startSizes[panel],
      )
      setSizes(changed ? current.draft : current.before, changed)
      setActivePanel(null)
      release(current)
    }
    const cancelled = (event: PointerEvent) => {
      if (gesture.current?.pointerId === event.pointerId) cancel()
    }
    const key = (event: KeyboardEvent) => {
      if (gesture.current && event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        cancel()
      }
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancelled)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key)
    return () => {
      const current = gesture.current
      gesture.current = null
      if (current) release(current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancelled)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key)
    }
  }, [cancel, setSizes])

  const reset = useCallback(
    (panel: LadPanel) => {
      if (gesture.current) cancel()
      setSizes(
        { ...preferencesRef.current, [panel]: LAD_PANEL_DEFAULTS[panel] },
        true,
      )
    },
    [cancel, setSizes],
  )
  const start = useCallback(
    (panel: LadPanel, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !event.isPrimary || gesture.current) return
      event.preventDefault()
      event.stopPropagation()
      const element = event.currentTarget,
        startSizes = fitPanelSizes(
          preferencesRef.current,
          dimensionsRef.current,
        )
      element.focus({ preventScroll: true })
      gesture.current = {
        panel,
        pointerId: event.pointerId,
        element,
        startX: event.clientX,
        startY: event.clientY,
        startSizes,
        before: { ...preferencesRef.current },
        draft: startSizes,
      }
      setActivePanel(panel)
      try {
        element.setPointerCapture(event.pointerId)
      } catch {
        /* Window listeners also handle platforms without pointer capture. */
      }
    },
    [],
  )
  const keyboard = useCallback(
    (panel: LadPanel, event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (gesture.current) return
      if (event.key === 'Home') {
        event.preventDefault()
        event.stopPropagation()
        reset(panel)
        return
      }
      const delta = panelKeyboardDelta(panel, event.key, event.shiftKey)
      if (delta === null) return
      event.preventDefault()
      event.stopPropagation()
      const current = fitPanelSizes(
        preferencesRef.current,
        dimensionsRef.current,
      )
      setSizes(
        resizePanel(
          current,
          panel,
          current[panel] + delta,
          dimensionsRef.current,
        ),
        true,
      )
    },
    [reset, setSizes],
  )

  const getHandleProps = (panel: LadPanel): PanelResizeHandleProps => {
    const range = panelRange(panel, sizes, effectiveViewport)
    return {
      panel,
      value: sizes[panel],
      minimum: range.min,
      maximum: range.max,
      active: activePanel === panel,
      onPointerDown: (event) => start(panel, event),
      onKeyDown: (event) => keyboard(panel, event),
      onDoubleClick: (event) => {
        event.preventDefault()
        event.stopPropagation()
        reset(panel)
      },
      onLostPointerCapture: (event) => {
        if (
          gesture.current?.pointerId === event.pointerId &&
          gesture.current.element === event.currentTarget
        )
          cancel()
      },
    }
  }
  const style: PanelStyle = {
    '--lad-left-width': sizes.left + 'px',
    '--lad-right-width': sizes.right + 'px',
    '--lad-bottom-height': sizes.bottom + 'px',
  }
  return { bodyRef, centerRef, style, sizes, activePanel, getHandleProps }
}
