import { RED, RIGHT_DRAG_COPY_THRESHOLD } from '@/assets/constant'
import { previewLinkAttrs } from '@/assets/x6Model'
import {
  rightEdgeDragging,
  setRightEdgeDragging,
  setSuppressDomContextMenu,
  suppressDomContextMenu,
} from '@/store/flags'
import type { Edge, EdgeView, Graph, Node } from '@antv/x6'

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
 * addEventListener 事件，包括右键 edge 拉线前置状态、右键拖拽复制节点、
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

    let rightDragNode: {
      sourceNode: Node
      startX: number
      startY: number
      ghostEl: HTMLDivElement | null
    } | null = null

    // ── X6 guard 覆写：允许右键 mousedown 到达 edge ─────────────────────
    const graphView = currentGraph.view
    const originalGuard = graphView.guard.bind(graphView)
    graphView.guard = (e, view) => {
      if (e.type === 'mousedown' && e.button === 2 && view?.cell?.isEdge?.()) {
        return false
      }
      return originalGuard(e, view)
    }

    // ── 按下：edge 拉线先关 Scroller 平移；node 右键进入拖拽复制候选状态 ───
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
      if (!view?.cell?.isNode?.()) return
      rightDragNode = {
        sourceNode: view.cell as Node,
        startX: e.clientX,
        startY: e.clientY,
        ghostEl: null,
      }
    }

    // ── 右键移动：阻止浏览器手势；node 超过阈值后显示复制预览 ─────────────
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
      if (!rightDragNode || e.buttons !== 2) return

      if (!rightDragNode.ghostEl) {
        const dx = e.clientX - rightDragNode.startX
        const dy = e.clientY - rightDragNode.startY
        if (Math.hypot(dx, dy) < RIGHT_DRAG_COPY_THRESHOLD) return

        const zoom = currentGraph.zoom()
        const { width, height } = rightDragNode.sourceNode.getSize()
        const ghost = document.createElement('div')
        Object.assign(ghost.style, {
          position: 'fixed',
          width: `${width * zoom}px`,
          height: `${height * zoom}px`,
          border: '2px dashed #1890ff',
          backgroundColor: 'rgba(24, 144, 255, 0.1)',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: '1000',
          transform: 'translate(-50%, -50%)',
        })
        document.body.appendChild(ghost)
        rightDragNode.ghostEl = ghost
        currentGraph.container.style.cursor = 'copy'
        setSuppressDomContextMenu(true)
      }

      e.preventDefault()
      rightDragNode.ghostEl.style.left = `${e.clientX}px`
      rightDragNode.ghostEl.style.top = `${e.clientY}px`
    }

    // ── 右键释放：结束 edge 拉线状态；node 已拖拽则克隆到释放位置 ─────────
    function onMouseUp(e: MouseEvent) {
      setRightEdgeDragging(false)
      scroller?.togglePanning(true)
      rightDragEdgeRef.current = null
      if (e.button !== 2 || !rightDragNode) return

      const state = rightDragNode
      rightDragNode = null
      currentGraph.container.style.cursor = ''
      if (!state.ghostEl) return

      e.preventDefault()
      state.ghostEl.remove()

      const clone = state.sourceNode.clone()
      const pos = currentGraph.pageToLocal(e.pageX, e.pageY)
      const size = clone.getSize()
      clone.position(pos.x - size.width / 2, pos.y - size.height / 2)
      currentGraph.addNode(clone)
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
      rightDragNode?.ghostEl?.remove()
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
