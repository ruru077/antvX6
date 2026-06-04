import { Stencil, StringExt } from '@antv/x6'
import { debounce } from 'lodash-es'
import { fetchBlockLibrary, fetchBlocks } from '@/api/blocks'
import {
  MIN_RESIZABLE_WIDTH,
  STENCIL_GROUP_PADDING,
  STENCIL_NODE_COLUMN_GAP,
  STENCIL_NODE_ROW_GAP,
  STENCIL_SIDE_PADDING,
} from '@/assets/constant'
import { createCommonService } from '@/services/common-service'
import { createInteractiveService } from '@/services/interactive-service'
import { createPermissionService } from '@/services/permission-service'
import { useGraphStore } from '@/store/graphStore'
import type { Graph, Model, Node } from '@antv/x6'
import type { TextMatchOptions } from '~/types/common/text'
import type { Block } from '~/types/vo/block'

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
class ManagedStencil extends Stencil {
  public getManagedGroupGraph(groupName: string): Graph | undefined {
    return this.getGraph(groupName)
  }

  /** 触发关键词过滤 */
  public setKeyword(keyword: string): void {
    this.filter(keyword, this.options.search)
  }
}

// ── StencilService ───────────────────────────────────────────────────────────
function createStencilService() {
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
    dispose(): void
  } | null = null
  let currentKeyword = ''
  let searchOptions: TextMatchOptions = { ...SEARCH_OPTIONS }
  // 进入搜索模式前暂存的标准库各分组折叠状态（true = 已折叠）
  let savedLibraryGroupStates: Map<string, boolean> | null = null
  // 上一次的视图模式，用于检测 library ↔ results 切换
  let prevViewMode: 'library' | 'results' = 'library'

  /**
   * @description 删去边距和滚动条占位后剩余的宽度，作为 greedy layout 的可用宽度
   * @param width 当前的 stencilWidth
   * @returns reLayout 可用宽度
   */
  function getLayoutAreaWidth(content: HTMLElement, width: number): number {
    const scrollbarWidth =
      content.scrollHeight > content.clientHeight
        ? Math.max(0, content.offsetWidth - content.clientWidth)
        : 0
    return Math.max(0, width - scrollbarWidth - 2 * STENCIL_SIDE_PADDING)
  }
  /**
   * @description 贪心布局算法：从上到下逐行放置节点，当前行放不下时换行；每行节点水平居中分布
   * @param model 当前 Lib 的所有节点
   * @param areaWidth 可用宽度
   */
  function applyGreedyLayout(model: Model, areaWidth: number): void {
    const rows: Node[][] = []
    let currentRow: Node[] = []
    let currentWidth = 0

    for (const node of model.getNodes()) {
      const { width } = node.getSize()
      const nextWidth = currentRow.length
        ? currentWidth + STENCIL_NODE_ROW_GAP + width
        : width

      if (nextWidth <= areaWidth) {
        currentRow.push(node)
        currentWidth = nextWidth
        continue
      }

      if (currentRow.length) rows.push(currentRow)
      currentRow = [node]
      currentWidth = width

      if (width > areaWidth) {
        console.error('[联系管理员兼容]Exist node exceeds min row width:', node)
      }
    }

    if (currentRow.length) rows.push(currentRow)

    let y = STENCIL_NODE_ROW_GAP / 2
    for (const row of rows) {
      const sizes = row.map((node) => node.getSize())
      const rowHeight = Math.max(...sizes.map((size) => size.height))
      const nodesWidth = sizes.reduce((sum, size) => sum + size.width, 0)
      const gap =
        (areaWidth - nodesWidth) / (row.length > 1 ? row.length + 1 : 2)
      let x = gap

      row.forEach((node, index) => {
        const { width, height } = sizes[index]
        node.position(x, y + (rowHeight - height) / 2)
        x += width + gap
      })
      y += rowHeight + STENCIL_NODE_COLUMN_GAP
    }
  }

  // 创建并挂载 Stencil，返回是否成功
  async function create(container: HTMLElement): Promise<boolean> {
    const graph = useGraphStore.getState().graph
    if (!graph) return false
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

    const stencilWidth = container.clientWidth
    const stencil = new ManagedStencil({
      target: graph,
      stencilGraphWidth: stencilWidth,
      stencilGraphHeight: 0,
      layout(model) {
        // setKeyword → X6 内部 filter → layout 回调
        const areaWidth = session
          ? getLayoutAreaWidth(session.content, session.stencilWidth)
          : Math.max(0, stencilWidth - 2 * STENCIL_SIDE_PADDING)
        applyGreedyLayout(model, areaWidth)
      },
      groups: Array.from(libraryWithBlock, ([name]) => ({ name, title: name })),
      search(cell, keyword) {
        const labelText = cell.attr<string>('label/text')
        return commonService.isTextMatched(labelText, keyword, searchOptions)
      },
      placeholder: 'TO_BLOCK_NAME',
      stencilGraphPadding: STENCIL_GROUP_PADDING,
      notFoundText: 'NOT FOUND',
      // 拖拽预处理：增加节点阴影，调整宽高
      getDragNode(node) {
        const res = node.clone()
        // 节点阴影
        interactiveService.removeOutline(res)
        // 子系统不做处理方便解构
        if (node.getData()?.blockType === 'Subsystem') return res
        // 更新port id 确保唯一性
        res.getPorts().forEach((port) => {
          if (port.id) res.portProp(port.id, 'id', StringExt.uuid())
        })
        const { width, height } = res.getSize()
        /// 宽高不相等为特调模块 不进行处理
        return width !== height
          ? res
          : res.size(Math.max(60, width), Math.max(60, height))
      },
    })

    for (const [libraryName, blockList] of libraryWithBlock) {
      stencil.load(
        blockList.map((block) => graph.createNode(block)),
        libraryName,
      )
    }
    container.appendChild(stencil.container)

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
      dispose() {
        syncContainerWidth.cancel()
        contentMutationObserver.disconnect()
        containerResizeObserver.disconnect()
        stencil.dispose()
        container.replaceChildren()
      },
    }
    resize(container.clientWidth)
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

    currentKeyword =
      viewMode === 'results' ? keyword.trim() || '空串默认全搜确保返回404' : ''

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
  }
  /**
   * @description Stencil 宽度更新 重排 group
   * @param newWidth
   */
  function resize(newWidth: number): void {
    if (!session || !session.libraryWithBlock.size) return
    // 更新宽度
    session.stencilWidth = newWidth
    const areaWidth = getLayoutAreaWidth(session.content, newWidth)
    const { stencil, libraryWithBlock } = session

    // 有搜索词时：layout 由 setKeyword → X6 filter → layout 回调完成
    if (currentKeyword) {
      stencil.setKeyword(currentKeyword)
      return
    }

    // 对每个库分组图直接调整尺寸和节点布局
    for (const libraryName of libraryWithBlock.keys()) {
      const groupGraph = stencil.getManagedGroupGraph(libraryName)
      if (!groupGraph) continue

      applyGreedyLayout(groupGraph.model, areaWidth)
      groupGraph.fitToContent({
        minWidth: groupGraph.options.width,
        gridHeight: 1,
        padding: stencil.options.stencilGraphPadding,
      })
    }
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

  return {
    create,
    dispose,
    resize,
    collapseAll,
    expandAll,
    onCollapsedChange,
    configSearchOptions,
    syncSearchKeyword,
  }
}

export { createStencilService }
