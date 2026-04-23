import type { Graph } from '@antv/x6'
import { useSubsystemStore } from '@/store/subsystemStore'

/**
 * 图形编辑器事件监听 hook
 * @param graph - Graph 实例
 */
export function useGraphListener(graph: Graph | null) {
  const syncGraph = useSubsystemStore((s) => s.syncGraph)
  const syncSubGraph = useSubsystemStore((s) => s.syncSubGraph)
  function enterSubsystem(subGraphId: string) {
    const { subGraphs } = useSubsystemStore.getState()
    syncGraph(graph.toJSON())
    graph.clearCells()
    graph.fromJSON(subGraphs[subGraphId].graphJson)
  }
  useEffect(() => {
    if (!graph) return

    graph.on('node:dblclick', ({ node }) => {
      // #1 进入子系统
      if (node.getData()?.type === 'SubsystemBlock') {
        enterSubsystem(node.id)
      }
    })

    graph.on('node:added', ({ node }) => {
      if (node.getData()?.type === 'SubsystemBlock') {
        syncSubGraph(node)
      }
    })
    graph.on('cell:click', ({ cell }) => {
      console.log(cell.id)
    })
    return () => {}
  }, [graph])
}
