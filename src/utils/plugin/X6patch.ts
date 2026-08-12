import {
  CellView,
  Dom,
  FunctionExt,
  Node,
  NodeView,
  Scroller,
  Shape,
} from '@antv/x6'
import { SelectionImpl } from '@antv/x6/es/plugin/selection/selection'
import { previewLinkAttrs } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { routeAllEdges } from '@/services/routing-service'
import type { Cell, Edge, EdgeView, Graph, Rectangle } from '@antv/x6'
import type { PortMetadata } from '@antv/x6/lib/model/port'

const commonService = createCommonService()

// ── X6 运行时原型补丁 ────────────────────────────────────────────────────────
// _xxx 前缀表示自定义框架补丁方法，避免与 X6 未来版本的方法名冲突。
// ─────────────────────────────────────────────────────────────────────────────

declare module '@antv/x6' {
  interface Node {
    _getMergedPort(portId: string): PortMetadata
  }
}

CellView.prototype._getSelectors = function () {
  return (this as unknown as { selectors: Record<string, Element> }).selectors
}

const nodeViewProto = NodeView.prototype as unknown as Record<string, any>

const selectionProto = SelectionImpl.prototype as unknown as Record<string, any>

/**
 * X6 框选结束后默认用已选节点的包围盒重算选择外框。
 * 保留 mousedown 到 mouseup 形成的框选区域，并在整体移动时同步该区域。
 */
if (!selectionProto._preserveRubberbandPatched) {
  const selectionRectKey = '_rubberbandSelectionRect'

  for (const methodName of ['select', 'unselect', 'reset', 'clean']) {
    const original = selectionProto[methodName]
    selectionProto[methodName] = function (this: any, ...args: any[]) {
      this[selectionRectKey] = null
      return original.apply(this, args)
    }
  }

  const originalStopSelecting = selectionProto.stopSelecting
  selectionProto.stopSelecting = function (this: any, evt: any) {
    const eventData = this.getEventData(evt)
    const selectingRect =
      eventData?.action === 'selecting' ? this.getSelectingRect() : null

    const result = originalStopSelecting.call(this, evt)
    if (selectingRect && this.length > 0) {
      this[selectionRectKey] = selectingRect
      this.updateContainer()
    }
    return result
  }

  const originalUpdateContainer = selectionProto.updateContainer
  selectionProto.updateContainer = function (this: any) {
    const result = originalUpdateContainer.call(this)
    const rect = this[selectionRectKey]
    if (rect) {
      Dom.css(this.selectionContainer, {
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      })
    }
    return result
  }

  const originalApplyDraggingPreview = selectionProto.applyDraggingPreview
  selectionProto.applyDraggingPreview = function (
    this: any,
    offset: { dx: number; dy: number },
  ) {
    if (this.options.following) {
      this[selectionRectKey]?.translate(offset.dx, offset.dy)
    }
    return originalApplyDraggingPreview.call(this, offset)
  }

  selectionProto._preserveRubberbandPatched = true
}

interface SelectionAreaState {
  graph: Graph
  options: {
    rubberEdge?: boolean
    strict?: boolean
  }
}

/**
 * X6 默认使用整条 Edge 的 BBox 判断框选命中。折线路径跨度较大时，
 * BBox 内没有线段的空白区域也会误选 Edge。
 *
 * Node 保留 X6 原有的 BBox 判断；Edge 改用 EdgeView 中的最终渲染路径，
 * 以覆盖 Avoid 等只反映在 View Path 中的路由结果。
 */
if (!selectionProto._preciseRubberEdgePatched) {
  const originalGetCellViewsInArea = selectionProto.getCellViewsInArea as (
    this: SelectionAreaState,
    rect: Rectangle,
  ) => CellView[]

  selectionProto.getCellViewsInArea = function (
    this: SelectionAreaState,
    rect: Rectangle,
  ) {
    const originalViews = originalGetCellViewsInArea.call(this, rect)
    if (!this.options.rubberEdge) return originalViews

    // Node 继续使用 X6 原有结果；丢弃其中通过 BBox 命中的 Edge。
    const nodeViews = originalViews.filter((view) => !view.cell.isEdge())
    const rectBoundary = [
      rect.topLine,
      rect.rightLine,
      rect.bottomLine,
      rect.leftLine,
    ]

    const edgeViews = this.graph
      .getEdges()
      .map((edge) => this.graph.findViewByCell(edge) as EdgeView | null)
      .filter((view): view is EdgeView => {
        const path = view?.getConnection()
        if (!view || !path) return false

        const polylines = path.toPolylines({
          segmentSubdivisions: view.getConnectionSubdivisions(),
        })
        if (!polylines?.length) return false

        if (this.options.strict) {
          return polylines.every((polyline) =>
            polyline.points.every((point) => rect.containsPoint(point)),
          )
        }

        return polylines.some(
          (polyline) =>
            polyline.points.some((point) => rect.containsPoint(point)) ||
            rectBoundary.some(
              (boundary) => polyline.intersectsWithLine(boundary) !== null,
            ),
        )
      })

    return nodeViews.concat(edgeViews)
  }

  selectionProto._preciseRubberEdgePatched = true
}

interface SelectionTranslationState {
  graph: Graph
  collection: {
    toArray(): Cell[]
  }
  translatingCache: {
    nodeIdSet: Set<string>
    edgesToTranslate: Edge[]
  } | null
}

interface FixedEdgeTerminal {
  edge: Edge
  source?: { horizontal: boolean; x: number; y: number }
  target?: { horizontal: boolean; x: number; y: number }
}

/**
 * Selection 整体平移 Edge vertices 时，引用未选中 Node 的端点不会移动，
 * 首尾线段因此会倾斜。平移后在同一帧校正固定端旁的 vertex：内部 Edge
 * 保持相对位置不变，边界 Edge 保持正交连接，全程不触发 Avoid。
 */
if (!selectionProto._fixedTerminalVertexPatched) {
  const originalTranslateSelectedNodes =
    selectionProto.translateSelectedNodes as (
      this: SelectionTranslationState,
      dx: number,
      dy: number,
      exclude?: Cell,
      otherOptions?: Record<string, unknown>,
    ) => void

  selectionProto.translateSelectedNodes = function (
    this: SelectionTranslationState,
    dx: number,
    dy: number,
    exclude?: Cell,
    otherOptions?: Record<string, unknown>,
  ) {
    const movingNodeIds = this.translatingCache?.nodeIdSet ?? new Set<string>()
    const fixedTerminals =
      this.translatingCache?.edgesToTranslate
        .map((edge) => {
          const vertices = edge.getVertices()
          if (vertices.length === 0) return null

          const view = this.graph.findViewByCell(edge) as EdgeView | null
          if (!view) return null

          const item: FixedEdgeTerminal = { edge }
          const sourceId = edge.getSourceCellId()
          const targetId = edge.getTargetCellId()
          const firstVertex = vertices[0]
          const lastVertex = vertices[vertices.length - 1]

          if (sourceId && !movingNodeIds.has(sourceId)) {
            item.source = {
              horizontal:
                Math.abs(view.sourcePoint.x - firstVertex.x) >=
                Math.abs(view.sourcePoint.y - firstVertex.y),
              x: view.sourcePoint.x,
              y: view.sourcePoint.y,
            }
          }
          if (targetId && !movingNodeIds.has(targetId)) {
            item.target = {
              horizontal:
                Math.abs(view.targetPoint.x - lastVertex.x) >=
                Math.abs(view.targetPoint.y - lastVertex.y),
              x: view.targetPoint.x,
              y: view.targetPoint.y,
            }
          }

          return item.source || item.target ? item : null
        })
        .filter((item): item is FixedEdgeTerminal => item !== null) ?? []

    originalTranslateSelectedNodes.call(this, dx, dy, exclude, otherOptions)

    fixedTerminals.forEach(({ edge, source, target }) => {
      const vertices = edge.getVertices().map((point) => ({ ...point }))
      if (vertices.length === 0) return

      if (source) {
        if (source.horizontal) vertices[0].y = source.y
        else vertices[0].x = source.x
      }
      if (target) {
        const lastVertex = vertices[vertices.length - 1]
        if (target.horizontal) lastVertex.y = target.y
        else lastVertex.x = target.x
      }

      edge.setVertices(vertices, { ui: true })
    })
  }

  selectionProto._fixedTerminalVertexPatched = true
}

/**
 * 一个模块和 Edge 一起移动时，整体平移可能让路线穿过其他模块。
 * 必须等 Selection 在当前帧提交节点和 vertices 后，再按最新坐标执行 Avoid。
 * 多个模块一起移动时不寻路，保持组内 Cell 的相对位置不变。
 */
if (!selectionProto._routeSingleNodeSelectionPatched) {
  const originalApplyDraggingPreview = selectionProto.applyDraggingPreview as (
    this: SelectionTranslationState,
    offset: { dx: number; dy: number },
  ) => void

  selectionProto.applyDraggingPreview = function (
    this: SelectionTranslationState,
    offset: { dx: number; dy: number },
  ) {
    const result = originalApplyDraggingPreview.call(this, offset)
    const selectedCells = this.collection.toArray()
    const selectedNodeCount = selectedCells.filter((cell) =>
      cell.isNode(),
    ).length

    if (selectedCells.length > 1 && selectedNodeCount === 1) {
      void routeAllEdges(this.graph)
    }
    return result
  }

  selectionProto._routeSingleNodeSelectionPatched = true
}

/**
 * X6 默认把 mousedown 的端口固定为 source，只拖动 target；
 * 从 in 端口拉线时改为固定 target 拖动 source
 */
if (!nodeViewProto._startConnecttingPatched) {
  const originalStartConnectting = nodeViewProto.startConnectting

  nodeViewProto.startConnectting = function (
    this: any,
    e: any,
    magnet: Element,
    x: number,
    y: number,
  ) {
    const portId = this.findAttr('port', magnet)
    const portGroup = portId
      ? commonService.getPortGroup(this.cell.getPort(portId))
      : null

    if (portGroup !== 'in') {
      return originalStartConnectting.call(this, e, magnet, x, y)
    }

    this.graph.model.startBatch('add-edge')

    const edge =
      this.getDefaultEdge(this, magnet) ?? new Shape.Edge(previewLinkAttrs)
    edge.setTarget({
      ...edge.getTarget(),
      ...this.getEdgeTerminal(magnet, x, y, edge, 'target'),
    })
    edge.setSource({
      ...edge.getSource(),
      x,
      y,
    })
    edge.addTo(this.graph.model, { async: false, ui: true })

    const edgeView = edge.findView(this.graph)
    edgeView.setEventData(
      e,
      edgeView.prepareArrowheadDragging('source', {
        x,
        y,
        isNewEdge: true,
        fallbackAction: 'remove',
      }),
    )
    this.setEventData(e, { edgeView })
    edgeView.notifyMouseDown(e, x, y)
  }

  nodeViewProto._startConnecttingPatched = true
}

/**
 * 将 scroller 构造时默认的 debounce(200ms) 替换为 throttle(60ms)，
 * 使画布滚动/缩放时的 autoResize 响应更即时。
 * 参考: https://github.com/antvis/X6/issues/3223
 */
export function _patchScrollerOnUpdate(scroller: Scroller) {
  const impl = (scroller as unknown as Record<string, any>).scrollerImpl
  if (!impl) {
    console.warn('[X6patch] _patchScrollerOnUpdate: scrollerImpl 不存在，跳过')
    return
  }

  const proto = Object.getPrototypeOf(impl) as Record<string, Function>
  const originalOnUpdate = proto.onUpdate as Function

  // 构造时 startListening() 已用 debounce 版本注册事件监听，
  // 必须先 stopListening 解绑，再用 throttled 版本重新绑定。
  proto.stopListening.call(impl)
  impl.onUpdate = FunctionExt.throttle(originalOnUpdate.bind(impl), 60)
  proto.startListening.call(impl)
}

/**
 * 强制 scroller 立即重新计算内容尺寸和 page 分页。
 * 用于 fromJSON 切换图层后，确保 scroller 同步新图层的内容范围。
 */
export function _patchScrollerForceUpdate(scroller: Scroller) {
  const impl = (scroller as unknown as Record<string, any>).scrollerImpl
  if (!impl) {
    console.warn(
      '[X6patch] _patchScrollerForceUpdate: scrollerImpl 不存在，跳过',
    )
    return
  }
  const { graph, options } = impl
  // 更新 graph size
  graph?.fitToContent({
    gridWidth: options?.pageWidth,
    gridHeight: options?.pageHeight,
    allowNewOrigin: 'negative',
    useCellGeometry: true,
  })
}

export function mergePortMetadata(
  item: PortMetadata,
  groups?: Record<string, PortMetadata>,
): PortMetadata {
  const groupName = item.group
  if (!groupName) return item
  const groupDef = groups?.[groupName]
  if (!groupDef) return item
  return {
    ...groupDef,
    ...item,
    attrs: { ...groupDef.attrs, ...item.attrs },
    label: {
      ...groupDef.label,
      ...item.label,
    },
  }
}

/**
 * 获取合并后的完整 PortMetadata（item + group）
 * X6 getPort() 只返回 item 自身数据，不包含 group 定义。
 * 此补丁将 group 的 markup/attrs/label 与 item 合并，得到渲染时的完整数据。
 */
Node.prototype._getMergedPort = function (
  this: Node,
  portId: string,
): PortMetadata {
  const item = this.getPort(portId)
  const groupName = item.group
  if (!groupName) return item
  // 通过 ports getter 获取完整 ports 数据（含 groups）
  const portsData = (
    this as unknown as { ports: { groups?: Record<string, PortMetadata> } }
  ).ports
  return mergePortMetadata(item, portsData?.groups)
}
