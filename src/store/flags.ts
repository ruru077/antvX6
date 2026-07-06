import type { Node } from '@antv/x6'

// ── 运行时标志位 不驱动 UI────────────────────────────────────
// export let：外部 import 后为只读 binding，TypeScript 禁止外部赋值

export let isSelectionByKey = false
export let pasteTarget: { x: number; y: number } | null = null
/** 当前持有 edge tool 的边 ID，同一时刻只允许一条 */
export let activeToolEdgeId: string | null = null
/** 右键拉线中标志位，供 Graph.interacting 回调使用 */
export let rightEdgeDragging = false
/** 当前鼠标所在节点，用于 Transform 工具显示控制 */
export let currentNode: Node | null = null
/** 当前是否正在 Transform，避免移动时误清理工具 */
export let isTransforming = false
/** paste keydown 连续触发时，只允许第一次执行 */
export let firstTimePaste = true
/** Space 是否按下，用于组合快捷键和平移 */
export let spaceHeld = false
/** Space 按下期间是否已经触发组合行为 */
export let spaceComboUsed = false
/** 是否抑制下一次原生右键菜单 */
export let suppressDomContextMenu = false

export const setIsSelectionByKey = (val: boolean) => {
  isSelectionByKey = val
}

export const setPasteTarget = (x?: number, y?: number) => {
  pasteTarget = x !== undefined && y !== undefined ? { x, y } : null
}

export const setActiveToolEdgeId = (id: string | null) => {
  activeToolEdgeId = id
}

export const setRightEdgeDragging = (val: boolean) => {
  rightEdgeDragging = val
}

export const setCurrentNode = (node: Node | null) => {
  currentNode = node
}

export const setIsTransforming = (val: boolean) => {
  isTransforming = val
}

export const setFirstTimePaste = (val: boolean) => {
  firstTimePaste = val
}

export const setSpaceHeld = (val: boolean) => {
  spaceHeld = val
}

export const setSpaceComboUsed = (val: boolean) => {
  spaceComboUsed = val
}

export const setSuppressDomContextMenu = (val: boolean) => {
  suppressDomContextMenu = val
}
