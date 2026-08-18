import { useGraphStore } from '@/store/graphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import type { Scroller } from '@antv/x6'

function focusCellInSubGraph(graphId: string, cellId: string) {
  useSubSystemTabStore
    .getState()
    .navigateWithin(graphId, { centerContent: false })
  const graph = useGraphStore.getState().graph
  const cell = graph?.getCellById(cellId)
  if (!cell) return
  graph.resetSelection([cell])
  graph.getPlugin<Scroller>('scroller')?.scrollToCell(cell)
}

export { focusCellInSubGraph }
