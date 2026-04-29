import type { History } from '@antv/x6'
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

    // graph.on('cell:unselected', ({ cell }) => {
    //   if (cell.isNode()) cell.removeAttrs('body/filter')
    // })

    graph.on('cell:click', ({ cell, x, y }) => {
      // #3.2 cell点击，修改粘贴目标位置
      setPasteTarget({ x, y })
      if (cell.isNode()) {
        cell.attr('body/filter', {
          name: 'outline',
          args: { color: '#77caeb', width: 2, margin: 0 },
        })
      } else if (cell.isEdge()) {
        cell.attr('line/filter', {
          name: 'outline',
          args: { color: '#77caeb', width: 2, margin: 0 },
        })
      }
    })

    return () => {
      graph.off('node:dblclick')
      graph.off('node:added')
      graph.off('node:removed')
      graph.off('blank:click')
      graph.off('history:change')
      graph.off('cell:click')
    }
  }, [graph, syncSubGraph, changeGraphView, setPasteTarget])
}

export { useGraphListener }
