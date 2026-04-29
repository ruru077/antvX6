import { Tooltip } from 'antd'
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
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.3333 2.66667L4 18.6667H16L14.6667 29.3333L28 13.3333H16L17.3333 2.66667Z"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clipPath="url(#clip0_toolbar_off)">
                <path
                  d="M16.5466 9L17.3333 2.66666L14.0933 6.56M24.76 17.2133L28 13.3333H20.88M10.6666 10.6667L3.99998 18.6667H16L14.6666 29.3333L21.3333 21.3333M1.33331 1.33333L30.6666 30.6667"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              <defs>
                <clipPath id="clip0_toolbar_off">
                  <rect width="32" height="32" fill="white" />
                </clipPath>
              </defs>
            </svg>
          )}
        </button>
      </Tooltip>
    </div>
  )
}

export { CanvasLeftToolbar }
