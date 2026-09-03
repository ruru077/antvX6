import type { Graph } from '@antv/x6'

interface CloseContextMenuOptions {
  sync?: boolean
}

interface ContextMenuController {
  close: (options?: CloseContextMenuOptions) => void
}

const controllers = new WeakMap<Graph, ContextMenuController>()

/** 暴露通用菜单关闭能力，输入适配层无需依赖 React 菜单组件。 */
function registerContextMenuController(
  graph: Graph,
  controller: ContextMenuController,
) {
  controllers.set(graph, controller)
  return () => {
    if (controllers.get(graph) === controller) controllers.delete(graph)
  }
}

function closeContextMenu(graph: Graph, options?: CloseContextMenuOptions) {
  controllers.get(graph)?.close(options)
}

export { closeContextMenu, registerContextMenuController }
export type { CloseContextMenuOptions, ContextMenuController }
