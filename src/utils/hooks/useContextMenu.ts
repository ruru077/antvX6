import { useGraphStore } from '@/store/graphStore'

/**
 * X6 画布右键 → 通知 paper-container 触发 Radix ContextMenu。
 * X6 拦截了原生 contextmenu 事件，传递给 paper-container 通知 Radix 弹出。
 */
function useContextMenu() {
  const graph = useGraphStore((s) => s.graph)

  useEffect(() => {
    if (!graph) return
    const paper = graph.container.closest<HTMLElement>('.paper-container')
    if (!paper) return

    const handler = (args: { e: MouseEvent; x: number; y: number }) => {
      paper.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: args.e.clientX,
          clientY: args.e.clientY,
        }),
      )
    }

    graph.on('blank:contextmenu', handler)
    graph.on('node:contextmenu', handler)
    graph.on('edge:contextmenu', handler)

    return () => {
      console.log('[useContextMenu]注销 contextmenu 事件')
      graph.off('blank:contextmenu', handler)
      graph.off('node:contextmenu', handler)
      graph.off('edge:contextmenu', handler)
    }
  }, [graph])
}

export { useContextMenu }
