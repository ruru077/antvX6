import { Dom } from '@antv/x6'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import { toggleMountedStencilGroup } from '@/services/stencil-service'
import { isTouchArrowheadDragging } from '@/touch/graph/touch-arrowhead-tool'
import { closeContextMenu } from '@/touch/service/context-menu-controller-service'
import { getPlacementHandler } from '@/touch/service/placement-interaction-service'
import { GUARD_BLOCK_TYPES } from '@/utils/hof/withNodeGuard'
import type { CellView, Graph, Node, Scroller, Selection } from '@antv/x6'

const LONG_PRESS_DELAY = 450
const TAP_DELAY = 300
const MOVE_TOLERANCE = 8
const DOUBLE_TAP_DISTANCE = 24
const PINCH_ZOOM_STEP = 0.05
const PINCH_ACTIVATION_DISTANCE = 12
const PINCH_ACTIVATION_RATIO = 0.06
const TWO_FINGER_PAN_ACTIVATION_DISTANCE = 8
const TOUCH_COMPAT_CLICK_DELAY = 700
const STENCIL_TOGGLE_SELECTOR = '.x6-widget-stencil-group-title'

type TapPart = 'blank' | 'body' | 'label'

interface TapTarget {
  key: string
  part: TapPart
  cellId: string | null
  element: Element
}

interface ActiveTouch {
  identifier: number
  startX: number
  startY: number
  moved: boolean
  longPressActive: boolean
  longPressTimer: number | null
  startEvent: TouchEvent
  target: TapTarget
}

interface PendingTap {
  target: TapTarget
  clientX: number
  clientY: number
  time: number
  timer: number | null
}

interface PinchState {
  mode: 'pending' | 'pan' | 'zoom'
  startCenter: { x: number; y: number }
  zoomAnchor: { x: number; y: number }
  startScrollPosition: { left: number; top: number }
  startTranslation: { x: number; y: number }
  lastCenter: { x: number; y: number }
  startDistance: number
  startScale: number
}

function createTouchEventObject(event: TouchEvent) {
  return new Dom.EventObject(event as any, {
    type: event.type,
  }) as any
}

interface TouchRubberbandState {
  data: unknown
  selectionImpl: {
    normalizeEvent: (e: unknown) => { data?: unknown }
    stopSelecting: (e: unknown) => void
  }
}

const touchRubberbandStates = new WeakMap<Graph, TouchRubberbandState>()

/** 终止 X6 已经持有的单指 Graph/Scroller 手势。 */
function cancelTouchGraphGesture(graph: Graph, event: TouchEvent) {
  const normalizedEvent = createTouchEventObject(event)
  const graphView = graph.view as unknown as Record<string, Function>
  graphView.undelegateDocumentEvents()
  graphView.delegateEvents()

  const scroller = graph.getPlugin<Scroller>('scroller') as unknown as
    | { scrollerImpl?: { stopPanning: (e: unknown) => void } }
    | undefined
  scroller?.scrollerImpl?.stopPanning(normalizedEvent)
}

/** 空白长按成立后，直接把当前触控事件交给 Selection 开始框选。 */
function startTouchRubberband(graph: Graph, event: TouchEvent) {
  const selection = graph.getPlugin<Selection>('selection') as unknown as
    | {
        selectionImpl?: {
          normalizeEvent: (e: unknown) => { data?: unknown }
          startSelecting: (e: unknown) => void
          stopSelecting: (e: unknown) => void
        }
      }
    | undefined
  if (!selection?.selectionImpl) return false

  cancelTouchGraphGesture(graph, event)
  const startEvent = createTouchEventObject(event)
  const normalizedStartEvent =
    selection.selectionImpl.normalizeEvent(startEvent)
  selection.selectionImpl.startSelecting(startEvent)
  touchRubberbandStates.set(graph, {
    data: normalizedStartEvent.data,
    selectionImpl: selection.selectionImpl,
  })
  return true
}

/** 手指离开时使用同一框选会话数据结束 Selection。 */
function stopTouchRubberband(graph: Graph, event: TouchEvent) {
  const state = touchRubberbandStates.get(graph)
  if (!state) return false

  const endEvent = createTouchEventObject(event)
  const normalizedEndEvent = state.selectionImpl.normalizeEvent(endEvent)
  normalizedEndEvent.data = state.data
  state.selectionImpl.stopSelecting(normalizedEndEvent)
  touchRubberbandStates.delete(graph)
  return true
}

/** X6 Selection 的 touchend 未把归一化事件传给 stopSelecting，这里显式结束移动会话。 */
function stopTouchSelectionTranslation(graph: Graph, event: TouchEvent) {
  const selection = graph.getPlugin<Selection>('selection') as unknown as
    | {
        selectionImpl?: {
          normalizeEvent: (e: unknown) => { data?: unknown }
          setEventData: (e: unknown, data: { action: 'translating' }) => void
          stopSelecting: (e: unknown) => void
        }
      }
    | undefined
  if (!selection?.selectionImpl) return false

  const endEvent = createTouchEventObject(event)
  const normalizedEndEvent = selection.selectionImpl.normalizeEvent(endEvent)
  selection.selectionImpl.setEventData(normalizedEndEvent, {
    action: 'translating',
  })
  selection.selectionImpl.stopSelecting(normalizedEndEvent)
  return true
}

const commonService = createCommonService()
const interactiveService = createInteractiveService()

function distanceBetween(first: Touch, second: Touch) {
  return Math.hypot(
    second.clientX - first.clientX,
    second.clientY - first.clientY,
  )
}

function getTouchCenter(first: Touch, second: Touch) {
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  }
}

function getScrollerViewportPoint(
  scroller: Scroller,
  clientPoint: {
    x: number
    y: number
  },
) {
  const container = scroller.container
  const rect = container.getBoundingClientRect()
  return {
    x: clientPoint.x - rect.left - container.clientLeft,
    y: clientPoint.y - rect.top - container.clientTop,
  }
}

/** 缩放后保持手势中心下的画布坐标不变，避免 Scroller.centerPoint 累积补边与取整误差。 */
function applyPinchZoom(
  graph: Graph,
  scroller: Scroller,
  pinch: PinchState,
  scale: number,
) {
  graph.transform.scale(scale, scale, 0, 0, false)

  const matrix = graph.matrix()
  const scaleDelta = scale - pinch.startScale
  scroller.setScrollbarPosition(
    pinch.startScrollPosition.left +
      pinch.zoomAnchor.x * scaleDelta +
      matrix.e -
      pinch.startTranslation.x,
    pinch.startScrollPosition.top +
      pinch.zoomAnchor.y * scaleDelta +
      matrix.f -
      pinch.startTranslation.y,
  )
}

function isTouchToolTarget(target: Element) {
  return !!target.closest(
    [
      '.x6-port',
      '.x6-cell-tools',
      '.x6-widget-selection',
      '.x6-widget-transform',
      '[contenteditable="true"]',
      '[contenteditable="plaintext-only"]',
      'input',
      'textarea',
      'button',
    ].join(','),
  )
}

function isSelectionMoveTarget(target: Element) {
  if (
    target.closest(
      'button, input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]',
    )
  )
    return false
  return !!target.closest(
    '.x6-widget-selection-box, .x6-widget-selection-inner',
  )
}

function getTapTarget(graph: Graph, rawTarget: EventTarget | null) {
  if (!(rawTarget instanceof Element)) return null
  if (isTouchToolTarget(rawTarget)) return null

  const view = graph.findViewByElem(rawTarget) as CellView | null
  if (!view) {
    if (!graph.container.contains(rawTarget)) return null
    return {
      key: 'blank',
      part: 'blank',
      cellId: null,
      element: rawTarget,
    } satisfies TapTarget
  }

  const cell = view.cell
  const label = cell.isNode()
    ? commonService.isDblClickOnLabel(view, rawTarget)
    : false
  const part: TapPart = label ? 'label' : 'body'
  return {
    key: `${cell.isNode() ? 'node' : 'edge'}:${cell.id}:${part}`,
    part,
    cellId: cell.id,
    element: rawTarget,
  } satisfies TapTarget
}

function getLiveTarget(graph: Graph, target: TapTarget) {
  if (target.element.isConnected) return target.element
  if (!target.cellId) return graph.container

  const cell = graph.getCellById(target.cellId)
  if (!cell) return graph.container
  const view = graph.findViewByCell(cell)
  if (!view) return graph.container
  if (target.part === 'label') {
    return view._getSelectors()?.['label'] ?? view.container
  }
  return view.container
}

function isSameTap(
  pending: PendingTap,
  target: TapTarget,
  clientX: number,
  clientY: number,
) {
  return (
    pending.target.key === target.key &&
    performance.now() - pending.time <= TAP_DELAY &&
    Math.hypot(clientX - pending.clientX, clientY - pending.clientY) <=
      DOUBLE_TAP_DISTANCE
  )
}

function openSubsystemLabelEditor(graph: Graph, target: TapTarget) {
  if (target.part !== 'label' || !target.cellId) return false
  const cell = graph.getCellById(target.cellId)
  if (!cell?.isNode() || !GUARD_BLOCK_TYPES.includes(cell.getData()?.blockType))
    return false

  const view = graph.findViewByCell(cell)
  const label = view?._getSelectors()?.['label']
  if (!label) return false
  interactiveService.openLabelEditor(cell as Node, label)
  return true
}

function registerTouchInteractions(graph: Graph) {
  const scrollerPlugin = graph.getPlugin<Scroller>('scroller')
  if (!scrollerPlugin) throw new Error('Touch interaction requires Scroller')
  const scroller: Scroller = scrollerPlugin

  let activeTouch: ActiveTouch | null = null
  let pendingTap: PendingTap | null = null
  let pinch: PinchState | null = null
  let ignoreUntilAllTouchesEnd = false
  let selectionMoveTouchId: number | null = null
  let suppressNativeDblClickUntil = 0
  let doubleTapTimer: number | null = null
  let lastStencilTouchToggle: {
    element: Element
    groupName: string
    identifier: number
    startX: number
    startY: number
    moved: boolean
    time: number
  } | null = null
  let suppressedStencilCompatibilityClick: {
    element: Element
    clientX: number
    clientY: number
    time: number
  } | null = null

  function clearLongPress() {
    if (activeTouch?.longPressTimer != null) {
      window.clearTimeout(activeTouch.longPressTimer)
      activeTouch.longPressTimer = null
    }
  }

  function clearPendingTap() {
    if (pendingTap?.timer != null) window.clearTimeout(pendingTap.timer)
    pendingTap = null
  }

  function pausePendingTap() {
    if (pendingTap?.timer != null) {
      window.clearTimeout(pendingTap.timer)
      pendingTap.timer = null
    }
  }

  function dispatchContextMenu(tap: PendingTap) {
    const target = getLiveTarget(graph, tap.target)
    target.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: tap.clientX,
        clientY: tap.clientY,
      }),
    )
  }

  function scheduleContextMenu(
    target: TapTarget,
    clientX: number,
    clientY: number,
  ) {
    clearPendingTap()
    const tap: PendingTap = {
      target,
      clientX,
      clientY,
      time: performance.now(),
      timer: null,
    }
    tap.timer = window.setTimeout(() => {
      if (pendingTap !== tap) return
      pendingTap = null
      dispatchContextMenu(tap)
    }, TAP_DELAY)
    pendingTap = tap
  }

  function dispatchDoubleTap(
    target: TapTarget,
    clientX: number,
    clientY: number,
  ) {
    suppressNativeDblClickUntil = performance.now() + TAP_DELAY
    if (doubleTapTimer != null) window.clearTimeout(doubleTapTimer)
    doubleTapTimer = window.setTimeout(() => {
      doubleTapTimer = null
      if (openSubsystemLabelEditor(graph, target)) return
      getLiveTarget(graph, target).dispatchEvent(
        new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
        }),
      )
    })
  }

  function commitTap(target: TapTarget, clientX: number, clientY: number) {
    const previous = pendingTap
    if (previous && isSameTap(previous, target, clientX, clientY)) {
      clearPendingTap()
      dispatchDoubleTap(target, clientX, clientY)
      return
    }
    scheduleContextMenu(target, clientX, clientY)
  }

  function beginLongPress() {
    const current = activeTouch
    if (!current || current.target.part !== 'blank' || current.moved) return
    clearPendingTap()
    closeContextMenu(graph, { sync: true })
    current.longPressActive = startTouchRubberband(graph, current.startEvent)
  }

  function startPinch(event: TouchEvent) {
    if (
      selectionMoveTouchId != null ||
      activeTouch?.longPressActive ||
      (activeTouch != null && activeTouch.target.part !== 'blank') ||
      event.touches.length < 2
    )
      return false
    clearLongPress()
    clearPendingTap()
    closeContextMenu(graph, { sync: true })
    cancelTouchGraphGesture(graph, event)
    const first = event.touches[0]
    const second = event.touches[1]
    const center = getTouchCenter(first, second)
    const zoomViewportCenter = getScrollerViewportPoint(scroller, center)
    const matrix = graph.matrix()
    pinch = {
      mode: 'pending',
      startCenter: center,
      zoomAnchor: scroller.clientToLocalPoint(
        zoomViewportCenter.x,
        zoomViewportCenter.y,
      ),
      startScrollPosition: scroller.getScrollbarPosition(),
      startTranslation: { x: matrix.e, y: matrix.f },
      lastCenter: center,
      startDistance: distanceBetween(first, second),
      startScale: graph.zoom(),
    }
    activeTouch = null
    ignoreUntilAllTouchesEnd = true
    return true
  }

  function onTouchStart(event: TouchEvent) {
    if (isTouchArrowheadDragging(graph)) {
      clearLongPress()
      clearPendingTap()
      activeTouch = null
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (event.touches.length >= 2) {
      if (startPinch(event)) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }
    if (ignoreUntilAllTouchesEnd) return

    pausePendingTap()
    const touch = event.changedTouches[0]
    if (
      touch &&
      event.target instanceof Element &&
      isSelectionMoveTarget(event.target)
    ) {
      clearLongPress()
      clearPendingTap()
      activeTouch = null
      selectionMoveTouchId = touch.identifier
      return
    }
    const target = getTapTarget(graph, event.target)
    if (!touch || !target) {
      activeTouch = null
      clearPendingTap()
      return
    }

    activeTouch = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      moved: false,
      longPressActive: false,
      longPressTimer: null,
      startEvent: event,
      target,
    }
    if (target.part === 'blank') {
      activeTouch.longPressTimer = window.setTimeout(
        beginLongPress,
        LONG_PRESS_DELAY,
      )
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (isTouchArrowheadDragging(graph)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (pinch && event.touches.length >= 2) {
      const first = event.touches[0]
      const second = event.touches[1]
      const distance = distanceBetween(first, second)
      if (pinch.startDistance <= 0) return

      const center = getTouchCenter(first, second)
      const activationDistance = Math.max(
        PINCH_ACTIVATION_DISTANCE,
        pinch.startDistance * PINCH_ACTIVATION_RATIO,
      )
      if (pinch.mode === 'pending') {
        const panProgress =
          Math.hypot(
            center.x - pinch.startCenter.x,
            center.y - pinch.startCenter.y,
          ) / TWO_FINGER_PAN_ACTIVATION_DISTANCE
        const zoomProgress =
          Math.abs(distance - pinch.startDistance) / activationDistance
        if (panProgress >= 1 || zoomProgress >= 1) {
          pinch.mode = zoomProgress > panProgress ? 'zoom' : 'pan'
        }
      }

      if (pinch.mode === 'pan') {
        const dx = center.x - pinch.lastCenter.x
        const dy = center.y - pinch.lastCenter.y
        if (dx !== 0 || dy !== 0) {
          const position = scroller.getScrollbarPosition()
          scroller.setScrollbarPosition(position.left - dx, position.top - dy)
          pinch.lastCenter = center
        }
      } else if (pinch.mode === 'zoom') {
        const rawScale = Math.min(
          5,
          Math.max(0.5, pinch.startScale * (distance / pinch.startDistance)),
        )
        const scale = Number(
          (Math.round(rawScale / PINCH_ZOOM_STEP) * PINCH_ZOOM_STEP).toFixed(2),
        )
        if (scale !== graph.zoom()) {
          applyPinchZoom(graph, scroller, pinch, scale)
        }
      }
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const current = activeTouch
    if (!current || current.longPressActive) return
    const touch = Array.from(event.touches).find(
      (item) => item.identifier === current.identifier,
    )
    if (!touch) return
    if (
      Math.hypot(
        touch.clientX - current.startX,
        touch.clientY - current.startY,
      ) < MOVE_TOLERANCE
    ) {
      return
    }

    current.moved = true
    clearLongPress()
    clearPendingTap()
  }

  function finishTouch(event: TouchEvent) {
    if (isTouchArrowheadDragging(graph)) {
      clearLongPress()
      clearPendingTap()
      activeTouch = null
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (
      selectionMoveTouchId != null &&
      Array.from(event.changedTouches).some(
        (touch) => touch.identifier === selectionMoveTouchId,
      )
    ) {
      selectionMoveTouchId = null
      stopTouchSelectionTranslation(graph, event)
      clearPendingTap()
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (pinch) {
      event.preventDefault()
      event.stopPropagation()
      if (event.touches.length < 2) pinch = null
      if (event.touches.length === 0) ignoreUntilAllTouchesEnd = false
      return
    }
    if (ignoreUntilAllTouchesEnd) {
      if (event.touches.length === 0) ignoreUntilAllTouchesEnd = false
      return
    }

    const current = activeTouch
    clearLongPress()
    activeTouch = null
    if (current?.longPressActive) {
      stopTouchRubberband(graph, event)
      clearPendingTap()
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (!current || current.moved) {
      clearPendingTap()
      return
    }

    const touch = Array.from(event.changedTouches).find(
      (item) => item.identifier === current.identifier,
    )
    if (!touch) return
    const placementHandler = getPlacementHandler(graph)
    if (placementHandler) {
      clearPendingTap()
      placementHandler(touch.clientX, touch.clientY)
      event.preventDefault()
      event.stopPropagation()
      return
    }
    commitTap(current.target, touch.clientX, touch.clientY)
  }

  function onTouchCancel(event: TouchEvent) {
    if (selectionMoveTouchId != null) {
      selectionMoveTouchId = null
      stopTouchSelectionTranslation(graph, event)
    }
    if (activeTouch?.longPressActive) {
      stopTouchRubberband(graph, event)
    }
    clearLongPress()
    clearPendingTap()
    if (doubleTapTimer != null) window.clearTimeout(doubleTapTimer)
    activeTouch = null
    pinch = null
    ignoreUntilAllTouchesEnd = false
  }

  function onNativeDblClick(event: MouseEvent) {
    if (event.isTrusted && performance.now() < suppressNativeDblClickUntil) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function onNativeContextMenu(event: MouseEvent) {
    if (!event.isTrusted) return
    event.preventDefault()
    event.stopPropagation()
  }

  function closeMenu() {
    closeContextMenu(graph)
  }

  function closeMenuBeforeCanvasPointer(event: PointerEvent) {
    if (event.pointerType !== 'touch') return
    closeContextMenu(graph, { sync: true })
  }

  function closeMenuBeforeCanvasTouch(event: TouchEvent) {
    if (!(event.target instanceof Element)) return
    if (!graph.container.contains(event.target)) {
      clearPendingTap()
      return
    }
    closeContextMenu(graph, { sync: true })
  }

  function onStencilTouchStart(event: TouchEvent) {
    if (!(event.target instanceof Element)) return
    const element = event.target.closest(STENCIL_TOGGLE_SELECTOR)
    const group = element?.closest<HTMLElement>(
      '.x6-widget-stencil-group[data-name]',
    )
    const groupName = group?.dataset.name
    const touch = event.changedTouches[0]
    if (!element || !groupName || !touch) return
    lastStencilTouchToggle = {
      element,
      groupName,
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      moved: false,
      time: performance.now(),
    }
    event.preventDefault()
    event.stopPropagation()
  }

  function onStencilTouchMove(event: TouchEvent) {
    const state = lastStencilTouchToggle
    if (!state || state.moved) return
    const touch = Array.from(event.touches).find(
      (item) => item.identifier === state.identifier,
    )
    if (!touch) return
    if (
      Math.hypot(touch.clientX - state.startX, touch.clientY - state.startY) >=
      MOVE_TOLERANCE
    ) {
      state.moved = true
    }
  }

  function onStencilTouchEnd(event: TouchEvent) {
    const state = lastStencilTouchToggle
    if (!state) return
    const touch = Array.from(event.changedTouches).find(
      (item) => item.identifier === state.identifier,
    )
    if (!touch) return

    state.time = performance.now()
    lastStencilTouchToggle = null
    if (state.moved) return
    event.preventDefault()
    event.stopPropagation()
    suppressedStencilCompatibilityClick = {
      element: state.element,
      clientX: touch.clientX,
      clientY: touch.clientY,
      time: state.time,
    }
    toggleMountedStencilGroup(state.groupName)
  }

  function onStencilTouchCancel() {
    lastStencilTouchToggle = null
    suppressedStencilCompatibilityClick = null
  }

  function onStencilCompatibilityClick(event: MouseEvent) {
    if (!event.isTrusted) return
    if (!(event.target instanceof Element)) return
    const element = event.target.closest(STENCIL_TOGGLE_SELECTOR)
    const suppressedClick = suppressedStencilCompatibilityClick
    lastStencilTouchToggle = null
    suppressedStencilCompatibilityClick = null
    if (!element || !suppressedClick) return
    if (element !== suppressedClick.element) return
    if (performance.now() - suppressedClick.time >= TOUCH_COMPAT_CLICK_DELAY)
      return
    if (
      Math.hypot(
        event.clientX - suppressedClick.clientX,
        event.clientY - suppressedClick.clientY,
      ) >= MOVE_TOLERANCE
    )
      return

    event.preventDefault()
    event.stopPropagation()
  }

  const listenerOptions: AddEventListenerOptions = {
    capture: true,
    passive: false,
  }
  graph.container.addEventListener('touchstart', onTouchStart, listenerOptions)
  graph.container.addEventListener(
    'pointerdown',
    closeMenuBeforeCanvasPointer,
    true,
  )
  graph.container.addEventListener('touchmove', onTouchMove, listenerOptions)
  graph.container.addEventListener('touchend', finishTouch, listenerOptions)
  graph.container.addEventListener(
    'touchcancel',
    onTouchCancel,
    listenerOptions,
  )
  graph.container.addEventListener('dblclick', onNativeDblClick, true)
  graph.container.addEventListener('contextmenu', onNativeContextMenu, true)
  graph.on('blank:mousemove', closeMenu)
  graph.on('cell:mousemove', closeMenu)
  graph.on('box:mousedown', closeMenu)
  graph.on('scale', closeMenu)
  graph.container.addEventListener('touchmove', closeMenu, { passive: true })
  document.addEventListener('touchstart', closeMenuBeforeCanvasTouch, true)
  document.addEventListener('touchstart', onStencilTouchStart, true)
  document.addEventListener('touchmove', onStencilTouchMove, true)
  document.addEventListener('touchend', onStencilTouchEnd, true)
  document.addEventListener('touchcancel', onStencilTouchCancel, true)
  document.addEventListener('click', onStencilCompatibilityClick, true)

  return () => {
    clearLongPress()
    clearPendingTap()
    if (doubleTapTimer != null) window.clearTimeout(doubleTapTimer)
    graph.container.removeEventListener(
      'touchstart',
      onTouchStart,
      listenerOptions,
    )
    graph.container.removeEventListener(
      'pointerdown',
      closeMenuBeforeCanvasPointer,
      true,
    )
    graph.container.removeEventListener(
      'touchmove',
      onTouchMove,
      listenerOptions,
    )
    graph.container.removeEventListener(
      'touchend',
      finishTouch,
      listenerOptions,
    )
    graph.container.removeEventListener(
      'touchcancel',
      onTouchCancel,
      listenerOptions,
    )
    graph.container.removeEventListener('dblclick', onNativeDblClick, true)
    graph.container.removeEventListener(
      'contextmenu',
      onNativeContextMenu,
      true,
    )
    graph.off('blank:mousemove', closeMenu)
    graph.off('cell:mousemove', closeMenu)
    graph.off('box:mousedown', closeMenu)
    graph.off('scale', closeMenu)
    graph.container.removeEventListener('touchmove', closeMenu)
    document.removeEventListener('touchstart', closeMenuBeforeCanvasTouch, true)
    document.removeEventListener('touchstart', onStencilTouchStart, true)
    document.removeEventListener('touchmove', onStencilTouchMove, true)
    document.removeEventListener('touchend', onStencilTouchEnd, true)
    document.removeEventListener('touchcancel', onStencilTouchCancel, true)
    document.removeEventListener('click', onStencilCompatibilityClick, true)
  }
}

export { registerTouchInteractions }
