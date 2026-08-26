import { Button, Divider, Dropdown, Tooltip } from 'antd'
import LiquidGlass from 'liquid-glass-react'
import { Redo2, Undo2 } from 'lucide-react'
import CanvasToolbarEnterFullscreenSvg from '@/assets/svg/canvas-toolbar-enter-fullscreen.svg?react'
import CanvasToolbarExitFullscreenSvg from '@/assets/svg/canvas-toolbar-exit-fullscreen.svg?react'
import CanvasToolbarExportSvg from '@/assets/svg/canvas-toolbar-export.svg?react'
import CanvasToolbarFitSvg from '@/assets/svg/canvas-toolbar-fit.svg?react'
import CanvasToolbarZoomInSvg from '@/assets/svg/canvas-toolbar-zoom-in.svg?react'
import CanvasToolbarZoomOutSvg from '@/assets/svg/canvas-toolbar-zoom-out.svg?react'
import { createInteractiveService } from '@/services/interactive-service'
import { createMinimapService } from '@/services/minimap-service'
import { useGraphStore } from '@/store/graphStore'
import '@styles/CanvasToolbars.scss'

type CanvasToolbarsProps = {
  visible: boolean
  minimapVisible: boolean
}

const toolbarDividerStyle = {
  height: 16,
  margin: '0 4px',
  borderInlineStart: '1px solid rgb(172, 172, 172)',
}

function CanvasToolbars({ visible, minimapVisible }: CanvasToolbarsProps) {
  const graph = useGraphStore((s) => s.graph)
  const zoom = useGraphStore((s) => s.zoom)
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  })
  const getExportViewBox = () => {
    const bbox = graph.getContentBBox()
    const padding = 30
    return {
      x: bbox.x - padding * 2,
      y: bbox.y - padding,
      width: bbox.width + padding * 4,
      height: bbox.height + padding * 4,
    }
  }

  const handleZoomIn = () => graph?.zoom(0.1)
  const handleZoomOut = () => graph?.zoom(-0.1)
  const handleFit = () => {
    if (!graph) return
    createInteractiveService().zoomToFitWithVirtual(graph, { padding: 16 })
  }
  const handleExportSVG = () => {
    graph.exportSVG('diagram', {
      copyStyles: false,
      preserveDimensions: true,
      viewBox: getExportViewBox() ?? undefined,
    })
  }

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
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

  useEffect(() => {
    if (!graph) return

    const syncHistoryState = () =>
      setHistoryState({
        canUndo: graph.canUndo(),
        canRedo: graph.canRedo(),
      })

    syncHistoryState()
    graph.on('history:change', syncHistoryState)

    return () => {
      graph.off('history:change', syncHistoryState)
    }
  }, [graph])

  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const handleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  const handlePrint = () => {
    const viewBox = getExportViewBox()
    graph.toSVG(
      (svgXml) => {
        const win = window.open('', '_blank')
        if (!win) return

        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgXml, 'image/svg+xml')
        const svg = svgDoc.documentElement

        svg.setAttribute('width', '100%')
        svg.setAttribute('height', 'auto')

        const printSvg = new XMLSerializer().serializeToString(svgDoc)

        win.document.write(
          `<html><head><title>打印</title><style>
            *{box-sizing:border-box;}
            body{margin:0;}
            svg{display:block;width:100%;height:auto;}
            @media print{
              @page{margin:10mm;size:auto;}
              svg{width:100%;height:auto;}
            }
          </style></head><body>${printSvg}<script>window.onload=function(){window.print();window.close()}</script></body></html>`,
        )
        win.document.close()
      },
      { copyStyles: false, viewBox },
    )
  }

  const exportMenuItems = [
    {
      key: 'png',
      label: '导出为 PNG',
      onClick: () =>
        graph?.exportPNG('diagram', {
          padding: 30,
        }),
    },
    {
      key: 'jpeg',
      label: '导出为 JPEG',
      onClick: () => graph?.exportJPEG('diagram', { padding: 30 }),
    },
    {
      key: 'svg',
      label: '导出为 SVG',
      onClick: handleExportSVG,
    },
    {
      key: 'print',
      label: '打印',
      onClick: handlePrint,
    },
  ]

  return (
    <>
      <LiquidGlass
        displacementScale={30}
        blurAmount={0.01}
        aberrationIntensity={1}
        elasticity={0.1}
        cornerRadius={100}
        padding="8px 16px"
        mode="prominent"
        style={{
          position: 'absolute',
          top: 'calc(100% - 40px)',
          left: '50%',
          zIndex: 10,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.24s ease',
        }}
      >
        <div className="canvas-float-toolbar">
          <Tooltip title="撤销" mouseEnterDelay={0.2} placement="top">
            <Button
              type="text"
              className="toolbar-btn"
              disabled={
                !historyState.canUndo || graph?.getUndoStackSize() === 0
              }
              onClick={() => graph?.undo()}
            >
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip title="重做" mouseEnterDelay={0.2} placement="top">
            <Button
              type="text"
              className="toolbar-btn"
              disabled={
                !historyState.canRedo || graph?.getRedoStackSize() === 0
              }
              onClick={() => graph?.redo()}
            >
              <Redo2 />
            </Button>
          </Tooltip>
          <Divider orientation="vertical" style={toolbarDividerStyle} />
          <Tooltip title="缩小" mouseEnterDelay={0.2} placement="top">
            <Button type="text" className="toolbar-btn" onClick={handleZoomOut}>
              <CanvasToolbarZoomOutSvg />
            </Button>
          </Tooltip>
          <span className="toolbar-zoom-label">{zoom}%</span>
          <Tooltip title="放大" mouseEnterDelay={0.2} placement="top">
            <Button type="text" className="toolbar-btn" onClick={handleZoomIn}>
              <CanvasToolbarZoomInSvg />
            </Button>
          </Tooltip>
          <Divider orientation="vertical" style={toolbarDividerStyle} />
          <Tooltip
            title={isFullscreen ? '退出全屏' : '全屏'}
            mouseEnterDelay={0.2}
            placement="top"
          >
            <Button
              type="text"
              className="toolbar-btn"
              onClick={handleFullscreen}
            >
              {isFullscreen ? (
                <CanvasToolbarExitFullscreenSvg />
              ) : (
                <CanvasToolbarEnterFullscreenSvg />
              )}
            </Button>
          </Tooltip>
          <Tooltip title="适应画布" mouseEnterDelay={0.2} placement="top">
            <Button type="text" className="toolbar-btn" onClick={handleFit}>
              <CanvasToolbarFitSvg />
            </Button>
          </Tooltip>
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
              <Button type="text" className="toolbar-btn">
                <CanvasToolbarExportSvg />
              </Button>
            </Tooltip>
          </Dropdown>
        </div>
      </LiquidGlass>

      <div
        ref={minimapContainerRef}
        className={`canvas-minimap${minimapVisible ? ' is-visible' : ''}`}
      />
    </>
  )
}

export { CanvasToolbars }
