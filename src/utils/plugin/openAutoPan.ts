import type { Edge, Graph, Scroller } from '@antv/x6'

/**
 * @description 开启鼠标沿边移动功能
 * @param graph - X6 Graph 实例
 */
export function openAutoPan(graph: Graph) {
  const threshold = 20
  const controller = new AbortController()
  let draggingEndpoint: 'source' | 'target' = 'source'
  const autoPan = {
    dx: 0,
    dy: 0,
    intervalId: null as number | null,
    edge: null as Edge | null,
    clientX: 0,
    clientY: 0,
  }

  /**
   * @description 停止自动平移并清理当前拖拽状态
   */
  function stop() {
    autoPan.edge = null
    draggingEndpoint = 'source'
    if (autoPan.intervalId !== null) {
      clearInterval(autoPan.intervalId)
      autoPan.intervalId = null
    }
  }

  // X6 的 cell:change:source 仅在 edge 终端 source 拖拽时触发
  /**
   * @description 记录正在拖拽 source 端点
   */
  function onChangeSource({ cell }: { cell: Edge }) {
    draggingEndpoint = 'source'
  }

  // X6 的 cell:change:target 仅在 edge 终端 target 拖拽时触发
  /**
   * @description 记录正在拖拽 target 端点
   */
  function onChangeTarget({ cell }: { cell: Edge }) {
    draggingEndpoint = 'target'
  }

  graph.on('cell:change:source', onChangeSource)
  graph.on('cell:change:target', onChangeTarget)
  // 鼠标移动出浏览器窗口
  window.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      autoPan.clientX = e.clientX
      autoPan.clientY = e.clientY
    },
    { signal: controller.signal },
  )
  // 浏览器窗口失焦
  window.addEventListener('blur', stop, { signal: controller.signal })

  /**
   * @description 监听 edge 拖拽轨迹，触发窗口边缘自动平移
   */
  graph.on('edge:mousemove', ({ e, edge }) => {
    const paperContainer = document.querySelector('.paper-container')
    if (!paperContainer) return
    autoPan.edge = edge
    autoPan.clientX = e.clientX
    autoPan.clientY = e.clientY
    const rect = paperContainer.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    autoPan.dx = 0
    autoPan.dy = 0

    if (x < threshold) autoPan.dx = -20
    else if (x > rect.width - threshold) autoPan.dx = 20
    if (y < threshold) autoPan.dy = -20
    else if (y > rect.height - threshold) autoPan.dy = 20

    if ((autoPan.dx !== 0 || autoPan.dy !== 0) && autoPan.intervalId === null) {
      autoPan.intervalId = setInterval(() => {
        const scroller = graph.getPlugin<Scroller>('scroller')
        if (!scroller || !autoPan.edge) return
        const pos = scroller.getScrollbarPosition()
        scroller.setScrollbarPosition(
          pos.left + autoPan.dx,
          pos.top + autoPan.dy,
        )
        const graphPos = graph.clientToLocal(autoPan.clientX, autoPan.clientY)
        const draggingSource = draggingEndpoint === 'source'
        if (draggingSource) {
          autoPan.edge.setSource({ x: graphPos.x, y: graphPos.y })
        } else {
          autoPan.edge.setTarget({ x: graphPos.x, y: graphPos.y })
        }
      }, 100)
    } else if (
      autoPan.dx === 0 &&
      autoPan.dy === 0 &&
      autoPan.intervalId !== null
    ) {
      clearInterval(autoPan.intervalId)
      autoPan.intervalId = null
    }
  })

  graph.on('edge:mouseup', stop)

  /**
   * @description 释放阶段：卸载 openAutoPan 监听与定时任务相关事件
   */
  return () => {
    graph.off('cell:change:source', onChangeSource)
    graph.off('cell:change:target', onChangeTarget)
    controller.abort()
  }
}
