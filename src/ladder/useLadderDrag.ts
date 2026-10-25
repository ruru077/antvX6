import { useCallback, useEffect, useRef, useState } from 'react'
import { applyLadDrop } from './drag'
import { findElement } from './model'
import type { LadDragPayload, LadDropTarget } from './drag'
import type { LadProgram, LadSelection } from './model'
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react'

type Options = {
  program: LadProgram
  locked: boolean
  onCommit: (program: LadProgram, selection: LadSelection | null) => void
  onStatus: (message: string) => void
}
type Gesture = {
  payload: LadDragPayload
  pointerId: number
  startX: number
  startY: number
  active: boolean
  program: LadProgram
}

export function dragLabel(payload: LadDragPayload): string {
  if (payload.kind === 'network') return '移动网络'
  if (payload.kind === 'element') return '移动元件'
  const names: Record<string, string> = {
    'contact-open': '常开触点',
    'contact-closed': '常闭触点',
    not: '逻辑流求反',
    'coil-normal': '普通线圈',
    'coil-negated': '反向线圈',
    'coil-set': '置位线圈 S',
    'coil-reset': '复位线圈 R',
  }
  return names[payload.tool] ?? payload.tool
}

export function dropLabel(
  target: LadDropTarget | null,
  program?: LadProgram,
): string {
  if (!target) return '移至有效插入标记；Esc 取消'
  if (target.kind === 'network') return '插入到网络边界 ' + (target.index + 1)
  if (target.kind === 'coil') return '替换末尾线圈类型，保留变量绑定'
  const network = program?.networks.find((item) => item.id === target.networkId)
  if (network && findElement(network, target.elementId)?.type === 'series') {
    if (target.mode === 'before') return '在串联组内开头插入'
    if (target.mode === 'after') return '在串联组内末尾插入'
  }
  return {
    before: '在元件前串联插入',
    after: '在元件后串联插入',
    parallel: '与目标元件并联',
    branch: '追加一条并联支路',
  }[target.mode]
}

/** A pointer gesture is one immutable edit. A click remains a click below 5 px. */
export function useLadderDrag(options: Options) {
  const latest = useRef(options)
  latest.current = options
  const gesture = useRef<Gesture | null>(null)
  const targetRef = useRef<LadDropTarget | null>(null)
  const suppressClick = useRef(false)
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [payload, setPayload] = useState<LadDragPayload | null>(null)
  const [target, setTarget] = useState<LadDropTarget | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const setDropTarget = useCallback((next: LadDropTarget | null) => {
    targetRef.current = next
    setTarget((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    )
  }, [])
  const clear = () => {
    gesture.current = null
    targetRef.current = null
    setPayload(null)
    setTarget(null)
  }
  const cancel = () => {
    const active = gesture.current?.active
    clear()
    if (active) {
      suppressClick.current = true
      latest.current.onStatus('已取消拖动 · 程序未改变')
    }
  }
  const start = (next: LadDragPayload, event: ReactPointerEvent) => {
    if (latest.current.locked || event.button !== 0 || !event.isPrimary) return
    event.stopPropagation()
    gesture.current = {
      payload: next,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      program: latest.current.program,
    }
    targetRef.current = null
    setTarget(null)
  }
  const onClickCapture = (event: MouseEvent) => {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
  }
  const onPointerDownCapture = () => {
    suppressClick.current = false
  }

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = gesture.current
      if (!current || current.pointerId !== event.pointerId) return
      if (latest.current.locked || latest.current.program !== current.program) {
        cancel()
        return
      }
      if (!current.active) {
        if (
          Math.hypot(
            event.clientX - current.startX,
            event.clientY - current.startY,
          ) < 5
        )
          return
        current.active = true
        setPayload(current.payload)
      }
      event.preventDefault()
      setPosition({ x: event.clientX, y: event.clientY })
    }
    const finish = (event: PointerEvent) => {
      const current = gesture.current
      if (!current || current.pointerId !== event.pointerId) return
      const destination = targetRef.current
      clear()
      if (!current.active) return
      // Suppress the synthetic click following a drag; it must not add a second item.
      suppressClick.current = true
      if (suppressTimer.current) clearTimeout(suppressTimer.current)
      suppressTimer.current = setTimeout(() => {
        suppressClick.current = false
      }, 0)
      if (latest.current.locked || latest.current.program !== current.program)
        return
      const result = destination
        ? applyLadDrop(current.program, current.payload, destination)
        : null
      if (result) {
        latest.current.onCommit(result.program, result.selection)
        latest.current.onStatus(dragLabel(current.payload) + '完成 · 可撤销')
      } else latest.current.onStatus('未放到有效插入位置 · 程序未改变')
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault()
        cancel()
      }
    }
    const hidden = () => {
      if (document.hidden) cancel()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      gesture.current = null
      if (suppressTimer.current) clearTimeout(suppressTimer.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])

  useEffect(() => {
    if (
      gesture.current &&
      (options.locked || gesture.current.program !== options.program)
    )
      cancel()
  }, [options.locked, options.program])

  return {
    payload,
    target,
    position,
    start,
    setDropTarget,
    onClickCapture,
    onPointerDownCapture,
  }
}
