import { GUARD_BLOCK_TYPES, withNodeGuard } from '@hof/withNodeGuard'
import { useThrottleFn } from 'ahooks'
import { RED } from '@/assets/constant'
import subsystemDefaultGraph from '@/assets/subsystemDefaultGraph.json'
import {
  sourceMarkerAttrs,
  targetMarkerAttrs,
  formalLinkAttrs,
  previewLinkAttrs,
} from '@/assets/x6Model'
import { editAnnotationNode } from '@/services/annotation-service'
import { getAntdMessage } from '@/services/antd-message-service'
import { UPDATE_BLOCK_PARAMS } from '@/services/block-param-service'
import { createCommonService } from '@/services/common-service'
import { createDomService } from '@/services/dom-service'
import {
  canInsertNodeOnEdge,
  clearEdgeInsertionPreview,
  commitEdgeInsertion,
  updateEdgeInsertionPreview,
} from '@/services/edge-insertion-service'
import { selectImageForNode } from '@/services/image-node-service'
import { createInteractiveService } from '@/services/interactive-service'
import {
  fallbackEdgeToManhattan,
  isCompleteNodeEdge,
  isRoutingNode,
  routeAllEdges,
} from '@/services/routing-service'
import {
  hasSubsystemMask,
  invalidateSubsystemSnapshot,
  isIONode,
  syncParentSubsystemPorts,
  syncParentSubsystemSnapshot,
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
import { focusOrRestoreFloatingWindow } from '@/store/floatingWindowStore'
import { useGraphStore } from '@/store/graphStore'
import {
  type HistoryParamBlock,
  useHistoryParamNoticeStore,
} from '@/store/historyParamNoticeStore'
import { useSimulationStore } from '@/store/simulationStore'
import {
  getSubGraphHistory,
  restoreSubGraphHistory,
  useSubGraphStore,
} from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import { useDomListener } from '@/utils/hooks/useDomListener'
import { addEdgeEditTool } from '@/utils/plugin/EdgeEditTool'
import {
  getHoverEdgeToolId,
  setHoverEdgeToolsVisible,
} from '@/utils/plugin/edgeToolVisibility'
import { _patchScrollerForceUpdate } from '@/utils/plugin/X6patch'
import type {
  Cell,
  Edge,
  EdgeView,
  EventArgs,
  Graph,
  Node,
  Scroller,
} from '@antv/x6'
import type { GraphJSON } from '~/types'

const commonService = createCommonService()
const interactiveService = createInteractiveService()
const domService = createDomService()
const EDGE_INSERTION_PREVIEW = 'edgeInsertionPreview'

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
      registerCellSelectionListeners(graph),
      registerScopeListeners(graph),
      registerEdgeInsertionListeners(graph),
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

function registerScopeListeners(graph: Graph) {
  function nodeDblClickHandler({ node, view, e }: EventArgs['node:dblclick']) {
    // 过滤 非 Scope 双击
    const blockType = String(node.getData()?.blockType ?? '').toLowerCase()
    if (blockType !== 'scope') return
    // Scope 双击文本 → 不打开仿真窗口
    // body 内文字仍属于模块本体，只有 selector 为 label 的底部名称走文本分支
    const target = e.target as Element
    if (commonService.isDblClickOnLabel(view, target)) return
    if (focusOrRestoreFloatingWindow(`scope:${node.id}`)) return
    useSimulationStore.getState().openScope(node.id)
  }

  return registerListeners(graph, [['node:dblclick', nodeDblClickHandler]])
}

// ── Cell 交互：按下即选中 ───────────────────────────────────────────────
function registerCellSelectionListeners(graph: Graph) {
  function cellMouseDownHandler({ cell, e }: EventArgs['cell:mousedown']) {
    // 点击 Port 时不选中 cell
    if (e.target.closest('.x6-port')) return
    if (cell.getData()?.blockType === 'Annotation')
      interactiveService.addOutline(cell)
    graph.resetSelection([cell])
  }

  return registerListeners(graph, [['cell:mousedown', cellMouseDownHandler]])
}

/**
 * @description: 事件监听注册函数，返回注销函数
 */
// ── 子系统 ──────────────────────────────────────────────────────────
function registerSubsystemListeners(graph: Graph) {
  function dblclickHandler({ node, e }: EventArgs['node:dblclick']) {
    if ((e.target as Element).closest('foreignObject')) return

    if (hasSubsystemMask(node)) {
      // 已封装 → 打开子系统参数悬浮窗口
      interactiveService.openNodeParamWindow(node)
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
  function syncAddSubsystemHandler({ node, options }: EventArgs['node:added']) {
    const { syncSubGraph, syncGraph } = useSubGraphStore.getState()
    const subGraphHistory = getSubGraphHistory(options)
    if (subGraphHistory?.items[node.id]) {
      restoreSubGraphHistory(subGraphHistory)
      syncGraph(graph.toJSON())
      return
    }
    const initialGraphJson = options.stencil
      ? (subsystemDefaultGraph as unknown as GraphJSON)
      : undefined
    if (!syncSubGraph(node, 'add', initialGraphJson)) return

    syncGraph(graph.toJSON())
    const graphJson = useSubGraphStore.getState().subGraphs[node.id].graphJson
    void syncParentSubsystemSnapshot(node.id, graphJson, graph).catch(
      (error: unknown) => {
        console.error(error)
        getAntdMessage().error('子系统缩略图生成失败')
      },
    )
  }
  function syncRemoveSubsystemHandler({
    node,
    options,
  }: EventArgs['node:removed']) {
    if (options.ignore) return
    const { subGraphs, syncSubGraph } = useSubGraphStore.getState()
    const removedIds: string[] = []
    function collectRemovedIds(subGraphId: string) {
      const subGraph = subGraphs[subGraphId]
      if (!subGraph) return
      removedIds.push(subGraphId)
      subGraph.childrenIds.forEach(collectRemovedIds)
    }
    collectRemovedIds(node.id)
    removedIds.forEach(invalidateSubsystemSnapshot)
    if (!syncSubGraph(node, 'delete')) return
    useSubSystemTabStore.getState().removeHistory(removedIds)
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
    interactiveService.openAddBlockCommand(x, y, e.clientX, e.clientY)
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
    if (cell.getData()?.[EDGE_INSERTION_PREVIEW] === true) return
    applyEdgeMarkerState(cell)
    handleEdgeTerminalChanged(cell)
  }
  function edgeTargetChangedHandler({ cell }: EventArgs['cell:change:target']) {
    if (!cell.isEdge()) return
    if (cell.getData()?.[EDGE_INSERTION_PREVIEW] === true) return
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
  let hideTimer: number | null = null

  function showEdgeTools(edge: Edge) {
    if (hideTimer != null) {
      window.clearTimeout(hideTimer)
      hideTimer = null
    }
    if (activeToolEdgeId && activeToolEdgeId !== edge.id) {
      setHoverEdgeToolsVisible(graph, activeToolEdgeId, false)
    }
    setActiveToolEdgeId(edge.id)
    setHoverEdgeToolsVisible(graph, edge.id, true)
  }

  function scheduleHideEdgeTools(edge: Edge) {
    if (hideTimer != null) window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      hideTimer = null
      if (activeToolEdgeId !== edge.id) return
      setHoverEdgeToolsVisible(graph, edge.id, false)
      setActiveToolEdgeId(null)
    })
  }

  function edgeAddedHandler({ edge }: EventArgs['edge:added']) {
    // 插入模块时生成的内部预览线会立即销毁，不需要编辑工具。
    if (edge.getData()?.[EDGE_INSERTION_PREVIEW] === true) return
    addEdgeEditTool(edge)
    interactiveService.initializeEdgeTools(edge)
  }
  function edgeConnectedHandler({ edge }: EventArgs['edge:connected']) {
    addEdgeEditTool(edge)
    interactiveService.initializeEdgeTools(edge)
  }
  function edgeMouseenterHandler({ edge }: EventArgs['edge:mouseenter']) {
    showEdgeTools(edge)
  }
  function edgeMouseleaveHandler({ edge, e }: EventArgs['edge:mouseleave']) {
    // 鼠标按键按住中（正在拖拽），不隐藏工具
    if (e.buttons !== 0) return
    scheduleHideEdgeTools(edge)
  }

  function hoverToolMouseoverHandler(event: MouseEvent) {
    const edgeId = getHoverEdgeToolId(event.target)
    if (!edgeId) return
    const edge = graph.getCellById(edgeId)
    if (edge?.isEdge()) showEdgeTools(edge)
  }

  function hoverToolMouseoutHandler(event: MouseEvent) {
    if (event.buttons !== 0) return
    const edgeId = getHoverEdgeToolId(event.target)
    if (!edgeId) return
    const edge = graph.getCellById(edgeId)
    if (edge?.isEdge()) scheduleHideEdgeTools(edge)
  }

  graph.container.addEventListener('mouseover', hoverToolMouseoverHandler)
  graph.container.addEventListener('mouseout', hoverToolMouseoutHandler)
  const unregisterGraphListeners = registerListeners(graph, [
    ['edge:added', edgeAddedHandler],
    ['edge:connected', edgeConnectedHandler],
    ['edge:mouseenter', edgeMouseenterHandler],
    ['edge:mouseleave', edgeMouseleaveHandler],
  ])
  return () => {
    unregisterGraphListeners()
    graph.container.removeEventListener('mouseover', hoverToolMouseoverHandler)
    graph.container.removeEventListener('mouseout', hoverToolMouseoutHandler)
    if (hideTimer != null) window.clearTimeout(hideTimer)
  }
}

// ── 拖放模块到 Edge：预览并拆分连接 ────────────────────────────────────────
function registerEdgeInsertionListeners(graph: Graph) {
  let movingRoutingNodeId: string | null = null

  function nodeMovingHandler({ node }: EventArgs['node:moving']) {
    if (!isRoutingNode(node)) return
    if (!movingRoutingNodeId) {
      movingRoutingNodeId = node.id
      graph.startBatch('move-routing-node')
    }
    updateEdgeInsertionPreview(graph, node)
  }

  async function nodeMovedHandler({ node }: EventArgs['node:moved']) {
    if (!isRoutingNode(node)) return
    try {
      const committed = await commitEdgeInsertion(graph, node)
      if (!committed) await routeAllEdges(graph)
    } finally {
      if (movingRoutingNodeId === node.id) {
        movingRoutingNodeId = null
        graph.stopBatch('move-routing-node')
      }
    }
  }

  async function nodeAddedHandler({ node, options }: EventArgs['node:added']) {
    if (!options.stencil || !isRoutingNode(node)) return
    const committed = await commitEdgeInsertion(graph, node)
    if (!committed) await routeAllEdges(graph)
  }

  const unregister = registerListeners(graph, [
    ['node:moving', nodeMovingHandler],
    ['node:moved', nodeMovedHandler],
    ['node:added', nodeAddedHandler],
  ])
  return () => {
    unregister()
    clearEdgeInsertionPreview(graph)
    if (movingRoutingNodeId) {
      movingRoutingNodeId = null
      graph.stopBatch('move-routing-node')
    }
  }
}

// ── Node 移动时重新巡线 ───────────────────────────────────────────────────
function registerNodeRouteListeners(graph: Graph) {
  function nodeMovingHandler({ node }: EventArgs['node:moving']) {
    if (!isRoutingNode(node)) return
    // 未连接的单输入单输出模块可能要插入 Edge。拖动期间必须保持正式
    // Edge 原路线不动，否则全局避障会先把 Edge 绕开，永远无法进入吸附范围。
    // 命中后仅由 insertion service 触发预览 Edge 的 Avoid 路由。
    if (canInsertNodeOnEdge(graph, node)) return
    void routeAllEdges(graph)
  }

  function nodeResizedHandler({ node }: EventArgs['node:resized']) {
    if (!isRoutingNode(node)) return
    void routeAllEdges(graph)
  }

  function nodeAngleChangedHandler({ node }: EventArgs['node:change:angle']) {
    if (!isRoutingNode(node)) return
    void routeAllEdges(graph)
  }

  return registerListeners(graph, [
    ['node:moving', nodeMovingHandler],
    ['node:resized', nodeResizedHandler],
    ['node:change:angle', nodeAngleChangedHandler],
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

// ── Outline 同步（框选/选择态） ────────────────────────────────────────
function registerOutlineListeners(graph: Graph) {
  const wheelBlocker = domService.createPageWheelBlocker()
  let prevCells = new Set<Cell>()

  function mouseMoveHandler() {
    return ({ nodes, edges }: EventArgs['box:mousemove']) => {
      const curr = new Set<Cell>([...nodes, ...edges])
      curr.forEach((cell) => {
        if (!prevCells.has(cell)) interactiveService.addOutline(cell)
      })
      prevCells.forEach((cell) => {
        if (!curr.has(cell)) interactiveService.removeOutline(cell)
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
    ['box:mousedown', wheelBlocker.blockPageWheel],
    ['box:mousemove', mouseMoveHandler()],
    ['box:mouseup', wheelBlocker.releasePageWheel],
    ['cell:selected', cellSelectedHandler],
    ['cell:unselected', cellUnselectedHandler],
  ])

  return () => {
    wheelBlocker.releasePageWheel()
    unregister()
  }
}

// ── Node 双击编辑 ──────────────────────────────────────────────────────────
function registerNodeEditListeners(graph: Graph) {
  async function nodeDblClickHandler({
    node,
    view,
    e,
  }: EventArgs['node:dblclick']) {
    if (node.getData()?.blockType === 'Annotation') {
      editAnnotationNode(node, graph, e.clientX, e.clientY)
      return
    }
    if (node.getData()?.blockType === 'ImageNode') {
      await selectImageForNode(node, graph)
      return
    }
    // 特殊 GUARD_BLOCK_TYPES 跳过
    if (GUARD_BLOCK_TYPES.includes(node.getData()?.blockType)) return

    const target = e.target as Element
    // 判断双击目标是否为文本元素（兼容 SVG text / foreignObject）
    // 仅匹配 markup 中 selector 为 label 的底部名称，排除模块 body 内的文字图标
    if (commonService.isDblClickOnLabel(view, target)) {
      // 文本双击 → 就地编辑 label
      interactiveService.openLabelEditor(node, view._getSelectors()['label'])
      return
    }
    if (String(node.getData()?.blockType ?? '').toLowerCase() === 'scope')
      return
    // 默认：打开参数设置悬浮窗口
    interactiveService.openNodeParamWindow(node)
  }

  return registerListeners(graph, [['node:dblclick', nodeDblClickHandler]])
}

// ── 历史 ──────────────────────────────────────────────────────────────────
function registerHistoryListeners(graph: Graph) {
  function getParamValues(data: unknown): Record<string, string> | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const paramValues = (data as { paramValues?: unknown }).paramValues
    if (
      !paramValues ||
      typeof paramValues !== 'object' ||
      Array.isArray(paramValues)
    ) {
      return null
    }
    return paramValues as Record<string, string>
  }

  function showParamNotice(
    cmds: EventArgs['history:undo']['cmds'],
    action: 'undo' | 'redo',
  ) {
    const blocks: HistoryParamBlock[] = []
    for (const cmd of cmds) {
      if (cmd.options?.historyAction !== UPDATE_BLOCK_PARAMS) continue
      if (!('key' in cmd.data) || cmd.data.key !== 'data') continue

      const previousParams = getParamValues(cmd.data.prev.data)
      const nextParams = getParamValues(cmd.data.next.data)
      if (!previousParams || !nextParams || !cmd.data.id) continue

      const node = graph.getCellById(cmd.data.id)
      if (!node?.isNode()) continue
      const currentParams = getParamValues(node.getData())
      if (!currentParams) continue

      const changedNames = new Set([
        ...Object.keys(previousParams),
        ...Object.keys(nextParams),
      ])
      const params = [...changedNames]
        .filter((name) => previousParams[name] !== nextParams[name])
        .map((name) => {
          const value = currentParams[name]
          if (typeof value !== 'string') {
            throw new Error(`Parameter ${name} must be a string`)
          }
          return { name, value }
        })
      if (params.length === 0) continue

      const label = node.attr<string>('label/text')
      if (!label) throw new Error(`Node ${node.id} label is required`)
      blocks.push({ label, params })
    }

    if (blocks.length > 0) {
      useHistoryParamNoticeStore.getState().showNotice(action, blocks)
    }
  }

  function historyChangeHandler({
    cmds,
    options,
  }: EventArgs['history:change']) {
    if (!cmds?.length) return

    console.log('[undo] history:change', {
      commands: cmds.map((cmd) => ({
        event: cmd.event,
        id: cmd.data.id,
        key: 'key' in cmd.data ? cmd.data.key : undefined,
        batch: cmd.batch,
      })),
      options,
      undoStackSize: graph.getUndoStackSize(),
    })

    const { syncGraph, recomputeDirty } = useSubGraphStore.getState()
    syncGraph(graph.toJSON())
    recomputeDirty()
  }

  function historyUndoHandler({ cmds }: EventArgs['history:undo']) {
    const cellsById = new Map<string, Cell>()
    cmds.forEach((cmd) => {
      const id = cmd.data.id
      if (!id) return
      const cell = graph.getCellById(id)
      if (cell) cellsById.set(id, cell)
    })
    const undoCells = [...cellsById.values()]

    if (undoCells.length > 0) graph.resetSelection(undoCells)
    showParamNotice(cmds, 'undo')
  }

  function historyRedoHandler({ cmds }: EventArgs['history:redo']) {
    showParamNotice(cmds, 'redo')
  }
  return registerListeners(graph, [
    ['history:change', historyChangeHandler],
    ['history:undo', historyUndoHandler],
    ['history:redo', historyRedoHandler],
  ])
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
  function getCurrentIOLabels(): string[] {
    return graph
      .getNodes()
      .filter((node) => isIONode(node))
      .map((node) => node.attr<string>('label/text'))
      .filter((label): label is string => typeof label === 'string')
  }

  function nodeAddedHandler({ node }: EventArgs['node:added']) {
    if (!graph.isHistoryEnabled()) return
    if (node.getData()?.blockType === 'Annotation') return
    const rawLabel = node.attr<string>('label/text') ?? ''
    const ioNode = isIONode(node)
    if (!rawLabel && !ioNode) return

    const { currentGraphId, syncGraph } = useSubGraphStore.getState()
    if (ioNode) {
      const label = rawLabel.trim() ? rawLabel : node.getData().blockType
      node.attr(
        'label/text',
        commonService.getUniqueLabel(label, getCurrentIOLabels(), true),
      )
      syncGraph(graph.toJSON())
      return
    }

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
    if (!isIONode(node)) return

    const previousLabel = previous?.label?.text
    const invalidMessage = !rawLabel.trim()
      ? 'In/Out 节点 label 不能为空'
      : getCurrentIOLabels().filter((label) => label === rawLabel).length > 1
        ? `IO节点不允许重名：${rawLabel}`
        : null
    if (!invalidMessage) {
      useSubGraphStore.getState().syncGraph(graph.toJSON())
      return
    }
    if (typeof previousLabel !== 'string' || !previousLabel.trim()) {
      throw new Error(`IO node ${node.id} previous label is required`)
    }

    getAntdMessage().error(invalidMessage)
    node.attr('label/text', previousLabel, { ignore: true })
    const { syncGraph } = useSubGraphStore.getState()
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
type RightEdgeDragEventSetter = (
  edge: Edge,
  edgeView: EdgeView,
  e: EventArgs['edge:mousedown']['e'],
) => void

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
    // 拉出 Branch 时只隐藏箭头和 ratio anchor，常驻 EdgeEdit/label 保持不变。
    setHoverEdgeToolsVisible(graph, edge.id, false)
    const startPos = graph.pageToLocal(e.pageX, e.pageY)
    const ratio: number = edgeView?.getClosestPointRatio(startPos) ?? 0.5

    graph.startBatch('add-edge')
    const tempEdge = graph.addEdge({
      source: { cell: edge.id, anchor: { name: 'ratio', args: { ratio } } },
      target: { x: startPos.x, y: startPos.y },
      ...previewLinkAttrs,
    })
    graph.resetSelection([edge, tempEdge])
    // 不建议修改以下代码，除非清楚X6的事件系统和拖拽机制
    const tempEdgeView = graph.findViewByCell(tempEdge) as EdgeView
    tempEdgeView.setEventData(
      e,
      tempEdgeView.prepareArrowheadDragging('target', {
        x: startPos.x,
        y: startPos.y,
        isNewEdge: true,
        fallbackAction: 'remove',
      }),
    )
    document.addEventListener(
      'mouseup',
      () => {
        window.setTimeout(() => {
          void (async () => {
            try {
              if (graph.hasCell(tempEdge)) await routeAllEdges(graph)
            } finally {
              graph.stopBatch('add-edge')
            }
          })()
        }, 0)
      },
      { once: true, capture: true },
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
