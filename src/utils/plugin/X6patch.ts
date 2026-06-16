import { CellView, FunctionExt, Scroller } from '@antv/x6'

// ── X6 运行时原型补丁 ────────────────────────────────────────────────────────
// _xxx 前缀表示自定义框架补丁方法，避免与 X6 未来版本的方法名冲突。
// ─────────────────────────────────────────────────────────────────────────────

CellView.prototype._getSelectors = function () {
  return (this as unknown as { selectors: Record<string, Element | Element[]> })
    .selectors
}

/**
 * 将 scroller 构造时默认的 debounce(200ms) 替换为 throttle(60ms)，
 * 使画布滚动/缩放时的 autoResize 响应更即时。
 * 参考: https://github.com/antvis/X6/issues/3223
 */
export function _patchScrollerOnUpdate(scroller: Scroller) {
  const impl = (scroller as unknown as Record<string, any>).scrollerImpl
  if (!impl) return

  const proto = Object.getPrototypeOf(impl) as Record<string, Function>
  const originalOnUpdate = proto.onUpdate as Function

  // 构造时 startListening() 已用 debounce 版本注册事件监听，
  // 必须先 stopListening 解绑，再用 throttled 版本重新绑定。
  proto.stopListening.call(impl)
  impl.onUpdate = FunctionExt.throttle(originalOnUpdate.bind(impl), 60)
  proto.startListening.call(impl)
}
