import { CellView } from '@antv/x6'

// ── X6 运行时原型补丁 ────────────────────────────────────────────────────────
// _xxx 前缀表示自定义框架补丁方法，避免与 X6 未来版本的方法名冲突。
// ─────────────────────────────────────────────────────────────────────────────

CellView.prototype._getSelectors = function () {
  return (this as unknown as { selectors: Record<string, Element | Element[]> })
    .selectors
}
