import type { Graph } from '@antv/x6'
import { Dropdown } from 'antd'
import { Tooltip } from 'antd'
import { createMinimapService } from '@/services/minimap-service'
import './CanvasToolbars.scss'

type CanvasToolbarsProps = {
  graph: Graph | null
  zoom: number
  visible: boolean
}

function CanvasToolbars({ graph, zoom, visible }: CanvasToolbarsProps) {
  const getExportViewBox = () => {
    if (!graph) return null

    const bbox = graph.getContentBBox()
    const padding = 16
    return {
      x: bbox.x - padding,
      y: bbox.y - padding,
      width: bbox.width + padding * 2,
      height: bbox.height + padding * 2,
    }
  }

  const handleZoomIn = () => graph?.zoom(0.1)
  const handleZoomOut = () => graph?.zoom(-0.1)
  const handleFit = () =>
    graph?.zoomToFit({
      padding: 16,
      useCellGeometry: false, // TODO 2期
    })
  const handleCenter = () => graph?.centerContent()
  const handleExportSVG = () => {
    if (!graph) return

    graph.exportSVG('diagram', {
      copyStyles: false,
      preserveDimensions: true,
      viewBox: getExportViewBox() ?? undefined,
    })
  }

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [minimapVisible, setMinimapVisible] = useState(false)
  const minimapContainerRef = useRef<HTMLDivElement>(null)
  const minimapServiceRef = useRef<ReturnType<
    typeof createMinimapService
  > | null>(null)

  useEffect(() => {
    if (!graph || !minimapContainerRef.current) return
    const service = createMinimapService()
    service.create(graph, minimapContainerRef.current)
    minimapServiceRef.current = service
    return () => {
      service.dispose()
      minimapServiceRef.current = null
    }
  }, [graph])

  const handleToggleMinimap = () => setMinimapVisible((v) => !v)

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const exportMenuItems = [
    {
      key: 'png',
      label: '导出为 PNG',
      onClick: () =>
        graph?.exportPNG('diagram', {
          padding: 16,
        }),
    },
    {
      key: 'jpeg',
      label: '导出为 JPEG',
      onClick: () => graph?.exportJPEG('diagram'),
    },
    {
      key: 'svg',
      label: '导出为 SVG',
      onClick: handleExportSVG,
    },
  ]

  return (
    <>
      <div className={`canvas-left-toolbar${visible ? '' : ' is-hidden'}`}>
        <Tooltip title="选择" mouseEnterDelay={0.2} placement="right">
          <button className="toolbar-btn">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M3 2l10 6-5 1.5L6 14z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
        <Tooltip title="手型平移" mouseEnterDelay={0.2} placement="right">
          <button className="toolbar-btn">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M6 2v6M10 4v4M4 7v3M8 6v4M12 7v3"
                strokeLinecap="round"
              />
              <path
                d="M4 10c0 2 8 2 8 0"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </Tooltip>
        <span className="toolbar-divider-h" />
        <Tooltip title="矩形" mouseEnterDelay={0.2} placement="right">
          <button className="toolbar-btn">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="2" y="4" width="12" height="8" rx="1" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip title="圆形" mouseEnterDelay={0.2} placement="right">
          <button className="toolbar-btn">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="5" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip title="菱形" mouseEnterDelay={0.2} placement="right">
          <button className="toolbar-btn">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polygon points="8,2 14,8 8,14 2,8" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip title="文本" mouseEnterDelay={0.2} placement="right">
          <button className="toolbar-btn">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <line x1="3" y1="4" x2="13" y2="4" strokeLinecap="round" />
              <line x1="8" y1="4" x2="8" y2="13" strokeLinecap="round" />
            </svg>
          </button>
        </Tooltip>
      </div>

      <div className={`canvas-float-toolbar${visible ? '' : ' is-hidden'}`}>
        <Tooltip
          title={isFullscreen ? '退出全屏' : '全屏'}
          mouseEnterDelay={0.2}
          placement="top"
        >
          <button className="toolbar-btn" onClick={handleFullscreen}>
            {isFullscreen ? (
              <svg
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.6667 4V8C10.6667 8.70724 10.3857 9.38552 9.88562 9.88562C9.38552 10.3857 8.70724 10.6667 8 10.6667H4M28 10.6667H24C23.2928 10.6667 22.6145 10.3857 22.1144 9.88562C21.6143 9.38552 21.3333 8.70724 21.3333 8V4M21.3333 28V24C21.3333 23.2928 21.6143 22.6145 22.1144 22.1144C22.6145 21.6143 23.2928 21.3333 24 21.3333H28M4 21.3333H8C8.70724 21.3333 9.38552 21.6143 9.88562 22.1144C10.3857 22.6145 10.6667 23.2928 10.6667 24V28" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 5V2h3M12 2h3v3M15 11v3h-3M4 14H1v-3" />
              </svg>
            )}
          </button>
        </Tooltip>
        <Tooltip title="适应画布" mouseEnterDelay={0.2} placement="top">
          <button className="toolbar-btn" onClick={handleFit}>
            <svg viewBox="0 0 1024 1024" fill="currentColor">
              <path d="M78.506667 332.8c-13.653333 0-25.6-11.946667-25.6-25.6V117.76c0-40.96 32.426667-73.386667 73.386666-73.386667h189.44c13.653333 0 25.6 11.946667 25.6 25.6s-11.946667 25.6-25.6 25.6H126.293333c-11.946667 0-22.186667 10.24-22.186666 22.186667V307.2c0 15.36-11.946667 25.6-25.6 25.6zM315.733333 950.613333H126.293333c-40.96 0-73.386667-32.426667-73.386666-73.386666V687.786667c0-13.653333 11.946667-25.6 25.6-25.6s25.6 11.946667 25.6 25.6v189.44c0 11.946667 10.24 22.186667 22.186666 22.186666h189.44c13.653333 0 25.6 11.946667 25.6 25.6s-11.946667 25.6-25.6 25.6zM884.053333 950.613333H694.613333c-13.653333 0-25.6-11.946667-25.6-25.6s11.946667-25.6 25.6-25.6h189.44c11.946667 0 22.186667-10.24 22.186667-22.186666V687.786667c0-13.653333 11.946667-25.6 25.6-25.6s25.6 11.946667 25.6 25.6v189.44c0 39.253333-32.426667 73.386667-73.386667 73.386666zM931.84 332.8c-13.653333 0-25.6-11.946667-25.6-25.6V117.76c0-11.946667-10.24-22.186667-22.186667-22.186667H694.613333c-13.653333 0-25.6-11.946667-25.6-25.6s11.946667-25.6 25.6-25.6h189.44c40.96 0 73.386667 32.426667 73.386667 73.386667V307.2c0 15.36-11.946667 25.6-25.6 25.6zM694.613333 759.466667H315.733333c-40.96 0-73.386667-32.426667-73.386666-73.386667V307.2c0-40.96 32.426667-73.386667 73.386666-73.386667h378.88c40.96 0 73.386667 32.426667 73.386667 73.386667v378.88c0 40.96-32.426667 73.386667-73.386667 73.386667zM315.733333 286.72c-11.946667 0-22.186667 10.24-22.186666 22.186667v378.88c0 11.946667 10.24 22.186667 22.186666 22.186666h378.88c11.946667 0 22.186667-10.24 22.186667-22.186666V307.2c0-11.946667-10.24-22.186667-22.186667-22.186667H315.733333z" />
            </svg>
          </button>
        </Tooltip>
        <span className="toolbar-divider" />
        <Tooltip title="缩小" mouseEnterDelay={0.2} placement="top">
          <button className="toolbar-btn" onClick={handleZoomOut}>
            <svg viewBox="0 0 1024 1024" fill="currentColor">
              <path d="M213.333333 469.333333m21.333334 0l554.666666 0q21.333333 0 21.333334 21.333334l0 42.666666q0 21.333333-21.333334 21.333334l-554.666666 0q-21.333333 0-21.333334-21.333334l0-42.666666q0-21.333333 21.333334-21.333334Z" />
            </svg>
          </button>
        </Tooltip>
        <span className="toolbar-zoom-label">{zoom}%</span>
        <Tooltip title="放大" mouseEnterDelay={0.2} placement="top">
          <button className="toolbar-btn" onClick={handleZoomIn}>
            <svg viewBox="0 0 1024 1024" fill="currentColor">
              <path d="M469.333333 469.333333V234.666667a21.333333 21.333333 0 0 1 21.333334-21.333334h42.666666a21.333333 21.333333 0 0 1 21.333334 21.333334V469.333333h234.666666a21.333333 21.333333 0 0 1 21.333334 21.333334v42.666666a21.333333 21.333333 0 0 1-21.333334 21.333334H554.666667v234.666666a21.333333 21.333333 0 0 1-21.333334 21.333334h-42.666666a21.333333 21.333333 0 0 1-21.333334-21.333334V554.666667H234.666667a21.333333 21.333333 0 0 1-21.333334-21.333334v-42.666666a21.333333 21.333333 0 0 1 21.333334-21.333334H469.333333z" />
            </svg>
          </button>
        </Tooltip>
        <span className="toolbar-divider" />
        {/* <Tooltip title="适应画布" mouseEnterDelay={0.2} placement="top">
          <button className="toolbar-btn" onClick={handleFit}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M1 5V2h3M12 2h3v3M15 11v3h-3M4 14H1v-3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </Tooltip> */}
        <Tooltip title="注解" mouseEnterDelay={0.2} placement="top">
          <button className="toolbar-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.5 9C5.94772 9 5.5 9.44772 5.5 10V11C5.5 11.5523 5.94772 12 6.5 12H7.5C8.05228 12 8.5 11.5523 8.5 11V10C8.5 9.44772 8.05228 9 7.5 9H6.5zM11.5 9C10.9477 9 10.5 9.44772 10.5 10V11C10.5 11.5523 10.9477 12 11.5 12H12.5C13.0523 12 13.5 11.5523 13.5 11V10C13.5 9.44772 13.0523 9 12.5 9H11.5zM15.5 10C15.5 9.44772 15.9477 9 16.5 9H17.5C18.0523 9 18.5 9.44772 18.5 10V11C18.5 11.5523 18.0523 12 17.5 12H16.5C15.9477 12 15.5 11.5523 15.5 11V10z" />
              <path d="M23 4C23 2.9 22.1 2 21 2H3C1.9 2 1 2.9 1 4V17.0111C1 18.0211 1.9 19.0111 3 19.0111H7.7586L10.4774 22C10.9822 22.5017 11.3166 22.6311 12 22.7009C12.414 22.707 13.0502 22.5093 13.5 22L16.2414 19.0111H21C22.1 19.0111 23 18.1111 23 17.0111V4ZM3 4H21V17.0111H15.5L12 20.6714L8.5 17.0111H3V4Z" />
            </svg>
          </button>
        </Tooltip>
        <span className="toolbar-divider" />
        <Dropdown
          menu={{ items: exportMenuItems }}
          placement="top"
          trigger={['click']}
          onOpenChange={setExportDropdownOpen}
        >
          <Tooltip
            title="导出"
            mouseEnterDelay={0.2}
            placement="top"
            open={exportDropdownOpen ? false : undefined}
          >
            <button className="toolbar-btn">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M28 20V25.3333C28 26.0406 27.719 26.7189 27.219 27.219C26.7189 27.719 26.0406 28 25.3333 28H6.66667C5.95942 28 5.28115 27.719 4.78105 27.219C4.28095 26.7189 4 26.0406 4 25.3333V20M9.33333 13.3333L16 20M16 20L22.6667 13.3333M16 20V4" />
              </svg>
            </button>
          </Tooltip>
        </Dropdown>
        <span className="toolbar-divider" />
        <Tooltip
          title={minimapVisible ? '隐藏小地图' : '小地图'}
          mouseEnterDelay={0.2}
          placement="top"
        >
          <button
            className={`toolbar-btn${minimapVisible ? ' is-active' : ''}`}
            onClick={handleToggleMinimap}
          >
            <svg viewBox="0 0 512.032 512.032" fill="currentColor">
              <path d="M496.016 224c-8.832 0-16 7.168-16 16v181.184l-128 51.2V304c0-8.832-7.168-16-16-16s-16 7.168-16 16v168.352l-128-51.2V167.648l74.144 29.664c8.096 3.264 17.504-.704 20.8-8.928 3.296-8.192-.704-17.504-8.928-20.8l-95.776-38.336h-.032l-.256-.096a15.87 15.87 0 0 0-11.872 0l-.288.096h-.032L10.064 193.152A16.005 16.005 0 0 0 .016 208v288c0 5.312 2.656 10.272 7.04 13.248a15.892 15.892 0 0 0 8.96 2.752c2.016 0 4.032-.384 5.952-1.152l154.048-61.6 153.76 61.504h.032l.288.128a15.87 15.87 0 0 0 11.872 0l.288-.128h.032L502 446.88c6.016-2.464 10.016-8.32 10.016-14.88V240c0-8.832-7.168-16-16-16zm-336 197.152-128 51.2V218.816l128-51.2v253.536zM400.016 64c-26.464 0-48 21.536-48 48s21.536 48 48 48 48-21.536 48-48-21.536-48-48-48zm0 64c-8.832 0-16-7.168-16-16s7.168-16 16-16 16 7.168 16 16-7.168 16-16 16z" />
              <path d="M400.016 0c-61.76 0-112 50.24-112 112 0 57.472 89.856 159.264 100.096 170.688 3.04 3.36 7.36 5.312 11.904 5.312s8.864-1.952 11.904-5.312C422.16 271.264 512.016 169.472 512.016 112c0-61.76-50.24-112-112-112zm0 247.584c-34.944-41.44-80-105.056-80-135.584 0-44.096 35.904-80 80-80s80 35.904 80 80c0 30.496-45.056 94.144-80 135.584z" />
            </svg>
          </button>
        </Tooltip>
      </div>
      <div
        ref={minimapContainerRef}
        className={`canvas-minimap${minimapVisible ? ' is-visible' : ''}`}
      />
    </>
  )
}

export default CanvasToolbars
