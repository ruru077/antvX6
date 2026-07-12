import {
  DoubleRightOutlined,
  EditOutlined,
  SisternodeOutlined,
} from '@ant-design/icons'
import {
  Breadcrumb,
  Button,
  Drawer,
  Flex,
  Input,
  Space,
  Typography,
} from 'antd'
import { useShallow } from 'zustand/shallow'
import { Button as UiButton } from '@/components/ui/button'
import { Input as UiInput } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGraphStore } from '@/store/graphStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import { useSubSystemTabStore } from '@/store/subSystemTabStore'
import type { Scroller } from '@antv/x6'
import type { GraphJSON, SubGraphMap } from '~/types'

type SearchScope = 'root' | 'currentAndBelow' | 'current'

type GraphJsonCell = GraphJSON['cells'][number] & {
  id?: string
  shape?: string
  attrs?: {
    label?: {
      text?: unknown
    }
  }
  data?: {
    blockType?: unknown
    title?: unknown
    srcBlock?: unknown
  }
}

interface SearchResult {
  key: string
  graphId: string
  cellId: string
  name: string
  type: string
  srcBlock: string
  path: string
}

const SEARCH_SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'root', label: '顶层搜索' },
  { value: 'current', label: '当前层搜索' },
  { value: 'currentAndBelow', label: '当前层及下层搜索' },
]

// 获取搜索范围的展示文案。
function getScopeLabel(scope: SearchScope) {
  return SEARCH_SCOPE_OPTIONS.find((item) => item.value === scope)?.label ?? ''
}

// 收集指定层级及其所有子层级 ID。
function collectGraphIds(subGraphs: SubGraphMap, graphId: string): string[] {
  if (!subGraphs[graphId]) return []
  const result: string[] = []
  const visited = new Set<string>()

  function walk(id: string) {
    if (visited.has(id) || !subGraphs[id]) return
    visited.add(id)
    result.push(id)
    subGraphs[id].childrenIds.forEach(walk)
  }

  walk(graphId)
  return result
}

// 拼出指定层级在子系统树里的路径。
function getGraphPath(subGraphs: SubGraphMap, graphId: string) {
  const names: string[] = []
  let id: string | null | undefined = graphId
  while (id && subGraphs[id]) {
    names.unshift(subGraphs[id].name)
    id = subGraphs[id].parentId
  }
  return names.join(' / ')
}

// 从 subGraphs 构建查找器结果，覆盖当前不可见的子系统层级。
function buildSearchResults(
  subGraphs: SubGraphMap,
  rootId: string,
  currentGraphId: string,
  scope: SearchScope,
  keyword: string,
): SearchResult[] {
  const query = keyword.trim().toLowerCase()
  if (!query) return []

  const graphIds =
    scope === 'current'
      ? subGraphs[currentGraphId]
        ? [currentGraphId]
        : []
      : collectGraphIds(
          subGraphs,
          scope === 'currentAndBelow' ? currentGraphId : rootId,
        )

  return graphIds.flatMap((graphId) => {
    const subGraph = subGraphs[graphId]
    const path = getGraphPath(subGraphs, graphId)
    return ((subGraph.graphJson.cells ?? []) as GraphJsonCell[])
      .filter((cell) => cell.shape !== 'edge' && cell.id)
      .map((cell) => {
        const labelText = cell.attrs?.label?.text
        const title = cell.data?.title
        const blockType = cell.data?.blockType
        const srcBlock = cell.data?.srcBlock
        const name =
          typeof labelText === 'string' && labelText.trim()
            ? labelText.trim()
            : typeof title === 'string' && title.trim()
              ? title.trim()
              : (cell.id ?? 'Unnamed')
        const type =
          typeof blockType === 'string' && blockType.trim()
            ? blockType
            : (cell.shape ?? 'Node')
        return {
          key: `${graphId}:${cell.id}`,
          graphId,
          cellId: cell.id as string,
          name,
          type,
          srcBlock: typeof srcBlock === 'string' ? srcBlock : '',
          path,
        }
      })
      .filter((result) => result.name.toLowerCase().includes(query))
  })
}

function SubsystemNavBar({
  modelName,
  modelSaved = true,
  onRename,
}: {
  modelName?: string
  modelSaved?: boolean
  onRename?: (name: string) => void
}) {
  const { currentPathIds, subGraphs, rootId } = useSubGraphStore(
    useShallow((s) => ({
      currentPathIds: s.currentPathIds,
      subGraphs: s.subGraphs,
      rootId: s.rootId,
    })),
  )
  // 在当前 Tab 内切换子系统层级。
  function navigateTo(subGraphId: string) {
    useSubSystemTabStore.getState().navigateWithin(subGraphId)
  }

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('root')
  const [activeResultIndex, setActiveResultIndex] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const searchResults = useMemo(
    () =>
      buildSearchResults(
        subGraphs,
        rootId,
        currentPathIds[currentPathIds.length - 1],
        searchScope,
        searchValue,
      ),
    [currentPathIds, rootId, searchScope, searchValue, subGraphs],
  )
  const resultCounterText = searchResults.length
    ? `第 ${activeResultIndex + 1} 个结果，共 ${searchResults.length} 个`
    : '第 0 个结果，共 0 个'

  useEffect(() => {
    setActiveResultIndex(0)
  }, [searchScope, searchValue])

  useEffect(() => {
    if (activeResultIndex < searchResults.length) return
    setActiveResultIndex(Math.max(0, searchResults.length - 1))
  }, [activeResultIndex, searchResults.length])

  useEffect(() => {
    if (!drawerOpen) return
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [drawerOpen])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((!e.ctrlKey && !e.metaKey) || e.key.toLowerCase() !== 'f') return
      e.preventDefault()
      setDrawerOpen(true)
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // 打开查找器，并让输入框立即获得焦点。
  function openSearchPanel() {
    setDrawerOpen(true)
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  // 关闭查找器并清理本次搜索状态。
  function closeSearchPanel() {
    setDrawerOpen(false)
    setSearchValue('')
    setActiveResultIndex(0)
  }

  // 跳到结果所在层级，并选中滚动到目标节点。
  function focusResultCell(result: SearchResult) {
    navigateTo(result.graphId)
    window.setTimeout(() => {
      const nextGraph = useGraphStore.getState().graph
      const cell = nextGraph?.getCellById(result.cellId)
      if (!cell) return
      nextGraph.resetSelection([cell])
      nextGraph.getPlugin<Scroller>('scroller')?.scrollToCell(cell)
    }, 0)
  }

  // 打开指定序号的搜索结果。
  function openResult(index: number) {
    const result = searchResults[index]
    if (!result) return
    setActiveResultIndex(index)
    focusResultCell(result)
  }

  // 在搜索结果中循环切换上一个或下一个。
  function moveResult(step: number) {
    if (!searchResults.length) return
    const nextIndex =
      (activeResultIndex + step + searchResults.length) % searchResults.length
    setActiveResultIndex(nextIndex)
  }

  // 根据当前字体测量项目名编辑框宽度。
  function measureTextWidth(text: string) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return 0

    context.font =
      '15px "OPPO Sans", "OPPOSans", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    return context.measureText(text || ' ').width
  }

  const editInputWidth = editing
    ? Math.max(Math.ceil(measureTextWidth(editValue) + 20), 48)
    : 120

  // 开始编辑模型名称。
  function startEdit() {
    setEditValue(modelName ?? '')
    setEditing(true)
  }

  // 提交模型名称编辑。
  function commitEdit() {
    const trimmed = editValue.trim()
    if (trimmed) onRename?.(trimmed)
    setEditing(false)
  }

  const items = currentPathIds.map((id, index) => {
    const isLast = index === currentPathIds.length - 1
    const isRoot = index === 0
    const name = subGraphs[id].name
    const label = (
      <Space
        size={2}
        align="center"
        className="text-sm [&_.ant-typography]:text-sm"
      >
        {isRoot && <SisternodeOutlined />}
        <Typography.Text strong={isLast}>{name}</Typography.Text>
      </Space>
    )
    const parentId = index > 0 ? currentPathIds[index - 1] : null
    const siblings = parentId ? subGraphs[parentId].childrenIds : []

    return {
      title: isLast ? label : <a onClick={() => navigateTo(id)}>{label}</a>,
      menu:
        siblings.length > 1
          ? {
              selectedKeys: [id],
              items: siblings.map((sibId) => ({
                key: sibId,
                label: subGraphs[sibId].name || sibId,
              })),
              onClick: ({ key }: { key: string }) => navigateTo(key),
            }
          : undefined,
    }
  })

  return (
    <Flex
      align="center"
      className="flex h-8 items-center overflow-visible border-b border-gray-100 bg-white"
    >
      {/* 项目名区域 */}
      {modelName && (
        <Flex
          align="center"
          gap={6}
          className="flex h-full shrink-0 cursor-default select-none border-r border-gray-200 bg-gray-50 px-3"
        >
          {editing ? (
            <Input
              size="small"
              value={editValue}
              autoFocus
              style={{ width: editInputWidth }}
              className="h-6"
              onChange={(e) => setEditValue(e.target.value)}
              onPressEnter={commitEdit}
              onBlur={commitEdit}
            />
          ) : (
            <>
              <Typography.Text className="text-xs leading-none whitespace-nowrap font-medium text-gray-600">
                {modelName}
              </Typography.Text>
              <EditOutlined
                className="cursor-pointer text-xs text-gray-400 transition-colors hover:text-[#1890ff]"
                onClick={startEdit}
              />
            </>
          )}
        </Flex>
      )}

      {/* 路径 + 展开按钮 */}
      <Flex flex={1} align="center" className="h-full">
        {/* 路径面包屑 */}
        <Flex flex={1} align="center" className="min-w-0 overflow-hidden px-2">
          <Breadcrumb items={items} />
        </Flex>

        {/* 展开全局层级 */}
        <Button
          type="text"
          size="small"
          icon={<DoubleRightOutlined rotate={90} />}
          className="mr-1 shrink-0 text-gray-400 transition-colors hover:text-[#1890ff]"
          onClick={openSearchPanel}
        />
      </Flex>
      <Drawer
        title={`查找器: ${getScopeLabel(searchScope)}`}
        placement="bottom"
        size="45vh"
        zIndex={40}
        open={drawerOpen}
        onClose={closeSearchPanel}
        closable={{ placement: 'end' }}
        className="subsystem-tree-drawer"
        styles={{
          body: {
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          },
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Select
              value={searchScope}
              onValueChange={(value) => setSearchScope(value as SearchScope)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SEARCH_SCOPE_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <UiInput
              ref={searchInputRef}
              value={searchValue}
              placeholder="输入搜索字符串"
              className="flex-1"
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  moveResult(-1)
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  moveResult(1)
                }
                if (e.key === 'Enter') openResult(activeResultIndex)
                if (e.key === 'Escape') closeSearchPanel()
              }}
            />
            <UiButton
              type="button"
              size="sm"
              variant="outline"
              disabled={!searchResults.length}
              onClick={() => openResult(activeResultIndex)}
            >
              查找
            </UiButton>
            <span className="w-36 text-sm text-gray-700">
              {resultCounterText}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-gray-200 bg-white">
            <div className="sticky top-0 grid grid-cols-[minmax(180px,1fr)_140px_minmax(240px,1.2fr)] border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
              <div className="border-r border-gray-200 px-3 py-2">名称</div>
              <div className="border-r border-gray-200 px-3 py-2">类型</div>
              <div className="px-3 py-2">所在层级</div>
            </div>
            {searchResults.length ? (
              searchResults.map((result, index) => (
                <UiButton
                  key={result.key}
                  type="button"
                  variant="ghost"
                  className={`grid w-full grid-cols-[minmax(180px,1fr)_140px_minmax(240px,1.2fr)] rounded-none border-b border-gray-100 text-left text-sm hover:bg-blue-100 ${
                    index === activeResultIndex ? 'bg-blue-100' : 'bg-white'
                  }`}
                  onMouseEnter={() => setActiveResultIndex(index)}
                  onClick={() => openResult(index)}
                >
                  <span className="truncate border-r border-gray-100 px-3 py-2 font-medium">
                    {result.name}
                  </span>
                  <span className="truncate border-r border-gray-100 px-3 py-2 text-gray-600">
                    {result.type}
                  </span>
                  <span className="truncate px-3 py-2 text-gray-600">
                    {result.path}
                  </span>
                </UiButton>
              ))
            ) : (
              <div className="flex h-full min-h-24 items-center justify-center text-sm text-gray-400">
                {searchValue.trim() ? '没有匹配结果' : '输入搜索字符串开始查找'}
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </Flex>
  )
}

export { SubsystemNavBar }
