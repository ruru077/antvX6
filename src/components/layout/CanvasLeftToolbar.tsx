import { LoginOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import {
  BotIcon,
  ChartNoAxesCombinedIcon,
  CircleHelpIcon,
  ImageIcon,
  ListTreeIcon,
  WrenchIcon,
  WrenchOffIcon,
} from 'lucide-react'
import CanvasToolbarCommentSvg from '@/assets/svg/canvas-toolbar-comment.svg?react'
import CanvasToolbarMinimapSvg from '@/assets/svg/canvas-toolbar-minimap.svg?react'
import {
  cancelAnnotationPlacement,
  startAnnotationPlacement,
} from '@/services/annotation-service'
import {
  cancelImageNodePlacement,
  startImageNodePlacement,
} from '@/services/image-node-service'
import { useAgentPanelStore } from '@/store/agentPanelStore'
import { useBottomPanelStore } from '@/store/bottomPanelStore'
import { useGraphStore } from '@/store/graphStore'
import { useTouchTerminal } from '@/utils/hooks/useTouchTerminal'
import '@styles/CanvasLeftToolbar.scss'

type CanvasLeftToolbarProps = {
  navPanelVisible: boolean
  onToggleNavPanel: () => void
  toolbarsVisible: boolean
  onToggleToolbars: () => void
  minimapVisible: boolean
  onToggleMinimap: () => void
}

type TouchPlacementMode = 'image' | 'annotation' | null

function CanvasLeftToolbar({
  navPanelVisible,
  onToggleNavPanel,
  toolbarsVisible,
  onToggleToolbars,
  minimapVisible,
  onToggleMinimap,
}: CanvasLeftToolbarProps) {
  const agentPanelVisible = useAgentPanelStore((state) => state.visible)
  const graph = useGraphStore((state) => state.graph)
  const touchTerminal = useTouchTerminal()
  const [touchPlacementMode, setTouchPlacementMode] =
    useState<TouchPlacementMode>(null)
  const toggleAgentPanel = useAgentPanelStore((state) => state.toggle)
  const hierarchyPanelOpen = useBottomPanelStore(
    (state) => state.visible && state.activeTab === 'hierarchy',
  )
  const signalAnalysisPanelOpen = useBottomPanelStore(
    (state) => state.visible && state.activeTab === 'signal-analysis',
  )

  useEffect(
    () => () => {
      if (!graph) return
      cancelAnnotationPlacement(graph)
      cancelImageNodePlacement(graph)
    },
    [graph],
  )

  return (
    <div className="canvas-left-toolbar">
      <Tooltip
        title={navPanelVisible ? '收起导航条' : '展开导航条'}
        mouseEnterDelay={0.2}
        placement="right"
      >
        <button
          className="canvas-left-toolbar__btn"
          style={{
            transform: `rotate(${navPanelVisible ? 90 : -90}deg)`,
            transition: 'transform 0.25s ease',
          }}
          onClick={onToggleNavPanel}
        >
          <LoginOutlined />
        </button>
      </Tooltip>
      <div className="canvas-left-toolbar__divider" />
      <Tooltip
        title={agentPanelVisible ? '关闭 Agent 面板' : '打开 Agent 面板'}
        mouseEnterDelay={0.2}
        placement="right"
      >
        <button
          type="button"
          data-active={agentPanelVisible}
          className="canvas-left-toolbar__btn"
          aria-label={agentPanelVisible ? '关闭 Agent 面板' : '打开 Agent 面板'}
          onClick={toggleAgentPanel}
        >
          <BotIcon />
        </button>
      </Tooltip>

      <Tooltip
        title={toolbarsVisible ? '隐藏工具栏' : '显示工具栏'}
        mouseEnterDelay={0.2}
        placement="right"
      >
        <button className="canvas-left-toolbar__btn" onClick={onToggleToolbars}>
          {toolbarsVisible ? <WrenchIcon /> : <WrenchOffIcon />}
        </button>
      </Tooltip>

      <Tooltip title="添加图片" mouseEnterDelay={0.2} placement="right">
        <button
          type="button"
          data-active={touchTerminal && touchPlacementMode === 'image'}
          className="canvas-left-toolbar__btn"
          aria-label="添加图片"
          aria-pressed={touchTerminal && touchPlacementMode === 'image'}
          onClick={() => {
            if (!graph) return
            cancelAnnotationPlacement(graph)
            cancelImageNodePlacement(graph)
            if (touchTerminal) setTouchPlacementMode('image')
            startImageNodePlacement(
              graph,
              touchTerminal ? () => setTouchPlacementMode(null) : undefined,
            )
          }}
        >
          <ImageIcon />
        </button>
      </Tooltip>

      <Tooltip title="注解" mouseEnterDelay={0.2} placement="right">
        <button
          type="button"
          data-active={touchTerminal && touchPlacementMode === 'annotation'}
          className="canvas-left-toolbar__btn"
          aria-label="注解"
          aria-pressed={touchTerminal && touchPlacementMode === 'annotation'}
          onClick={() => {
            if (!graph) return
            cancelImageNodePlacement(graph)
            cancelAnnotationPlacement(graph)
            if (touchTerminal) setTouchPlacementMode('annotation')
            startAnnotationPlacement(
              graph,
              touchTerminal ? () => setTouchPlacementMode(null) : undefined,
            )
          }}
        >
          <CanvasToolbarCommentSvg />
        </button>
      </Tooltip>

      <Tooltip title="键位指南" mouseEnterDelay={0.2} placement="right">
        <button
          type="button"
          className="canvas-left-toolbar__btn"
          aria-label="键位指南"
          onClick={() =>
            window.open(
              'https://www.douyin.com/',
              '_blank',
              'noopener,noreferrer',
            )
          }
        >
          <CircleHelpIcon />
        </button>
      </Tooltip>

      <Tooltip
        title={minimapVisible ? '隐藏小地图' : '小地图'}
        mouseEnterDelay={0.2}
        placement="right"
      >
        <button
          type="button"
          data-active={minimapVisible}
          className="canvas-left-toolbar__btn canvas-left-toolbar__btn--bottom"
          aria-label={minimapVisible ? '隐藏小地图' : '小地图'}
          onClick={onToggleMinimap}
        >
          <CanvasToolbarMinimapSvg />
        </button>
      </Tooltip>

      <Tooltip title="系统层级预览" mouseEnterDelay={0.2} placement="right">
        <button
          type="button"
          data-active={hierarchyPanelOpen}
          className="canvas-left-toolbar__btn"
          aria-label="系统层级预览"
          onClick={() =>
            useBottomPanelStore.getState().togglePanel('hierarchy')
          }
        >
          <ListTreeIcon />
        </button>
      </Tooltip>

      <Tooltip title="信号分析" mouseEnterDelay={0.2} placement="right">
        <button
          type="button"
          data-active={signalAnalysisPanelOpen}
          className="canvas-left-toolbar__btn"
          aria-label="信号分析"
          onClick={() =>
            useBottomPanelStore.getState().togglePanel('signal-analysis')
          }
        >
          <ChartNoAxesCombinedIcon />
        </button>
      </Tooltip>
    </div>
  )
}

export { CanvasLeftToolbar }
