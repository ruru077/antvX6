// ── 运行时标志位 不驱动 UI────────────────────────────────────
// export let：外部 import 后为只读 binding，TypeScript 禁止外部赋值

export let isSelectionByKey = false
export let pasteTarget: { x: number; y: number } | null = null

export const setIsSelectionByKey = (val: boolean) => {
  isSelectionByKey = val
}

export const setPasteTarget = (x?: number, y?: number) => {
  pasteTarget = x !== undefined && y !== undefined ? { x, y } : null
}
