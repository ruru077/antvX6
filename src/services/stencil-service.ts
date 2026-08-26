import { Graph, Stencil } from '@antv/x6'
import { debounce } from 'lodash-es'
import { fetchBlockLibrary, fetchBlocks } from '@/api/blocks'
import { MIN_RESIZABLE_WIDTH, STENCIL_GROUP_PADDING } from '@/assets/constant'
import { createSubsystemBackgroundFill } from '@/assets/x6Model'
import { createCommonService } from '@/services/common-service'
import {
  clearEdgeInsertionPreview,
  updateEdgeInsertionPreview,
} from '@/services/edge-insertion-service'
import { createInteractiveService } from '@/services/interactive-service'
import { createPermissionService } from '@/services/permission-service'
import { addSearchHistory } from '@/services/search-history-service'
import {
  createStencilLayoutService,
  type StencilContentArea,
} from '@/services/stencil-layout-service'
import { useConfigStore } from '@/store/configStore'
import { useGraphStore } from '@/store/graphStore'
import type { Node } from '@antv/x6'
import type { TextMatchOptions } from '~/types/common/text'
import type { Block, BlockData } from '~/types/vo/block'

// 模块常量 ----------------------------------------------------
const permissionService = createPermissionService()
const commonService = createCommonService()
const interactiveService = createInteractiveService()
const SEARCH_OPTIONS: TextMatchOptions = {
  regex: false,
  caseSensitive: false,
  wholeWord: false,
}
const STENCIL_CONTENT_SELECTOR = '.x6-widget-stencil-content'
const STENCIL_DRAG_LEFT_PORT_OFFSET = 9

// 模块级：供外部读取当前已加载的库名列表
let loadedLibraryNames: string[] = []
// 模块级：供外部读取当前已加载的库 → Block[] 映射
let loadedLibraryWithBlocks: Map<string, Block[]> = new Map()
class ManagedStencil extends Stencil {
  public getManagedGroupGraph(groupName: string): Graph | undefined {
    return this.getGraph(groupName)
  }

  /** 触发关键词过滤 */
  public setKeyword(keyword: string): void {
    this.filter(keyword, this.options.search)
  }
}

function createStencilTooltip(stencil: ManagedStencil, groupNames: string[]) {
  const tooltip = document.createElement('aside')
  tooltip.className = 'stencil-node-preview'
  tooltip.hidden = true

  const previewCanvas = document.createElement('div')
  previewCanvas.className = 'stencil-node-preview-canvas'
  const title = document.createElement('h2')
  const size = document.createElement('p')
  const params = document.createElement('table')
  params.className = 'stencil-node-preview-params'
  const paramsHead = params.createTHead()
  const headerRow = paramsHead.insertRow()
  const paramHeader = document.createElement('th')
  const valueHeader = document.createElement('th')
  paramHeader.textContent = '参数'
  valueHeader.textContent = '默认值'
  headerRow.append(paramHeader, valueHeader)
  const paramsBody = params.createTBody()
  tooltip.append(previewCanvas, title, size, params)
  document.body.appendChild(tooltip)

  const previewGraph = new Graph({
    container: previewCanvas,
    width: 260,
    height: 160,
    interacting: false,
    panning: false,
    mousewheel: false,
    background: { color: 'transparent' },
  })

  function hide() {
    tooltip.hidden = true
  }

  function show(node: Node, anchor: Element) {
    if (!useConfigStore.getState().stencilPreviewEnabled) return

    const data = node.getData<BlockData>()
    const previewNode = node.clone()
    const { width, height } = previewNode.getSize()
    previewNode.attr('label/text', '')
    previewNode.attr('label/textWrap', null)
    previewNode.position(0, 0)
    previewGraph.resetCells([previewNode])
    previewGraph.zoomToFit({
      padding: 0,
      minScale: 1.5,
      maxScale: 2,
      preserveAspectRatio: true,
    })

    title.textContent =
      node.attr<string>('label/text')?.trim() || data?.title || data?.blockType
    size.textContent = `Size: ${width} x ${height}`
    paramsBody.replaceChildren()

    const paramValues = data?.paramValues ?? {}
    const paramLabels = data?.paramLables ?? {}
    const entries = Object.entries(paramValues)
    if (entries.length) {
      for (const [key, value] of entries) {
        const row = paramsBody.insertRow()
        const paramCell = row.insertCell()
        const valueCell = row.insertCell()
        paramCell.textContent = paramLabels[key] || key
        valueCell.textContent = String(value)
      }
    } else {
      const row = paramsBody.insertRow()
      const cell = row.insertCell()
      cell.colSpan = 2
      cell.textContent = '暂无参数'
    }

    tooltip.hidden = false
    tooltip.style.visibility = 'hidden'
    const anchorRect = anchor.getBoundingClientRect()
    const stencilRect = stencil.container.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    tooltip.style.left = `${stencilRect.right + 10}px`
    tooltip.style.top = `${Math.min(
      Math.max(
        8,
        anchorRect.top + anchorRect.height / 2 - tooltipRect.height / 2,
      ),
      window.innerHeight - tooltipRect.height - 8,
    )}px`
    tooltip.style.visibility = 'visible'
  }

  const graphs = groupNames.map((name) => stencil.getManagedGroupGraph(name))
  for (const graph of graphs) {
    if (!graph) continue
    graph.on('node:mouseenter', ({ node, view }) => show(node, view.container))
    graph.on('node:mouseleave', hide)
    graph.on('node:mousedown', hide)
  }
  window.addEventListener('resize', hide)
  stencil.container.addEventListener('scroll', hide, true)
  const unsubPreview = useConfigStore.subscribe(
    (state) => state.stencilPreviewEnabled,
    (enabled) => {
      if (!enabled) hide()
    },
  )

  return () => {
    unsubPreview()
    window.removeEventListener('resize', hide)
    stencil.container.removeEventListener('scroll', hide, true)
    previewGraph.dispose()
    tooltip.remove()
  }
}

// ── 测试：Subsystem block 数据 ────────────────────────────────────────────────
const SUBSYSTEM_TEST_BLOCK = {
  shape: 'subsystem-block',
  width: 100,
  height: 60,
  attrs: {
    body: {
      fill: '#ffffff',
    },
    foreignObject: {
      refWidth: '100%',
      refHeight: null,
      refY: '100%',
    },
    label: {
      text: 'Subsystem',
      style: {
        width: 'fit-content',
        height: 'auto',
        whiteSpace: 'pre',
        marginLeft: '50%',
        transform: 'translateX(-50%)',
      },
    },
  },
  ports: {
    items: [
      { id: 'i1', group: 'inSYS' },
      { id: 'o1', group: 'outSYS' },
    ],
    groups: {
      inSYS: {
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z' },
          },
        ],
        z: 1,
        attrs: {
          portBody: {
            magnet: true,
            stroke: '#000000',
            strokeWidth: 10,
            strokeOpacity: 0,
          },
          text: { fontSize: 12, fontWeight: 'bold' },
        },
        position: { name: 'left' },
        label: {
          markup: { tagName: 'text', selector: 'text', textContent: 'In' },
          position: { name: 'right', args: { x: 2 } },
        },
      },
      outSYS: {
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z' },
          },
        ],
        z: 1,
        attrs: {
          portBody: {
            magnet: true,
            stroke: '#000000',
            strokeWidth: 10,
            strokeOpacity: 0,
          },
          text: { fontSize: 12, fontWeight: 'bold' },
        },
        position: { name: 'right' },
        label: {
          markup: { tagName: 'text', selector: 'text', textContent: 'Out' },
          position: { name: 'left', args: { x: -2 } },
        },
      },
    },
  },
  data: {
    title: 'Subsystem',
    srcBlock: 'simulink/Ports & Subsystems/Subsystem',
    blockType: 'Subsystem',
    portTexts: ['In', 'Out'],
    description: 'Subsystem',
    paramLables: [],
    paramValues: [],
    level: 10,
  },
} as unknown as Block

// ── 测试：Add block 数据 ─────────────────────────────────────────────────────
const ADD_TEST_BLOCK = {
  shape: 'rect',
  width: 60,
  height: 60,
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'text', selector: 'label' },
  ],
  attrs: {
    body: {
      fill: '#FFFFFF',
      stroke: '#000000',
      refWidth: '100%',
      refHeight: '100%',
      strokeWidth: 2,
    },
    label: {
      fill: '#000000',
      refX: '50%',
      refY: '120%',
      fontSize: 14,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      text: 'Add',
    },
  },
  ports: {
    items: [
      {
        id: 'i1',
        group: 'in',
        attrs: { portLabel: { text: '+' } },
      },
      {
        id: 'i2',
        group: 'in',
        attrs: { portLabel: { text: '+' } },
      },
      { id: 'o1', group: 'out' },
    ],
    groups: {
      in: {
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z' },
          },
        ],
        z: 1,
        attrs: {
          text: {},
          portBody: {
            magnet: true,
            fill: '#000000',
            stroke: '#000000',
            strokeWidth: 10,
            strokeOpacity: 0,
          },
          portLabel: {
            fill: '#000000',
            fontSize: 18,
            fontWeight: 'bold',
            text: '+',
          },
        },
        position: { name: 'left' },
        label: {
          markup: [{ tagName: 'text', selector: 'portLabel' }],
          position: { name: 'right', args: { x: 2, y: 0 } },
        },
      },
      out: {
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z' },
          },
        ],
        z: -1,
        attrs: {
          portBody: {
            magnet: true,
            fill: '#000000',
            stroke: '#000000',
            strokeWidth: 10,
            strokeOpacity: 0,
          },
        },
        position: { name: 'right' },
        label: { position: { name: 'right' } },
      },
    },
  },
  data: {
    title: 'Add',
    srcBlock: 'simulink/Math Operations/Add',
    blockType: 'Add',
    portTexts: ['+', '+'],
    description: 'Add or substract inputs.',
    paramLables: { Inputs: 'List of signs' },
    paramValues: { Inputs: '++' },
    level: 10,
  },
} as unknown as Block

// ── 测试：Product block 数据 ─────────────────────────────────────────────────
const PRODUCT_TEST_BLOCK = {
  shape: 'rect',
  width: 60,
  height: 60,
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'text', selector: 'label' },
  ],
  attrs: {
    body: {
      fill: '#FFFFFF',
      stroke: '#000000',
      refWidth: '100%',
      refHeight: '100%',
      strokeWidth: 2,
    },
    label: {
      fill: '#000000',
      refX: '50%',
      refY: '120%',
      fontSize: 14,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      text: 'Product',
    },
  },
  ports: {
    items: [
      {
        id: 'i1',
        group: 'in',
        attrs: { portLabel: { text: '×' } },
      },
      {
        id: 'i2',
        group: 'in',
        attrs: { portLabel: { text: '×' } },
      },
      { id: 'o1', group: 'out' },
    ],
    groups: {
      in: {
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z' },
          },
        ],
        z: 1,
        attrs: {
          text: {},
          portBody: {
            magnet: true,
            fill: '#000000',
            stroke: '#000000',
            strokeWidth: 10,
            strokeOpacity: 0,
          },
          portLabel: {
            fill: '#000000',
            fontSize: 18,
            fontWeight: 'bold',
            text: '×',
          },
        },
        position: { name: 'left' },
        label: {
          markup: [{ tagName: 'text', selector: 'portLabel' }],
          position: { name: 'right', args: { x: 2, y: 0 } },
        },
      },
      out: {
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z' },
          },
        ],
        z: -1,
        attrs: {
          portBody: {
            magnet: true,
            fill: '#000000',
            stroke: '#000000',
            strokeWidth: 10,
            strokeOpacity: 0,
          },
        },
        position: { name: 'right' },
        label: { position: { name: 'right' } },
      },
    },
  },
  data: {
    title: 'Product',
    srcBlock: 'simulink/Math Operations/Product',
    blockType: 'Product',
    portTexts: ['×', '×'],
    description: 'Multiply or divide inputs.',
    paramLables: {
      Inputs: 'List of signs',
      Multiplication: 'Multiplication',
    },
    paramValues: {
      Inputs: '**',
      Multiplication: 'Element-wise(.*)',
    },
    paramOptions: {
      Multiplication: ['Element-wise(.*)', 'Matrix(*)'],
    },
    level: 10,
  },
} as unknown as Block

// ── 测试：Sum block 数据 ─────────────────────────────────────────────────────
const SUM_TEST_BLOCK = {
  shape: 'rect',
  width: 60,
  height: 60,
  markup: [
    { tagName: 'ellipse', selector: 'body' },
    { tagName: 'text', selector: 'label' },
  ],
  attrs: {
    body: {
      fill: '#ffffff',
      refCx: '50%',
      refCy: '50%',
      refRx: '50%',
      refRy: '50%',
      stroke: '#000000',
      strokeWidth: 2,
    },
    label: {
      fill: '#000000',
      refX: '50%',
      refY: '120%',
      fontSize: 14,
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      text: 'Sum',
    },
  },
  ports: {
    items: [
      {
        id: 'i1',
        group: 'in',
        attrs: { portLabel: { text: '+' } },
        label: { position: { args: { offset: -15 } } },
      },
      {
        id: 'i2',
        group: 'in',
        attrs: { portLabel: { text: '-' } },
        label: { position: { args: { offset: -15 } } },
      },
      { id: 'o1', group: 'out' },
    ],
    groups: {
      in: {
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: 'M 0 0 -9 -5 -9 -3 -3 0 -9 3 -9 5 z' },
          },
        ],
        z: 1,
        attrs: {
          text: {},
          portBody: {
            magnet: true,
            fill: '#000000',
            stroke: '#000000',
            strokeWidth: 10,
            strokeOpacity: 0,
            transform: 'rotate(90)',
          },
          portLabel: {
            fill: '#000000',
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
        position: {
          name: 'ellipse',
          args: { start: 225, step: -90, compensateRotate: true },
        },
        label: {
          markup: [{ tagName: 'text', selector: 'portLabel' }],
          position: { name: 'radial' },
        },
      },
      out: {
        markup: [
          {
            tagName: 'path',
            selector: 'portBody',
            attrs: { d: 'M 9 0 0 -5 0 -3 6 0 0 3 0 5 z' },
          },
        ],
        z: -1,
        attrs: {
          portBody: {
            magnet: true,
            fill: '#000000',
            stroke: '#000000',
            strokeWidth: 10,
            strokeOpacity: 0,
          },
        },
        position: { name: 'right' },
      },
    },
  },
  data: {
    title: 'Sum',
    srcBlock: 'simulink/Math Operations/Sum',
    blockType: 'Sum',
    portTexts: ['+', '-'],
    description: 'Add or substract inputs.',
    paramLables: { Inputs: 'List of signs' },
    paramValues: { Inputs: '+-' },
    level: 10,
  },
} as unknown as Block

// 测试组
const TEST_GROUP_NAME = 'beta'

// ── StencilService ───────────────────────────────────────────────────────────
function createStencilService() {
  const layoutService = createStencilLayoutService()

  /**
   * 模块级session 管理 components 内存
   * session 存在 ↔ stencil 已挂载；所有 per-session 状态和卸载统一处理
   */
  let session: {
    // 挂载 stencil.container 的 DOM 节点
    container: HTMLElement
    // ManagedStencil 实例
    stencil: ManagedStencil
    // 库名 → Block[] 映射
    libraryWithBlock: Map<string, Block[]>
    // 容器宽度
    stencilWidth: number
    // stencil 内容区 DOM，挂载后唯一，供滚动条检测和布局宽度计算复用
    content: HTMLElement
    // 上一帧滚动条是否存在，变化时触发 resize
    lastHasVerticalScrollbar: boolean
    // 各分组包含 Label 的视觉占位，供 fitToContent 计算完整高度
    contentAreas: Map<string, StencilContentArea>
    dispose(): void
  } | null = null
  let currentKeyword = ''
  let currentSearchValue = ''
  let stopEdgeInsertionPreview: (() => void) | null = null
  // 拖拽中间变量：暂存 label，拖拽时清空避免 foreignObject 裁剪，drop 时恢复
  let pendingLabelText = ''
  let searchOptions: TextMatchOptions = { ...SEARCH_OPTIONS }
  // 进入搜索模式前暂存的标准库各分组折叠状态（true = 已折叠）
  let savedLibraryGroupStates: Map<string, boolean> | null = null
  // 上一次的视图模式，用于检测 library ↔ results 切换
  let prevViewMode: 'library' | 'results' = 'library'

  function startEdgeInsertionPreview(
    node: Node,
    draggingGraph: Graph,
    targetGraph: Graph,
    leftPortOffset: number,
  ) {
    stopEdgeInsertionPreview?.()

    let registrationTimer: ReturnType<typeof setTimeout> | null = setTimeout(
      () => {
        registrationTimer = null

        const moveHandler = () => {
          // Stencil 为左侧输入端口预留了视觉偏移；先恢复这个基础偏移，再以画布中的
          // 吸附点为准追加拖拽层位移，避免基础偏移被重复计入距离计算。
          const baseOffsetX = -leftPortOffset
          draggingGraph.container.style.transform = baseOffsetX
            ? `translateX(${baseOffsetX}px)`
            : ''
          const snapped = updateEdgeInsertionPreview(targetGraph, node)
          if (!snapped) return

          const snapClient = targetGraph.localToClient(
            node.getBBox().getCenter(),
          )
          const draggingView = draggingGraph.findViewByCell(node)
          if (!draggingView) {
            throw new Error(`Stencil dragging view is missing: ${node.id}`)
          }
          const body = draggingView.findOne('body')
          if (!body) {
            throw new Error(`Stencil dragging node body is missing: ${node.id}`)
          }
          // 只用 body 的可见中心对齐吸附点。NodeView 的包围盒还包含 label，使用它会
          // 让 Stencil 模块与画布模块采用不同的视觉中心，从而产生吸附偏移。
          const visibleBBox = body.getBoundingClientRect()
          const visibleCenter = {
            x: visibleBBox.left + visibleBBox.width / 2,
            y: visibleBBox.top + visibleBBox.height / 2,
          }
          const translate = {
            x: baseOffsetX + snapClient.x - visibleCenter.x,
            y: snapClient.y - visibleCenter.y,
          }
          draggingGraph.container.style.transform = `translate(${translate.x}px, ${translate.y}px)`
        }

        const endHandler = () => setTimeout(cleanup, 0)

        const cleanup = () => {
          if (stopEdgeInsertionPreview !== cleanup) return
          document.removeEventListener('mousemove', moveHandler)
          document.removeEventListener('mouseup', endHandler)
          draggingGraph.container.style.transform = ''
          clearEdgeInsertionPreview(targetGraph, node.id)
          stopEdgeInsertionPreview = null
        }

        document.addEventListener('mousemove', moveHandler)
        document.addEventListener('mouseup', endHandler, { once: true })
        stopEdgeInsertionPreview = cleanup
      },
      0,
    )

    stopEdgeInsertionPreview = () => {
      if (registrationTimer) clearTimeout(registrationTimer)
      registrationTimer = null
      draggingGraph.container.style.transform = ''
      clearEdgeInsertionPreview(targetGraph, node.id)
      stopEdgeInsertionPreview = null
    }
  }

  function fitGroupsToLayout(): void {
    if (!session) return

    const { stencil, libraryWithBlock, contentAreas } = session
    for (const libraryName of libraryWithBlock.keys()) {
      const groupGraph = stencil.getManagedGroupGraph(libraryName)
      const contentArea = contentAreas.get(libraryName)
      if (!groupGraph || !contentArea) continue

      groupGraph.fitToContent({
        minWidth: session.stencilWidth,
        maxWidth: session.stencilWidth,
        gridWidth: 1,
        gridHeight: 1,
        padding: { bottom: stencil.options.stencilGraphPadding },
        contentArea,
      })
    }
  }

  // 创建并挂载 Stencil，返回是否成功
  async function create(container: HTMLElement): Promise<boolean> {
    const graph = useGraphStore.getState().graph
    if (!graph) return false
    const { betaGroupEnabled, hiddenStencilGroups, stencilDefaultExpand } =
      useConfigStore.getState()
    const [blocks, libraries] = await Promise.all([
      fetchBlocks(),
      fetchBlockLibrary(),
    ])

    const libraryWithBlock = new Map(
      permissionService
        .filterAccessLibraries(libraries)
        .map((library) => [
          library.name.toUpperCase(),
          blocks
            .filter((item) => item.libraryId === library.id)
            .map((item) => item.block),
        ]),
    )

    // ── 测试：push 测试组（独立分组，不干扰后端数据） ──
    libraryWithBlock.set(TEST_GROUP_NAME, [
      SUBSYSTEM_TEST_BLOCK,
      ADD_TEST_BLOCK,
      PRODUCT_TEST_BLOCK,
      SUM_TEST_BLOCK,
    ])

    // 缓存库名和 Block 列表供外部读取
    loadedLibraryNames = Array.from(libraryWithBlock.keys())
    loadedLibraryWithBlocks = libraryWithBlock

    const stencilWidth = container.clientWidth
    const contentAreas = new Map<string, StencilContentArea>()
    const stencil = new ManagedStencil({
      target: graph,
      stencilGraphWidth: stencilWidth,
      stencilGraphHeight: 0,
      layout(model, group) {
        // setKeyword → X6 内部 filter → layout 回调
        const areaWidth = layoutService.getLayoutAreaWidth(
          session?.content,
          session?.stencilWidth ?? stencilWidth,
        )
        const contentArea = layoutService.applyGridLayout(model, areaWidth)
        if (group) contentAreas.set(group.name, contentArea)
      },
      groups: Array.from(libraryWithBlock, ([name]) => ({
        name,
        title: name,
        collapsed: !stencilDefaultExpand,
      })),
      search(cell, keyword) {
        const labelText = cell.attr<string>('label/text')
        return commonService.isTextMatched(labelText, keyword, searchOptions)
      },
      placeholder: 'TO_BLOCK_NAME',
      stencilGraphPadding: STENCIL_GROUP_PADDING,
      notFoundText: 'NOT FOUND',
      // 拖拽预处理：增加节点阴影，调整宽高
      getDragNode(node, { draggingGraph, targetGraph }) {
        addSearchHistory(currentSearchValue)
        pendingLabelText = ''
        const res = node.clone()
        layoutService.restoreLabelPresentation(res, node)
        const hasLeftPort = res
          .getPorts()
          .some((port) => port.group?.toLowerCase().startsWith('in'))
        const leftPortOffset = hasLeftPort
          ? STENCIL_DRAG_LEFT_PORT_OFFSET * targetGraph.zoom()
          : 0
        draggingGraph.container.style.transform = leftPortOffset
          ? `translateX(${-leftPortOffset}px)`
          : ''
        // 节点阴影
        interactiveService.removeOutline(res)
        // 子系统：暂存 label 并清空，避免拖拽时 foreignObject 裁剪
        if (node.getData()?.blockType === 'Subsystem') {
          pendingLabelText = res.attr<string>('label/text') ?? ''
          res.attr('label/text', '')
        } else {
          const { width, height } = res.getSize()
          /// 宽高不相等为特调模块 不进行处理
          if (width === height) {
            res.size(Math.max(60, width), Math.max(60, height))
          }
        }
        // // 更新port id 确保唯一性
        // res.getPorts().forEach((port) => {
        //   if (port.id) res.portProp(port.id, 'id', StringExt.uuid())
        // })
        startEdgeInsertionPreview(
          res,
          draggingGraph,
          targetGraph,
          leftPortOffset,
        )
        return res
      },
      // 拖拽结束放置到画布时：确保 label 唯一性，相同类型模块自动递增编号
      getDropNode(draggingNode) {
        const res = draggingNode.clone()
        // 恢复拖拽时清空的 label
        if (res.getData()?.blockType === 'Subsystem') {
          if (pendingLabelText) res.attr('label/text', pendingLabelText)
          res.attr('body/fill', createSubsystemBackgroundFill())
        }
        pendingLabelText = ''
        // label 唯一性检查与 contentEditable 设置已移至
        // useGraphListener 的 node:added / node:mouseenter 监听器统一处理
        return res
      },
    })

    // 加载全部分组节点（隐藏组通过 display:none 控制）
    for (const [libraryName, blockList] of libraryWithBlock) {
      stencil.load(
        blockList.map((block) => graph.createNode(block)),
        libraryName,
      )
    }
    container.appendChild(stencil.container)
    const disposeTooltip = createStencilTooltip(
      stencil,
      Array.from(libraryWithBlock.keys()),
    )

    // 初始隐藏已配置的分组以及默认关闭的 Beta 分组
    for (const libraryName of libraryWithBlock.keys()) {
      const isHidden =
        libraryName === TEST_GROUP_NAME
          ? !betaGroupEnabled
          : hiddenStencilGroups.includes(libraryName)
      if (!isHidden) continue
      const groupElem = container.querySelector<HTMLElement>(
        `[data-name="${libraryName}"]`,
      )
      if (groupElem) groupElem.style.display = 'none'
    }

    // ── 所有 per-session 的 observer / debounce 在此创建，统一在 session.dispose() 中卸载 ──
    const content = container.querySelector<HTMLElement>(
      STENCIL_CONTENT_SELECTOR,
    )!
    // 是否有滚动条
    const lastHasVerticalScrollbar = content.scrollHeight > content.clientHeight

    // Effect
    const syncScrollbarLayout = () => {
      if (!session) return

      const hasScrollbar = content.scrollHeight > content.clientHeight
      if (hasScrollbar !== session.lastHasVerticalScrollbar) {
        session.lastHasVerticalScrollbar = hasScrollbar
        resize(container.clientWidth)
      }
    }

    const syncContainerWidth = debounce((entries: ResizeObserverEntry[]) => {
      const nextWidth = entries[0].contentRect.width
      if (nextWidth < MIN_RESIZABLE_WIDTH) return
      resize(nextWidth)
    }, 300)

    // ResizeObserver 监听容器宽度变化
    const containerResizeObserver = new ResizeObserver(syncContainerWidth)
    containerResizeObserver.observe(container)

    // 内部元素变化 如后期feat 用户新增Block
    const contentMutationObserver = new MutationObserver(syncScrollbarLayout)
    contentMutationObserver.observe(content, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    session = {
      container,
      stencil,
      libraryWithBlock,
      stencilWidth,
      content,
      lastHasVerticalScrollbar,
      contentAreas,
      dispose() {
        disposeTooltip()
        stopEdgeInsertionPreview?.()
        syncContainerWidth.cancel()
        contentMutationObserver.disconnect()
        containerResizeObserver.disconnect()
        stencil.dispose()
        container.replaceChildren()
      },
    }
    resize(container.clientWidth)

    // 配置变化时自动同步（subscribeWithSelector 自动过滤无关字段）
    const unsubExpand = useConfigStore.subscribe(
      (state) => state.stencilDefaultExpand,
      () => syncStencilDefaultExpand(),
    )
    const unsubHidden = useConfigStore.subscribe(
      (state) => state.hiddenStencilGroups,
      () => syncHiddenGroups(),
    )
    const unsubBetaGroup = useConfigStore.subscribe(
      (state) => state.betaGroupEnabled,
      () => syncHiddenGroups(),
    )
    const unsubArrange = useConfigStore.subscribe(
      (state) => state.stencilArrangeMode,
      () => resize(container.clientWidth),
    )
    // session dispose 时取消订阅
    const origDispose = session.dispose
    session.dispose = () => {
      unsubExpand()
      unsubHidden()
      unsubBetaGroup()
      unsubArrange()
      origDispose()
    }

    return true
  }

  function dispose(): void {
    session?.dispose()
    session = null
  }

  function syncSearchKeyword(
    keyword: string,
    viewMode: 'library' | 'results',
  ): void {
    const enteringSearch = prevViewMode === 'library' && viewMode === 'results'
    const leavingSearch = prevViewMode === 'results' && viewMode === 'library'
    prevViewMode = viewMode

    currentSearchValue = keyword.trim()
    currentKeyword =
      viewMode === 'results'
        ? currentSearchValue || '空串默认全搜确保返回404'
        : ''

    if (session) {
      if (enteringSearch) {
        // 进入搜索模式：保存当前各分组折叠状态，然后全部展开
        savedLibraryGroupStates = new Map(
          Array.from(session.libraryWithBlock.keys()).map((name) => [
            name,
            session!.stencil.isGroupCollapsed(name),
          ]),
        )
        session.stencil.expandGroups()
      } else if (leavingSearch && savedLibraryGroupStates) {
        // 离开搜索模式：恢复标准库保存的折叠状态
        for (const [name, collapsed] of savedLibraryGroupStates) {
          if (collapsed) {
            session.stencil.collapseGroup(name)
          } else {
            session.stencil.expandGroup(name)
          }
        }
        savedLibraryGroupStates = null
      }
    }

    session?.stencil.setKeyword(currentKeyword)
    fitGroupsToLayout()
  }
  /**
   * @description Stencil 宽度更新 重排 group
   * @param newWidth
   */
  function resize(newWidth: number): void {
    if (!session || !session.libraryWithBlock.size) return
    // 更新宽度
    session.stencilWidth = newWidth
    const areaWidth = layoutService.getLayoutAreaWidth(
      session.content,
      newWidth,
    )
    const { stencil, libraryWithBlock } = session

    // 有搜索词时：layout 由 setKeyword → X6 filter → layout 回调完成
    if (currentKeyword) {
      stencil.setKeyword(currentKeyword)
      fitGroupsToLayout()
      return
    }

    // 对每个库分组图直接调整尺寸和节点布局
    for (const libraryName of libraryWithBlock.keys()) {
      const groupGraph = stencil.getManagedGroupGraph(libraryName)
      if (!groupGraph) continue

      const contentArea = layoutService.applyGridLayout(
        groupGraph.model,
        areaWidth,
      )
      session.contentAreas.set(libraryName, contentArea)
    }
    fitGroupsToLayout()
  }

  function collapseAll(): void {
    session?.stencil.collapseGroups()
  }

  function expandAll(): void {
    session?.stencil.expandGroups()
  }

  function onCollapsedChange(collapsed: boolean): void {
    if (!session) return
    if (!collapsed && session.libraryWithBlock.size) {
      resize(session.container.clientWidth)
    }
  }

  function configSearchOptions(nextOptions: Partial<TextMatchOptions>): void {
    searchOptions = { ...searchOptions, ...nextOptions }
  }

  function getLibraryNames(): string[] {
    return loadedLibraryNames.filter((name) => name !== TEST_GROUP_NAME)
  }

  function syncStencilDefaultExpand(): void {
    if (!session) return
    const { stencilDefaultExpand } = useConfigStore.getState()
    const firstGroup = session.libraryWithBlock.keys().next().value as
      | string
      | undefined
    if (!firstGroup) return

    const currentlyExpanded = !session.stencil.isGroupCollapsed(firstGroup)
    if (currentlyExpanded === stencilDefaultExpand) return

    if (stencilDefaultExpand) {
      session.stencil.expandGroups()
    } else {
      session.stencil.collapseGroups()
    }
  }

  function syncHiddenGroups(): void {
    if (!session) return

    const { betaGroupEnabled, hiddenStencilGroups } = useConfigStore.getState()

    for (const libraryName of session.libraryWithBlock.keys()) {
      const isHidden =
        libraryName === TEST_GROUP_NAME
          ? !betaGroupEnabled
          : hiddenStencilGroups.includes(libraryName)
      const groupElem = session.container.querySelector<HTMLElement>(
        `[data-name="${libraryName}"]`,
      )
      if (groupElem) {
        groupElem.style.display = isHidden ? 'none' : ''
      }
    }
  }

  return {
    create,
    dispose,
    resize,
    collapseAll,
    expandAll,
    onCollapsedChange,
    configSearchOptions,
    syncSearchKeyword,
    syncHiddenGroups,
    syncStencilDefaultExpand,
    getLibraryNames,
  }
}

const getLibraryNames = () =>
  loadedLibraryNames.filter((name) => name !== TEST_GROUP_NAME)
const getLibraryWithBlocks = () => {
  if (useConfigStore.getState().betaGroupEnabled) {
    return loadedLibraryWithBlocks
  }
  return new Map(
    Array.from(loadedLibraryWithBlocks).filter(
      ([name]) => name !== TEST_GROUP_NAME,
    ),
  )
}

export { createStencilService, getLibraryNames, getLibraryWithBlocks }
