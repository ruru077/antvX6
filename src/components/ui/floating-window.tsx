import { MinusIcon, XIcon } from 'lucide-react'
import { animate, useReducedMotion } from 'motion/react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  FLOATING_WINDOW_Z_INDEX_BASE,
  getFloatingWindowTaskbarAnchor,
  setFloatingWindowSurface,
  useFloatingWindowStore,
} from '@/store/floatingWindowStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { LucideIcon } from 'lucide-react'

const WINDOW_MARGIN = 16
let nextFloatingWindowId = 0

interface FloatingWindowRect {
  x: number
  y: number
  width: number
  height: number
}

interface FloatingWindowProps {
  windowId?: string
  graphId?: string
  title: string
  taskbarIcon: LucideIcon
  children: React.ReactNode
  footer?: React.ReactNode
  defaultWidth: number
  defaultHeight: number
  minWidth?: number
  minHeight?: number
  autoFitHeight?: boolean
  maxAutoHeight?: number
  onClose: () => void
}

function getInitialWindowRect(
  defaultWidth: number,
  defaultHeight: number,
): FloatingWindowRect {
  const availableWidth = Math.max(320, window.innerWidth - WINDOW_MARGIN * 2)
  const availableHeight = Math.max(240, window.innerHeight - WINDOW_MARGIN * 2)
  const width = Math.min(defaultWidth, availableWidth)
  const height = Math.min(defaultHeight, availableHeight)

  return {
    x: Math.max(WINDOW_MARGIN, (window.innerWidth - width) / 2),
    y: Math.max(WINDOW_MARGIN, (window.innerHeight - height) / 2),
    width,
    height,
  }
}

function FloatingWindow({
  windowId: providedWindowId,
  graphId: providedGraphId,
  title,
  taskbarIcon,
  children,
  footer,
  defaultWidth,
  defaultHeight,
  minWidth = 480,
  minHeight = 320,
  autoFitHeight = false,
  maxAutoHeight = 520,
  onClose,
}: FloatingWindowProps) {
  const titleId = useId()
  const [windowId] = useState(
    () => providedWindowId ?? `floating-window-${++nextFloatingWindowId}`,
  )
  const [graphId] = useState(
    () => providedGraphId ?? useSubGraphStore.getState().currentGraphId,
  )
  const currentGraphId = useSubGraphStore((state) => state.currentGraphId)
  const rndRef = useRef<Rnd>(null)
  const windowSurfaceRef = useRef<HTMLDivElement>(null)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const contentBodyRef = useRef<HTMLDivElement>(null)
  const windowRectRef = useRef<FloatingWindowRect | null>(null)
  const windowAnimationRectRef = useRef<DOMRect | null>(null)
  const initialTaskbarMetadataRef = useRef({ title, taskbarIcon })
  const [contentScrollable, setContentScrollable] = useState(!autoFitHeight)
  const [windowHidden, setWindowHidden] = useState(false)
  const reducedMotion = useReducedMotion()
  const windowEntry = useFloatingWindowStore((state) =>
    state.windows.find((window) => window.id === windowId),
  )
  const active = useFloatingWindowStore(
    (state) => state.activeIds[graphId] === windowId,
  )
  const registerWindow = useFloatingWindowStore((state) => state.registerWindow)
  const updateWindow = useFloatingWindowStore((state) => state.updateWindow)
  const unregisterWindow = useFloatingWindowStore(
    (state) => state.unregisterWindow,
  )
  const activateWindow = useFloatingWindowStore((state) => state.activateWindow)
  const minimizeWindow = useFloatingWindowStore((state) => state.minimizeWindow)
  const minimized = windowEntry?.minimized ?? false
  const registered = Boolean(windowEntry)
  const layerVisible = graphId === currentGraphId
  const zIndex = windowEntry?.zIndex ?? FLOATING_WINDOW_Z_INDEX_BASE

  windowRectRef.current ??= getInitialWindowRect(defaultWidth, defaultHeight)
  const windowRect = windowRectRef.current
  const viewportMinWidth = Math.min(
    minWidth,
    window.innerWidth - WINDOW_MARGIN * 2,
  )
  const viewportMinHeight = Math.min(
    minHeight,
    window.innerHeight - WINDOW_MARGIN * 2,
  )

  useLayoutEffect(() => {
    registerWindow({
      id: windowId,
      graphId,
      ...initialTaskbarMetadataRef.current,
    })
    return () => unregisterWindow(windowId)
  }, [graphId, registerWindow, unregisterWindow, windowId])

  useLayoutEffect(() => {
    setFloatingWindowSurface(windowId, windowSurfaceRef.current)
    return () => setFloatingWindowSurface(windowId, null)
  }, [windowId])

  useLayoutEffect(() => {
    const surface = windowSurfaceRef.current
    if (!surface) return
    surface.style.removeProperty('transform')
    surface.style.removeProperty('opacity')
    surface.style.removeProperty('will-change')
    surface.style.removeProperty('visibility')
  }, [registered])

  useLayoutEffect(() => {
    updateWindow(windowId, { title, taskbarIcon })
  }, [taskbarIcon, title, updateWindow, windowId])

  const previousMinimizedRef = useRef(false)
  useLayoutEffect(() => {
    if (!registered || previousMinimizedRef.current === minimized) return
    previousMinimizedRef.current = minimized

    const surface = windowSurfaceRef.current
    if (!surface) throw new Error(`Window surface is required for ${windowId}`)
    surface.style.removeProperty('transform')
    surface.style.removeProperty('opacity')
    surface.style.removeProperty('will-change')
    surface.style.removeProperty('visibility')
    if (minimized) surface.style.removeProperty('display')
    const taskbarAnchor = getFloatingWindowTaskbarAnchor(windowId)
    const target = taskbarAnchor.getBoundingClientRect()
    const source = minimized
      ? surface.getBoundingClientRect()
      : windowAnimationRectRef.current
    if (!source)
      throw new Error(`Window animation rect is required for ${windowId}`)
    if (minimized) windowAnimationRectRef.current = source
    const transform = {
      x: target.left - source.left,
      y: target.top - source.top,
      scaleX: target.width / source.width,
      scaleY: target.height / source.height,
    }
    let cancelled = false
    let frame = 0
    let animation: ReturnType<typeof animate> | null = null
    const clearAnimationStyles = () => {
      surface.style.removeProperty('transform')
      surface.style.removeProperty('opacity')
      surface.style.removeProperty('will-change')
    }

    if (reducedMotion) {
      if (minimized) surface.style.display = 'none'
      else surface.style.removeProperty('display')
      clearAnimationStyles()
      setWindowHidden(minimized)
      if (minimized) taskbarAnchor.focus()
      else surface.focus()
      return
    }

    surface.style.willChange = 'transform, opacity'
    if (minimized) {
      setWindowHidden(false)
      animation = animate(
        surface,
        { ...transform, opacity: 0.4 },
        { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
      )
      animation.then(() => {
        if (!cancelled) {
          surface.style.display = 'none'
          setWindowHidden(true)
          clearAnimationStyles()
          taskbarAnchor.focus()
        }
      })
    } else {
      surface.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scaleX}, ${transform.scaleY})`
      surface.style.opacity = '0.4'
      surface.style.removeProperty('display')
      setWindowHidden(false)
      frame = requestAnimationFrame(() => {
        animation = animate(
          surface,
          {
            x: [transform.x, 0],
            y: [transform.y, 0],
            scaleX: [transform.scaleX, 1],
            scaleY: [transform.scaleY, 1],
            opacity: [0.4, 1],
          },
          { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
        )
        animation.then(() => {
          if (cancelled) return
          clearAnimationStyles()
          surface.focus()
        })
      })
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      animation?.stop()
      clearAnimationStyles()
    }
  }, [minimized, reducedMotion, registered, windowId])
  useLayoutEffect(() => {
    if (
      minimized ||
      !autoFitHeight ||
      !contentAreaRef.current ||
      !contentBodyRef.current
    )
      return

    const fitWindowToContent = () => {
      if (!contentAreaRef.current || !rndRef.current) return

      const overflowHeight =
        contentAreaRef.current.scrollHeight -
        contentAreaRef.current.clientHeight
      const rect = windowRectRef.current!
      const heightLimit = Math.min(
        maxAutoHeight,
        window.innerHeight - WINDOW_MARGIN * 2,
      )
      const requiredHeight = rect.height + Math.max(0, overflowHeight)
      setContentScrollable(requiredHeight > heightLimit + 1)

      if (overflowHeight <= 1 || rect.height >= heightLimit) return

      const heightIncrease = Math.ceil(overflowHeight / 20) * 20
      const height = Math.min(heightLimit, rect.height + heightIncrease)
      const y = Math.max(WINDOW_MARGIN, (window.innerHeight - height) / 2)

      windowRectRef.current = { ...rect, y, height }
      rndRef.current.updateSize({ width: rect.width, height })
      rndRef.current.updatePosition({ x: rect.x, y })
    }

    const resizeObserver = new ResizeObserver(fitWindowToContent)
    resizeObserver.observe(contentBodyRef.current)
    fitWindowToContent()

    return () => resizeObserver.disconnect()
  }, [autoFitHeight, maxAutoHeight, minimized])

  return createPortal(
    <Rnd
      ref={rndRef}
      bounds="window"
      cancel="[data-floating-window-action]"
      default={windowRect}
      dragHandleClassName="floating-window-drag-handle"
      enableResizing={!minimized}
      minHeight={viewportMinHeight}
      minWidth={viewportMinWidth}
      style={{
        display: layerVisible ? undefined : 'none',
        zIndex,
        pointerEvents: !layerVisible || windowHidden ? 'none' : 'auto',
      }}
      onMouseDown={() => activateWindow(windowId)}
      onDragStop={(_, position) => {
        windowRectRef.current = {
          ...windowRectRef.current!,
          x: position.x,
          y: position.y,
        }
      }}
      onResizeStop={(_, __, element, ___, position) => {
        windowRectRef.current = {
          x: position.x,
          y: position.y,
          width: element.offsetWidth,
          height: element.offsetHeight,
        }
      }}
    >
      <div
        ref={windowSurfaceRef}
        className="h-full origin-top-left outline-none"
        aria-hidden={windowHidden}
        tabIndex={-1}
      >
        <Card
          className={cn(
            'h-full gap-0 rounded-none py-0 transition-[box-shadow] duration-150',
            active && 'shadow-[0_0_16px_rgba(0,0,0,0.32)]',
          )}
          role="dialog"
          aria-labelledby={titleId}
          aria-modal="false"
        >
          <CardHeader
            className={cn(
              'floating-window-drag-handle flex h-8 cursor-move touch-none items-center justify-between rounded-none px-3 py-0 transition-colors duration-150 select-none',
              active ? 'bg-[rgb(211_227_253)]' : 'bg-[rgb(221_227_233)]',
            )}
          >
            <CardTitle id={titleId} className="text-sm font-sans leading-none">
              {title}
            </CardTitle>
            <CardAction
              className="-mr-3 flex h-8 self-center"
              data-floating-window-action
            >
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-10 rounded-none hover:bg-[rgb(219_219_219)]"
                aria-label={`最小化${title}`}
                title="最小化"
                data-floating-window-action
                onClick={() => minimizeWindow(windowId)}
              >
                <MinusIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-10 rounded-none hover:bg-destructive hover:text-card"
                aria-label={`关闭${title}`}
                title="关闭"
                data-floating-window-action
                onClick={onClose}
              >
                <XIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <Separator />
          <CardContent
            ref={contentAreaRef}
            className={cn(
              'min-h-0 flex-1 overflow-x-hidden p-3',
              contentScrollable ? 'overflow-y-auto' : 'overflow-y-hidden',
            )}
          >
            <div
              ref={contentBodyRef}
              className={autoFitHeight ? undefined : 'h-full'}
            >
              {children}
            </div>
          </CardContent>
          {footer && (
            <>
              <Separator />
              <CardFooter
                className="h-8 items-center justify-end gap-2 rounded-none bg-[rgb(240_240_240)] px-3 py-0"
                data-floating-window-action
              >
                {footer}
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </Rnd>,
    document.body,
  )
}

export { FloatingWindow }
