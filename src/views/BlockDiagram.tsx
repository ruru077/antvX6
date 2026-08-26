import { useGraphListener } from '@hooks/useGraphListener'
import { useScrollListener } from '@hooks/useScrollListener'
import { App as AntdApp, ConfigProvider } from 'antd'
import {
  AgentPanel,
  DiagramCanvas,
  PanelSplitter,
  ScopeWindow,
  StencilLayout,
} from '@/components'
import { bindAntdMessage } from '@/services/antd-message-service'
import { useGraphStore } from '@/store/graphStore'
import '@styles/BlockDiagram.scss'

const SPLITTER_THEME = {
  token: {
    colorPrimary: '#1890ff',
  },
  components: {
    Splitter: {
      splitBarSize: 4,
      splitTriggerSize: 12,
      splitBarDraggableSize: 80,
    },
  },
}

/**
 * @description 图编辑入口
 * @returns
 */
function DiagramWorkspace() {
  const { message } = AntdApp.useApp()
  const paperContainerRef = useRef<HTMLDivElement>(null)

  bindAntdMessage(message)
  useGraphListener()
  useScrollListener(paperContainerRef)

  useEffect(() => {
    if (!paperContainerRef.current) return
    const { initGraph, destroyGraph } = useGraphStore.getState()
    initGraph(paperContainerRef.current)
    return destroyGraph
  }, [])

  return (
    <PanelSplitter
      variant="workspace"
      stencil={<StencilLayout />}
      canvas={
        <>
          {/* 画布区域 */}
          <DiagramCanvas paperContainerRef={paperContainerRef} />
          <ScopeWindow />
        </>
      }
      agent={<AgentPanel />}
    />
  )
}

function BlockDiagram({ modelName }: { modelName?: string }) {
  return (
    <ConfigProvider theme={SPLITTER_THEME}>
      <AntdApp component={false}>
        <DiagramWorkspace />
      </AntdApp>
    </ConfigProvider>
  )
}

export default BlockDiagram
export { BlockDiagram as Component } // Data Router Lazy
