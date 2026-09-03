import { useConfigStore } from '@/store/configStore'
import type { Graph, Selection } from '@antv/x6'

interface ConfigurableSelectionImpl {
  options: {
    movingRouterFallback?: string
  }
}

interface ConfigurableSelection {
  selectionImpl?: ConfigurableSelectionImpl
}

function createSettingService() {
  /** 注册 Selection 性能配置，并随 Graph 生命周期清理订阅。 */
  function registerSelectionSettings(graph: Graph, selection: Selection) {
    const selectionImpl = (selection as unknown as ConfigurableSelection)
      .selectionImpl
    if (!selectionImpl)
      throw new Error('Selection must be mounted before settings registration')

    function syncMovingRouterFallback(enabled: boolean) {
      selectionImpl!.options.movingRouterFallback = enabled ? 'orth' : undefined
    }

    syncMovingRouterFallback(
      useConfigStore.getState().selectionMovingRouterFallbackEnabled,
    )
    const unsubscribe = useConfigStore.subscribe(
      (state) => state.selectionMovingRouterFallbackEnabled,
      syncMovingRouterFallback,
    )

    const dispose = graph.dispose.bind(graph)
    graph.dispose = (clean?: boolean) => {
      unsubscribe()
      dispose(clean)
    }
  }

  return { registerSelectionSettings }
}

export { createSettingService }
