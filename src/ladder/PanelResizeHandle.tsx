import type { LadPanel } from './panels'
import type { HTMLAttributes } from 'react'

export type PanelResizeHandleProps = Pick<
  HTMLAttributes<HTMLDivElement>,
  'onPointerDown' | 'onLostPointerCapture' | 'onKeyDown' | 'onDoubleClick'
> & {
  panel: LadPanel
  value: number
  minimum: number
  maximum: number
  active: boolean
}

const names = {
  left: '调整左侧面板宽度',
  right: '调整右侧面板宽度',
  bottom: '调整底部面板高度',
}

export default function PanelResizeHandle({
  panel,
  value,
  minimum,
  maximum,
  active,
  ...events
}: PanelResizeHandleProps) {
  const horizontal = panel === 'bottom'
  return (
    <div
      {...events}
      className={`lad-panel-resizer panel-${panel} is-${horizontal ? 'horizontal' : 'vertical'}${active ? ' is-active' : ''}`}
      role="separator"
      tabIndex={0}
      aria-label={names[panel]}
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      aria-valuenow={Math.round(value)}
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuetext={`${Math.round(value)} 像素`}
      title="拖动调整；方向键微调，Shift 加速；Home 或双击恢复默认"
      data-panel={panel}
      data-resizing={active ? 'true' : 'false'}
      style={{
        touchAction: 'none',
        userSelect: 'none',
        cursor: horizontal ? 'row-resize' : 'col-resize',
        ...(horizontal
          ? { height: 6, minHeight: 6, flex: '0 0 6px' }
          : { width: 6, minWidth: 6, alignSelf: 'stretch' }),
      }}
    >
      <span className="lad-panel-resizer-grip" aria-hidden="true" />
    </div>
  )
}
