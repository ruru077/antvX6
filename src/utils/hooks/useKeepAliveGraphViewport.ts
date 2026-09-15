import { Scroller } from '@antv/x6'
import { useEffectOnActive } from 'keepalive-for-react'
import { useRef } from 'react'
import { useGraphStore } from '@/store/graphStore'

interface ScrollerPosition {
  left: number
  top: number
}

/**
 * KeepAlive 会在路由失活时把缓存节点移出 DOM，Scroller 因此短暂变为 0×0。
 * 记录失活前的滚动位置，并在节点重新挂回 DOM 完成布局后恢复。
 */
function useKeepAliveGraphViewport() {
  const positionRef = useRef<ScrollerPosition | null>(null)

  useEffectOnActive(() => {
    const graph = useGraphStore.getState().graph
    const scroller = graph?.getPlugin<Scroller>('scroller')
    if (!scroller) return

    let firstFrame = 0
    let secondFrame = 0
    const position = positionRef.current

    if (position) {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          scroller.setScrollbarPosition(position.left, position.top)
        })
      })
    }

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      positionRef.current = scroller.getScrollbarPosition()
    }
  }, [])
}

export { useKeepAliveGraphViewport }
