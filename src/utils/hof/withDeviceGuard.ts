import { TOUCH_TERMINAL } from '@/utils/hooks/useTouchTerminal'

type DeviceScope = 'desktop' | 'touch'

/** 根据页面加载时确定的终端类型决定是否执行 handler。 */
function withDeviceGuard<TArgs extends unknown[], TResult>(
  scope: DeviceScope,
  handler: (...args: TArgs) => TResult,
) {
  return (...args: TArgs): TResult | undefined => {
    const matched = scope === 'touch' ? TOUCH_TERMINAL : !TOUCH_TERMINAL
    if (!matched) return
    return handler(...args)
  }
}

export { withDeviceGuard }
export type { DeviceScope }
