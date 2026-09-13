import { Tooltip } from 'antd'
import { SolverStatusBar } from '@/components/layout/SolverStatusBar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  focusFloatingWindow,
  setFloatingWindowTaskbarAnchor,
  useFloatingWindowStore,
} from '@/store/floatingWindowStore'
import { useSubGraphStore } from '@/store/subGraphStore'

function CanvasStatusBar() {
  const currentGraphId = useSubGraphStore((state) => state.currentGraphId)
  const allWindows = useFloatingWindowStore((state) => state.windows)
  const windows = useMemo(
    () => allWindows.filter((window) => window.graphId === currentGraphId),
    [allWindows, currentGraphId],
  )
  const activeId = useFloatingWindowStore(
    (state) => state.activeIds[currentGraphId] ?? null,
  )
  const minimizeWindow = useFloatingWindowStore((state) => state.minimizeWindow)
  const restoreWindow = useFloatingWindowStore((state) => state.restoreWindow)

  function toggleWindow(id: string, minimized: boolean) {
    if (minimized) {
      restoreWindow(id)
      requestAnimationFrame(() => focusFloatingWindow(id))
      return
    }
    minimizeWindow(id)
  }

  return (
    <div
      className="relative flex h-8 shrink-0 items-center border-t border-[rgb(130_135_144)] bg-[rgb(240_240_240)]"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto bg-[linear-gradient(to_bottom,rgb(211_227_233),rgb(211_227_253))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {windows.map((window) => {
          const Icon = window.taskbarIcon
          const active = activeId === window.id
          return (
            <Tooltip key={window.id} title={window.title} placement="top">
              <Button
                ref={(element) =>
                  setFloatingWindowTaskbarAnchor(window.id, element)
                }
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  'relative rounded-none after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:-translate-x-1/2 after:bg-muted-foreground after:content-[""]',
                  active ? 'bg-muted after:w-5 after:bg-primary' : 'after:w-2',
                  window.minimized && 'opacity-60',
                )}
                aria-label={
                  window.minimized
                    ? `还原${window.title}`
                    : `最小化${window.title}`
                }
                aria-pressed={active}
                onClick={() => toggleWindow(window.id, window.minimized)}
              >
                <Icon data-icon="inline-start" />
              </Button>
            </Tooltip>
          )
        })}
      </div>
      <SolverStatusBar />
    </div>
  )
}

export { CanvasStatusBar }
