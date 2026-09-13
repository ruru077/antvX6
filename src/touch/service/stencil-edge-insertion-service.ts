import { withDeviceGuard } from '@/utils/hof/withDeviceGuard'

type TouchStencilEdgeInsertionLifecycle = {
  onMove: () => void
  onEnd: () => void
}

/** 为 Stencil Edge Intersection 补齐触控拖拽生命周期。 */
function registerTouchStencilEdgeInsertionLifecycle({
  onMove,
  onEnd,
}: TouchStencilEdgeInsertionLifecycle) {
  return withDeviceGuard('touch', () => {
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)

    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  })()
}

export { registerTouchStencilEdgeInsertionLifecycle }
