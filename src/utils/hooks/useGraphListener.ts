import { GUARD_BLOCK_TYPES, withNodeGuard } from '@hof/withNodeGuard'
import { useThrottleFn } from 'ahooks'
import { message } from 'antd'
import { RED } from '@/assets/constant'
import {
  sourceMarkerAttrs,
  targetMarkerAttrs,
  formalLinkAttrs,
  previewLinkAttrs,
} from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import {
  fallbackEdgeToManhattan,
  isCompleteNodeEdge,
  routeAllEdges,
} from '@/services/routing-service'
import {
  hasSubsystemMask,
  isIONode,
  syncParentSubsystemPorts,
} from '@/services/subsystem-service'
import {
  activeToolEdgeId,
  currentNode,
  isTransforming,
  setActiveToolEdgeId,
  setCurrentNode,
  setIsTransforming,
  setIsSelectionByKey,
  setPasteTarget,
} from '@/store/flags'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import { useDomListener } from '@/utils/hooks/useDomListener'
import { _patchScrollerForceUpdate } from '@/utils/plugin/X6patch'
import type {
  Cell,
  Edge,
  EdgeView,
  EventArgs,
  Graph,
  History,
  Node,
  Scroller,
} from '@antv/x6'

const commonService = createCommonService()
const interactiveService = createInteractiveService()

/**
 * 图形编辑器事件监听 hook
 * graph 直接从 store 订阅，无需外部传参
 */
function useGraphListener() {
  const { run: __mouseMove, cancel: cancel__mouseMove } = useThrottleFn(
    onMouseMoveHandler,
    { wait: 200 },
  )

  const graph = useGraphStore((s) => s.graph)
  const setRightEdgeDragEvent = useDomListener(
    graph,
    __mouseMove,
    cancel__mouseMove,
  )

  // ── 副作用：注册事件 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!graph) return
    const cleanups = [
      // TODO 任务调度Emit 顺序分离
      // ── Node ──────────────────────────────────────────────────────
      registerNodeEditListeners(graph),
      registerNodeRouteListeners(graph),
      // ── Edge ──────────────────────────────────────────────────────
      registerEdgeMarkerListeners(graph),
      registerEdgeBranchListeners(graph, setRightEdgeDragEvent),
      registerEdgeToolListeners(graph),
      // ── 子系统 ──────────────────────────────────────────────────────
      registerSubsystemListeners(graph),
      // ── 空白区域 ────────────────────────────────────────────────────
      registerBlankPaperListeners(graph),
      // ── 插件 ──────────────────────────────────────────────────────────────
      registerTransformListeners(graph),
      registerOutlineListeners(graph),
      registerPasteTargetListeners(graph),
      registerHistoryListeners(graph),
      registerScrollerSyncListener(graph),
      // ── Label 唯一性与可编辑 ──────────────────────────────────────
      registerLabelUniqueListeners(graph),
      registerSubsystemPortSyncListeners(graph),
      registerEditableLabelListeners(graph),
    ]

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [graph, setRightEdgeDragEvent])
}

/**
 * @description: 事件监听注册函数，返回注销函数
 */
// ── 子系统 ──────────────────────────────────────────────────────────
function registerSubsystemListeners(graph: Graph) {
  function dblclickHandler({ node }: EventArgs['node:dblclick']) {
    if (hasSubsystemMask(node)) {
      // 已封装 → 打开子系统参数弹窗
      interactiveService.openNodeModal(node)
    } else {
      // 未封装 → 进入子系统
      useSubSystemTabStore.getState().navigateWithin(node.id)
      setPasteTarget(0, 30)
    }
  }
  function maskClickHandler({ node, e }: EventArgs['node:click']) {
    const inMask = !!e.target.closest('[data-mask="subsystem"]')
    if (inMask) {
      useSubSystemTabStore.getState().navigateWithin(node.id)
    }
  }
  function syncAddSubsystemHandler({ node }: EventArgs['node:added']) {
    useSubGraphStore.getState().syncSubGraph(node, 'add')
  }
  function syncRemoveSubsystemHandler({ node }: EventArgs['node:removed']) {
    useSubGraphStore.getState().syncSubGraph(node, 'delete')
  }
  function syncSubsystemNameHandler({ node }: EventArgs['node:change:attrs']) {
    useSubGraphStore
      .getState()
      .syncSubGraphName(node.id, node.attr<string>('label/text') ?? '')
  }
  return registerListeners(graph, [
    ['node:dblclick', withNodeGuard('subsystem', dblclickHandler)],
    ['node:click', withNodeGuard('subsystem', maskClickHandler)],
    ['node:added', withNodeGuard('subsystem', syncAddSubsystemHandler)],
    ['node:removed', withNodeGuard('subsystem', syncRemoveSubsystemHandler)],
    ['node:change:attrs', withNodeGuard('subsystem', syncSubsystemNameHandler)],
  ])
}

// ── 空白双击 → 添加模块 ──────────────────────────────────────────────
function registerBlankPaperListeners(graph: Graph) {
  function blankDblClickHandler({ x, y, e }: EventArgs['blank:dblclick']) {
    interactiveService.openAddBlockModal(x, y, e.clientX, e.clientY)
  }
  return registerListeners(graph, [['blank:dblclick', blankDblClickHandler]])
}

// ── 粘贴坐标 ───────────────────────────────────────────────────────────
function registerPasteTargetListeners(graph: Graph) {
  function blankClickHandler({ x, y }: EventArgs['blank:click']) {
    // 空白处点击，修改粘贴目标位置
    setPasteTarget(x, y)
    setIsSelectionByKey(false)
    useGraphStore
      .getState()
      .graph.getNodes()
      .forEach((n) => n.removeTool('boundary', { undo: false }))
  }
  function cellClickHandler({ cell }: EventArgs['cell:click']) {
    // cell点击，修改粘贴目标位置
    const { x, y } = cell.getBBox().getCenter()
    setPasteTarget(x, y)
    setIsSelectionByKey(false)
    useGraphStore
      .getState()
      .graph.getNodes()
      .forEach((n) => n.removeTool('boundary', { undo: false }))
  }
  return registerListeners(graph, [
    ['blank:click', blankClickHandler],
    ['cell:click', cellClickHandler],
  ])
}

// ── Edge 基础状态：连接归一、marker、路由 ───────────────────────────────
function registerEdgeMarkerListeners(graph: Graph) {
  function applyEdgeMarkerState(edge: Edge) {
    const source = edge.getSource()
    const target = edge.getTarget()
    const sourceState = source && 'cell' in source ? 'full' : 'empty'
    const targetState =
      target && 'cell' in target
        ? sourceState === 'full'
          ? 'full'
          : 'single'
        : 'empty'

    const lineConfig =
      sourceState === 'full' && targetState === 'full'
        ? formalLinkAttrs.attrs
        : previewLinkAttrs.attrs

    edge.setAttrs({
      ...lineConfig,
      line: {
        ...lineConfig.line,
        sourceMarker: sourceMarkerAttrs(sourceState),
        targetMarker: targetMarkerAttrs(targetState),
      },
    })
  }

  function isReverseConnection(edge: Edge) {
    const srcCell = edge.getSourceCell() as Node | Edge | null
    const tgtCell = edge.getTargetCell() as Node | null
    if (!srcCell?.isNode() || !tgtCell?.isNode()) return false

    const srcGroup = commonService.getPortGroup(
      srcCell.getPort(edge.getSourcePortId()),
    )
    const tgtGroup = commonService.getPortGroup(
      tgtCell.getPort(edge.getTargetPortId()),
    )
    return srcGroup === 'in' && tgtGroup === 'out'
  }

  function edgeConnectedHandler({
    edge,
    currentCell,
  }: EventArgs['edge:connected']) {
    if (!currentCell) return
    if (!edge.getSourceCell() || !edge.getTargetCell()) return

    if (isReverseConnection(edge)) {
      const source = edge.getSource()
      const target = edge.getTarget()
      edge.setSource(target)
      edge.setTarget(source)
    }
    applyEdgeMarkerState(edge)
    void routeAllEdges(graph)
  }

  function edgeSourceChangedHandler({ cell }: EventArgs['cell:change:source']) {
    if (!cell.isEdge()) return
    applyEdgeMarkerState(cell)
    handleEdgeTerminalChanged(cell)
  }
  function edgeTargetChangedHandler({ cell }: EventArgs['cell:change:target']) {
    if (!cell.isEdge()) return
    applyEdgeMarkerState(cell)
    handleEdgeTerminalChanged(cell)
  }

  function handleEdgeTerminalChanged(edge: Edge) {
    if (edge.getAttrs()?.line?.stroke === RED) {
      fallbackEdgeToManhattan(edge)
      return
    }

    if (isCompleteNodeEdge(edge)) {
      void routeAllEdges(graph)
      return
    }

    fallbackEdgeToManhattan(edge)
  }

  return registerListeners(graph, [
    ['edge:connected', edgeConnectedHandler],
    ['cell:change:source', edgeSourceChangedHandler],
    ['cell:change:target', edgeTargetChangedHandler],
  ])
}

// ── Edge 工具栏 ───────────────────────────────────────────────────────────
function registerEdgeToolListeners(graph: Graph) {
  function edgeMouseenterHandler({ edge }: EventArgs['edge:mouseenter']) {
    if (activeToolEdgeId) return
    setActiveToolEdgeId(edge.id)
    interactiveService.addEdgeTools(edge)
  }
  function edgeMouseleaveHandler({ edge, e }: EventArgs['edge:mouseleave']) {
    // 鼠标按键按住中（正在拖拽），不移除工具
    if (e.buttons !== 0) return
    setActiveToolEdgeId(null)
    edge.removeTools({ undo: false })
  }
  return registerListeners(graph, [
    ['edge:added', () => {}],
    ['edge:mouseenter', edgeMouseenterHandler],
    ['edge:mouseleave', edgeMouseleaveHandler],
  ])
}

// ── Node 移动时重新巡线 ───────────────────────────────────────────────────
function registerNodeRouteListeners(graph: Graph) {
  function nodeMovingHandler(_args: EventArgs['node:moving']) {
    void routeAllEdges(graph)
  }

  function nodeResizedHandler(_args: EventArgs['node:resized']) {
    void routeAllEdges(graph)
  }

  return registerListeners(graph, [
    ['node:moving', nodeMovingHandler],
    ['node:resized', nodeResizedHandler],
  ])
}

// ── #5 Transform ──────────────────────────────────────────────────────────
function registerTransformListeners(graph: Graph) {
  // 更新 resize 标志位
  function nodeResizeHandler(_args: EventArgs['node:resize']) {
    setIsTransforming(true)
  }
  function nodeResizedHandler(_args: EventArgs['node:resized']) {
    setIsTransforming(false)
  }
  function nodeMouseEnterHandler({ node }: EventArgs['node:mouseenter']) {
    const graph = useGraphStore.getState().graph
    graph.createTransformWidget(node)
  }
  return registerListeners(graph, [
    ['node:resize', nodeResizeHandler],
    ['node:resized', nodeResizedHandler],
    ['node:mouseenter', nodeMouseEnterHandler],
  ])
}

// onMouseMoveHandler 对鼠标移动的监听函数，控制 Transform 工具的显示和隐藏
function onMouseMoveHandler(e: MouseEvent) {
  const graph = useGraphStore.getState().graph
  if (!graph) return
  // 右键拖拽复制中，不处理 Transform 工具显示/隐藏
  if (e.buttons === 2) return
  // #5.2 鼠标移动时，如果正在变换或鼠标在当前节点附近，则不清除变换工具
  if (
    isTransforming ||
    (currentNode && !commonService.isMouseOutCell(e, currentNode, 10))
  )
    return
  graph.clearTransformWidgets()
  setCurrentNode(null)
  const node = commonService.getNodeAtPoint(e)
  if (node) {
    setCurrentNode(node)
    graph.createTransformWidget(node)
  }
}

// ── Outline ───────────────────────────────────────────────────────────────
function registerOutlineListeners(graph: Graph) {
  let stopBlockingWheel: (() => void) | null = null

  function startBlockingWheel() {
    if (stopBlockingWheel) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('wheel', onWheel, {
      passive: false,
      capture: true,
    })
    stopBlockingWheel = () => {
      document.removeEventListener('wheel', onWheel, { capture: true })
      stopBlockingWheel = null
    }
  }

  function stopBlockingWheelIfNeeded() {
    stopBlockingWheel?.()
  }

  function mouseMoveHandler() {
    let prevCells = new Set<Cell>()
    return ({ nodes, edges }: EventArgs['box:mousemove']) => {
      const curr = new Set<Cell>([...nodes, ...edges])
      curr.forEach((c) => {
        if (!prevCells.has(c)) interactiveService.addOutline(c)
      })
      prevCells.forEach((c) => {
        if (!curr.has(c)) interactiveService.removeOutline(c)
      })
      prevCells = curr
    }
  }
  function cellSelectedHandler({ cell }: EventArgs['cell:selected']) {
    interactiveService.addOutline(cell)
  }
  function cellUnselectedHandler({ cell }: EventArgs['cell:unselected']) {
    interactiveService.removeOutline(cell)
  }
  const unregister = registerListeners(graph, [
    ['box:mousedown', startBlockingWheel],
    ['box:mousemove', mouseMoveHandler()],
    ['box:mouseup', stopBlockingWheelIfNeeded],
    ['cell:selected', cellSelectedHandler],
    ['cell:unselected', cellUnselectedHandler],
  ])

  return () => {
    stopBlockingWheelIfNeeded()
    unregister()
  }
}

// ── Node 双击编辑 ──────────────────────────────────────────────────────────
function registerNodeEditListeners(graph: Graph) {
  function nodeDblClickHandler({ node, e }: EventArgs['node:dblclick']) {
    // 特殊 GUARD_BLOCK_TYPES 跳过
    if (GUARD_BLOCK_TYPES.includes(node.getData()?.blockType)) return

    const target = e.target as Element
    // 判断双击目标是否为文本元素（兼容 SVG text / foreignObject）
    const textEl = target.closest('text') ?? target.closest('foreignObject')

    if (textEl) {
      // 文本双击 → 就地编辑 label
      interactiveService.openLabelEditor(node, textEl)
      return
    }
    // 默认：打开参数设置弹窗
    interactiveService.openNodeModal(node)
  }

  return registerListeners(graph, [['node:dblclick', nodeDblClickHandler]])
}

// ── 历史 ──────────────────────────────────────────────────────────────────
function registerHistoryListeners(graph: Graph) {
  function historyChangeHandler() {
    const history = useGraphStore.getState().graph.getPlugin<History>('history')
    if (!history) return
    console.log(history['undoStack'])
  }
  return registerListeners(graph, [['history:change', historyChangeHandler]])
}

// ── Scroller 区域同步 ──────────────────────────────────────────────────────
/** 拖拽模块到非画布空白区域时，强制 scroller 同步扩展 graph 尺寸 */
function registerScrollerSyncListener(graph: Graph) {
  function nodeAddedHandler({ node }: EventArgs['node:added']) {
    const scroller = graph.getPlugin<Scroller>('scroller')
    if (!scroller) return

    const pos = node.getPosition()
    const size = node.getSize()
    const graphW = graph.options.width
    const graphH = graph.options.height

    // 节点超出当前 graph 边界，强制用模型几何刷新 scroller
    if (
      pos.x + size.width > graphW ||
      pos.y + size.height > graphH ||
      pos.x < 0 ||
      pos.y < 0
    ) {
      _patchScrollerForceUpdate(scroller)
    }
  }

  return registerListeners(graph, [['node:added', nodeAddedHandler]])
}

// ── Label 唯一性（node:added 自动递增，IO 改名重复时恢复）───────────────
function registerLabelUniqueListeners(graph: Graph) {
  function nodeAddedHandler({ node }: EventArgs['node:added']) {
    const rawLabel = node.attr<string>('label/text') ?? ''
    if (!rawLabel) return

    const { currentGraphId, syncGraph } = useSubGraphStore.getState()
    syncGraph(graph.toJSON())
    node.attr(
      'label/text',
      commonService.ensureLabelUnique(rawLabel, currentGraphId),
    )
    syncGraph(graph.toJSON())
  }

  function IONodeChangeAttrsHandler({
    node,
    previous,
  }: EventArgs['node:change:attrs']) {
    const rawLabel = node.attr<string>('label/text') ?? ''
    if (!rawLabel) return
    if (!isIONode(node)) return

    const { currentGraphId, syncGraph } = useSubGraphStore.getState()
    syncGraph(graph.toJSON())
    if (commonService.isLabelUnique(rawLabel, currentGraphId)) return

    const previousLabel = previous?.label?.text
    message.error(`IO节点不允许重名：${rawLabel}`)
    node.attr('label/text', previousLabel, { ignore: true })
    syncGraph(graph.toJSON())
  }

  return registerListeners(graph, [
    ['node:added', nodeAddedHandler],
    ['node:change:attrs', IONodeChangeAttrsHandler],
  ])
}

// ── 子系统端口同步：内部 In/Out 节点变化 → 父级 Subsystem port ─────────────
function registerSubsystemPortSyncListeners(graph: Graph) {
  let timer: number | null = null

  function scheduleSync({ node }: { node: Node }) {
    if (!isIONode(node)) return
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      syncParentSubsystemPorts(graph)
    }, 0)
  }

  const unregister = registerListeners(graph, [
    ['node:added', scheduleSync],
    ['node:removed', scheduleSync],
    ['node:change:attrs', scheduleSync],
  ])

  return () => {
    if (timer != null) window.clearTimeout(timer)
    unregister()
  }
}

// ── 可编辑 Label（text-block subsystem，mouseenter 惰性设置）──────────────
function registerEditableLabelListeners(graph: Graph) {
  function nodeMouseEnterHandler({ node }: EventArgs['node:mouseenter']) {
    if (node.getData()?.blockType !== 'Subsystem') return

    const view = graph.findViewByCell(node)
    if (!view) return
    const selectors = view._getSelectors()
    if (!selectors) return
    const labelDiv = selectors['label']
    if (!(labelDiv instanceof HTMLElement)) return

    // 已设置过则跳过，避免重复绑定事件监听器
    if (labelDiv.contentEditable === 'plaintext-only') return

    Object.assign(labelDiv.style, {
      cursor: 'text',
      userSelect: 'text',
      outline: 'none',
    })
    labelDiv.contentEditable = 'plaintext-only'
    labelDiv.addEventListener('mousedown', (ev) => ev.stopPropagation())
    labelDiv.addEventListener('blur', () => {
      node.attr('label/text', labelDiv.textContent ?? '')
      window.getSelection()?.removeAllRanges()
    })
  }

  return registerListeners(graph, [['node:mouseenter', nodeMouseEnterHandler]])
}
// ── Ctrl+Click 拉线 ──────────────────────────────────────────────────────
type RightEdgeDragEventSetter = (edge: Edge, edgeView: EdgeView, e: any) => void

function registerEdgeBranchListeners(
  graph: Graph,
  setRightEdgeDragEvent: RightEdgeDragEventSetter,
) {
  function edgeMousedownHandler({ edge, e }: EventArgs['edge:mousedown']) {
    if (edge.getAttrs()?.line?.stroke === RED) return

    const edgeView = graph.findViewByCell(edge) as EdgeView
    if (edgeView?.getEventData(e)?.action === 'drag-arrowhead') return
    if (e.button === 2) {
      setRightEdgeDragEvent(edge, edgeView, e)
      return
    }
    if (!e.ctrlKey && !e.metaKey) return

    e.stopPropagation()
    e.preventDefault()
    edge.removeTools({ undo: false })
    const startPos = graph.pageToLocal(e.pageX, e.pageY)
    const ratio: number = edgeView?.getClosestPointRatio(startPos) ?? 0.5

    const tempEdge = graph.addEdge({
      source: { cell: edge.id, anchor: { name: 'ratio', args: { ratio } } },
      target: { x: startPos.x, y: startPos.y },
      ...previewLinkAttrs,
    })
    // 不建议修改以下代码，除非清楚X6的事件系统和拖拽机制
    const tempEdgeView = graph.findViewByCell(tempEdge) as EdgeView
    tempEdgeView.setEventData(
      e,
      tempEdgeView.prepareArrowheadDragging('target', {
        x: startPos.x,
        y: startPos.y,
        isNewEdge: true,
      }),
    )
    setTimeout(() => {
      const key = `__${graph.view.cid}__`
      if (e.data?.[key]) e.data[key].currentView = tempEdgeView
    }, 0)
  }

  return registerListeners(graph, [['edge:mousedown', edgeMousedownHandler]])
}
// ── 事件注册工具 ──────────────────────────────────────────────────────────
type ListenerEntry = {
  [K in keyof EventArgs]: [event: K, handler: (args: EventArgs[K]) => void]
}[keyof EventArgs]

/**
 * @description: 批量注册事件监听器
 * @param graph X6 Graph 需要暴露 离屏渲染等会有多个Graph实例
 * @param entries 事件和处理函数
 * @returns 清理函数
 */
function registerListeners(graph: Graph, entries: ListenerEntry[]): () => void {
  // TS#30581: 迭代 discriminated union tuple 时编译器丢失关联性，边界 as 不可避免
  let list = entries as [string, (args: object) => void][]
  list = list.map(([event, handler]) => {
    const newHandler = (args: object) => {
      // ignore 为代码触发事件，跳过所有用户交互监听
      if (args && 'ignore' in args && args.ignore) return
      handler(args)
    }
    return [event, newHandler]
  })
  for (const [event, handler] of list) {
    graph.on(event, handler)
  }
  return () => {
    for (const [event, handler] of list) {
      graph.off(event, handler)
    }
  }
}
export { useGraphListener }
