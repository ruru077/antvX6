import type { Cell, Edge, Graph, History, Node, Scroller } from '@antv/x6'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'

/**
 * 图形编辑器事件监听 hook
 * @param graph - Graph 实例
 */
export function useGraphListener(graph: Graph | null) {
  const syncGraph = useSubGraphStore((s) => s.syncGraph)
  const syncSubGraph = useSubGraphStore((s) => s.syncSubGraph)
  const changeGraphView = useSubGraphStore((s) => s.changeGraphView)
  const setPasteTarget = useGraphStore((s) => s.setPasteTarget)
  useEffect(() => {
    if (!graph) return

    graph.on('node:dblclick', ({ node }) => {
      // #1 进入子系统
      if (node.getData()?.type === 'SubsystemBlock') {
        changeGraphView(node.id)
        setPasteTarget({ x: 0, y: 30 })
      }
    })

    graph.on('node:added', ({ node, options }) => {
      if (options?.ignoreSync) return
      // #2.1 子系统添加
      if (node.getData()?.type === 'SubsystemBlock') {
        syncSubGraph(node, 'add')
      }
    })

    graph.on('node:removed', ({ node, options }) => {
      if (options?.ignoreSync) return
      // #2.2 子系统删除
      if (node.getData()?.type === 'SubsystemBlock') {
        syncSubGraph(node, 'delete')
      }
    })

    graph.on('blank:click', ({ x, y }: { x: number; y: number }) => {
      // #3.1 空白处点击，修改粘贴目标位置
      setPasteTarget({ x, y })
    })

    graph.on('history:change', ({ cmds }) => {
      const history = graph.getPlugin<History>('history')
      if (!history) return
      console.log(history['undoStack'])
    })

    const threshold = 30
    const autoPan = {
      dx: 0,
      dy: 0,
      intervalId: null as number | null,
    }

    graph.on('edge:mousemove', ({ e, edge }) => {
      const paperContainer = document.querySelector('.paper-container')
      if (!paperContainer) return
      const rect = paperContainer.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      autoPan.dx = 0
      autoPan.dy = 0

      if (x < threshold) autoPan.dx = -10
      else if (x > rect.width - threshold) autoPan.dx = 10
      if (y < threshold) autoPan.dy = -10
      else if (y > rect.height - threshold) autoPan.dy = 10

      if (
        (autoPan.dx !== 0 || autoPan.dy !== 0) &&
        autoPan.intervalId === null
      ) {
        autoPan.intervalId = setInterval(() => {
          const scroller = graph.getPlugin<Scroller>('scroller')
          if (!scroller) return
          const pos = scroller.getScrollbarPosition()
          scroller.setScrollbarPosition(
            pos.left + autoPan.dx,
            pos.top + autoPan.dy,
          )
          // client -> local：节点/边的坐标都在 local 坐标系
          const graphPos = graph.clientToLocal(e.clientX, e.clientY)
          edge.setTarget({ x: graphPos.x, y: graphPos.y })
        }, 50)
      } else if (
        autoPan.dx === 0 &&
        autoPan.dy === 0 &&
        autoPan.intervalId !== null
      ) {
        clearInterval(autoPan.intervalId)
        autoPan.intervalId = null
      }
    })

    graph.on('edge:mouseup', () => {
      if (autoPan.intervalId !== null) {
        clearInterval(autoPan.intervalId)
        autoPan.intervalId = null
      }
    })

    graph.on('cell:click', ({ cell, view, x, y }) => {
      // #3.2 cell点击，修改粘贴目标位置
      setPasteTarget({ x, y })
      console.log(cell, x, y)
    })
    return () => {}
  }, [graph, syncSubGraph, changeGraphView, setPasteTarget])
}
