import {
  captureSubGraphHistory,
  SUBGRAPH_HISTORY_OPTION,
} from '@/store/subGraphStore'
import type { Cell, Graph } from '@antv/x6'

function removeCellsWithSubGraphHistory(graph: Graph, cells: Cell[]) {
  const subGraphHistory = captureSubGraphHistory(cells)
  const options = subGraphHistory
    ? { [SUBGRAPH_HISTORY_OPTION]: subGraphHistory }
    : {}
  graph.removeCells(cells, options)
}

export { removeCellsWithSubGraphHistory }
