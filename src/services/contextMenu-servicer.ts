import { removeCellsWithSubGraphHistory } from '@/services/cell-removal-service'
import { cutCells, pasteAndSelect } from '@/services/clipboard-service'
import { createInteractiveService } from '@/services/interactive-service'
import { routeAllEdges } from '@/services/routing-service'
import {
  addSubsystemImage,
  hasSubsystemMask,
  mergeToSubsystem,
  removeSubsystemImage,
} from '@/services/subsystem-service'
import { setPasteTarget } from '@/store/flags'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import type { Cell, Graph } from '@antv/x6'

const interactiveService = createInteractiveService()

function getLabelFontSize(cell?: Cell) {
  if (!cell?.isNode()) return 14
  const value =
    cell.attr('label/fontSize') ?? cell.attr('label/style/fontSize') ?? 14
  const size = Number.parseFloat(String(value))
  return Number.isFinite(size) ? size : 14
}

function selectContextNode(graph: Graph, cell: Cell) {
  if (!cell.isNode()) return
  if (graph.getSelectedCells().some((selected) => selected.id === cell.id))
    return
  graph.resetSelection([cell])
}

function createContextMenuService(
  graph: Graph | null,
  cell?: Cell,
  imageMode = cell?.isNode() ? cell.getData()?.imageMode : undefined,
) {
  const canRemoveSubsystemImage = cell?.isNode() && imageMode === 'custom'
  const blockPath = cell?.isNode() ? cell.getData()?.srcBlock : undefined

  return {
    canUndo: graph?.canUndo() ?? false,
    canRedo: graph?.canRedo() ?? false,
    canPaste: !(graph?.isClipboardEmpty() ?? true),
    canCreateSubsystem: (graph?.getSelectedCells().length ?? 0) > 0,
    hasSubsystemMask: cell?.isNode() && hasSubsystemMask(cell),
    canRemoveSubsystemImage,
    canSetModuleIcon:
      cell?.isNode() && cell.getData()?.blockType === 'Subsystem',
    canCopyBlockPath: typeof blockPath === 'string' && blockPath.length > 0,
    isLabelHidden:
      cell?.isNode() && cell.attr<string>('label/style/display') === 'none',
    labelFontSize: getLabelFontSize(cell),
    canvasFontFamily: graph?.container.style.fontFamily || 'inherit',

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
      cutCells(graph, [cell])
    },
    remove() {
      if (!graph || !cell) return
      removeCellsWithSubGraphHistory(graph, [cell])
    },
    rotateClockwise() {
      if (!cell?.isNode()) return
      cell.rotate(90)
    },
    rotateCounterclockwise() {
      if (!cell?.isNode()) return
      cell.rotate(-90)
    },
    formatDiagram() {
      if (!graph) return
      const currentGraph = graph
      currentGraph.startBatch('format-diagram')
      void (async () => {
        try {
          await routeAllEdges(currentGraph)
        } finally {
          currentGraph.stopBatch('format-diagram')
        }
      })()
    },
    autoArrange() {
      if (!graph) return
      const currentGraph = graph
      const nodes = currentGraph.getNodes().sort((a, b) => {
        const aPosition = a.getPosition()
        const bPosition = b.getPosition()
        return aPosition.y - bPosition.y || aPosition.x - bPosition.x
      })
      if (!nodes.length) return

      const bounds = currentGraph.getCellsBBox(nodes)
      const columns = Math.ceil(Math.sqrt(nodes.length))
      const columnWidth = Math.max(...nodes.map((node) => node.getSize().width))
      const rowHeight = Math.max(...nodes.map((node) => node.getSize().height))
      const horizontalGap = 80
      const verticalGap = 80

      currentGraph.startBatch('auto-arrange')
      nodes.forEach((node, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        node.position(
          bounds.x + column * (columnWidth + horizontalGap),
          bounds.y + row * (rowHeight + verticalGap),
        )
      })
      void (async () => {
        try {
          await routeAllEdges(currentGraph)
        } finally {
          currentGraph.stopBatch('auto-arrange')
        }
      })()
    },
    copyBlockPath() {
      if (typeof blockPath !== 'string' || !blockPath) return
      void navigator.clipboard.writeText(blockPath)
    },
    setCanvasBackgroundColor(color: string) {
      graph?.drawBackground({ color })
    },
    setNodeBackgroundColor(color: string) {
      if (!cell?.isNode()) return
      cell.attr('body/fill', color)
    },
    setLabelColor(color: string) {
      if (!cell?.isNode()) return
      cell.attr('label/fill', color)
      cell.attr('label/style/color', color)
    },
    setLabelFontSize(fontSize: number) {
      if (!cell?.isNode()) return
      cell.attr('label/fontSize', fontSize)
      cell.attr('label/style/fontSize', `${fontSize}px`)
    },
    increaseLabelFontSize() {
      if (!cell?.isNode()) return
      const fontSize = getLabelFontSize(cell) + 1
      cell.attr('label/fontSize', fontSize)
      cell.attr('label/style/fontSize', `${fontSize}px`)
    },
    decreaseLabelFontSize() {
      if (!cell?.isNode()) return
      const fontSize = Math.max(1, getLabelFontSize(cell) - 1)
      cell.attr('label/fontSize', fontSize)
      cell.attr('label/style/fontSize', `${fontSize}px`)
    },
    setCanvasFontFamily(fontFamily: string) {
      if (!graph) return
      graph.container.style.fontFamily = fontFamily
      graph.startBatch('set-canvas-font')
      graph.getNodes().forEach((node) => {
        node.attr('label/fontFamily', fontFamily)
        node.attr('label/style/fontFamily', fontFamily)
      })
      graph.stopBatch('set-canvas-font')
    },
    setLabelVisible(visible: boolean) {
      if (!cell?.isNode()) return
      cell.attr('label/style/display', visible ? '' : 'none', {
        undo: false,
      })
    },
    toggleLabelVisibility() {
      if (!cell?.isNode()) return
      const isHidden = cell.attr<string>('label/style/display') === 'none'
      cell.attr('label/style/display', isHidden ? '' : 'none', {
        undo: false,
      })
    },
    openNodeParameters() {
      if (!cell?.isNode()) return
      interactiveService.openNodeParamWindow(cell)
    },
    openSubsystem() {
      if (!cell?.isNode()) return
      useSubSystemTabStore.getState().navigateWithin(cell.id)
      setPasteTarget(0, 30)
    },
    openSubsystemInTab() {
      if (!cell?.isNode()) return
      useSubSystemTabStore.getState().openOrSwitch(cell.id)
    },
    createSubsystemMask() {
      if (!cell?.isNode()) return
      useSubGraphStore.getState().addMaskToSubsystem(cell)
    },
    addSubsystemImage() {
      if (!graph || !cell?.isNode()) return
      void addSubsystemImage(cell, graph)
    },
    removeSubsystemImage() {
      if (!graph || !cell?.isNode()) return
      void removeSubsystemImage(cell, graph)
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
