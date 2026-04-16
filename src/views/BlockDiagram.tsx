import { createMinimapService } from '@/services/minimap-service'
import { createStencilService } from '@/services/stencil-service'
import '@/styles/BlockDiagram.scoped.scss'
import { Graph, Scroller, Snapline } from '@antv/x6'

function BlockDiagram() {
  const paperContainerRef = useRef<HTMLDivElement>(null)
  const stencilContainerRef = useRef<HTMLDivElement>(null)
  const minimapContainerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const [minimapVisible, setMinimapVisible] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!paperContainerRef.current || !stencilContainerRef.current) return

    const graph = new Graph({
      container: paperContainerRef.current,
      autoResize: true,
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
      },
      virtual: true,
      grid: { visible: false, size: 5, type: 'dot' },
    })
    graphRef.current = graph

    graph.on('scale', ({ sx }: { sx: number }) => {
      setZoom(Math.round(sx * 100))
    })

    // Tools 注册
    graph.use(new Snapline({ enabled: true, sharp: true }))
    graph.use(
      new Scroller({
        enabled: true,
        pannable: true,
        pageWidth: 400,
        pageHeight: 400,
        pageBreak: true,
        pageVisible: true,
      }),
    )
    graph.centerContent()
    // 服务调用
    // miniMap
    const minimapService = createMinimapService()
    minimapService.create(graph, minimapContainerRef.current!)

    // Stencil
    const stencilService = createStencilService(stencilContainerRef.current!)
    stencilService.create(graph)

    return () => {
      graphRef.current = null
      minimapService.dispose()
      stencilService.dispose()
      graph.dispose()
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoom(0.1)
  }, [])

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoom(-0.1)
  }, [])

  const handleFitToScreen = useCallback(() => {
    graphRef.current?.zoomToFit({ padding: 20 })
  }, [])

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  return (
    <div className="diagram-wrapper">
      <div className="toolbar-row">
        <div className="toolbar-left">
          <button className="toolbar-btn" title="File">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect
                x="2"
                y="1"
                width="9"
                height="14"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M8 1v4h4"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" title="Undo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 5H9a4 4 0 0 1 0 8H5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M5.5 2.5L3 5l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <button className="toolbar-btn" title="Redo">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12.5 5H7a4 4 0 0 0 0 8h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M10.5 2.5L13 5l-2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn toolbar-dropdown">
            Layout
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              style={{ marginLeft: 4 }}
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div className="toolbar-right">
          <button className="toolbar-btn toolbar-dropdown">
            Canvas settings
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              style={{ marginLeft: 4 }}
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn toolbar-btn--primary" title="Export">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v8M4 6l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 10v2h10v-2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button className="toolbar-btn toolbar-dropdown-arrow">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main editor body */}
      <div className="app-body">
        <div className="stencil-container" ref={stencilContainerRef} />
        <div className="canvas-area">
          <div className="paper-container" ref={paperContainerRef} />

          {/* Zoom Bar */}
          <div className="zoom-bar">
            <button
              className={`zoom-bar-btn${isFullscreen ? ' zoom-bar-btn--active' : ''}`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              onClick={handleFullscreen}
            >
              {isFullscreen ? (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path
                    d="M5 1v4H1M10 1v4h4M5 14v-4H1M10 14v-4h4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path
                    d="M1 5V1h4M14 5V1h-4M1 10v4h4M14 10v4h-4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <button
              className="zoom-bar-btn"
              title="Fit to Screen"
              onClick={handleFitToScreen}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path
                  d="M5 2H2v3M10 2h3v3M5 13H2v-3M10 13h3v-3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="7.5"
                  cy="7.5"
                  r="2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </button>
            <div className="zoom-bar-separator" />
            <button
              className="zoom-bar-btn"
              title="Zoom Out"
              onClick={handleZoomOut}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 7h8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span className="zoom-value">{zoom}%</span>
            <button
              className="zoom-bar-btn"
              title="Zoom In"
              onClick={handleZoomIn}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 3v8M3 7h8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="zoom-bar-separator" />
            <button
              className={`zoom-bar-btn${minimapVisible ? ' zoom-bar-btn--active' : ''}`}
              title="Toggle MiniMap"
              onClick={() => setMinimapVisible((v) => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="13"
                  height="13"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  fill="none"
                />
                <rect
                  x="8.5"
                  y="7.5"
                  width="4"
                  height="3"
                  rx="0.5"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  fill="none"
                />
                <path
                  d="M2.5 4.5l2.5 3 2.5-3"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div
            ref={minimapContainerRef}
            className={`minimap-container${minimapVisible ? ' minimap-container--visible' : ''}`}
          />
        </div>
      </div>
    </div>
  )
}

export default BlockDiagram
export { BlockDiagram as Component } // Router Lazy
