import { RED, RIGHT_DRAG_COPY_THRESHOLD } from '@/assets/constant'
import { previewLinkAttrs } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { connectAvailablePorts } from '@/services/connection-service'
import {
  clearEdgeInsertionPreview,
  commitEdgeInsertion,
  updateEdgeInsertionPreview,
} from '@/services/edge-insertion-service'
import { routeAllEdges } from '@/services/routing-service'
import {
  rightEdgeDragging,
  setRightEdgeDragging,
  setSuppressDomContextMenu,
  suppressDomContextMenu,
} from '@/store/flags'
import { useTouchTerminal } from '@/utils/hooks/useTouchTerminal'
import { setHoverEdgeToolsVisible } from '@/utils/plugin/edgeToolVisibility'
import type { Cell, Edge, EdgeView, EventArgs, Graph, Node } from '@antv/x6'

type EdgeMouseDownEvent = EventArgs['edge:mousedown']['e']

const commonService = createCommonService()
const primaryModifierKey = commonService.getPrimaryModifeierByDevice()

type PointerGesture =
  | {
      type: 'edge-branch'
      edge: Edge
      edgeView: EdgeView
      downEvent: EdgeMouseDownEvent | null
      startX: number
      startY: number
      pageX: number
      pageY: number
      dragging: boolean
    }
  | {
      type: 'cell-copy'
      button: 0 | 2
      sourceCells: Cell[]
      startX: number
      startY: number
      lastPoint: { x: number; y: number } | null
      cloneCells: Cell[] | null
      insertionNode: Node | null
      batchStarted: boolean
      hideSelectionOverlay: boolean
      connectionSourceNode: Node | null
      targetNode: Node | null
    }

type CellCopyGesture = Extract<PointerGesture, { type: 'cell-copy' }>

type RegisteredPointerGestures = {
  setRightEdgeDragEvent: (
    edge: Edge,
    edgeView: EdgeView,
    e: EdgeMouseDownEvent,
  ) => void
  dispose: () => void
}

/**
 * 注册必须先于 X6 处理的原生鼠标手势。
 * 右键与 Ctrl/Command 共用 Cell 复制流程；Ctrl 未形成拖拽时转为模块连接。
 */
function registerPointerGestures(
  graph: Graph,
  onGraphMouseMove: (e: MouseEvent) => void,
): RegisteredPointerGestures {
  const scroller = graph.getPlugin('scroller') as
    | { togglePanning: (pannable?: boolean) => void }
    | undefined
  let gesture: PointerGesture | null = null

  let selectionOverlayVisibility: Array<{
    element: HTMLElement
    visibility: string
  }> | null = null

  function setSelectionOverlayVisibility(visible: boolean) {
    if (visible) {
      selectionOverlayVisibility?.forEach(({ element, visibility }) => {
        element.style.visibility = visibility
      })
      selectionOverlayVisibility = null
      return
    }

    if (selectionOverlayVisibility !== null) return

    const selection = graph.container.querySelector<HTMLElement>(
      '.x6-widget-selection',
    )
    if (!selection) return

    const elements = [
      selection,
      selection.querySelector<HTMLElement>('.x6-widget-selection-inner'),
      selection.querySelector<HTMLElement>('.x6-widget-selection-content'),
    ].filter((element): element is HTMLElement => element !== null)
    selectionOverlayVisibility = elements.map((element) => ({
      element,
      visibility: element.style.visibility,
    }))
    elements.forEach((element) => {
      element.style.visibility = 'hidden'
    })
  }

  const graphView = graph.view
  const originalGuard = graphView.guard.bind(graphView)
  graphView.guard = (e, view) => {
    if (e.type === 'mousedown' && e.button === 2 && view?.cell?.isEdge?.()) {
      return false
    }
    return originalGuard(e, view)
  }

  function setRightEdgeDragEvent(
    edge: Edge,
    edgeView: EdgeView,
    e: EdgeMouseDownEvent,
  ) {
    if (gesture?.type !== 'edge-branch' || gesture.edge.id !== edge.id) return
    gesture.edgeView = edgeView
    gesture.downEvent = e
  }

  function onMouseDown(e: MouseEvent) {
    const view = graph.findViewByElem(e.target as Element)
    if (view?.cell?.isEdge?.() && (e.button === 2 || e[primaryModifierKey])) {
      scroller?.togglePanning(false)
      if (e.button === 2) {
        const edge = view.cell as Edge
        if (edge.getAttrs()?.line?.stroke === RED) return
        gesture = {
          type: 'edge-branch',
          edge,
          edgeView: view as EdgeView,
          downEvent: null,
          startX: e.clientX,
          startY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          dragging: false,
        }
      }
      e.preventDefault()
      return
    }

    const target = e.target instanceof Element ? e.target : null
    const isRightDrag = e.button === 2
    const isCtrlDrag = e.button === 0 && e[primaryModifierKey]
    if (!isRightDrag && !isCtrlDrag) return
    if (target?.closest('.x6-port')) return

    const isSelectionContent = !!target?.closest('.x6-widget-selection-content')
    const isSelectionContainer =
      !isSelectionContent && !!target?.closest('.x6-widget-selection-inner')
    const selectedCells = graph.getSelectedCells().slice()

    if (view?.cell?.isNode?.()) {
      const node = view.cell as Node
      const isNodeSelected = selectedCells.some((cell) => cell.id === node.id)
      const sourceCells = isNodeSelected ? selectedCells : [node]
      const selectedNodes = selectedCells.filter((cell) => cell.isNode())
      if (!isNodeSelected) graph.resetSelection([node])

      gesture = {
        type: 'cell-copy',
        button: isCtrlDrag ? 0 : 2,
        sourceCells,
        startX: e.clientX,
        startY: e.clientY,
        lastPoint: null,
        cloneCells: null,
        insertionNode: null,
        batchStarted: false,
        hideSelectionOverlay:
          sourceCells.filter((cell) => cell.isNode()).length > 1,
        connectionSourceNode:
          isCtrlDrag && selectedNodes.length === 1
            ? (selectedNodes[0] as Node)
            : null,
        targetNode: isCtrlDrag ? node : null,
      }
      if (gesture.hideSelectionOverlay) {
        setSelectionOverlayVisibility(false)
      }
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (!isSelectionContainer || selectedCells.length === 0) return
    gesture = {
      type: 'cell-copy',
      button: isCtrlDrag ? 0 : 2,
      sourceCells: selectedCells,
      startX: e.clientX,
      startY: e.clientY,
      lastPoint: null,
      cloneCells: null,
      insertionNode: null,
      batchStarted: false,
      hideSelectionOverlay:
        selectedCells.filter((cell) => cell.isNode()).length > 1,
      connectionSourceNode: null,
      targetNode: null,
    }
    if (gesture.hideSelectionOverlay) {
      setSelectionOverlayVisibility(false)
    }
    e.preventDefault()
    e.stopPropagation()
  }

  function startRightEdgeDrag(e: MouseEvent) {
    const state = gesture
    if (state?.type !== 'edge-branch' || e.buttons !== 2) return

    const dx = e.clientX - state.startX
    const dy = e.clientY - state.startY
    if (!state.dragging && Math.hypot(dx, dy) < RIGHT_DRAG_COPY_THRESHOLD) {
      return
    }
    if (!state.dragging) {
      if (!state.downEvent) return

      const key = `__${graph.view.cid}__`
      const dragData = state.downEvent.data?.[key]
      if (!dragData) return

      const startPosition = graph.pageToLocal(state.pageX, state.pageY)
      const ratio = state.edgeView.getClosestPointRatio(startPosition) ?? 0.5
      const temporaryEdge = graph.addEdge({
        source: {
          cell: state.edge.id,
          anchor: { name: 'ratio', args: { ratio } },
        },
        target: { x: startPosition.x, y: startPosition.y },
        ...previewLinkAttrs,
      })
      graph.resetSelection([state.edge, temporaryEdge])
      const temporaryEdgeView = graph.findViewByCell(temporaryEdge) as EdgeView
      temporaryEdgeView.setEventData(
        state.downEvent,
        temporaryEdgeView.prepareArrowheadDragging('target', {
          x: startPosition.x,
          y: startPosition.y,
          isNewEdge: true,
          fallbackAction: 'remove',
        }),
      )
      dragData.currentView = temporaryEdgeView
      // 拉出 Branch 时只隐藏箭头和 ratio anchor，常驻 EdgeEdit/label 保持不变。
      setHoverEdgeToolsVisible(graph, state.edge.id, false)
    }

    state.dragging = true
    setRightEdgeDragging(true)
    setSuppressDomContextMenu(true)
    e.preventDefault()
  }

  function startOrMoveCellCopy(e: MouseEvent) {
    const state = gesture
    if (state?.type !== 'cell-copy') return

    const pressedButton = state.button === 0 ? 1 : 2
    if ((e.buttons & pressedButton) === 0) return

    if (!state.cloneCells) {
      const dx = e.clientX - state.startX
      const dy = e.clientY - state.startY
      if (Math.hypot(dx, dy) < RIGHT_DRAG_COPY_THRESHOLD) return

      const sourceBBox = graph.getCellsBBox(state.sourceCells)
      if (!sourceBBox) throw new Error('Drag-copy source cells bbox is missing')

      const cloneMap = graph.model.cloneSubGraph(state.sourceCells)
      const cloneCells = Object.values(cloneMap).sort(
        (a, b) => Number(a.isEdge()) - Number(b.isEdge()),
      )
      const position = graph.pageToLocal(e.pageX, e.pageY)
      const sourceCenter = sourceBBox.getCenter()
      const offsetX = position.x - sourceCenter.x
      const offsetY = position.y - sourceCenter.y
      cloneCells.forEach((cell) => cell.translate(offsetX, offsetY))
      graph.startBatch('copy-cell')
      state.batchStarted = true
      graph.model.addCells(cloneCells)
      graph.resetSelection(cloneCells)
      if (state.hideSelectionOverlay) setSelectionOverlayVisibility(false)

      state.cloneCells = cloneCells
      state.lastPoint = position
      state.insertionNode =
        cloneCells.length === 1 && cloneCells[0].isNode() ? cloneCells[0] : null
      graph.container.style.cursor = 'copy'
      if (state.button === 2) setSuppressDomContextMenu(true)
    }

    e.preventDefault()
    const cloneCells = state.cloneCells
    const lastPoint = state.lastPoint
    if (!cloneCells || !lastPoint) {
      throw new Error('Drag-copy cells are missing')
    }
    const position = graph.pageToLocal(e.pageX, e.pageY)
    if (state.insertionNode) {
      const size = state.insertionNode.getSize()
      state.insertionNode.position(
        position.x - size.width / 2,
        position.y - size.height / 2,
        { ignore: true, undo: false },
      )
    } else {
      const offsetX = position.x - lastPoint.x
      const offsetY = position.y - lastPoint.y
      cloneCells.forEach((cell) => cell.translate(offsetX, offsetY))
    }
    state.lastPoint = position
    if (state.insertionNode) {
      updateEdgeInsertionPreview(graph, state.insertionNode)
    }
  }

  function onMouseMove(e: MouseEvent) {
    startRightEdgeDrag(e)
    if (rightEdgeDragging) e.preventDefault()
    startOrMoveCellCopy(e)
  }

  async function finishCellCopy(state: CellCopyGesture, e: MouseEvent) {
    try {
      e.preventDefault()
      const position = graph.pageToLocal(e.pageX, e.pageY)
      const lastPoint = state.lastPoint
      if (!lastPoint) throw new Error('Drag-copy position is missing')
      const cloneCells = state.cloneCells
      if (!cloneCells) throw new Error('Drag-copy cells are missing')

      if (state.insertionNode) {
        const size = state.insertionNode.getSize()
        state.insertionNode.position(
          position.x - size.width / 2,
          position.y - size.height / 2,
          { ignore: true, undo: false },
        )
      } else {
        const offsetX = position.x - lastPoint.x
        const offsetY = position.y - lastPoint.y
        cloneCells.forEach((cell) => cell.translate(offsetX, offsetY))
      }

      if (state.insertionNode) {
        updateEdgeInsertionPreview(graph, state.insertionNode)
        const committed = await commitEdgeInsertion(graph, state.insertionNode)
        if (!committed) await routeAllEdges(graph)
      } else {
        clearEdgeInsertionPreview(graph)
        await routeAllEdges(graph)
      }
    } finally {
      if (state.hideSelectionOverlay) setSelectionOverlayVisibility(true)
      if (state.batchStarted) {
        state.batchStarted = false
        graph.stopBatch('copy-cell')
      }
    }
  }

  function finishCtrlClick(state: CellCopyGesture, e: MouseEvent) {
    if (state.hideSelectionOverlay) setSelectionOverlayVisibility(true)
    if (!state.connectionSourceNode || !state.targetNode) return

    const releasePoint = graph.clientToLocal(e.clientX, e.clientY)
    if (!state.targetNode.getBBox().containsPoint(releasePoint)) return
    void connectAvailablePorts(
      graph,
      state.connectionSourceNode,
      state.targetNode,
    )
  }

  function onMouseUp(e: MouseEvent) {
    setRightEdgeDragging(false)
    scroller?.togglePanning(true)
    if (gesture?.type === 'edge-branch') {
      gesture = null
      return
    }
    if (gesture?.type !== 'cell-copy' || e.button !== gesture.button) return

    const state = gesture
    gesture = null
    graph.container.style.cursor = ''
    if (state.cloneCells) void finishCellCopy(state, e)
    else finishCtrlClick(state, e)
  }

  function onContextMenu(e: MouseEvent) {
    if (!suppressDomContextMenu) return
    e.preventDefault()
    e.stopPropagation()
    setSuppressDomContextMenu(false)
  }

  const container = graph.container
  container.addEventListener('mousemove', onGraphMouseMove)
  container.addEventListener('mousedown', onMouseDown, true)
  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('mouseup', onMouseUp, true)
  container.addEventListener('contextmenu', onContextMenu, true)

  function dispose() {
    graphView.guard = originalGuard
    container.removeEventListener('mousemove', onGraphMouseMove)
    container.removeEventListener('mousedown', onMouseDown, true)
    document.removeEventListener('mousemove', onMouseMove, true)
    document.removeEventListener('mouseup', onMouseUp, true)
    container.removeEventListener('contextmenu', onContextMenu, true)
    clearEdgeInsertionPreview(graph)
    if (gesture?.type === 'cell-copy' && gesture.hideSelectionOverlay) {
      setSelectionOverlayVisibility(true)
    }
    if (gesture?.type === 'cell-copy' && gesture.cloneCells) {
      graph.removeCells(gesture.cloneCells, { ignore: true, undo: false })
    }
    if (gesture?.type === 'cell-copy' && gesture.batchStarted) {
      gesture.batchStarted = false
      graph.stopBatch('copy-cell')
    }
    gesture = null
    graph.container.style.cursor = ''
    setRightEdgeDragging(false)
    scroller?.togglePanning(true)
    setSuppressDomContextMenu(false)
  }

  return { dispose, setRightEdgeDragEvent }
}

/** 将原生鼠标手势注册绑定到 React 生命周期。 */
function useDomListener(
  graph: Graph | null,
  onGraphMouseMove: (e: MouseEvent) => void,
  cancelGraphMouseMove: () => void,
) {
  const touchTerminal = useTouchTerminal()
  const gesturesRef = useRef<RegisteredPointerGestures | null>(null)

  function setRightEdgeDragEvent(
    edge: Edge,
    edgeView: EdgeView,
    e: EdgeMouseDownEvent,
  ) {
    gesturesRef.current?.setRightEdgeDragEvent(edge, edgeView, e)
  }

  useEffect(() => {
    if (!graph || touchTerminal) return

    const gestures = registerPointerGestures(graph, onGraphMouseMove)
    gesturesRef.current = gestures

    return () => {
      cancelGraphMouseMove()
      gestures.dispose()
      if (gesturesRef.current === gestures) gesturesRef.current = null
    }
  }, [graph, onGraphMouseMove, cancelGraphMouseMove, touchTerminal])

  return setRightEdgeDragEvent
}

export { useDomListener }
