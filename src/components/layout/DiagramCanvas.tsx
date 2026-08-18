import { ContextMenuAntd } from '@/components/contextMenuAntd'
import { BottomPanel } from '@/components/layout/BottomPanel'
import { CanvasLeftToolbar } from '@/components/layout/CanvasLeftToolbar'
import { CanvasToolbars } from '@/components/layout/CanvasToolbars'
import { PanelSplitter } from '@/components/layout/PanelSplitter'
import { PaperToolbar } from '@/components/layout/PaperToolbar'
import { SubsystemNavBar } from '@/components/layout/SubsystemNavBar'
import { SubsystemTabBar } from '@/components/layout/SubsystemTabBar'
import type { RefObject } from 'react'

function DiagramCanvas({
  paperContainerRef,
}: {
  paperContainerRef: RefObject<HTMLDivElement | null>
}) {
  const [toolbarsVisible, setToolbarsVisible] = useState(true)
  const [navPanelVisible, setNavPanelVisible] = useState(true)

  return (
    <div className="diagram-canvas-area">
      <div className="paper-toolbar">
        {/* PaperToolbar */}
        <PaperToolbar />
      </div>
      {/* 选项卡导航栏：占满画布区域宽度 */}
      <SubsystemTabBar />
      <PanelSplitter
        variant="bottom"
        first={
          <div className="diagram-body">
            {/* 左侧工具栏 */}
            <CanvasLeftToolbar
              navPanelVisible={navPanelVisible}
              onToggleNavPanel={() => setNavPanelVisible((value) => !value)}
              toolbarsVisible={toolbarsVisible}
              onToggleToolbars={() => setToolbarsVisible((value) => !value)}
            />
            <div className="diagram-canvas-right">
              {/* 子系统导航栏 */}
              {navPanelVisible && <SubsystemNavBar />}
              <ContextMenuAntd>
                <div className="paper-container">
                  <div ref={paperContainerRef} className="paper" />
                  {/* 悬浮工具栏 */}
                  <CanvasToolbars visible={toolbarsVisible} />
                </div>
              </ContextMenuAntd>
            </div>
          </div>
        }
        second={<BottomPanel />}
      />
    </div>
  )
}

export { DiagramCanvas }
