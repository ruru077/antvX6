import { useEffect, useMemo, useRef } from 'react'
import {
  canvasDropZones,
  clientPointToSvg,
  dropTargetKey,
  edgeScrollDelta,
  hitTestCanvasDrop,
  layoutCanvas,
  measureElement,
  pointInside,
} from './canvasDrag'
import { canDropLad } from './drag'
import { isFunctionBlock } from './model'
import type { CanvasPoint, CanvasRect, LadDropZone } from './canvasDrag'
import type { LadDragPayload, LadDropTarget } from './drag'
import type {
  LadElement,
  LadNetwork,
  LadProgram,
  LadSelection,
  LadSnapshot,
} from './model'
import type { PointerEvent as ReactPointerEvent } from 'react'

const GAP = 24
export { measureElement } from './canvasDrag'
type CanvasProps = {
  program: LadProgram
  selection: LadSelection | null
  snapshot: LadSnapshot | null
  onSelect: (selection: LadSelection) => void
  dragPayload?: LadDragPayload | null
  onDragStart?: (payload: LadDragPayload, event: ReactPointerEvent) => void
  onDropTargetChange?: (target: LadDropTarget | null) => void
  dropTarget?: LadDropTarget | null
  locked?: boolean
}
type ElementProps = {
  element: LadElement
  x: number
  y: number
  network: LadNetwork
  powerIn?: boolean
} & CanvasProps
const color = (id: string, snapshot: LadSnapshot | null) =>
  snapshot && snapshot.scanIndex > 0 && snapshot.trace[id] === true
    ? '#1769e0'
    : '#64748b'
const shortLabel = (text: string, limit = 17) =>
  text.length > limit ? text.slice(0, limit - 1) + '…' : text

function HoverOutline({
  x,
  y,
  width,
  height,
  group = false,
}: CanvasRect & { group?: boolean }) {
  return (
    <rect
      className="lad-hover-outline"
      x={x}
      y={y}
      width={width}
      height={height}
      rx={0}
      fill="none"
      opacity={0}
      strokeDasharray={group ? '3 4' : undefined}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      aria-hidden="true"
    />
  )
}

function LadderElement(props: ElementProps) {
  const { element, x, y, network, selection, snapshot, onSelect } = props
  const size = measureElement(element)
  const selected = selection?.elementId === element.id
  const stroke = color(element.id, snapshot)
  const incomingStroke =
    snapshot && props.powerIn === true ? '#1769e0' : '#64748b'
  const select = () =>
    onSelect({ networkId: network.id, elementId: element.id })
  const name =
    element.type === 'contact'
      ? (element.negated ? '常闭 ' : '常开 ') + (element.variable || '未绑定')
      : element.type === 'not'
        ? '逻辑流求反'
        : isFunctionBlock(element)
          ? (element.mode ?? '') + ' ' + (element.instance || '未命名实例')
          : element.type === 'parallel'
            ? '并联支路'
            : '串联支路'
  const functional = isFunctionBlock(element)
  const leaf =
    element.type === 'contact' || element.type === 'not' || functional
  const interactionHint = props.locked
    ? name + '：单击查看属性；运行中不可移动。'
    : name +
      (props.onDragStart
        ? element.id === network.condition.id
          ? '：单击选择；拖动网络序号可调整顺序。'
          : '：单击选择；拖动移动。'
        : '：单击选择。')
  const functionState =
    snapshot?.states &&
    element.instance &&
    Object.hasOwn(snapshot.states, element.instance)
      ? snapshot.states[element.instance]
      : undefined
  return (
    <g
      data-element-id={element.id}
      className={'lad-element' + (selected ? ' is-selected' : '')}
    >
      <rect
        x={x + 3}
        y={y - size.height / 2 + 3}
        width={size.width - 6}
        height={size.height - 6}
        rx={0}
        fill={selected ? '#e8f1ff' : 'transparent'}
        stroke={selected ? '#1677ff' : 'none'}
        strokeDasharray={leaf ? undefined : '3 4'}
        role="button"
        tabIndex={0}
        aria-label={name}
        className="lad-hover-target"
        style={{ touchAction: props.locked ? 'auto' : 'none' }}
        onPointerDown={(event) => {
          if (
            props.locked ||
            event.button !== 0 ||
            element.id === network.condition.id
          )
            return
          event.stopPropagation()
          props.onDragStart?.(
            { kind: 'element', networkId: network.id, elementId: element.id },
            event,
          )
        }}
        onClick={(event) => {
          event.stopPropagation()
          select()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            select()
          }
        }}
      >
        <title>{interactionHint}</title>
      </rect>
      <HoverOutline
        x={x + 3}
        y={y - size.height / 2 + 3}
        width={size.width - 6}
        height={size.height - 6}
        group={!leaf}
      />
      {functional ? (
        <g pointerEvents="none" className="lad-function-symbol">
          <text
            x={x + size.width / 2}
            y={y - 58}
            textAnchor="middle"
            className="lad-symbol-label"
          >
            <title>{element.instance}</title>
            {shortLabel(element.instance || '设置实例名称', 23)}
          </text>
          <rect
            x={x + 18}
            y={y - 46}
            width={size.width - 36}
            height={106}
            rx={0}
            fill={selected ? '#f4f8ff' : '#fbfcfe'}
            stroke={stroke}
            strokeWidth={1.8}
          />
          <line
            x1={x + 18}
            x2={x + size.width - 18}
            y1={y - 15}
            y2={y - 15}
            stroke="#dce5f1"
          />
          <text
            x={x + size.width / 2}
            y={y - 26}
            textAnchor="middle"
            className="lad-function-mode"
          >
            {element.mode}
          </text>
          <path
            d={'M ' + x + ' ' + y + ' H ' + (x + 18)}
            stroke={incomingStroke}
            strokeWidth={2.5}
            fill="none"
          />
          <path
            d={
              'M ' + (x + size.width - 18) + ' ' + y + ' H ' + (x + size.width)
            }
            stroke={stroke}
            strokeWidth={2.5}
            fill="none"
          />
          <text x={x + 25} y={y + 4} className="lad-port-name">
            {element.type === 'edge'
              ? 'CLK'
              : element.type === 'counter'
                ? element.mode === 'CTD'
                  ? 'CD'
                  : 'CU'
                : 'IN'}
          </text>
          <text
            x={x + size.width - 27}
            y={y + 4}
            textAnchor="end"
            className="lad-port-name"
          >
            Q
          </text>
          {element.type === 'timer' && (
            <>
              <text
                x={x + size.width / 2}
                y={y + 20}
                textAnchor="middle"
                className="lad-function-param"
              >
                PT {element.presetMs} ms
              </text>
              <text
                x={x + size.width / 2}
                y={y + 43}
                textAnchor="middle"
                className="lad-function-state"
              >
                ET {functionState?.etMs ?? '—'} ms · Q{' '}
                {functionState ? (functionState.q ? 'TRUE' : 'FALSE') : '—'}
              </text>
            </>
          )}
          {element.type === 'counter' && (
            <>
              <text
                x={x + size.width / 2}
                y={y + 19}
                textAnchor="middle"
                className="lad-function-param"
              >
                PV {element.preset}
              </text>
              <text
                x={x + size.width / 2}
                y={y + 35}
                textAnchor="middle"
                className="lad-function-control"
              >
                <title>{element.controlVariable}</title>
                {element.mode === 'CTD' ? 'LOAD' : 'RESET'}:{' '}
                {shortLabel(element.controlVariable || '未绑定', 14)}
              </text>
              <text
                x={x + size.width / 2}
                y={y + 52}
                textAnchor="middle"
                className="lad-function-state"
              >
                CV {functionState?.cv ?? '—'} · Q{' '}
                {functionState ? (functionState.q ? 'TRUE' : 'FALSE') : '—'}
              </text>
            </>
          )}
          {element.type === 'edge' && (
            <>
              <text
                x={x + size.width / 2}
                y={y + 23}
                textAnchor="middle"
                className="lad-function-param"
              >
                {element.mode === 'R_TRIG'
                  ? '上升沿 · 0 → 1'
                  : '下降沿 · 1 → 0'}
              </text>
              <text
                x={x + size.width / 2}
                y={y + 45}
                textAnchor="middle"
                className="lad-function-state"
              >
                Q {functionState ? (functionState.q ? 'TRUE' : 'FALSE') : '—'}
              </text>
            </>
          )}
        </g>
      ) : leaf ? (
        <g pointerEvents="none">
          <text
            x={x + size.width / 2}
            y={y - 22}
            textAnchor="middle"
            className="lad-symbol-label"
          >
            <title>{element.variable}</title>
            {element.type === 'contact'
              ? shortLabel(element.variable || '选择变量')
              : 'NOT'}
          </text>
          <path
            d={'M ' + x + ' ' + y + ' H ' + (x + 50)}
            fill="none"
            stroke={incomingStroke}
            strokeWidth={2.5}
          />
          <path
            d={'M ' + (x + 74) + ' ' + y + ' H ' + (x + size.width)}
            fill="none"
            stroke={stroke}
            strokeWidth={2.5}
          />
          {element.type === 'contact' ? (
            <>
              <path
                d={
                  'M ' +
                  (x + 50) +
                  ' ' +
                  (y - 13) +
                  ' V ' +
                  (y + 13) +
                  ' M ' +
                  (x + 74) +
                  ' ' +
                  (y - 13) +
                  ' V ' +
                  (y + 13)
                }
                fill="none"
                stroke={stroke}
                strokeWidth={2.8}
              />
              {element.negated && (
                <path
                  d={
                    'M ' +
                    (x + 48) +
                    ' ' +
                    (y + 14) +
                    ' L ' +
                    (x + 76) +
                    ' ' +
                    (y - 14)
                  }
                  stroke={stroke}
                  strokeWidth={2.4}
                />
              )}
            </>
          ) : (
            <>
              <path
                d={
                  'M ' +
                  (x + 50) +
                  ' ' +
                  (y - 12) +
                  ' L ' +
                  (x + 70) +
                  ' ' +
                  y +
                  ' L ' +
                  (x + 50) +
                  ' ' +
                  (y + 12) +
                  ' Z'
                }
                fill="white"
                stroke={stroke}
                strokeWidth={2}
              />
              <circle
                cx={x + 73}
                cy={y}
                r={3}
                fill="white"
                stroke={stroke}
                strokeWidth={2}
              />
            </>
          )}
          {snapshot && (
            <text
              x={x + size.width / 2}
              y={y + 29}
              textAnchor="middle"
              fill={stroke}
              className="lad-bit-label"
            >
              {snapshot.scanIndex > 0
                ? snapshot.trace[element.id] === true
                  ? 'TRUE'
                  : 'FALSE'
                : '—'}
            </text>
          )}
        </g>
      ) : (
        <>
          {!element.children?.length && (
            <text
              x={x + size.width / 2}
              y={y + 5}
              textAnchor="middle"
              className="lad-empty-label"
              pointerEvents="none"
            >
              选择后添加触点
            </text>
          )}
          {element.type === 'series'
            ? (() => {
                let offset = x
                return element.children?.map((child, index) => {
                  const start = offset
                  offset += measureElement(child).width
                  // Read preceding Link trace values; this is presentation, not a second evaluator.
                  const powerIn =
                    index === 0
                      ? props.powerIn
                      : snapshot?.trace[element.children![index - 1].id]
                  return (
                    <LadderElement
                      key={child.id}
                      {...props}
                      element={child}
                      x={start}
                      y={y}
                      powerIn={powerIn}
                    />
                  )
                })
              })()
            : (() => {
                let top = y - size.height / 2
                const centers = (element.children ?? []).map((child) => {
                  const childSize = measureElement(child)
                  const cy = top + childSize.height / 2
                  top += childSize.height + GAP
                  return { child, cy, childSize }
                })
                const left = x + 22,
                  right = x + size.width - 22
                return (
                  <>
                    <path
                      d={'M ' + x + ' ' + y + ' H ' + left}
                      stroke={incomingStroke}
                      strokeWidth={2.5}
                      fill="none"
                      pointerEvents="none"
                    />
                    <path
                      d={'M ' + right + ' ' + y + ' H ' + (x + size.width)}
                      stroke={stroke}
                      strokeWidth={2.5}
                      fill="none"
                      pointerEvents="none"
                    />
                    {centers.length > 0 && (
                      <>
                        <path
                          d={
                            'M ' +
                            left +
                            ' ' +
                            centers[0].cy +
                            ' V ' +
                            centers[centers.length - 1].cy
                          }
                          stroke={incomingStroke}
                          strokeWidth={2.5}
                          fill="none"
                          pointerEvents="none"
                        />
                        <path
                          d={
                            'M ' +
                            right +
                            ' ' +
                            centers[0].cy +
                            ' V ' +
                            centers[centers.length - 1].cy
                          }
                          stroke={stroke}
                          strokeWidth={2.5}
                          fill="none"
                          pointerEvents="none"
                        />
                      </>
                    )}
                    {centers.map(({ child, cy, childSize }) => (
                      <g key={child.id}>
                        <LadderElement
                          {...props}
                          element={child}
                          x={left}
                          y={cy}
                        />
                        <path
                          d={
                            'M ' +
                            (left + childSize.width) +
                            ' ' +
                            cy +
                            ' H ' +
                            right
                          }
                          stroke={color(child.id, snapshot)}
                          strokeWidth={2.5}
                          fill="none"
                          pointerEvents="none"
                        />
                      </g>
                    ))}
                  </>
                )
              })()}
        </>
      )}
    </g>
  )
}

function DropOverlay({
  zones,
  target,
  width,
}: {
  zones: LadDropZone[]
  target: LadDropTarget | null
  width: number
}) {
  const activeKey = target ? dropTargetKey(target) : null
  const active = zones.find((zone) => dropTargetKey(zone.target) === activeKey)
  const labelWidth = active ? Math.max(170, active.label.length * 12 + 20) : 0
  const labelX = active
    ? Math.max(
        8,
        Math.min(width - labelWidth - 8, active.anchor.x - labelWidth / 2),
      )
    : 0
  return (
    <g className="lad-drop-overlay" pointerEvents="none">
      {zones.map((zone) => {
        const selected = dropTargetKey(zone.target) === activeKey
        const stroke = selected ? '#0958d9' : '#69a5ed'
        return (
          <g
            key={dropTargetKey(zone.target)}
            className={'lad-drop-zone' + (selected ? ' is-active' : '')}
            data-drop-target={dropTargetKey(zone.target)}
            data-drop-active={selected ? 'true' : 'false'}
            aria-label={zone.label}
            opacity={selected ? 1 : 0.45}
          >
            <title>{zone.label}</title>
            {zone.marker === 'coil' ? (
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.width}
                height={zone.height}
                fill={selected ? '#e8f1ff66' : 'none'}
                stroke={stroke}
                strokeWidth={selected ? 3 : 1.5}
                strokeDasharray={selected ? undefined : '4 3'}
              />
            ) : zone.marker === 'vertical' ? (
              <path
                d={`M ${zone.anchor.x} ${zone.anchor.y - 20} V ${zone.anchor.y + 20} M ${zone.anchor.x - 5} ${zone.anchor.y - 20} H ${zone.anchor.x + 5} M ${zone.anchor.x - 5} ${zone.anchor.y + 20} H ${zone.anchor.x + 5}`}
                fill="none"
                stroke={stroke}
                strokeWidth={selected ? 3 : 1.5}
              />
            ) : (
              <path
                d={`M ${zone.x} ${zone.anchor.y} H ${zone.x + zone.width}`}
                fill="none"
                stroke={stroke}
                strokeWidth={selected ? 3 : 1.5}
                strokeDasharray={selected ? undefined : '5 4'}
              />
            )}
          </g>
        )
      })}
      {active && (
        <g
          className="lad-drop-label"
          role="status"
          aria-live="polite"
          aria-label={active.label}
          data-drop-label={active.label}
        >
          <rect
            x={labelX}
            y={Math.max(2, active.anchor.y - 48)}
            width={labelWidth}
            height={25}
            fill="#0958d9"
          />
          <text
            x={labelX + labelWidth / 2}
            y={Math.max(2, active.anchor.y - 48) + 17}
            textAnchor="middle"
            fill="white"
            fontSize={12}
          >
            {active.label}
          </text>
        </g>
      )}
    </g>
  )
}

export default function LadderCanvas(props: CanvasProps) {
  const {
    program,
    selection,
    snapshot,
    onSelect,
    dragPayload,
    locked,
    onDropTargetChange,
  } = props
  const {
    width,
    height: canvasHeight,
    bottom: top,
    rows,
  } = useMemo(() => layoutCanvas(program), [program])
  const zones = useMemo(
    () =>
      dragPayload && !locked
        ? canvasDropZones(program).filter((zone) =>
            canDropLad(program, dragPayload, zone.target),
          )
        : [],
    [program, dragPayload, locked],
  )
  const svgRef = useRef<SVGSVGElement>(null)
  const lastPoint = useRef<CanvasPoint | null>(null)
  const lastTargetKey = useRef<string | null>(null)

  useEffect(() => {
    let animation = 0
    const publish = (target: LadDropTarget | null) => {
      const key = target ? dropTargetKey(target) : null
      if (key !== lastTargetKey.current) {
        lastTargetKey.current = key
        onDropTargetChange?.(target)
      }
    }
    const viewport = (scroll: HTMLElement): CanvasRect => {
      const rect = scroll.getBoundingClientRect()
      return {
        x: rect.left + scroll.clientLeft,
        y: rect.top + scroll.clientTop,
        width: scroll.clientWidth,
        height: scroll.clientHeight,
      }
    }
    const update = () => {
      const svg = svgRef.current,
        point = lastPoint.current
      if (!dragPayload || locked || !svg || !point) {
        publish(null)
        return
      }
      const scroll = svg.closest('.lad-canvas-scroll') as HTMLElement | null
      if (scroll && !pointInside(point, viewport(scroll))) {
        publish(null)
        return
      }
      const rect = svg.getBoundingClientRect()
      if (
        !pointInside(point, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        })
      ) {
        publish(null)
        return
      }
      const matrix = svg.getScreenCTM()
      const position = matrix ? clientPointToSvg(point, matrix) : null
      publish(
        position ? (hitTestCanvasDrop(zones, position)?.target ?? null) : null,
      )
    }
    const move = (event: PointerEvent) => {
      lastPoint.current = { x: event.clientX, y: event.clientY }
      update()
    }
    const clear = () => {
      lastPoint.current = null
      publish(null)
    }
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) clear()
    }
    const scrollFrame = () => {
      const scroll = svgRef.current?.closest(
        '.lad-canvas-scroll',
      ) as HTMLElement | null
      if (scroll && lastPoint.current) {
        const delta = edgeScrollDelta(lastPoint.current, viewport(scroll))
        if (delta.x || delta.y) {
          const oldX = scroll.scrollLeft,
            oldY = scroll.scrollTop
          scroll.scrollLeft += delta.x
          scroll.scrollTop += delta.y
          if (scroll.scrollLeft !== oldX || scroll.scrollTop !== oldY) update()
        }
      }
      animation = requestAnimationFrame(scrollFrame)
    }
    // Captured pointer events still bubble to window; geometry does not depend on pointerenter.
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', move, true)
    window.addEventListener('pointercancel', clear)
    window.addEventListener('pointerout', leave)
    window.addEventListener('blur', clear)
    window.addEventListener('scroll', update, true)
    update()
    if (dragPayload && !locked) animation = requestAnimationFrame(scrollFrame)
    return () => {
      cancelAnimationFrame(animation)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', move, true)
      window.removeEventListener('pointercancel', clear)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('blur', clear)
      window.removeEventListener('scroll', update, true)
    }
  }, [dragPayload, locked, zones, onDropTargetChange])
  if (!rows.length)
    return (
      <div className="lad-empty-canvas">
        <strong>从第一条梯级开始</strong>
        <p>先在变量表中声明 BOOL 输入和输出，再点击“新增网络”。</p>
        <p>也可以打开“自保持示例”，试试启动、保持和停止。</p>
      </div>
    )
  return (
    <svg
      ref={svgRef}
      className="lad-svg"
      width={width}
      height={canvasHeight}
      role="group"
      aria-label="LAD 梯形图画布"
    >
      <defs>
        <pattern
          id="lad-dots"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="0.7" fill="#e7edf6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lad-dots)" />
      <path
        d={'M 76 36 V ' + top + ' M ' + (width - 48) + ' 36 V ' + top}
        stroke="#475569"
        strokeWidth={3}
        aria-label="左母线与右母线"
      >
        <title>左母线与右母线</title>
      </path>
      {rows.map(({ network, index, y, box, top: rowTop, height }) => {
        const stroke = color(network.coil.id, snapshot)
        const coilX = width - 128
        const selected = selection?.elementId === network.coil.id
        const networkName =
          '网络 ' + (index + 1) + (network.label ? ' · ' + network.label : '')
        const coilName =
          (network.coil.mode === 'set'
            ? '置位线圈 S '
            : network.coil.mode === 'reset'
              ? '复位线圈 R '
              : network.coil.negated
                ? '反向线圈 '
                : '线圈 ') + (network.coil.variable || '未绑定')
        return (
          <g key={network.id} id={'lad-network-' + network.id}>
            <rect
              x={13}
              y={rowTop + 18}
              width={30}
              height={25}
              rx={0}
              fill={selection?.networkId === network.id ? '#e5efff' : '#eef2f7'}
              role="button"
              tabIndex={0}
              aria-label={'选择网络 ' + (index + 1)}
              className="lad-network-handle lad-hover-target"
              style={{
                cursor: locked ? 'pointer' : 'grab',
                touchAction: locked ? 'auto' : 'none',
              }}
              onPointerDown={(event) => {
                if (locked || event.button !== 0) return
                event.stopPropagation()
                props.onDragStart?.(
                  { kind: 'network', networkId: network.id },
                  event,
                )
              }}
              onClick={() =>
                onSelect({
                  networkId: network.id,
                  elementId: network.condition.id,
                })
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter')
                  onSelect({
                    networkId: network.id,
                    elementId: network.condition.id,
                  })
              }}
            >
              <title>
                {networkName +
                  (locked
                    ? '：单击查看；运行中不可排序。'
                    : props.onDragStart
                      ? '：单击选择；拖动调整网络顺序。'
                      : '：单击选择。')}
              </title>
            </rect>
            <HoverOutline x={13} y={rowTop + 18} width={30} height={25} />
            <text
              x={28}
              y={rowTop + 37}
              textAnchor="middle"
              className="lad-network-number"
              pointerEvents="none"
            >
              {index + 1}
            </text>
            <text x={96} y={rowTop + 15} className="lad-network-comment">
              <title>{network.label}</title>
              {shortLabel(network.label || '网络 ' + (index + 1), 85)}
            </text>
            <path
              d={'M 76 ' + y + ' H 96'}
              stroke={
                snapshot && snapshot.scanIndex > 0 ? '#1769e0' : '#64748b'
              }
              strokeWidth={2.5}
              fill="none"
            />
            <LadderElement
              {...props}
              network={network}
              element={network.condition}
              x={96}
              y={y}
              powerIn={snapshot !== null && snapshot.scanIndex > 0}
            />
            <path
              d={'M ' + (96 + box.width) + ' ' + y + ' H ' + (coilX - 40)}
              stroke={color(network.condition.id, snapshot)}
              strokeWidth={2.5}
              fill="none"
            />
            <g className="lad-element" data-element-id={network.coil.id}>
              <rect
                x={coilX - 40}
                y={y - 40}
                width={80}
                height={80}
                rx={0}
                fill={selected ? '#e8f1ff' : 'transparent'}
                stroke={selected ? '#1677ff' : 'none'}
                role="button"
                tabIndex={0}
                aria-label={coilName}
                className="lad-hover-target"
                onClick={() =>
                  onSelect({
                    networkId: network.id,
                    elementId: network.coil.id,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect({
                      networkId: network.id,
                      elementId: network.coil.id,
                    })
                  }
                }}
              >
                <title>
                  {coilName +
                    (locked
                      ? '：单击查看属性；运行中不可替换。'
                      : props.onDragStart
                        ? '：单击选择；拖入线圈工具可替换类型。'
                        : '：单击选择。')}
                </title>
              </rect>
              <HoverOutline x={coilX - 40} y={y - 40} width={80} height={80} />
              <g pointerEvents="none">
                <text
                  x={coilX}
                  y={y - 22}
                  textAnchor="middle"
                  className="lad-symbol-label"
                >
                  <title>{network.coil.variable}</title>
                  {shortLabel(network.coil.variable || '选择输出', 12)}
                </text>
                <path
                  d={'M ' + (coilX - 40) + ' ' + y + ' H ' + (coilX - 13)}
                  stroke={color(network.condition.id, snapshot)}
                  strokeWidth={2.5}
                  fill="none"
                />
                <path
                  d={'M ' + (coilX + 13) + ' ' + y + ' H ' + (width - 48)}
                  stroke={stroke}
                  strokeWidth={2.5}
                  fill="none"
                />
                <path
                  d={
                    'M ' +
                    (coilX - 5) +
                    ' ' +
                    (y - 14) +
                    ' C ' +
                    (coilX - 22) +
                    ' ' +
                    (y - 14) +
                    ' ' +
                    (coilX - 22) +
                    ' ' +
                    (y + 14) +
                    ' ' +
                    (coilX - 5) +
                    ' ' +
                    (y + 14) +
                    ' M ' +
                    (coilX + 5) +
                    ' ' +
                    (y - 14) +
                    ' C ' +
                    (coilX + 22) +
                    ' ' +
                    (y - 14) +
                    ' ' +
                    (coilX + 22) +
                    ' ' +
                    (y + 14) +
                    ' ' +
                    (coilX + 5) +
                    ' ' +
                    (y + 14)
                  }
                  stroke={stroke}
                  strokeWidth={2.8}
                  fill="none"
                />
                {network.coil.negated && (
                  <path
                    d={
                      'M ' +
                      (coilX - 11) +
                      ' ' +
                      (y + 13) +
                      ' L ' +
                      (coilX + 11) +
                      ' ' +
                      (y - 13)
                    }
                    stroke={stroke}
                    strokeWidth={2}
                  />
                )}
                {network.coil.mode && network.coil.mode !== 'normal' && (
                  <text
                    x={coilX}
                    y={y + 5}
                    textAnchor="middle"
                    className="lad-coil-mode"
                    fill={stroke}
                  >
                    {network.coil.mode === 'set' ? 'S' : 'R'}
                  </text>
                )}
                {snapshot && (
                  <text
                    x={coilX}
                    y={y + 29}
                    textAnchor="middle"
                    className="lad-bit-label"
                    fill={stroke}
                  >
                    {snapshot.scanIndex > 0
                      ? snapshot.trace[network.coil.id] === true
                        ? 'TRUE'
                        : 'FALSE'
                      : '—'}
                  </text>
                )}
              </g>
            </g>
            <line
              x1={8}
              x2={width - 8}
              y1={rowTop + height - 5}
              y2={rowTop + height - 5}
              stroke="#e7edf4"
            />
          </g>
        )
      })}
      {dragPayload && !locked && (
        <DropOverlay
          zones={zones}
          target={props.dropTarget ?? null}
          width={width}
        />
      )}
    </svg>
  )
}
