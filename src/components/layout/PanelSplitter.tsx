import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Splitter } from 'antd'
import { useState, type ReactNode } from 'react'
import { useAgentPanelStore } from '@/store/agentPanelStore'
import { useBottomPanelStore } from '@/store/bottomPanelStore'

type PanelSplitterProps =
  | {
      variant: 'workspace'
      stencil: ReactNode
      canvas: ReactNode
      agent: ReactNode
    }
  | {
      variant: 'bottom'
      first: ReactNode
      second: ReactNode
    }

const STENCIL_DEFAULT_SIZE = '20%'
const AGENT_DEFAULT_SIZE = 360
const BOTTOM_PANEL_DEFAULT_SIZE = '35%'

function WorkspaceSplitter({
  stencil,
  canvas,
  agent,
}: {
  stencil: ReactNode
  canvas: ReactNode
  agent: ReactNode
}) {
  const agentVisible = useAgentPanelStore((state) => state.visible)
  const [stencilSize, setStencilSize] = useState<number | string>(
    STENCIL_DEFAULT_SIZE,
  )
  const [agentSize, setAgentSize] = useState<number | string>(
    AGENT_DEFAULT_SIZE,
  )

  return (
    <Splitter
      className="diagram-wrapper"
      orientation="horizontal"
      classNames={{ dragger: 'diagram-splitter-dragger' }}
      collapsible={{
        icon: { start: <LeftOutlined />, end: <RightOutlined /> },
      }}
      onResize={(sizes) => {
        setStencilSize(sizes[0])
        if (agentVisible) setAgentSize(sizes[2])
      }}
    >
      <Splitter.Panel
        size={stencilSize}
        min="10%"
        max="50%"
        collapsible={{ start: true, end: true, showCollapsibleIcon: 'auto' }}
      >
        {stencil}
      </Splitter.Panel>

      <Splitter.Panel className="canvas-panel-host">{canvas}</Splitter.Panel>

      <Splitter.Panel
        className={
          agentVisible ? 'agent-panel-host' : 'panel-splitter__panel--hidden'
        }
        size={agentVisible ? agentSize : 0}
        min={agentVisible ? 280 : 0}
        max="45%"
        resizable={agentVisible}
      >
        {agent}
      </Splitter.Panel>
    </Splitter>
  )
}

function CanvasBottomSplitter({
  first,
  second,
}: {
  first: ReactNode
  second: ReactNode
}) {
  const bottomVisible = useBottomPanelStore((state) => state.visible)
  const [bottomSize, setBottomSize] = useState<number | string>(
    BOTTOM_PANEL_DEFAULT_SIZE,
  )

  return (
    <Splitter
      className="diagram-vertical-splitter"
      orientation="vertical"
      classNames={{ dragger: 'diagram-splitter-dragger' }}
      onResize={(sizes) => {
        if (bottomVisible) setBottomSize(sizes[1])
      }}
    >
      <Splitter.Panel min="30%">{first}</Splitter.Panel>

      <Splitter.Panel
        className={
          bottomVisible ? 'bottom-panel-host' : 'panel-splitter__panel--hidden'
        }
        size={bottomVisible ? bottomSize : 0}
        min={bottomVisible ? 180 : 0}
        max="70%"
        resizable={bottomVisible}
      >
        {second}
      </Splitter.Panel>
    </Splitter>
  )
}

function PanelSplitter(props: PanelSplitterProps) {
  if (props.variant === 'workspace') {
    return (
      <WorkspaceSplitter
        stencil={props.stencil}
        canvas={props.canvas}
        agent={props.agent}
      />
    )
  }

  return <CanvasBottomSplitter first={props.first} second={props.second} />
}

export { PanelSplitter }
