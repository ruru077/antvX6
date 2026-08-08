import { RED, RIGHT_DRAG_COPY_THRESHOLD } from '@/assets/constant'
import { previewLinkAttrs } from '@/assets/x6Model'
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
import type { Cell, Edge, EdgeView, Graph, Node } from '@antv/x6'

type RightDragEdge = {
  edge: Edge
  edgeView: EdgeView
  downEvent: any
  startX: number
  startY: number
  pageX: number
  pageY: number
  dragging: boolean
}

/**
 * 原生 DOM 事件监听 hook
 *
 * useGraphListener 只负责 X6 的 graph.on 事件；这里集中处理 X6 之外的
 * addEventListener 事件，包括右键 edge 拉线前置状态、右键拖拽复制 cells、
 * 以及浏览器原生 contextmenu 抑制。
 */
function useDomListener(
  graph: Graph | null,
  onGraphMouseMove: (e: MouseEvent) => void,
  cancelGraphMouseMove: () => void,
) {
  const rightDragEdgeRef = useRef<RightDragEdge | null>(null)

  function setRightEdgeDragEvent(edge: Edge, edgeView: EdgeView, e: any) {
    const state = rightDragEdgeRef.current
    if (!state || state.edge.id !== edge.id) return
    state.edgeView = edgeView
    state.downEvent = e
  }

  useEffect(() => {
    if (!graph) return
    const currentGraph = graph
    const scroller = currentGraph.getPlugin('scroller') as
      | { togglePanning: (pannable?: boolean) => void }
      | undefined

    let rightDragCells: {
      dragId: number
      moveCount: number
      sourceCells: Cell[]
      startX: number
      startY: number
      lastPoint: { x: number; y: number } | null
      cloneCells: Cell[] | null
      insertionNode: Node | null
      hideSelectionOverlay: boolean
    } | null = null
    let nextDragId = 0

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

      const selection = currentGraph.container.querySelector<HTMLElement>(
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

    // ── X6 guard 覆写：允许右键 mousedown 到达 edge ─────────────────────
    const graphView = currentGraph.view
    const originalGuard = graphView.guard.bind(graphView)
    graphView.guard = (e, view) => {
      if (e.type === 'mousedown' && e.button === 2 && view?.cell?.isEdge?.()) {
        return false
      }
      return originalGuard(e, view)
    }

    // ── 按下：edge 拉线先关 Scroller 平移；右键进入拖拽复制候选状态 ───
    function onMouseDown(e: MouseEvent) {
      const view = currentGraph.findViewByElem(e.target as Element)
      if (
        view?.cell?.isEdge?.() &&
        (e.button === 2 || e.ctrlKey || e.metaKey)
      ) {
        scroller?.togglePanning(false)
        if (e.button === 2) {
          const edge = view.cell as Edge
          if (edge.getAttrs()?.line?.stroke === RED) return
          rightDragEdgeRef.current = {
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

      if (e.button !== 2) return
      const target = e.target instanceof Element ? e.target : null
      const isSelectionContent = !!target?.closest(
        '.x6-widget-selection-content',
      )
      const isSelectionContainer =
        !isSelectionContent && !!target?.closest('.x6-widget-selection-inner')
      const selectedCells = currentGraph.getSelectedCells().slice()

      if (view?.cell?.isNode?.()) {
        const node = view.cell as Node
        const isNodeSelected = selectedCells.some((cell) => cell.id === node.id)
        const sourceCells = isNodeSelected ? selectedCells : [node]
        if (!isNodeSelected) currentGraph.resetSelection([node])

        rightDragCells = {
          dragId: ++nextDragId,
          moveCount: 0,
          sourceCells,
          startX: e.clientX,
          startY: e.clientY,
          lastPoint: null,
          cloneCells: null,
          insertionNode: null,
          hideSelectionOverlay:
            sourceCells.filter((cell) => cell.isNode()).length > 1,
        }
        if (rightDragCells.hideSelectionOverlay) {
          setSelectionOverlayVisibility(false)
        }
        e.stopPropagation()
        return
      }

      if (!isSelectionContainer || selectedCells.length === 0) return
      rightDragCells = {
        dragId: ++nextDragId,
        moveCount: 0,
        sourceCells: selectedCells,
        startX: e.clientX,
        startY: e.clientY,
        lastPoint: null,
        cloneCells: null,
        insertionNode: null,
        hideSelectionOverlay:
          selectedCells.filter((cell) => cell.isNode()).length > 1,
      }
      if (rightDragCells.hideSelectionOverlay) {
        setSelectionOverlayVisibility(false)
      }
      e.stopPropagation()
    }

    // ── 右键移动：阻止浏览器手势；node 超过阈值后创建复制节点 ─────────────
    function onMouseMove(e: MouseEvent) {
      const rightDragEdge = rightDragEdgeRef.current
      if (rightDragEdge && e.buttons === 2) {
        const dx = e.clientX - rightDragEdge.startX
        const dy = e.clientY - rightDragEdge.startY
        if (
          rightDragEdge.dragging ||
          Math.hypot(dx, dy) >= RIGHT_DRAG_COPY_THRESHOLD
        ) {
          if (!rightDragEdge.dragging) {
            if (!rightDragEdge.downEvent) return

            const key = `__${currentGraph.view.cid}__`
            const dragData = rightDragEdge.downEvent.data?.[key]
            if (!dragData) return

            const startPos = currentGraph.pageToLocal(
              rightDragEdge.pageX,
              rightDragEdge.pageY,
            )
            const ratio =
              rightDragEdge.edgeView.getClosestPointRatio(startPos) ?? 0.5
            const tempEdge = currentGraph.addEdge({
              source: {
                cell: rightDragEdge.edge.id,
                anchor: { name: 'ratio', args: { ratio } },
              },
              target: { x: startPos.x, y: startPos.y },
              ...previewLinkAttrs,
            })
            const tempEdgeView = currentGraph.findViewByCell(
              tempEdge,
            ) as EdgeView
            tempEdgeView.setEventData(
              rightDragEdge.downEvent,
              tempEdgeView.prepareArrowheadDragging('target', {
                x: startPos.x,
                y: startPos.y,
                isNewEdge: true,
                fallbackAction: 'remove',
              }),
            )
            dragData.currentView = tempEdgeView
            rightDragEdge.edge.removeTools({ undo: false })
          }
          rightDragEdge.dragging = true
          setRightEdgeDragging(true)
          setSuppressDomContextMenu(true)
          e.preventDefault()
        }
      }

      if (rightEdgeDragging) e.preventDefault()
      if (!rightDragCells || e.buttons !== 2) return

      rightDragCells.moveCount += 1
      if (!rightDragCells.cloneCells) {
        const dx = e.clientX - rightDragCells.startX
        const dy = e.clientY - rightDragCells.startY
        if (Math.hypot(dx, dy) < RIGHT_DRAG_COPY_THRESHOLD) return

        const sourceBBox = currentGraph.getCellsBBox(rightDragCells.sourceCells)
        if (!sourceBBox) {
          throw new Error('Right-drag copy source cells bbox is missing')
        }

        const cloneMap = currentGraph.model.cloneSubGraph(
          rightDragCells.sourceCells,
        )
        const cloneCells = Object.values(cloneMap).sort(
          (a, b) => Number(a.isEdge()) - Number(b.isEdge()),
        )
        const position = currentGraph.pageToLocal(e.pageX, e.pageY)
        const sourceCenter = sourceBBox.getCenter()
        const offsetX = position.x - sourceCenter.x
        const offsetY = position.y - sourceCenter.y
        cloneCells.forEach((cell) => cell.translate(offsetX, offsetY))
        currentGraph.model.addCells(cloneCells)
        currentGraph.resetSelection(cloneCells)
        if (rightDragCells.hideSelectionOverlay) {
          setSelectionOverlayVisibility(false)
        }

        rightDragCells.cloneCells = cloneCells
        rightDragCells.lastPoint = position
        rightDragCells.insertionNode =
          cloneCells.length === 1 && cloneCells[0].isNode()
            ? cloneCells[0]
            : null
        currentGraph.container.style.cursor = 'copy'
        setSuppressDomContextMenu(true)
      }

      e.preventDefault()
      const cloneCells = rightDragCells.cloneCells
      const lastPoint = rightDragCells.lastPoint
      if (!cloneCells || !lastPoint) {
        throw new Error('Right-drag copy cells are missing')
      }
      const position = currentGraph.pageToLocal(e.pageX, e.pageY)
      // insertion 可能把节点吸到 Edge 上，单节点必须按鼠标位置绝对移动，
      // 否则每次只累加小增量会一直停留在 SNAP_RADIUS 内并反复吸回。
      if (rightDragCells.insertionNode) {
        const size = rightDragCells.insertionNode.getSize()
        rightDragCells.insertionNode.position(
          position.x - size.width / 2,
          position.y - size.height / 2,
          { ignore: true, undo: false },
        )
      } else {
        const offsetX = position.x - lastPoint.x
        const offsetY = position.y - lastPoint.y
        cloneCells.forEach((cell) => cell.translate(offsetX, offsetY))
      }
      rightDragCells.lastPoint = position
      if (rightDragCells.insertionNode) {
        updateEdgeInsertionPreview(currentGraph, rightDragCells.insertionNode)
      }
    }

    // ── 右键释放：结束 edge 拉线状态；完成复制 cells 的 insertion ──────
    function onMouseUp(e: MouseEvent) {
      setRightEdgeDragging(false)
      scroller?.togglePanning(true)
      rightDragEdgeRef.current = null
      if (e.button !== 2 || !rightDragCells) return

      const state = rightDragCells
      rightDragCells = null
      currentGraph.container.style.cursor = ''
      if (!state.cloneCells) {
        if (state.hideSelectionOverlay) {
          setSelectionOverlayVisibility(true)
        }
        return
      }

      e.preventDefault()
      const position = currentGraph.pageToLocal(e.pageX, e.pageY)
      const lastPoint = state.lastPoint
      if (!lastPoint) {
        throw new Error('Right-drag copy position is missing')
      }
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
        state.cloneCells.forEach((cell) => cell.translate(offsetX, offsetY))
      }

      if (state.insertionNode) {
        updateEdgeInsertionPreview(currentGraph, state.insertionNode)
        const committed = commitEdgeInsertion(currentGraph, state.insertionNode)
        if (!committed) {
          void routeAllEdges(currentGraph)
        }
      } else {
        clearEdgeInsertionPreview(currentGraph)
        void routeAllEdges(currentGraph)
      }
      if (state.hideSelectionOverlay) {
        setSelectionOverlayVisibility(true)
      }
    }

    // ── 右键拉线或拖拽复制后，抑制紧随其后的原生菜单 ───────────────────
    function onContextMenu(e: MouseEvent) {
      if (!suppressDomContextMenu) return
      e.preventDefault()
      e.stopPropagation()
      setSuppressDomContextMenu(false)
    }

    // ── 注册原生事件 ───────────────────────────────────────────────────
    const container = currentGraph.container
    container.addEventListener('mousemove', onGraphMouseMove)
    container.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('mouseup', onMouseUp, true)
    container.addEventListener('contextmenu', onContextMenu, true)

    // ── 清理原生事件与临时 DOM 状态 ────────────────────────────────────
    return () => {
      cancelGraphMouseMove()
      graphView.guard = originalGuard
      container.removeEventListener('mousemove', onGraphMouseMove)
      container.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('mousemove', onMouseMove, true)
      document.removeEventListener('mouseup', onMouseUp, true)
      container.removeEventListener('contextmenu', onContextMenu, true)
      clearEdgeInsertionPreview(currentGraph)
      if (rightDragCells?.hideSelectionOverlay) {
        setSelectionOverlayVisibility(true)
      }
      if (rightDragCells?.cloneCells) {
        currentGraph.removeCells(rightDragCells.cloneCells, {
          ignore: true,
          undo: false,
        })
      }
      rightDragCells = null
      rightDragEdgeRef.current = null
      currentGraph.container.style.cursor = ''
      setRightEdgeDragging(false)
      scroller?.togglePanning(true)
      setSuppressDomContextMenu(false)
    }
  }, [graph, onGraphMouseMove, cancelGraphMouseMove])

  return setRightEdgeDragEvent
}

export { useDomListener }
