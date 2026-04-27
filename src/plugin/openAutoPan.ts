import type { Edge, Graph, Scroller } from '@antv/x6'

export function openAutoPan(graph: Graph) {
  const threshold = 30
  const controller = new AbortController()
  const autoPan = {
    dx: 0,
    dy: 0,
    intervalId: null as number | null,
    edge: null as Edge | null,
    clientX: 0,
    clientY: 0,
  }

  function stop() {
    autoPan.edge = null
    if (autoPan.intervalId !== null) {
      clearInterval(autoPan.intervalId)
      autoPan.intervalId = null
    }
  }
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

    if (x < threshold) autoPan.dx = -10
    else if (x > rect.width - threshold) autoPan.dx = 10
    if (y < threshold) autoPan.dy = -10
    else if (y > rect.height - threshold) autoPan.dy = 10

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
        autoPan.edge.setTarget({ x: graphPos.x, y: graphPos.y })
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

  return () => controller.abort()
}
