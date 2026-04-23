import { Tooltip } from 'antd'
import './CanvasLeftToolbar.scss'

type CanvasLeftToolbarProps = {
  navPanelVisible: boolean
  onToggleNavPanel: () => void
}

function CanvasLeftToolbar({
  navPanelVisible,
  onToggleNavPanel,
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
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
            <line x1="1.5" y1="5.5" x2="14.5" y2="5.5" />
          </svg>
        </button>
      </Tooltip>
    </div>
  )
}

export default CanvasLeftToolbar
