import {
  HOVER_EDGE_TOOL_CLASS,
  HOVER_EDGE_TOOL_VISIBLE_CLASS,
} from '@/assets/constant'
import type { Graph } from '@antv/x6'

function setHoverEdgeToolsVisible(
  graph: Graph,
  edgeId: string,
  visible: boolean,
) {
  graph.container
    .querySelectorAll<HTMLElement>(`.${HOVER_EDGE_TOOL_CLASS}`)
    .forEach((tool) => {
      if (tool.dataset.cellId !== edgeId) return
      tool.classList.toggle(HOVER_EDGE_TOOL_VISIBLE_CLASS, visible)
    })
}

function getHoverEdgeToolId(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  return target
    .closest<HTMLElement>(`.${HOVER_EDGE_TOOL_CLASS}`)
    ?.getAttribute('data-cell-id')
}

export { getHoverEdgeToolId, setHoverEdgeToolsVisible }
