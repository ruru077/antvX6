import { type Graph } from '@antv/x6'
import { Tooltip } from 'antd'
import { createStencilService } from '@/services/stencil-service'
import { useGraphStore } from '@/store/graphStore'
import './StencilPanel.scss'

type StencilPanelProps = {
  toolbarsVisible: boolean
  setToolbarsVisible: (updater: (value: boolean) => boolean) => void
}

function StencilPanel({
  toolbarsVisible,
  setToolbarsVisible,
}: StencilPanelProps) {
  const graph = useGraphStore((s) => s.graph)
  const stencilContainerRef = useRef<HTMLDivElement>(null)
  const stencilServiceRef = useRef<ReturnType<
    typeof createStencilService
  > | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!graph || !stencilContainerRef.current) return
    const service = createStencilService(stencilContainerRef.current)
    service.create(graph)
    stencilServiceRef.current = service
    return () => {
      service.dispose()
      stencilServiceRef.current = null
    }
  }, [graph])

  const handleExpandAll = () => stencilServiceRef.current?.expandAll()
  const handleCollapseAll = () => stencilServiceRef.current?.collapseAll()
  const handleToggleToolbars = () => setToolbarsVisible((value) => !value)
  const handleToggleCollapsed = () => setCollapsed((value) => !value)

  return (
    <div
      className={`stencil-wrapper${collapsed ? ' stencil-wrapper--collapsed' : ''}`}
    >
      <div className="stencil-header">
        {!collapsed && (
          <div className="stencil-header-left">
            <Tooltip
              title="展开所有分组"
              mouseEnterDelay={0.2}
              placement="bottom"
            >
              <button
                className="stencil-icon-btn"
                onClick={handleExpandAll}
                style={{
                  border: '1px solid #ccc',
                }}
              >
                <svg
                  viewBox="0 0 8 13"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M5.88017 4.29065C6.14747 4.55796 6.58086 4.55796 6.84816 4.29065C7.11546 4.02335 7.11546 3.58996 6.84816 3.32266L4.0095 0.483997L3.5255 0L3.04151 0.483997L0.202847 3.32266C-0.0644574 3.58996 -0.0644574 4.02335 0.202847 4.29065C0.470151 4.55796 0.903537 4.55796 1.17084 4.29065L3.5255 1.93599L5.88017 4.29065ZM1.16847 7.93496C0.901168 7.66766 0.467783 7.66766 0.200478 7.93496C-0.0668261 8.20227 -0.0668261 8.63565 0.200478 8.90296L3.03914 11.7416L3.52313 12.2256L4.00713 11.7416L6.84579 8.90296C7.1131 8.63565 7.1131 8.20227 6.84579 7.93496C6.57849 7.66766 6.1451 7.66766 5.8778 7.93496L3.52313 10.2896L1.16847 7.93496Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </Tooltip>
            <Tooltip
              title="折叠所有分组"
              mouseEnterDelay={0.2}
              placement="bottom"
            >
              <button
                className="stencil-icon-btn"
                onClick={handleCollapseAll}
                style={{
                  border: '1px solid #ccc',
                }}
              >
                <svg
                  viewBox="0 0 8 11"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M5.88017 0.200478C6.14747 -0.0668261 6.58086 -0.0668261 6.84816 0.200478C7.11546 0.467783 7.11546 0.901168 6.84816 1.16847L4.0095 4.00713L3.5255 4.49113L3.04151 4.00713L0.202847 1.16847C-0.0644574 0.901168 -0.0644574 0.467783 0.202847 0.200478C0.470151 -0.0668261 0.903537 -0.0668261 1.17084 0.200478L3.5255 2.55514L5.88017 0.200478ZM1.16847 9.45851C0.901168 9.72582 0.467783 9.72582 0.200478 9.45851C-0.0668261 9.19121 -0.0668261 8.75782 0.200478 8.49052L3.03914 5.65186L3.52313 5.16786L4.00713 5.65186L6.84579 8.49052C7.1131 8.75782 7.1131 9.19121 6.84579 9.45851C6.57849 9.72582 6.1451 9.72582 5.8778 9.45851L3.52313 7.10385L1.16847 9.45851Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </Tooltip>
          </div>
        )}
        <span className="stencil-title">123456</span>
        <div className="stencil-header-actions">
          {!collapsed && (
            <Tooltip
              title={toolbarsVisible ? '隐藏工具栏' : '显示工具栏'}
              mouseEnterDelay={0.2}
              placement="bottom"
            >
              <button
                className={`stencil-visibility-btn${toolbarsVisible ? ' is-active' : ''}`}
                onClick={handleToggleToolbars}
              >
                {toolbarsVisible ? (
                  <svg
                    width="24"
                    height="24"
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
                    width="24"
                    height="24"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g clipPath="url(#clip0_5_165)">
                      <path
                        d="M16.5466 9L17.3333 2.66666L14.0933 6.56M24.76 17.2133L28 13.3333H20.88M10.6666 10.6667L3.99998 18.6667H16L14.6666 29.3333L21.3333 21.3333M1.33331 1.33333L30.6666 30.6667"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_5_165">
                        <rect width="32" height="32" fill="white" />
                      </clipPath>
                    </defs>
                  </svg>
                )}
              </button>
            </Tooltip>
          )}
          <Tooltip
            title={collapsed ? '展开' : '收起'}
            mouseEnterDelay={0.2}
            placement="bottom"
          >
            <button
              className={`stencil-toggle-btn${collapsed ? '' : ' stencil-toggle-btn--open'}`}
              onClick={handleToggleCollapsed}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <polyline
                  points="11,4 6,8 11,12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>
      <div ref={stencilContainerRef} className="stencil"></div>
    </div>
  )
}

export default StencilPanel
