import { GUARD_BLOCK_TYPES, withNodeGuard } from '@hof/withNodeGuard'
import { useThrottleFn } from 'ahooks'
import { RED } from '@/assets/constant'
import { formalLink, previewLink } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import {
  activeToolEdgeId,
  setActiveToolEdgeId,
  setIsSelectionByKey,
  setPasteTarget,
} from '@/store/flags'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { _patchScrollerForceUpdate } from '@/utils/plugin/X6patch'
import type {
  Cell,
  EdgeView,
  EventArgs,
  Graph,
  History,
  Node,
  NodeView,
  Scroller,
} from '@antv/x6'

const commonService = createCommonService()
const interactiveService = createInteractiveService()

// 当前鼠标所在节点和是否正在变换 用于 Transform 工具显示控制
let currentNode: Node | null = null
let isTransforming = false

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
  // ── 副作用：注册事件 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!graph) return
    const cleanups = [
      // TODO 任务调度Emit 顺序分离
      // ── Node ──────────────────────────────────────────────────────
      registerNodeEditListeners(graph),
      // ── Edge ──────────────────────────────────────────────────────
      registerEdgeBranchListeners(graph),
      registerEdgeToolListeners(graph),
      // ── 子系统 ──────────────────────────────────────────────────────
      registerSubsystemListeners(graph),
      // ── 插件 ──────────────────────────────────────────────────────────────
      registerTransformListeners(graph),
      registerOutlineListeners(graph),
      registerPasteTargetListeners(graph),
      registerHistoryListeners(graph),
      registerScrollerSyncListener(graph),
    ]

    // ── #5 鼠标移动（X6未注册 DOM 原生事件，节流）──────────────────────────────
    const container = graph.container
    container.addEventListener('mousemove', __mouseMove)

    return () => {
      cancel__mouseMove()
      container.removeEventListener('mousemove', __mouseMove)
      cleanups.forEach((fn) => fn())
    }
  }, [graph, __mouseMove, cancel__mouseMove])
}

/**
 * @description: 事件监听注册函数，返回注销函数
 */
// ── 子系统 ──────────────────────────────────────────────────────────
function registerSubsystemListeners(graph: Graph) {
  function dblclickHandler({ node }: EventArgs['node:dblclick']) {
    useSubGraphStore.getState().changeGraphView(node.id)
    setPasteTarget(0, 30)
  }
  function syncAddSubsystemHandler({ node }: EventArgs['node:added']) {
    useSubGraphStore.getState().syncSubGraph(node, 'add')
  }
  function syncRemoveSubsystemHandler({ node }: EventArgs['node:removed']) {
    useSubGraphStore.getState().syncSubGraph(node, 'delete')
  }
  return registerListeners(graph, [
    ['node:dblclick', withNodeGuard('subsystem', dblclickHandler)],
    ['node:added', withNodeGuard('subsystem', syncAddSubsystemHandler)],
    ['node:removed', withNodeGuard('subsystem', syncRemoveSubsystemHandler)],
  ])
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

// ──  Click+Ctrl 拉线 ──────────────────────────────────────────────────────
function registerEdgeBranchListeners(graph: Graph) {
  /**
   * @param evt EventArgs ['edge:mousedown']
   * @description: 事件委托，将临时线行为交给X6管理
   */
  function edgeMousedownHandler({ edge, e }: EventArgs['edge:mousedown']) {
    if (!e.ctrlKey && !e.metaKey) return
    // TODO: 临时线的Link拉线及连接时逻辑
    if (edge.getAttrs()?.line?.stroke === RED) return

    const graph = useGraphStore.getState().graph
    const edgeView = graph.findViewByCell(edge) as EdgeView
    if (edgeView?.getEventData(e)?.action === 'drag-arrowhead') return

    e.stopPropagation()
    e.preventDefault()
    // 将 sourceEdge Tool 删除
    edge.removeTools({ undo: false })
    const startPos = graph.pageToLocal(e.pageX, e.pageY)
    const ratio: number = edgeView?.getClosestPointRatio(startPos) ?? 0.5

    const tempEdge = graph.addEdge({
      source: { cell: edge.id, anchor: { name: 'ratio', args: { ratio } } },
      target: { x: startPos.x, y: startPos.y },
      ...previewLink,
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
  // 连接和断联均触发
  function edgeConnectedHandler({
    edge,
    currentCell,
  }: EventArgs['edge:connected']) {
    // 连接成功 → formal，断联 → preview
    if (currentCell) {
      edge.setAttrs(formalLink.attrs)
    } else {
      edge.setAttrs(previewLink.attrs)
    }
  }
  return registerListeners(graph, [
    ['edge:mousedown', edgeMousedownHandler],
    ['edge:connected', edgeConnectedHandler],
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

// ── #5 Transform ──────────────────────────────────────────────────────────
function registerTransformListeners(graph: Graph) {
  // 更新 resize 标志位
  function nodeResizeHandler(_args: EventArgs['node:resize']) {
    isTransforming = true
  }
  function nodeResizedHandler(_args: EventArgs['node:resized']) {
    isTransforming = false
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
  // #5.2 鼠标移动时，如果正在变换或鼠标在当前节点附近，则不清除变换工具
  if (
    isTransforming ||
    (currentNode && !commonService.isMouseOutCell(e, currentNode, 10))
  )
    return
  graph.clearTransformWidgets()
  currentNode = null
  const node = commonService.getNodeAtPoint(e)
  if (node) {
    currentNode = node
    graph.createTransformWidget(node)
  }
}

// ── Outline ───────────────────────────────────────────────────────────────
function registerOutlineListeners(graph: Graph) {
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
  return registerListeners(graph, [
    ['box:mousemove', mouseMoveHandler()],
    ['cell:selected', cellSelectedHandler],
    ['cell:unselected', cellUnselectedHandler],
  ])
}

// ── Node 双击编辑 ──────────────────────────────────────────────────────────
function registerNodeEditListeners(graph: Graph) {
  function nodeDblClickHandler({ node, e, view }: EventArgs['node:dblclick']) {
    // 特殊 GUARD_BLOCK_TYPES 跳过
    if (GUARD_BLOCK_TYPES.includes(node.getData()?.blockType)) return

    const target = e.target
    console.log(target)
    const dom = Object.values(view._getSelectors).find((el) =>
      el.contains(target),
    )
    // 拿到点击元素的 dom 信息，进行区分处理
    if (!dom) return
    if (dom.tagName.toLowerCase() === 'text') {
      // 文本双击，打开文本编辑工具 老版本兼容
      console.log('hello')
      return
    }
    // 默认：打开参数设置弹窗
    interactiveService.openBlockParamModal(node)
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

    // 节点超出当前 graph 边界（含负坐标），强制用模型几何刷新 scroller
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
