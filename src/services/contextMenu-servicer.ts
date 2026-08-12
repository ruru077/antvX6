import { pasteAndSelect } from '@/services/clipboard-service'
import { createInteractiveService } from '@/services/interactive-service'
import {
  hasSubsystemMask,
  mergeToSubsystem,
} from '@/services/subsystem-service'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import type { Cell, Graph } from '@antv/x6'

const interactiveService = createInteractiveService()

function selectContextNode(graph: Graph, cell: Cell) {
  if (!cell.isNode()) return
  if (graph.getSelectedCells().some((selected) => selected.id === cell.id))
    return
  graph.resetSelection([cell])
}

function createContextMenuService(graph: Graph | null, cell?: Cell) {
  return {
    canUndo: graph?.canUndo() ?? false,
    canRedo: graph?.canRedo() ?? false,
    canPaste: !(graph?.isClipboardEmpty() ?? true),
    canCreateSubsystem: (graph?.getSelectedCells().length ?? 0) > 0,
    hasSubsystemMask: cell?.isNode() && hasSubsystemMask(cell),

    undo() {
      graph?.undo()
    },
    redo() {
      graph?.redo()
    },
    paste() {
      if (graph) pasteAndSelect(graph)
    },
    copy() {
      if (!graph || !cell) return
      graph.copy([cell])
    },
    cut() {
      if (!graph || !cell) return
      graph.cut([cell])
      graph.resetSelection([])
    },
    remove() {
      if (!graph || !cell) return
      graph.removeCell(cell)
    },
    openNodeParameters() {
      if (!cell?.isNode()) return
      interactiveService.openNodeParamWindow(cell)
    },
    openSubsystem() {
      if (!cell?.isNode()) return
      useSubSystemTabStore.getState().navigateWithin(cell.id)
    },
    openSubsystemInTab() {
      if (!cell?.isNode()) return
      useSubSystemTabStore.getState().openOrSwitch(cell.id)
    },
    createSubsystemMask() {
      if (!cell?.isNode()) return
      useSubGraphStore.getState().addMaskToSubsystem(cell)
    },
    selectAll() {
      if (!graph) return
      graph.resetSelection(graph.getCells())
    },
    createSubsystem() {
      if (!graph) return
      const cells = graph.getSelectedCells()
      if (!cells.length) return
      mergeToSubsystem(cells, graph)
    },
  }
}

export { createContextMenuService, selectContextNode }
export type ContextMenuService = ReturnType<typeof createContextMenuService>
