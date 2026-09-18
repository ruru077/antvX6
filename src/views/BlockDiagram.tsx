import { useGraphListener } from '@hooks/useGraphListener'
import { useScrollListener } from '@hooks/useScrollListener'
import { App as AntdApp, ConfigProvider } from 'antd'
import {
  DiagramCanvas,
  PanelSplitter,
  ScopeWindow,
  StencilLayout,
} from '@/components'
import { WorkspaceLoadingBoundary } from '@/components/layout/WorkspaceLoadingBoundary'
import { bindAntdMessage } from '@/services/antd-message-service'
import { loadEntryGraphModel } from '@/services/subsystem-service'
import { useGraphStore } from '@/store/graphStore'
import { useInterpreterStore } from '@/store/interpreterStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useTouchAdapter } from '@/touch/useTouchAdapter'
import { useKeepAliveGraphViewport } from '@/utils/hooks/useKeepAliveGraphViewport'
import { useTouchTerminal } from '@/utils/hooks/useTouchTerminal'
import type { InterpreterConfig } from '@/store/interpreterStore'
import type { EntryGraphModel } from '~/types'
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
function DiagramWorkspace({
  initialModel,
  modelId,
  modelName,
  initialConfig,
  exchangePath,
  showIssueLink,
}: {
  initialModel?: EntryGraphModel
  modelId?: number | string
  modelName?: string
  initialConfig?: InterpreterConfig
  exchangePath: string
  showIssueLink: boolean
}) {
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
  useEffect(() => {
    if (!initialModel || modelId == null) return
    const graph = useGraphStore.getState().graph
    if (!graph) return

    loadEntryGraphModel(initialModel, graph)
    if (!modelName) throw new Error('模型详情缺少 modelName')
    if (!initialConfig) throw new Error('模型详情缺少 config')
    useSubGraphStore.setState({ modelName })
    useInterpreterStore.getState().setConfig(initialConfig)
    graph.fromJSON(
      initialModel.subGraphs[initialModel.currentGraphId].graphJson,
    )
    useSubGraphStore.getState().markSaved()
  }, [initialConfig, initialModel, modelId, modelName])
  const graphLoadingStage = useKeepAliveGraphViewport()
  const workspaceStage = stencilReady ? graphLoadingStage : 'initializing'

  return (
    <WorkspaceLoadingBoundary stage={workspaceStage}>
      <PanelSplitter
        variant="workspace"
        stencil={<StencilLayout onReady={() => setStencilReady(true)} />}
        canvas={
          <>
            {/* 画布区域 */}
            <DiagramCanvas
              paperContainerRef={paperContainerRef}
              exchangePath={exchangePath}
              showIssueLink={showIssueLink}
              modelId={modelId}
            />
            <ScopeWindow />
          </>
        }
      />
    </WorkspaceLoadingBoundary>
  )
}

function BlockDiagram({
  initialModel,
  modelId,
  modelName,
  initialConfig,
  exchangePath = '/exchange',
  showIssueLink = false,
}: {
  initialModel?: EntryGraphModel
  modelId?: number | string
  modelName?: string
  initialConfig?: InterpreterConfig
  exchangePath?: string
  showIssueLink?: boolean
}) {
  const touchTerminal = useTouchTerminal()

  return (
    <ConfigProvider
      theme={SPLITTER_THEME}
      tooltip={{ trigger: touchTerminal ? [] : 'hover' }}
    >
      <AntdApp component={false}>
        <DiagramWorkspace
          initialModel={initialModel}
          modelId={modelId}
          modelName={modelName}
          initialConfig={initialConfig}
          exchangePath={exchangePath}
          showIssueLink={showIssueLink}
        />
      </AntdApp>
    </ConfigProvider>
  )
}

export default BlockDiagram
export { BlockDiagram as Component } // Data Router Lazy
