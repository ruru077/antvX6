import { Scroller } from '@antv/x6'
import { useEffectOnActive } from 'keepalive-for-react'
import { useRef, useState } from 'react'
import { useGraphStore } from '@/store/graphStore'

type GraphLoadingStage = 'initializing' | 'ready'

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
  const initializedRef = useRef(false)
  const [stage, setStage] = useState<GraphLoadingStage>('initializing')

  useEffectOnActive(() => {
    const graph = useGraphStore.getState().graph
    const scroller = graph?.getPlugin<Scroller>('scroller')
    if (!scroller) return

    let firstFrame = 0
    let secondFrame = 0
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const position = positionRef.current
        if (position) {
          scroller.setScrollbarPosition(position.left, position.top)
          return
        }

        const { pageWidth, pageHeight } = scroller.options
        if (pageWidth == null || pageHeight == null) {
          throw new Error('Scroller page size is required to center the graph')
        }
        scroller.centerPoint(pageWidth / 2, pageHeight / 2)
        initializedRef.current = true
        setStage('ready')
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      if (initializedRef.current) {
        positionRef.current = scroller.getScrollbarPosition()
      }
    }
  }, [])

  return stage
}

export { useKeepAliveGraphViewport }
export type { GraphLoadingStage }
