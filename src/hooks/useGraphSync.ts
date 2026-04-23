import type { Graph } from '@antv/x6'
import { useSubsystemStore } from '@/store/subsystemStore'

/**
 * 图形编辑器事件监听 hook
 * @param graph - Graph 实例
 */
export function useGraphListener(graph: Graph | null) {
  const syncGraph = useSubsystemStore((s) => s.syncGraph)

  useEffect(() => {
    if (!graph) return

    graph.on('node:dblclick', ({ node }) => {
      // #1 进入子系统
      if (node.getData()?.type === 'SubsystemBlock') {
      }
    })

    return () => {}
  }, [graph])
}
