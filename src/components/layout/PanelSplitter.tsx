import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Splitter } from 'antd'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { useAgentPanelStore } from '@/store/agentPanelStore'
import { useBottomPanelStore } from '@/store/bottomPanelStore'

type PanelProps = ComponentProps<typeof Splitter.Panel>
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

const WORKSPACE_PANELS: PanelProps[] = [
  {
    defaultSize: '20%',
    min: '10%',
    max: '50%',
    collapsible: { start: true, end: true, showCollapsibleIcon: 'auto' },
  },
  { className: 'canvas-panel-host' },
  {
    className: 'agent-panel-host',
    defaultSize: 360,
    min: 280,
    max: '45%',
  },
]

const BOTTOM_PANELS: PanelProps[] = [
  { defaultSize: '65%', min: '30%' },
  {
    className: 'bottom-panel-host',
    defaultSize: '35%',
    min: 180,
    max: '70%',
  },
]

function PanelSplitter(props: PanelSplitterProps) {
  const agentVisible = useAgentPanelStore((state) => state.visible)
  const bottomVisible = useBottomPanelStore((state) => state.visible)
  const workspace = props.variant === 'workspace'
  const panels = workspace ? WORKSPACE_PANELS : BOTTOM_PANELS
  const contents = workspace
    ? [props.stencil, props.canvas, props.agent]
    : [props.first, props.second]
  const trailingVisible = workspace ? agentVisible : bottomVisible
  const hiddenIndex = panels.length - 1
  const [sizes, setSizes] = useState<(number | string | undefined)[]>(() =>
    panels.map((panel) => panel.defaultSize),
  )

  return (
    <Splitter
      className={workspace ? 'diagram-wrapper' : 'diagram-vertical-splitter'}
      orientation={workspace ? 'horizontal' : 'vertical'}
      classNames={{ dragger: 'diagram-splitter-dragger' }}
      collapsible={
        workspace
          ? { icon: { start: <LeftOutlined />, end: <RightOutlined /> } }
          : undefined
      }
      onResize={(next) => {
        if (trailingVisible) setSizes(next)
      }}
    >
      {panels.map((panel, index) => {
        const hidden = index === hiddenIndex && !trailingVisible
        const fillsTrailingSpace = index === hiddenIndex - 1 && !trailingVisible
        return (
          <Splitter.Panel
            {...panel}
            key={index}
            className={
              hidden ? 'panel-splitter__panel--hidden' : panel.className
            }
            size={
              hidden
                ? 0
                : fillsTrailingSpace && !workspace
                  ? '100%'
                  : fillsTrailingSpace
                    ? undefined
                    : sizes[index]
            }
            min={hidden ? 0 : panel.min}
            resizable={!hidden}
          >
            {contents[index]}
          </Splitter.Panel>
        )
      })}
    </Splitter>
  )
}

export { PanelSplitter }
