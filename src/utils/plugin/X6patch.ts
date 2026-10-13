import {
  CellView,
  Dom,
  EdgeView,
  FunctionExt,
  Node,
  NodeView,
  Scroller,
  Shape,
} from '@antv/x6'
import { SelectionImpl } from '@antv/x6/es/plugin/selection/selection'
import { previewLinkAttrs } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import {
  isRoutingNode,
  routeEdge,
  routeNodeEdges,
  captureNodeRoutes,
  finishNodeRoutes,
  captureEdgeRoutes,
  finishEdgeRoutes,
} from '@/services/routing-service'
import type { Cell, Edge, Graph, Rectangle } from '@antv/x6'
import type { PortMetadata } from '@antv/x6/lib/model/port'
import type { Selection } from '@antv/x6/lib/plugin/selection'

const commonService = createCommonService()
const reverseSourceDragEdges = new WeakSet<Edge>()
const activeReverseSourceDragGraphs = new WeakSet<Graph>()

export function isReverseSourceDragEdge(edge: Edge) {
  return reverseSourceDragEdges.has(edge)
}

/**
 * EdgeView 之间转移 X6 的 mouse batch，
 * 由新 EdgeView.onMouseUp 按 X6 原有生命周期关闭。
 */
export function transferEdgeMouseBatch(
  sourceView: EdgeView,
  targetView: EdgeView,
) {
  type MouseBatchView = EdgeView & {
    cachedModelForMouseEvent: Graph['model'] | null
  }
  const source = sourceView as MouseBatchView
  const target = targetView as MouseBatchView
  const model = source.cachedModelForMouseEvent
  if (!model) return
  target.cachedModelForMouseEvent = model
  source.cachedModelForMouseEvent = null
}

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
const edgeViewProto = EdgeView.prototype as unknown as Record<string, any>

const selectionProto = SelectionImpl.prototype as unknown as Record<string, any>

// 输入端反向拉线时不高亮作为候选或当前吸附点的原 Edge。
if (!edgeViewProto._skipReverseSourceEdgeHighlightPatched) {
  const originalHighlight = edgeViewProto.highlight as EdgeView['highlight']
  edgeViewProto.highlight = function (
    this: EdgeView,
    elem?: Element | null,
    options?: Parameters<EdgeView['highlight']>[1],
  ) {
    if (
      activeReverseSourceDragGraphs.has(this.graph) &&
      (options?.type === 'magnetAvailable' ||
        options?.type === 'magnetAdsorbed' ||
        options?.type === 'nodeAvailable')
    ) {
      return this
    }
    return originalHighlight.call(this, elem, options)
  }
  edgeViewProto._skipReverseSourceEdgeHighlightPatched = true
}

// X6 给 Edge 候选只生成 { cell }，BranchEdge 必须保留所指位置的 ratio anchor。
if (!edgeViewProto._sourceBranchTerminalPatched) {
  const originalGetEdgeTerminal = edgeViewProto.getEdgeTerminal as (
    this: EdgeView,
    magnet: Element,
    x: number,
    y: number,
    edge: Edge,
    type: 'source' | 'target',
  ) => ReturnType<EdgeView['getEdgeTerminal']>
  edgeViewProto.getEdgeTerminal = function (
    this: EdgeView,
    magnet: Element,
    x: number,
    y: number,
    edge: Edge,
    type: 'source' | 'target',
  ) {
    const terminal = originalGetEdgeTerminal.call(
      this,
      magnet,
      x,
      y,
      edge,
      type,
    )
    if (type !== 'source' || !edge.getTargetCell()?.isNode()) return terminal
    const ratio = this.getClosestPointRatio({ x, y })
    if (ratio == null) {
      throw new Error(`Cannot locate branch anchor on Edge ${this.cell.id}`)
    }
    return { ...terminal, anchor: { name: 'ratio', args: { ratio } } }
  }
  edgeViewProto._sourceBranchTerminalPatched = true
}

// X6 对同一候选 magnet 只更新一次端点；沿 Edge 移动时继续更新 ratio 预览。
if (!edgeViewProto._reverseSourceEdgePreviewPatched) {
  const originalSnapArrowhead = edgeViewProto.snapArrowhead as (
    this: EdgeView,
    x: number,
    y: number,
    data: {
      terminalType: 'source' | 'target'
      closestView?: EdgeView | null
      closestMagnet?: Element | null
    },
  ) => void
  edgeViewProto.snapArrowhead = function (
    this: EdgeView,
    x: number,
    y: number,
    data: {
      terminalType: 'source' | 'target'
      closestView?: EdgeView | null
      closestMagnet?: Element | null
    },
  ) {
    originalSnapArrowhead.call(this, x, y, data)
    if (
      !reverseSourceDragEdges.has(this.cell) ||
      data.terminalType !== 'source'
    )
      return
    const sourceView = data.closestView
    if (!sourceView?.cell.isEdge()) return
    const terminal = sourceView.getEdgeTerminal(
      data.closestMagnet ?? sourceView.container,
      x,
      y,
      this.cell,
      'source',
    )
    if (JSON.stringify(this.cell.getSource()) !== JSON.stringify(terminal)) {
      this.cell.setSource(terminal, { ui: true })
    }
  }
  edgeViewProto._reverseSourceEdgePreviewPatched = true
}

// NodeView 旋转包含端口与内容；只让内容反向旋转以保持文字和图像正向阅读。
if (!nodeViewProto._keepContentUprightPatched) {
  const originalUpdateTransform = nodeViewProto.updateTransform as (
    this: NodeView,
  ) => void
  nodeViewProto.updateTransform = function (this: NodeView) {
    originalUpdateTransform.call(this)
    if (isRoutingNode(this.cell)) {
      const container = this.container as SVGElement
      container.style.setProperty(
        '--node-content-counter-rotation',
        `${-this.cell.getAngle()}deg`,
      )
    }
  }
  nodeViewProto._keepContentUprightPatched = true
}
const RUBBERBAND_SELECTION_RECT_KEY = '_rubberbandSelectionRect'

/**
 * X6 框选结束后默认用已选节点的包围盒重算选择外框。
 * 保留 mousedown 到 mouseup 形成的框选区域，并在整体移动时同步该区域。
 */
if (!selectionProto._preserveRubberbandPatched) {
  for (const methodName of ['select', 'unselect', 'reset', 'clean']) {
    const original = selectionProto[methodName]
    selectionProto[methodName] = function (this: any, ...args: any[]) {
      this[RUBBERBAND_SELECTION_RECT_KEY] = null
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
      this[RUBBERBAND_SELECTION_RECT_KEY] = selectingRect
      this.updateContainer()
    }
    return result
  }

  const originalUpdateContainer = selectionProto.updateContainer
  selectionProto.updateContainer = function (this: any) {
    const result = originalUpdateContainer.call(this)
    const localRect = this[RUBBERBAND_SELECTION_RECT_KEY]
    if (!localRect) {
      Dom.css(this.selectionContainer, { display: 'none' })
      return result
    }
    const graphRect = this.graph.localToGraph(localRect)
    Dom.css(this.selectionContainer, {
      display: 'block',
      left: graphRect.x,
      top: graphRect.y,
      width: graphRect.width,
      height: graphRect.height,
    })
    return result
  }

  const originalApplyDraggingPreview = selectionProto.applyDraggingPreview
  selectionProto.applyDraggingPreview = function (
    this: any,
    offset: { dx: number; dy: number },
  ) {
    if (this.options.following) {
      this[RUBBERBAND_SELECTION_RECT_KEY]?.translate(offset.dx, offset.dy)
    }
    return originalApplyDraggingPreview.call(this, offset)
  }

  selectionProto._preserveRubberbandPatched = true
}

/** 获取最近一次有效框选所形成的画布逻辑坐标区域。 */
export function getRubberbandSelectionRect(graph: Graph): Rectangle | null {
  const selection = graph.getPlugin<Selection>('selection') as unknown as
    | { selectionImpl?: Record<string, unknown> }
    | undefined
  const rect = selection?.selectionImpl?.[RUBBERBAND_SELECTION_RECT_KEY] as
    | Rectangle
    | undefined
  return rect?.clone() ?? null
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
 * 保持相对位置不变，边界 Edge 在本帧结束后局部修复。
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
    captureNodeRoutes(
      this.graph,
      this.collection.toArray().filter((cell) => cell.isNode()),
    )
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
 * 多个模块一起移动时优先保留整体平移的路径，仅修复关联边。
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
    const selectedNodeCount = selectedCells.filter(
      (cell) => cell.isNode() && isRoutingNode(cell),
    ).length

    if (selectedCells.length > 1 && selectedNodeCount >= 1) {
      void routeNodeEdges(
        this.graph,
        selectedCells.filter((cell) => cell.isNode()),
        { preserveVertices: true },
      )
    }
    return result
  }

  selectionProto._routeSingleNodeSelectionPatched = true
}

// Keep the selection's geometry and final async route in one history transaction.
if (!selectionProto._localRouteStopPatched) {
  const stopSelecting = selectionProto.stopSelecting
  selectionProto.stopSelecting = function (
    this: SelectionTranslationState,
    e: Dom.MouseUpEvent,
  ) {
    const nodes = this.collection
      .toArray()
      .filter((cell): cell is Node => cell.isNode())
    if (!this.translatingCache || !nodes.length)
      return stopSelecting.call(this, e)
    this.graph.startBatch('route-selection')
    try {
      stopSelecting.call(this, e)
    } catch (error) {
      this.graph.stopBatch('route-selection')
      throw error
    }
    void routeNodeEdges(this.graph, nodes, { preserveVertices: true }).finally(
      () => {
        finishNodeRoutes(this.graph, nodes)
        this.graph.stopBatch('route-selection')
      },
    )
  }
  selectionProto._localRouteStopPatched = true
}

// X6 closes the pointer batch synchronously; retain it until the final route commits.
if (!edgeViewProto._localRouteMouseUpPatched) {
  const prepare = edgeViewProto.prepareArrowheadDragging
  edgeViewProto.prepareArrowheadDragging = function (
    this: EdgeView,
    ...args: unknown[]
  ) {
    captureEdgeRoutes(this.graph, [this.cell], { gesture: true })
    return prepare.apply(this, args)
  }
  const originalMouseUp = edgeViewProto.onMouseUp
  edgeViewProto.onMouseUp = function (
    this: EdgeView,
    e: Dom.MouseUpEvent,
    x: number,
    y: number,
  ) {
    const data = this.getEventData(e)
    if (data.action !== 'drag-arrowhead')
      return originalMouseUp.call(this, e, x, y)
    const graph = this.graph
    graph.startBatch('route-terminal')
    let result
    try {
      result = originalMouseUp.call(this, e, x, y)
    } catch (error) {
      graph.stopBatch('route-terminal')
      throw error
    }
    void routeEdge(this.cell, { reason: 'terminal' }).finally(() => {
      finishEdgeRoutes(graph, [this.cell])
      graph.stopBatch('route-terminal')
    })
    return result
  }
  edgeViewProto._localRouteMouseUpPatched = true
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
    reverseSourceDragEdges.add(edge)
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
    activeReverseSourceDragGraphs.add(this.graph)
    edgeView.setEventData(
      e,
      edgeView.prepareArrowheadDragging('source', {
        x,
        y,
        isNewEdge: true,
        fallbackAction: 'remove',
      }),
    )
    this.setEventData(e, { edgeView, reverseSourceDrag: true })
    edgeView.notifyMouseDown(e, x, y)
  }

  nodeViewProto._startConnecttingPatched = true
}

// 输入端口反向拉线：等 EdgeView 完成 source 吸附后再寻路，最后提交同一历史批次。
if (!nodeViewProto._stopReverseConnecttingPatched) {
  const originalStopMagnetDragging = nodeViewProto.stopMagnetDragging
  nodeViewProto.stopMagnetDragging = function (
    this: any,
    e: any,
    x: number,
    y: number,
  ) {
    const data = this.getEventData(e)
    if (!data.reverseSourceDrag) {
      return originalStopMagnetDragging.call(this, e, x, y)
    }
    const edgeView = data.edgeView as EdgeView
    if (!edgeView) throw new Error('Reverse source drag EdgeView is required')
    const edge = edgeView.cell
    const graph = this.graph as Graph
    void (async () => {
      try {
        edgeView.onMouseUp(e, x, y)
        if (
          graph.hasCell(edge) &&
          edge.getSourceCell() &&
          edge.getTargetCell()
        ) {
          await routeEdge(edge, { reason: 'connect' })
        }
      } finally {
        reverseSourceDragEdges.delete(edge)
        activeReverseSourceDragGraphs.delete(graph)
        graph.model.stopBatch('add-edge')
      }
    })()
  }
  nodeViewProto._stopReverseConnecttingPatched = true
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
  const previousOnUpdate = impl.onUpdate as Function & { cancel?: () => void }
  const modelEvents = ['reseted', 'cell:added', 'cell:removed', 'cell:changed']

  // 只替换模型更新监听。X6 的 stopListening() 无法正确解绑带冒号的
  // before:export/after:export，重启完整监听会导致导出后重复恢复滚动位置。
  modelEvents.forEach((eventName) => {
    impl.model.off(eventName, previousOnUpdate, impl)
  })
  previousOnUpdate.cancel?.()
  impl.onUpdate = FunctionExt.throttle(originalOnUpdate.bind(impl), 60)
  modelEvents.forEach((eventName) => {
    impl.model.on(eventName, impl.onUpdate, impl)
  })
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
