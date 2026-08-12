import { PASTE_OFFSET } from '@/assets/constant'
import { pasteTarget, setPasteTarget } from '@/store/flags'
import type { Graph } from '@antv/x6'

// 剪贴板行为只依赖显式传入的 Graph，供快捷键和右键菜单共同复用。

/** 复制当前 Selection。 */
function copySelection(graph: Graph) {
  const cells = graph.getSelectedCells()
  if (cells.length) graph.copy(cells)
}

/** 剪切当前 Selection，并清空画布选中状态。 */
function cutSelection(graph: Graph) {
  const cells = graph.getSelectedCells()
  if (!cells.length) return

  graph.cut(cells)
  graph.resetSelection([])
}

/**
 * 粘贴剪贴板内容并选中新建 Cell。
 * 右键菜单提供 pasteTarget 时以目标点对齐；连续粘贴沿固定偏移递增。
 */
function pasteAndSelect(graph: Graph) {
  if (graph.isClipboardEmpty()) return false

  let cells
  if (pasteTarget) {
    // 以剪贴板中所有节点的左上角为基准，将整体移动到右键位置。
    const clipboardCells = graph.getCellsInClipboard()
    const nodes = clipboardCells.filter((cell) => cell.isNode())
    const minX = Math.min(...nodes.map((node) => node.getPosition().x))
    const minY = Math.min(...nodes.map((node) => node.getPosition().y))
    cells = graph.paste({
      offset: { dx: pasteTarget.x - minX, dy: pasteTarget.y - minY },
    })
    setPasteTarget(pasteTarget.x + PASTE_OFFSET, pasteTarget.y + PASTE_OFFSET)
  } else {
    // 快捷键粘贴沿用 X6 的固定偏移行为。
    cells = graph.paste({ offset: PASTE_OFFSET })
  }

  graph.resetSelection(cells)
  return true
}

export { copySelection, cutSelection, pasteAndSelect }
