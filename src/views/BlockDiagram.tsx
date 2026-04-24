import {
  Clipboard,
  Export,
  Graph,
  History,
  Keyboard,
  Scroller,
  Selection,
  Snapline,
  Transform,
  routerPresets,
} from '@antv/x6'
import CanvasLeftToolbar from '@/components/CanvasLeftToolbar'
import CanvasToolbars from '@/components/CanvasToolbars'
import PaperToolbar from '@/components/PaperToolbar'
import StencilPanel from '@/components/StencilPanel'
import SubsystemNavBar from '@/components/SubsystemNavBar'
import { useGraphListener } from '@/hooks/useGraphListener'
import { useGraphStore } from '@/store/graphStore'
import { useSubsystemStore } from '@/store/subsystemStore'
import '@/styles/BlockDiagram.spoced.scss'

/**
 * @description 图编辑入口
 * @returns
 */
function BlockDiagram({ modelName }: { modelName?: string }) {
  const paperContainerRef = useRef<HTMLDivElement>(null)
  const setGraph = useGraphStore((s) => s.setGraph)
  const setZoom = useGraphStore((s) => s.setZoom)
  const graph = useGraphStore((s) => s.graph)
  // 初始化配置
  const [toolbarsVisible, setToolbarsVisible] = useState(true)
  const [navPanelVisible, setNavPanelVisible] = useState(true)
  const currentPathIds = useSubsystemStore((s) => s.currentPathIds)

  // 监听 graph 事件（数据同步、交互等）
  useGraphListener(graph)
  useEffect(() => {
    if (!paperContainerRef.current) return

    const g = new Graph({
      container: paperContainerRef.current,
      autoResize: true,
      background: { color: '#F2F7FA' },
      connecting: {
        router: {
          name: 'manhattan',
          args: {
            step: 15,
            padding: 30,
            // 拖拽阶段用稳定正交预览，连接完成后仍由曼哈顿负责避障
            draggingRouter: function (_from, _to, options) {
              return routerPresets.orth.call(
                this,
                [],
                { padding: options.padding },
                this,
              )
            },
          },
        },
        connector: {
          name: 'rounded',
          args: {
            radius: 8,
          },
        },
      },
      grid: { visible: true, size: 10, type: 'dot' },
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
      },
      virtual: true,
    })

    g.on('scale', ({ sx }: { sx: number }) => {
      setZoom(Math.round(sx * 100))
    })

    g.use(new Snapline({ enabled: true, sharp: true }))
    g.use(new Export())
    g.use(
      new Selection({
        enabled: true,
        multiple: true,
        rubberband: true,
        showNodeSelectionBox: true,
        // rubberEdge: true, // 是否选择边
        // showEdgeSelectionBox: true,
        modifiers: 'shift',
        content(selection, el) {
          const btn = document.createElement('button')
          btn.className = 'btn-create-subsystem'
          Object.assign(btn.style, {
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 12px',
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
          })
          btn.textContent = '转为子系统'
          btn.onmousedown = (e) => e.stopPropagation()
          btn.onclick = (e) => {
            e.stopPropagation()
            const cells = g.getSelectedCells()
            useSubsystemStore.getState().mergeToSubsystem(cells)
          }
          el.innerHTML = ''
          el.appendChild(btn)
          // return `${JSON.stringify(g.getSelectedCells(), null, 2)}`
          return ''
        },
      }),
    )
    g.use(
      new Scroller({
        enabled: true,
        pannable: true,
        pageWidth: 400,
        pageHeight: 400,
        pageBreak: true,
        pageVisible: true,
      }),
    )
    g.use(
      new Transform({
        rotating: {
          enabled: true,
          grid: 15,
        },
        resizing: {
          enabled: true,
          minWidth: 20,
          maxWidth: 200,
          minHeight: 20,
          maxHeight: 150,
          orthogonal: false, //中点调节点
          restrict: false, //是否限制在画布内
          preserveAspectRatio: false, //保持比例
        },
      }),
    )
    g.use(
      new Clipboard({
        enabled: true,
      }),
    )
    g.use(
      new History({
        enabled: true,
      }),
    )
    g.use(
      new Keyboard({
        enabled: true,
      }),
    )
    g.bindKey(['ctrl+c', 'meta+c'], () => {
      const cells = g.getSelectedCells()
      if (cells.length) {
        g.copy(cells)
      }
      return false
    })
    g.bindKey(['ctrl+v', 'meta+v'], () => {
      if (!g.isClipboardEmpty()) {
        const cells = g.paste({ offset: 32 })
        g.resetSelection(cells)
      }
      return false
    })
    g.bindKey(['ctrl+x', 'meta+x'], () => {
      const cells = g.getSelectedCells()
      if (cells.length) {
        g.cut(cells)
        g.resetSelection([])
      }
      return false
    })
    g.bindKey(['delete', 'backspace'], () => {
      const cells = g.getSelectedCells()
      if (cells.length) {
        g.removeCells(cells)
        g.resetSelection([])
      }
      return false
    })
    g.bindKey(['ctrl+a', 'meta+a'], () => {
      const cells = g.getCells()
      if (cells.length) {
        g.resetSelection(cells)
      }
      return false
    })
    g.bindKey(['ctrl+z', 'meta+z'], () => {
      g.undo()
      return false
    })
    g.bindKey(['ctrl+y', 'meta+shift+z', 'ctrl+shift+z'], () => {
      g.redo()
      return false
    })
    g.centerContent()
    setGraph(g)

    return () => {
      g.dispose()
      setGraph(null)
    }
  }, [setGraph, setZoom])

  return (
    <div className="diagram-wrapper">
      <StencilPanel />
      {/* 画布区域 */}
      <div className="diagram-canvas-area">
        <div className="paper-toolbar">
          {/* PaperToolbar */}
          <PaperToolbar modelName={'OpenLoop'} />
        </div>
        <div className="diagram-body">
          {/* 左侧工具栏 */}
          <CanvasLeftToolbar
            navPanelVisible={navPanelVisible}
            onToggleNavPanel={() => setNavPanelVisible((v) => !v)}
            toolbarsVisible={toolbarsVisible}
            onToggleToolbars={() => setToolbarsVisible((v) => !v)}
          />
          <div className="diagram-canvas-right">
            {/* 子系统导航栏 */}
            <SubsystemNavBar visible={navPanelVisible} />
            <div className="paper-container">
              <div ref={paperContainerRef} className="paper"></div>
              {/* 悬浮工具栏 */}
              <CanvasToolbars visible={toolbarsVisible} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BlockDiagram
export { BlockDiagram as Component } // Data Router Lazy
