import { XIcon } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
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

const WINDOW_MARGIN = 16
let activeWindowZIndex = 50

interface FloatingWindowRect {
  x: number
  y: number
  width: number
  height: number
}

interface FloatingWindowProps {
  title: string
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
  title,
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
  const rndRef = useRef<Rnd>(null)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const contentBodyRef = useRef<HTMLDivElement>(null)
  const windowRectRef = useRef<FloatingWindowRect | null>(null)
  const [zIndex, setZIndex] = useState(() => ++activeWindowZIndex)
  const [contentScrollable, setContentScrollable] = useState(!autoFitHeight)

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
    if (!autoFitHeight || !contentAreaRef.current || !contentBodyRef.current)
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
  }, [autoFitHeight, maxAutoHeight])

  return createPortal(
    <Rnd
      ref={rndRef}
      bounds="window"
      cancel="[data-floating-window-action]"
      default={windowRect}
      dragHandleClassName="floating-window-drag-handle"
      minHeight={viewportMinHeight}
      minWidth={viewportMinWidth}
      style={{ zIndex }}
      onMouseDown={() => setZIndex(++activeWindowZIndex)}
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
      <Card
        className="h-full gap-0 rounded-lg py-0"
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="false"
      >
        <CardHeader className="floating-window-drag-handle h-8 cursor-move touch-none items-center rounded-t-lg bg-muted/40 px-3 py-0 select-none">
          <CardTitle id={titleId}>{title}</CardTitle>
          <CardAction data-floating-window-action>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`关闭${title}`}
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
              className="h-8 justify-end gap-2 rounded-b-lg bg-muted/20 px-3 py-0"
              data-floating-window-action
            >
              {footer}
            </CardFooter>
          </>
        )}
      </Card>
    </Rnd>,
    document.body,
  )
}

export { FloatingWindow }
