import { LoginOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import CanvasLeftToolbarHiddenSvg from '@/assets/svg/canvas-left-toolbar-hidden.svg?react'
import CanvasLeftToolbarVisibleSvg from '@/assets/svg/canvas-left-toolbar-visible.svg?react'
import '@/styles/CanvasLeftToolbar.scss'

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
    </div>
  )
}

export { CanvasLeftToolbar }
