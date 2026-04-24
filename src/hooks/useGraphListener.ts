import type { Graph } from '@antv/x6'
import { useSubsystemStore } from '@/store/subsystemStore'

/**
 * 图形编辑器事件监听 hook
 * @param graph - Graph 实例
 */
export function useGraphListener(graph: Graph | null) {
  const syncGraph = useSubsystemStore((s) => s.syncGraph)
  const syncSubGraph = useSubsystemStore((s) => s.syncSubGraph)
  const changeGraphView = useSubsystemStore((s) => s.changeGraphView)
  useEffect(() => {
    if (!graph) return

    graph.on('node:dblclick', ({ node }) => {
      // #1 进入子系统
      if (node.getData()?.type === 'SubsystemBlock') {
        changeGraphView(node.id)
      }
    })

    graph.on('node:added', ({ node, options }) => {
      if (node.getData()?.type === 'SubsystemBlock') {
        syncSubGraph(node, 'add')
      }
    })
    graph.on('node:removed', ({ node, options }) => {
      if (options?.ignoreSync) return
      if (node.getData()?.type === 'SubsystemBlock') {
        syncSubGraph(node, 'delete')
      }
    })
    graph.on('cell:click', ({ cell }) => {
      console.log(cell.id)
    })
    return () => {}
  }, [graph, syncSubGraph, changeGraphView])
}
