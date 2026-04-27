import type { Cell, Graph, History, Node } from '@antv/x6'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'

/**
 * 图形编辑器事件监听 hook
 * @param graph - Graph 实例
 */
export function useGraphListener(graph: Graph | null) {
  const syncGraph = useSubGraphStore((s) => s.syncGraph)
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

    graph.on('history:change', ({ cmds }) => {
      const history = graph.getPlugin<History>('history')
      if (!history) return
      console.log(history['undoStack'])
    })

    graph.on('cell:click', ({ cell, view, x, y }) => {
      // #3.2 cell点击，修改粘贴目标位置
      setPasteTarget({ x, y })
      console.log(cell, x, y)
    })
  }, [graph, syncSubGraph, changeGraphView, setPasteTarget])
}
