import { LoginOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { BotIcon, CircleHelpIcon } from 'lucide-react'
import CanvasLeftToolbarHiddenSvg from '@/assets/svg/canvas-left-toolbar-hidden.svg?react'
import CanvasLeftToolbarVisibleSvg from '@/assets/svg/canvas-left-toolbar-visible.svg?react'
import { useAgentPanelStore } from '@/store/agentPanelStore'
import '@styles/CanvasLeftToolbar.scss'

type CanvasLeftToolbarProps = {
  navPanelVisible: boolean
  onToggleNavPanel: () => void
  toolbarsVisible: boolean
  onToggleToolbars: () => void
}

function CanvasLeftToolbar({
  navPanelVisible,
  onToggleNavPanel,
  toolbarsVisible,
  onToggleToolbars,
}: CanvasLeftToolbarProps) {
  const agentPanelVisible = useAgentPanelStore((state) => state.visible)
  const toggleAgentPanel = useAgentPanelStore((state) => state.toggle)

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
          {toolbarsVisible ? (
            <CanvasLeftToolbarVisibleSvg />
          ) : (
            <CanvasLeftToolbarHiddenSvg />
          )}
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
    </div>
  )
}

export { CanvasLeftToolbar }
