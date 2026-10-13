import { useLayoutEffect, useState } from 'react'
import { useGraphStore } from '@/store/graphStore'
import { _patchScrollerForceUpdate } from '@/utils/plugin/X6patch'
import type { Scroller } from '@antv/x6'
import type { EntryGraphModel } from '~/types'

type GraphLoadingStage = 'initializing' | 'restoring' | 'ready'

/** 每次进入画布，在模型加载与布局完成后适应当前图层。 */
function useKeepAliveGraphViewport(
  active: boolean,
  layoutReady: boolean,
  model?: EntryGraphModel,
) {
  const graph = useGraphStore((state) => state.graph)
  const [stage, setStage] = useState<GraphLoadingStage>('initializing')

  useLayoutEffect(() => {
    if (!graph || !layoutReady) return
    // 隐藏画布仍需完成初始化，让模型列表解除加载状态。
    if (!active) {
      setStage('ready')
      return
    }
    const scroller = graph.getPlugin<Scroller>('scroller')
    if (!scroller) return
    setStage('restoring')
    let firstFrame = 0
    let secondFrame = 0
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        _patchScrollerForceUpdate(scroller)
        graph.zoomToFit({ padding: 16, useCellGeometry: true, maxScale: 1.2 })
        setStage('ready')
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [active, graph, layoutReady, model])

  return stage
}

export { useKeepAliveGraphViewport }
export type { GraphLoadingStage }
