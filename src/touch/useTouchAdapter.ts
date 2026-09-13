import { useGraphStore } from '@/store/graphStore'
import { registerTouchArrowheadTools } from '@/touch/graph/touch-arrowhead-tool'
import { touchGraphInteractionAdapter } from '@/touch/graph/touch-edge-interaction'
import { registerTouchInteractions } from '@/touch/graph/touch-interaction-service'
import { registerGraphInteractionAdapter } from '@/touch/service/graph-interaction-adapter-service'
import { registerStencilPresentationAdapter } from '@/touch/service/stencil-presentation-adapter-service'
import { touchStencilPresentationAdapter } from '@/touch/stencil/touch-stencil-presentation'
import { useTouchTerminal } from '@/utils/hooks/useTouchTerminal'

/** 触控端唯一启动入口：先注册静态策略，Graph 创建后再挂载手势。 */
function useTouchAdapter() {
  const graph = useGraphStore((state) => state.graph)
  const touchTerminal = useTouchTerminal()

  useLayoutEffect(() => {
    if (!touchTerminal) return

    // Graph 在普通 useEffect 中初始化，layout effect 可确保自定义 Tool 先完成注册。
    registerTouchArrowheadTools()
    const unregisterGraphAdapter = registerGraphInteractionAdapter(
      touchGraphInteractionAdapter,
    )
    const unregisterStencilAdapter = registerStencilPresentationAdapter(
      touchStencilPresentationAdapter,
    )

    return () => {
      unregisterStencilAdapter()
      unregisterGraphAdapter()
    }
  }, [touchTerminal])

  useEffect(() => {
    if (!touchTerminal || !graph) return
    return registerTouchInteractions(graph)
  }, [graph, touchTerminal])
}

export { useTouchAdapter }
