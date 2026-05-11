import type { Cell, Edge, EdgeView, History, Node } from '@antv/x6'
import { createCommonService } from '@/services/common-service'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'

const commonService = createCommonService()

/**
 * 图形编辑器事件监听 hook
 * graph 直接从 store 订阅，无需外部传参
 */

function useGraphListener() {
  const graph = useGraphStore((s) => s.graph)
  const syncSubGraph = useSubGraphStore((s) => s.syncSubGraph)
  const changeGraphView = useSubGraphStore((s) => s.changeGraphView)
  const setPasteTarget = useGraphStore((s) => s.setPasteTarget)

  useEffect(() => {
    if (!graph) return

    graph.on('node:dblclick', ({ node }) => {
      // #1 进入子系统
      if (node.getData()?.type === 'SubsystemBlock') {
        changeGraphView(node.id)
        setPasteTarget({ x: 0, y: 30 })
      }
    })

    graph.on('node:added', ({ node, options }) => {
      if (options?.ignore) return
      // #2.1 子系统添加
      if (node.getData()?.type === 'SubsystemBlock') {
        syncSubGraph(node, 'add')
      }
    })

    graph.on('node:removed', ({ node, options }) => {
      if (options?.ignore) return
      // #2.2 子系统删除
      if (node.getData()?.type === 'SubsystemBlock') {
        syncSubGraph(node, 'delete')
      }
    })
    graph.on('blank:click', ({ x, y }: { x: number; y: number }) => {
      // #3.1 空白处点击，修改粘贴目标位置
      setPasteTarget({ x, y })
    })

    graph.on('history:change', () => {
      const history = graph.getPlugin<History>('history')
      if (!history) return
      console.log(history['undoStack'])
    })

    // const selectAffectedCells = ({ cmds }: { cmds: { data?: { id?: string } }[] | null }) => {
    //   if (!cmds) return
    //   const ids = [...new Set(cmds.map((c) => c.data?.id).filter(Boolean) as string[])]
    //   const cells = ids.map((id) => graph.getCellById(id)).filter(Boolean) as Cell[]
    //   graph.resetSelection(cells)
    // }
    // graph.on('history:undo', selectAffectedCells)
    // graph.on('history:redo', selectAffectedCells)

    let prevCells = new Set<Cell>()

    graph.on(
      'box:mousemove',
      ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
        const curr = new Set<Cell>([...nodes, ...edges])
        curr.forEach((c) => {
          if (!prevCells.has(c)) commonService.addOutline(c)
        })
        prevCells.forEach((c) => {
          if (!curr.has(c)) commonService.removeOutline(c)
        })
        prevCells = curr
      },
    )

    graph.on('cell:unselected', ({ cell }) => {
      commonService.removeOutline(cell)
    })
    // graph.on('cell:unselected', ({ cell }) => {
    //   if (cell.isNode()) cell.removeAttrs('body/filter')
    // })

    // Ctrl/Meta + 点击边拖拽：从边上分支出新边
    graph.on('edge:mousedown', ({ edge, e }) => {
      if (!e.ctrlKey && !e.metaKey) return
      // #4.1 线条分支
      // TODO: 临时线的Link拉线及连接时逻辑
      if (edge.getAttrs()?.line?.stroke === 'red') return

      const edgeView = graph.findViewByCell(edge) as EdgeView
      if (edgeView?.getEventData(e)?.action === 'drag-arrowhead') return

      e.stopPropagation()
      e.preventDefault()

      const startPos = graph.pageToLocal(e.pageX, e.pageY)
      const ratio: number = edgeView?.getClosestPointRatio(startPos) ?? 0.5

      const tempEdge = graph.addEdge({
        source: { cell: edge.id, anchor: { name: 'ratio', args: { ratio } } },
        target: { x: startPos.x, y: startPos.y },
        attrs: {
          line: { stroke: 'red', strokeWidth: 2, strokeDasharray: '6 3' },
        },
        zIndex: 3,
      })
      // 事件委托，将临时线行为交给X6管理
      // 不建议修改以下代码，除非清楚X6的事件系统和拖拽机制
      const tempEdgeView = graph.findViewByCell(tempEdge) as EdgeView
      tempEdgeView.setEventData(
        e,
        tempEdgeView.prepareArrowheadDragging('target', {
          x: startPos.x,
          y: startPos.y,
          isNewEdge: true,
          fallbackAction: 'remove',
        }),
      )
      setTimeout(() => {
        const key = `__${graph.view.cid}__`
        if (e.data?.[key]) e.data[key].currentView = tempEdgeView
      }, 0)
    })

    graph.on('edge:connected', ({ edge, isNew }) => {
      // #4.2临时分支线连接成功后，恢复为正式连线样式
      if (!isNew) return
      if (edge.getAttrs()?.line?.stroke !== 'red') return
      edge.setAttrs({
        line: { stroke: null, strokeWidth: null, strokeDasharray: null },
      })
    })

    graph.on('cell:click', ({ cell, x, y }) => {
      // #3.2 cell点击，修改粘贴目标位置
      setPasteTarget({ x, y })
      commonService.addOutline(cell)
    })

    // ── #5 Transform hover ──────────────────────────────────────────
    // TODO: X6 框架的 outline svg 会导致node 左方和上方的mouse事件无法正确触发
    let currentNode: Node | null = null
    let isTransforming = false
    const container = graph.container

    function onContainerMouseMove(e: MouseEvent) {
      if (
        isTransforming ||
        (currentNode &&
          !commonService.isMouseOutCell(e, graph, currentNode, 10))
      )
        return
      graph.clearTransformWidgets()
      currentNode = null
      const node = commonService.getNodeAtPoint(e, graph)
      if (node) {
        currentNode = node
        graph.createTransformWidget(node)
      }
    }
    container.addEventListener('mousemove', onContainerMouseMove)

    graph.on('node:resize', () => {
      // #5.1
      isTransforming = true
    })
    graph.on('node:resized', () => {
      // #5.1
      isTransforming = false
    })

    return () => {
      container.removeEventListener('mousemove', onContainerMouseMove)
      graph.off('node:dblclick')
      graph.off('node:added')
      graph.off('node:removed')
      graph.off('blank:click')
      graph.off('history:change')
      graph.off('history:undo')
      graph.off('history:redo')
      graph.off('box:mousemove')
      graph.off('cell:unselected')
      graph.off('edge:mousedown')
      graph.off('edge:connected')
      graph.off('node:resize')
      graph.off('node:resized')
      graph.off('cell:click')
    }
  }, [graph, syncSubGraph, changeGraphView, setPasteTarget])
}

export { useGraphListener }
