import {
  CanvasLeftToolbar,
  CanvasToolbars,
  PaperToolbar,
  StencilPanel,
  SubsystemNavBar,
} from '@/components'
import { useGraphListener } from '@/hooks/useGraphListener'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import '@/styles/BlockDiagram.spoced.scss'

/**
 * @description 图编辑入口
 * @returns
 */
function BlockDiagram({ modelName }: { modelName?: string }) {
  const paperContainerRef = useRef<HTMLDivElement>(null)
  const [toolbarsVisible, setToolbarsVisible] = useState(true)
  const [navPanelVisible, setNavPanelVisible] = useState(true)
  useGraphListener()
  useEffect(() => {
    if (!paperContainerRef.current) return
    const { initGraph, destroyGraph } = useGraphStore.getState()
    initGraph(paperContainerRef.current)
    return destroyGraph
  }, [])
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
