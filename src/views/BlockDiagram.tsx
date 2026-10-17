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
import { ModelRecoveryDialog } from '@/components/ModelRecoveryDialog'
import { bindAntdMessage } from '@/services/antd-message-service'
import { removeModelAutosave } from '@/services/model-autosave-service'
import { useNcslabContextStore } from '@/services/ncslab-context-service'
import { loadEntryGraphModel } from '@/services/subsystem-service'
import { useGraphStore } from '@/store/graphStore'
import { useInterpreterStore } from '@/store/interpreterStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useTouchAdapter } from '@/touch/useTouchAdapter'
import { useKeepAliveGraphViewport } from '@/utils/hooks/useKeepAliveGraphViewport'
import { useModelAutosave } from '@/utils/hooks/useModelAutosave'
import { useTouchTerminal } from '@/utils/hooks/useTouchTerminal'
import type {
  ModelAutosaveInfo,
  ModelContent,
} from '@/services/model-autosave-service'
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

type BlockDiagramProps = {
  initialModel?: EntryGraphModel
  modelId?: number | string
  modelName?: string
  initialConfig?: InterpreterConfig
  savedContent?: ModelContent
  recovery?: ModelAutosaveInfo | null
  lastUpdate?: string
  exchangePath?: string
  showIssueLink?: boolean
  onReady?: () => void
  active?: boolean
  visible?: boolean
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
  savedContent,
  recovery,
  lastUpdate,
  exchangePath = '/exchange',
  showIssueLink = false,
  onReady,
  active = true,
  visible = true,
}: BlockDiagramProps) {
  const { message } = AntdApp.useApp()
  const paperContainerRef = useRef<HTMLDivElement>(null)
  const [stencilReady, setStencilReady] = useState(false)
  const [resolvedRecovery, setResolvedRecovery] =
    useState<EntryGraphModel | null>(null)
  const [restored, setRestored] = useState<{
    sourceModel: EntryGraphModel
    content: ModelContent
  } | null>(null)
  const restoredContent =
    restored && restored.sourceModel === initialModel ? restored.content : null
  const displayedModel = restoredContent?.graphModel ?? initialModel
  const displayedConfig = restoredContent?.config ?? initialConfig
  const recoveryPending = recovery != null && resolvedRecovery !== initialModel

  bindAntdMessage(message)
  useGraphListener()
  useTouchAdapter()
  useScrollListener(paperContainerRef)
  useLayoutEffect(() => {
    if (!paperContainerRef.current) return
    const { initGraph, destroyGraph } = useGraphStore.getState()
    initGraph(paperContainerRef.current)
    return destroyGraph
  }, [])
  useLayoutEffect(() => {
    if (!initialModel || !displayedModel || modelId == null) return
    const graph = useGraphStore.getState().graph
    if (!graph) return

    loadEntryGraphModel(displayedModel, graph)
    if (!modelName) throw new Error('模型详情缺少 modelName')
    if (!initialConfig || !displayedConfig)
      throw new Error('模型详情缺少 config')
    useSubGraphStore.setState({ modelName })
    useInterpreterStore.getState().setConfig(displayedConfig)
    graph.fromJSON(
      displayedModel.subGraphs[displayedModel.currentGraphId].graphJson,
    )
    useSubGraphStore.getState().markSaved(
      savedContent ?? {
        graphModel: initialModel,
        config: initialConfig,
      },
    )
  }, [
    displayedConfig,
    displayedModel,
    initialConfig,
    initialModel,
    modelId,
    modelName,
    savedContent,
  ])
  // 在上面的模型加载 layout effect 之后安排画布适应。
  const graphLoadingStage = useKeepAliveGraphViewport(
    active,
    stencilReady,
    displayedModel,
  )
  const workspaceStage = stencilReady ? graphLoadingStage : 'initializing'
  useModelAutosave(
    active && workspaceStage === 'ready' && !recoveryPending,
    modelId,
  )
  useEffect(() => {
    if (workspaceStage === 'ready') onReady?.()
  }, [onReady, workspaceStage])

  function chooseRecovery(source: 'database' | 'autosave' | 'discard') {
    if (!initialModel || !recovery || modelId == null) return
    try {
      if (source === 'discard') {
        const userId = useNcslabContextStore.getState().context?.user.id
        if (userId == null) throw new Error('缺少用户上下文')
        removeModelAutosave(userId, modelId)
      }
      if (source === 'autosave') {
        setRestored({ sourceModel: initialModel, content: recovery.content })
      }
      setResolvedRecovery(initialModel)
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <WorkspaceLoadingBoundary
      stage={workspaceStage}
      showInitializingStage={false}
    >
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
      {recovery && (
        <ModelRecoveryDialog
          open={
            active && visible && workspaceStage === 'ready' && recoveryPending
          }
          autosave={recovery}
          lastUpdate={lastUpdate}
          onChoose={chooseRecovery}
        />
      )}
    </WorkspaceLoadingBoundary>
  )
}

function BlockDiagram(props: BlockDiagramProps) {
  const touchTerminal = useTouchTerminal()

  return (
    <ConfigProvider
      theme={SPLITTER_THEME}
      tooltip={{ trigger: touchTerminal ? [] : 'hover' }}
    >
      <AntdApp component={false}>
        <DiagramWorkspace {...props} />
      </AntdApp>
    </ConfigProvider>
  )
}

export default BlockDiagram
export { BlockDiagram as Component } // Data Router Lazy
