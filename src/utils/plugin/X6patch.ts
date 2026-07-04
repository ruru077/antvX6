import {
  CellView,
  FunctionExt,
  Node,
  NodeView,
  Scroller,
  Shape,
} from '@antv/x6'
import { previewLinkAttrs } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
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