import { ContextMenu } from '@/components/ContextMenu'
import { ContextMenuAntd } from '@/components/contextMenuAntd'
import { BottomPanel } from '@/components/layout/BottomPanel'
import { CanvasLeftToolbar } from '@/components/layout/CanvasLeftToolbar'
import { CanvasStatusBar } from '@/components/layout/CanvasStatusBar'
import { CanvasToolbars } from '@/components/layout/CanvasToolbars'
import { HistoryParamNotice } from '@/components/layout/HistoryParamNotice'
import { PanelSplitter } from '@/components/layout/PanelSplitter'
import { PaperToolbar } from '@/components/layout/PaperToolbar'
import { SubsystemNavBar } from '@/components/layout/SubsystemNavBar'
import { SubsystemTabBar } from '@/components/layout/SubsystemTabBar'
import { useConfigStore } from '@/store/configStore'
import { useTouchTerminal } from '@/utils/hooks/useTouchTerminal'
import type { RefObject } from 'react'

function DiagramCanvas({
  paperContainerRef,
}: {
  paperContainerRef: RefObject<HTMLDivElement | null>
}) {
  const [toolbarsVisible, setToolbarsVisible] = useState(true)
  const [navPanelVisible, setNavPanelVisible] = useState(true)
  const [minimapVisible, setMinimapVisible] = useState(false)
  const metaContextMenuEnabled = useConfigStore(
    (state) => state.metaContextMenuEnabled,
  )
  const touchTerminal = useTouchTerminal()
  const paperContainer = (
    <div className="paper-container">
      <div ref={paperContainerRef} className="paper" />
      {/* 悬浮工具栏 */}
      <CanvasToolbars
        visible={toolbarsVisible}
        minimapVisible={minimapVisible}
      />
    </div>
  )

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
              minimapVisible={minimapVisible}
              onToggleMinimap={() => setMinimapVisible((value) => !value)}
            />
            <div className="diagram-canvas-right">
              <div className="diagram-canvas-frame">
                {/* 子系统导航栏 */}
                {navPanelVisible && <SubsystemNavBar />}
                <ContextMenu
                  enabled={!touchTerminal && metaContextMenuEnabled}
                  toolbarsVisible={toolbarsVisible}
                  onToggleToolbars={() => setToolbarsVisible((value) => !value)}
                >
                  <ContextMenuAntd
                    enabled={touchTerminal || !metaContextMenuEnabled}
                  >
                    {paperContainer}
                  </ContextMenuAntd>
                </ContextMenu>
                <CanvasStatusBar />
              </div>
            </div>
            <HistoryParamNotice />
          </div>
        }
        second={<BottomPanel />}
      />
    </div>
  )
}

export { DiagramCanvas }
