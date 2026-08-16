import { useContextMenu } from '@hooks/useContextMenu'
import { useGraphListener } from '@hooks/useGraphListener'
import { useScrollListener } from '@hooks/useScrollListener'
import { ConfigProvider } from 'antd'
import { useEffect, useRef } from 'react'
import {
  AgentPanel,
  DiagramCanvas,
  PanelSplitter,
  ScopeWindow,
  StencilLayout,
} from '@/components'
import { useGraphStore } from '@/store/graphStore'
import '@styles/BlockDiagram.scss'

const SPLITTER_THEME = {
  token: {
    colorPrimary: '#1890ff',
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
}

/**
 * @description 图编辑入口
 * @returns
 */
function BlockDiagram({ modelName }: { modelName?: string }) {
  const paperContainerRef = useRef<HTMLDivElement>(null)

  useGraphListener()
  useContextMenu()
  useScrollListener(paperContainerRef)

  useEffect(() => {
    if (!paperContainerRef.current) return
    const { initGraph, destroyGraph } = useGraphStore.getState()
    initGraph(paperContainerRef.current)
    return destroyGraph
  }, [])

  return (
    <ConfigProvider theme={SPLITTER_THEME}>
      <PanelSplitter
        variant="workspace"
        stencil={<StencilLayout />}
        canvas={
          <>
            {/* 画布区域 */}
            <DiagramCanvas paperContainerRef={paperContainerRef} />
            <ScopeWindow />
          </>
        }
        agent={<AgentPanel />}
      />
    </ConfigProvider>
  )
}

export default BlockDiagram
export { BlockDiagram as Component } // Data Router Lazy
