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
import { WorkspaceLoadingBoundary } from '@/components/layout/WorkspaceLoadingBoundary'
import { bindAntdMessage } from '@/services/antd-message-service'
import { useGraphStore } from '@/store/graphStore'
import { useTouchAdapter } from '@/touch/useTouchAdapter'
import { useKeepAliveGraphViewport } from '@/utils/hooks/useKeepAliveGraphViewport'
import { useTouchTerminal } from '@/utils/hooks/useTouchTerminal'
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
function DiagramWorkspace({ showIssueLink }: { showIssueLink: boolean }) {
  const { message } = AntdApp.useApp()
  const paperContainerRef = useRef<HTMLDivElement>(null)
  const [stencilReady, setStencilReady] = useState(false)

  bindAntdMessage(message)
  useGraphListener()
  useTouchAdapter()
  useScrollListener(paperContainerRef)
  useEffect(() => {
    if (!paperContainerRef.current) return
    const { initGraph, destroyGraph } = useGraphStore.getState()
    initGraph(paperContainerRef.current)
    return destroyGraph
  }, [])
  const graphLoadingStage = useKeepAliveGraphViewport()
  const workspaceReady = graphLoadingStage === 'ready' && stencilReady

  return (
    <WorkspaceLoadingBoundary ready={workspaceReady}>
      <PanelSplitter
        variant="workspace"
        stencil={<StencilLayout onReady={() => setStencilReady(true)} />}
        canvas={
          <>
            {/* 画布区域 */}
            <DiagramCanvas
              paperContainerRef={paperContainerRef}
              showIssueLink={showIssueLink}
            />
            <ScopeWindow />
          </>
        }
        agent={<AgentPanel />}
      />
    </WorkspaceLoadingBoundary>
  )
}

function BlockDiagram({
  showIssueLink = false,
}: {
  modelName?: string
  showIssueLink?: boolean
}) {
  const touchTerminal = useTouchTerminal()

  return (
    <ConfigProvider
      theme={SPLITTER_THEME}
      tooltip={{ trigger: touchTerminal ? [] : 'hover' }}
    >
      <AntdApp component={false}>
        <DiagramWorkspace showIssueLink={showIssueLink} />
      </AntdApp>
    </ConfigProvider>
  )
}

export default BlockDiagram
export { BlockDiagram as Component } // Data Router Lazy
