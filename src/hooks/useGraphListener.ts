import type { EdgeView, History } from '@antv/x6'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'

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
      if (options?.ignoreSync) return
      // #2.1 子系统添加
      if (node.getData()?.type === 'SubsystemBlock') {
        syncSubGraph(node, 'add')
      }
    })

    graph.on('node:removed', ({ node, options }) => {
      if (options?.ignoreSync) return
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

    // 框选实时检测：每多框住一个节点就打印一次
    let prevRubberbandCount = 0

    graph.on('box:mousedown', () => {
      prevRubberbandCount = 0
    })

    graph.on('box:mousemove', ({ nodes }) => {
      const current = nodes.length
      if (current > prevRubberbandCount) {
        console.log('more one', nodes[nodes.length - 1])
      } else if (current < prevRubberbandCount) {
        console.log('less one')
      }
      prevRubberbandCount = current
    })

    graph.on('box:mouseup', () => {
      prevRubberbandCount = 0
    })

    // graph.on('cell:unselected', ({ cell }) => {
    //   if (cell.isNode()) cell.removeAttrs('body/filter')
    // })

    // Ctrl/Meta + 点击边拖拽：从边上分支出新边
    graph.on('edge:mousedown', ({ edge, e }) => {
      if (!e.ctrlKey && !e.metaKey) return
      // 临时线 stroke 为 red，不可再分支
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

    // 临时分支线连接成功后，恢复为正式连线样式
    graph.on('edge:connected', ({ edge, isNew }) => {
      if (!isNew) return
      if (edge.getAttrs()?.line?.stroke !== 'red') return
      edge.setAttrs({
        line: { stroke: null, strokeWidth: null, strokeDasharray: null },
      })
    })

    graph.on('cell:click', ({ cell, x, y }) => {
      // #3.2 cell点击，修改粘贴目标位置
      setPasteTarget({ x, y })
      if (cell.isNode()) {
        cell.attr('body/filter', {
          name: 'outline',
          args: { color: '#77caeb', width: 2, margin: 0 },
        })
      } else if (cell.isEdge()) {
        // fix objectBoundingBox 在垂直时 link-height=0 导致filter失效的问题
        // TODO : 假设用户的画布坐标超过 (-9999, -9999) ~ (9999, 9999)
        cell.attr('line/filter', {
          name: 'outline',
          args: { color: '#77caeb', width: 2, margin: 0 },
          attrs: {
            filterUnits: 'userSpaceOnUse',
            x: -9999,
            y: -9999,
            width: 19998, //(-9999) 到 (+9999)
            height: 19998,
          },
        })
      }
    })

    return () => {
      graph.off('node:dblclick')
      graph.off('node:added')
      graph.off('node:removed')
      graph.off('blank:click')
      graph.off('history:change')
      graph.off('box:mousedown')
      graph.off('box:mousemove')
      graph.off('box:mouseup')
      graph.off('edge:mousedown')
      graph.off('edge:connected')
      graph.off('cell:click')
    }
  }, [graph, syncSubGraph, changeGraphView, setPasteTarget])
}

export { useGraphListener }
