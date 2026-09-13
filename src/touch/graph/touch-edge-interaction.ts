import {
  HOVER_EDGE_TOOL_CLASS,
  RED,
  SOURCE_ARROWHEAD_STROKE_WIDTH,
  TARGET_ARROWHEAD_STROKE_WIDTH,
} from '@/assets/constant'
import sourceAnchorCursor from '@/assets/source-anchor-cursor.png'
import { OUTLINE_COLOR } from '@/assets/x6Model'
import {
  TOUCH_SOURCE_ARROWHEAD_TOOL,
  TOUCH_TARGET_ARROWHEAD_TOOL,
} from '@/touch/graph/touch-arrowhead-tool'
import type { GraphInteractionAdapter } from '@/touch/service/graph-interaction-adapter-service'
import type { ComplexAttrValue, Edge, Tools } from '@antv/x6'

interface TouchEdgeOutlineSnapshot {
  stroke: ComplexAttrValue
  strokeWidth: ComplexAttrValue
}

const touchEdgeOutlineSnapshots = new WeakMap<Edge, TouchEdgeOutlineSnapshot>()

function addEdgeOutline(
  edge: Edge,
  { getFilterWidth }: Parameters<GraphInteractionAdapter['addEdgeOutline']>[1],
) {
  if (!touchEdgeOutlineSnapshots.has(edge)) {
    touchEdgeOutlineSnapshots.set(edge, {
      stroke: edge.attr<ComplexAttrValue>('line/stroke'),
      strokeWidth: edge.attr<ComplexAttrValue>('line/strokeWidth'),
    })
  }
  const snapshot = touchEdgeOutlineSnapshots.get(edge)!
  edge.attr(
    {
      line: {
        filter: null,
        stroke: snapshot.stroke === RED ? RED : OUTLINE_COLOR,
        strokeWidth: Math.min(getFilterWidth(4), 4),
      },
    },
    { undo: false },
  )
}

function removeEdgeOutline(edge: Edge) {
  const snapshot = touchEdgeOutlineSnapshots.get(edge)
  edge.attr('line/filter', null, { undo: false })
  if (!snapshot) return

  edge.attr('line/stroke', snapshot.stroke ?? null, { undo: false })
  edge.attr('line/strokeWidth', snapshot.strokeWidth ?? null, {
    undo: false,
  })
  touchEdgeOutlineSnapshots.delete(edge)
}

function initializeEdgeTools(
  edge: Edge,
  {
    isPreview,
    isBranchEdge,
  }: Parameters<GraphInteractionAdapter['initializeEdgeTools']>[1],
) {
  const managedToolNames = [
    'ratio-anchor',
    'source-arrowhead',
    'target-arrowhead',
    TOUCH_SOURCE_ARROWHEAD_TOOL,
    TOUCH_TARGET_ARROWHEAD_TOOL,
  ]
  const tools = edge.getTools()
  const persistentTools =
    tools?.items.filter((item) => {
      const name = typeof item === 'string' ? item : item.name
      return !managedToolNames.includes(name)
    }) ?? []
  const touchTools: Tools['items'] = []

  if (isBranchEdge) {
    // BranchEdge 继续使用 ratio-anchor，不替换它的 source 端控制方式。
    touchTools.push({
      name: 'ratio-anchor',
      args: { className: HOVER_EDGE_TOOL_CLASS },
    })
  } else {
    touchTools.push({
      name: TOUCH_SOURCE_ARROWHEAD_TOOL,
      args: {
        attrs: {
          d: 'M -7.5 -7.5 H 7.5 V 7.5 H -7.5 Z',
          fill: 'transparent',
          stroke: 'transparent',
          cursor: `url("${sourceAnchorCursor}") 16 16, default`,
          'stroke-width': SOURCE_ARROWHEAD_STROKE_WIDTH,
        },
      },
    })
    // { name: 'vertices' },
    // { name: 'segments' },
  }

  touchTools.push({
    name: TOUCH_TARGET_ARROWHEAD_TOOL,
    args: {
      // 触控端没有 hover，透明命中区需要保持可交互。
      // ratio: isPreview ? 1 : 1,
      attrs: {
        // 使用 d 反转箭头 防止嵌入 Block 造成预期行为错乱
        ...(isPreview ? {} : { d: 'M 0 -8 -18 0 0 8 Z' }),
        fill: 'transparent',
        stroke: 'transparent',
        'stroke-width': TARGET_ARROWHEAD_STROKE_WIDTH,
        cursor: 'move',
      },
    },
  })

  const currentNames = tools?.items.map((item) =>
    typeof item === 'string' ? item : item.name,
  )
  const expectedNames = touchTools.map((item) =>
    typeof item === 'string' ? item : item.name,
  )
  const ordinaryToolsArePersistent =
    !isBranchEdge &&
    tools?.items
      .filter(
        (item) =>
          typeof item !== 'string' &&
          [TOUCH_SOURCE_ARROWHEAD_TOOL, TOUCH_TARGET_ARROWHEAD_TOOL].includes(
            item.name,
          ),
      )
      .every(
        (item) =>
          typeof item !== 'string' &&
          item.args?.className !== HOVER_EDGE_TOOL_CLASS,
      )
  const alreadyInitialized =
    currentNames?.filter((name) => managedToolNames.includes(name)).join() ===
    expectedNames.join()
  if (alreadyInitialized && (isBranchEdge || ordinaryToolsArePersistent)) return

  edge.setTools(
    { ...tools, items: [...persistentTools, ...touchTools] },
    { undo: false },
  )
}

const touchGraphInteractionAdapter: GraphInteractionAdapter = {
  addEdgeOutline,
  removeEdgeOutline,
  initializeEdgeTools,
}

export { touchGraphInteractionAdapter }
