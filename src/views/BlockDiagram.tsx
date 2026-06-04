import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useGraphListener } from '@hooks/useGraphListener'
import { useScrollListener } from '@hooks/useScrollListener'
import { ConfigProvider, Splitter } from 'antd'
import {
  CanvasLeftToolbar,
  CanvasToolbars,
  PaperToolbar,
  StencilLayout,
  SubsystemNavBar,
} from '@/components'
import { useGraphStore } from '@/store/graphStore'
import '@styles/BlockDiagram.scss'

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

    return () => {
      destroyGraph()
    }
  }, [])
  useScrollListener(paperContainerRef)
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#13c2c2', // 明青 cyan-6
          fontFamily:
            "'OPPO Sans', 'OPPOSans', 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Splitter: {
            splitBarSize: 4,
            splitTriggerSize: 12,
            splitBarDraggableSize: 80,
          },
        },
      }}
    >
      <Splitter
        className="diagram-wrapper"
        classNames={{ dragger: 'diagram-splitter-dragger' }}
        collapsible={{
          icon: { start: <LeftOutlined />, end: <RightOutlined /> },
        }}
      >
        <Splitter.Panel
          defaultSize={'20%'}
          min={'10%'}
          max={'50%'}
          collapsible={{ start: true, end: true, showCollapsibleIcon: 'auto' }}
        >
          <StencilLayout />
        </Splitter.Panel>
        <Splitter.Panel>
          {/* 画布区域 */}
          <div className="diagram-canvas-area">
            <div className="paper-toolbar">
              {/* PaperToolbar */}
              <PaperToolbar />
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
                {navPanelVisible && (
                  <SubsystemNavBar modelName={'实验二-系统稳态误差分析'} />
                )}
                <div className="paper-container">
                  <div ref={paperContainerRef} className="paper"></div>
                  {/* 悬浮工具栏 */}
                  <CanvasToolbars visible={toolbarsVisible} />
                </div>
              </div>
            </div>
          </div>
        </Splitter.Panel>
      </Splitter>
    </ConfigProvider>
  )
}

export default BlockDiagram
export { BlockDiagram as Component } // Data Router Lazy
