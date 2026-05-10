import { Graph, MiniMap } from '@antv/x6'

function createMinimapService() {
  let minimap: MiniMap | undefined
  let resizeObserver: ResizeObserver | undefined
  let graph: Graph | undefined
  let container: HTMLElement | undefined

  function create(g: Graph, c: HTMLElement) {
    graph = g
    container = c

    mount(container.offsetWidth, container.offsetHeight)

    resizeObserver = new ResizeObserver((entries) => {
      const { inlineSize, blockSize } = entries[0].contentBoxSize[0]
      mount(inlineSize, blockSize)
    })
    resizeObserver.observe(container)
  }

  function dispose() {
    resizeObserver?.disconnect()
    minimap?.dispose()

    resizeObserver = undefined
    minimap = undefined
    graph = undefined
    container = undefined
  }

  function mount(width: number, height: number) {
    if (!graph || !container) return
    minimap?.dispose()

    minimap = new MiniMap({
      container,
      width,
      height,
      padding: 0,
      // graphOptions: {
      //   createCellView(cell) {
      //     // 可以返回三种类型数据
      //     // 1. null: 不渲染
      //     // 2. undefined: 使用 X6 默认渲染方式
      //     // 3. CellView: 自定义渲染
      //     if (cell.isEdge()) {
      //       return null
      //     }
      //   },
      // },
    })
    graph.use(minimap)
  }

  return {
    create,
    dispose,
  }
}
export { createMinimapService }
