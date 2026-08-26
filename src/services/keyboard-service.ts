import { Keyboard, Scroller, Selection } from '@antv/x6'
import { debounce } from 'lodash-es'
import { GRAPH_GRID } from '@/assets/constant'
import { removeCellsWithSubGraphHistory } from '@/services/cell-removal-service'
import {
  copySelection,
  cutSelection,
  pasteAndSelect,
} from '@/services/clipboard-service'
import { createInteractiveService } from '@/services/interactive-service'
import {
  firstTimePaste,
  isSelectionByKey,
  setFirstTimePaste,
  setIsSelectionByKey,
  setSpaceComboUsed,
  setSpaceHeld,
  spaceComboUsed,
  spaceHeld,
} from '@/store/flags'
import { saveEntryGraphModel } from '@/store/subGraphStore'
import type { Graph, Node } from '@antv/x6'

const interactiveService = createInteractiveService()

// ── 方向键辅助（纯函数） ──────────────────────────────────────────────────────

type ArrowDirection = 'up' | 'down' | 'left' | 'right'

const DIRECTIONS: ArrowDirection[] = ['left', 'right', 'up', 'down']
const MOVE_STEP: Record<ArrowDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -GRAPH_GRID },
  down: { dx: 0, dy: GRAPH_GRID },
  left: { dx: -GRAPH_GRID, dy: 0 },
  right: { dx: GRAPH_GRID, dy: 0 },
}

/**
 * @description 检查当前焦点是否在可编辑元素上，若是则应跳过快捷键处理
 */
function isEditingElement() {
  const element = document.activeElement
  if (!element || !(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  return !!element.closest('input, textarea, select')
}

function findNeighbor(graph: Graph, current: Node, direction: ArrowDirection) {
  const center = current.getBBox().getCenter()
  const candidates = graph.getNodes().filter((node) => {
    if (node === current) return false
    const candidateCenter = node.getBBox().getCenter()
    const dx = candidateCenter.x - center.x
    const dy = candidateCenter.y - center.y
    if (direction === 'left') return dx < 0
    if (direction === 'right') return dx > 0
    if (direction === 'up') return dy < 0
    return dy > 0
  })
  if (!candidates.length) return null

  return candidates.reduce((nearest, node) => {
    const nodeCenter = node.getBBox().getCenter()
    const nearestCenter = nearest.getBBox().getCenter()
    return Math.hypot(nodeCenter.x - center.x, nodeCenter.y - center.y) <
      Math.hypot(nearestCenter.x - center.x, nearestCenter.y - center.y)
      ? node
      : nearest
  })
}

function createMoveHandler(graph: Graph, direction: ArrowDirection) {
  let isBatching = false
  // 连续按方向键属于同一次移动，停止输入 700ms 后再结束 History batch。
  const stopMoveBatch = debounce(() => {
    graph.stopBatch('move')
    isBatching = false
  }, 700)

  return () => {
    if (spaceHeld) return false
    if (!graph.getNodes().length) return false

    const selectedNodes = graph
      .getSelectedCells()
      .filter((cell) => cell.isNode())
    const selectedEdges = graph
      .getSelectedCells()
      .filter((cell) => cell.isEdge())
    if (selectedNodes.length > 0 && !isSelectionByKey) {
      if (!isBatching) {
        isBatching = true
        graph.startBatch('move')
      }
      selectedNodes.forEach((node) => {
        const position = node.getPosition()
        node.setPosition(
          position.x + MOVE_STEP[direction].dx,
          position.y + MOVE_STEP[direction].dy,
        )
      })
      stopMoveBatch()
    } else if (!selectedEdges.length) {
      const nodes = graph.getNodes()
      const current = isSelectionByKey ? selectedNodes[0] : nodes[0]
      current.removeTool('boundary', { undo: false })
      const neighbor = findNeighbor(graph, current, direction) ?? current
      setIsSelectionByKey(true)
      graph.resetSelection([neighbor])
      interactiveService.addOutline(neighbor)
      interactiveService.addBoundaryTool(neighbor)
      graph.getPlugin<Scroller>('scroller')?.scrollToCell(neighbor)
    }
    return false
  }
}

function zoomToFit(graph: Graph) {
  interactiveService.zoomToFitWithVirtual(graph, {
    scaleGrid: 0.05,
    padding: 20,
  })
}

// ── Space 键闭包 ────────────────────────────────────────────────────────────

function createSpaceHandlers(graph: Graph) {
  function whileSpaceHeld(action: () => void) {
    return () => {
      if (!spaceHeld) return false
      setSpaceComboUsed(true)
      action()
      return false
    }
  }

  const pan = (direction: ArrowDirection) =>
    whileSpaceHeld(() => {
      const scroller = graph.getPlugin<Scroller>('scroller')
      if (!scroller) return
      const position = scroller.getScrollbarPosition()
      scroller.setScrollbarPosition(
        position.left + MOVE_STEP[direction].dx * 5,
        position.top + MOVE_STEP[direction].dy * 5,
      )
    })

  return {
    down() {
      setSpaceComboUsed(false)
      setSpaceHeld(true)
    },
    up() {
      setSpaceHeld(false)
      if (!spaceComboUsed) zoomToFit(graph)
    },
    panLeft: pan('left'),
    panRight: pan('right'),
    panUp: pan('up'),
    panDown: pan('down'),
    zoomIn: whileSpaceHeld(() => graph.zoom(0.1)),
    zoomOut: whileSpaceHeld(() => graph.zoom(-0.1)),
    zoomReset: whileSpaceHeld(() => graph.zoomTo(1)),
    zoomToFit: whileSpaceHeld(() => zoomToFit(graph)),
    zoomToSelection: whileSpaceHeld(() => {
      const cells =
        graph.getPlugin<Selection>('selection')?.getSelectedCells() ?? []
      if (cells.length > 0) {
        graph.zoomToRect(graph.getCellsBBox(cells)!, { padding: 20 })
      }
    }),
  }
}

// ── 通用按键绑定 ────────────────────────────────────────────────────────────

type KeyBinding = [
  keys: string | string[],
  handler: () => void,
  eventType?: 'keydown' | 'keyup' | 'keypress',
]

function bindKeys(graph: Graph, bindings: KeyBinding[]) {
  bindings.forEach(([keys, handler, eventType]) => {
    graph.bindKey(
      keys,
      () => {
        // 编辑态：不执行 handler，不 return false（避免 Mousetrap 调 preventDefault）
        if (isEditingElement()) return
        handler()
        return false
      },
      eventType,
    )
  })
}

// ── 快捷键注册 ──────────────────────────────────────────────────────────────

/**
 * 注册 Keyboard 插件及所有画布快捷键。
 * Graph 实例由调用方显式传入，避免键盘服务反向依赖 graphStore。
 */
function registerKeyboard(graph: Graph) {
  graph.use(new Keyboard({ enabled: true }))
  const space = createSpaceHandlers(graph)

  // 方向键合并：Space 按住时走 pan，否则走 move。
  DIRECTIONS.forEach((direction) => {
    const move = createMoveHandler(graph, direction)
    const pan = [space.panLeft, space.panRight, space.panUp, space.panDown][
      DIRECTIONS.indexOf(direction)
    ]
    graph.bindKey(direction, () => {
      if (isEditingElement()) return
      if (spaceHeld) return pan()
      return move()
    })
  })

  bindKeys(graph, [
    [['ctrl+s', 'meta+s'], () => saveEntryGraphModel(graph)],
    [['ctrl+c', 'meta+c'], () => copySelection(graph)],
    [
      ['ctrl+v', 'meta+v'],
      () => {
        if (!firstTimePaste || !pasteAndSelect(graph)) return
        setFirstTimePaste(false)
      },
    ],
    [['ctrl+v', 'meta+v'], () => setFirstTimePaste(true), 'keyup'],
    [['ctrl+x', 'meta+x'], () => cutSelection(graph)],
    [
      ['delete', 'backspace'],
      () => {
        const cells = graph.getSelectedCells()
        if (!cells.length) return
        removeCellsWithSubGraphHistory(graph, cells)
        graph.resetSelection([])
      },
    ],
    [
      ['ctrl+a', 'meta+a'],
      () => {
        const cells = graph.getCells()
        if (cells.length) graph.resetSelection(cells)
      },
    ],
    ['space', space.down],
    ['space', space.up, 'keyup'],
    ['=', space.zoomIn],
    ['-', space.zoomOut],
    ['0', space.zoomReset],
    ['g', space.zoomToFit],
    ['f', space.zoomToSelection],
    [['ctrl+z', 'meta+z'], () => graph.undo()],
    [['ctrl+y', 'meta+y', 'meta+shift+z', 'ctrl+shift+z'], () => graph.redo()],
  ])
}

export { registerKeyboard }
