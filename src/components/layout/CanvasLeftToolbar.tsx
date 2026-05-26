import { Tooltip } from 'antd'
import CanvasLeftToolbarHiddenSvg from '@/assets/svg/canvas-left-toolbar-hidden.svg?react'
import CanvasLeftToolbarNavToggleSvg from '@/assets/svg/canvas-left-toolbar-nav-toggle.svg?react'
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
          className={`canvas-left-toolbar__btn${navPanelVisible ? ' is-active' : ''}`}
          onClick={onToggleNavPanel}
        >
          <CanvasLeftToolbarNavToggleSvg />
        </button>
      </Tooltip>
      <Tooltip
        title={toolbarsVisible ? '隐藏工具栏' : '显示工具栏'}
        mouseEnterDelay={0.2}
        placement="right"
      >
        <button
          className={`canvas-left-toolbar__btn${toolbarsVisible ? ' is-active' : ''}`}
          onClick={onToggleToolbars}
        >
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
