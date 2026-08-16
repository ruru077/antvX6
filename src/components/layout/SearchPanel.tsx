import { useShallow } from 'zustand/shallow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  attrs?: { label?: { text?: unknown } }
  data?: { blockType?: unknown; title?: unknown; srcBlock?: unknown }
}

interface SearchResult {
  key: string
  graphId: string
  cellId: string
  name: string
  type: string
  path: string
}

const SEARCH_SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'root', label: '顶层搜索' },
  { value: 'current', label: '当前层搜索' },
  { value: 'currentAndBelow', label: '当前层及下层搜索' },
]

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

function getGraphPath(subGraphs: SubGraphMap, graphId: string) {
  const names: string[] = []
  let id: string | null | undefined = graphId
  while (id && subGraphs[id]) {
    names.unshift(subGraphs[id].name)
    id = subGraphs[id].parentId
  }
  return names.join(' / ')
}

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
        const name =
          typeof labelText === 'string' && labelText.trim()
            ? labelText.trim()
            : typeof title === 'string' && title.trim()
              ? title.trim()
              : (cell.id ?? 'Unnamed')
        return {
          key: `${graphId}:${cell.id}`,
          graphId,
          cellId: cell.id as string,
          name,
          type:
            typeof blockType === 'string' && blockType.trim()
              ? blockType
              : (cell.shape ?? 'Node'),
          path,
        }
      })
      .filter((result) => result.name.toLowerCase().includes(query))
  })
}

function SearchPanel() {
  const { currentPathIds, subGraphs, rootId } = useSubGraphStore(
    useShallow((state) => ({
      currentPathIds: state.currentPathIds,
      subGraphs: state.subGraphs,
      rootId: state.rootId,
    })),
  )
  const [searchValue, setSearchValue] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('root')
  const [activeResultIndex, setActiveResultIndex] = useState(0)
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

  useEffect(() => setActiveResultIndex(0), [searchScope, searchValue])

  useEffect(() => {
    if (activeResultIndex < searchResults.length) return
    setActiveResultIndex(Math.max(0, searchResults.length - 1))
  }, [activeResultIndex, searchResults.length])

  useEffect(() => {
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [])

  function focusResultCell(result: SearchResult) {
    useSubSystemTabStore.getState().navigateWithin(result.graphId)
    window.setTimeout(() => {
      const graph = useGraphStore.getState().graph
      const cell = graph?.getCellById(result.cellId)
      if (!cell) return
      graph.resetSelection([cell])
      graph.getPlugin<Scroller>('scroller')?.scrollToCell(cell)
    }, 0)
  }

  function openResult(index: number) {
    const result = searchResults[index]
    if (!result) return
    setActiveResultIndex(index)
    focusResultCell(result)
  }

  function moveResult(step: number) {
    if (!searchResults.length) return
    setActiveResultIndex(
      (activeResultIndex + step + searchResults.length) % searchResults.length,
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <Select
          value={searchScope}
          onValueChange={(value) => setSearchScope(value as SearchScope)}
        >
          <SelectTrigger size="sm">
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
        <Input
          ref={searchInputRef}
          value={searchValue}
          placeholder="输入搜索字符串"
          className="h-8 flex-1"
          onChange={(event) => setSearchValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              moveResult(-1)
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              moveResult(1)
            }
            if (event.key === 'Enter') openResult(activeResultIndex)
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!searchResults.length}
          onClick={() => openResult(activeResultIndex)}
        >
          查找
        </Button>
        <span className="w-36 text-sm text-muted-foreground">
          {resultCounterText}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-background">
        <div className="sticky top-0 grid grid-cols-[minmax(180px,1fr)_140px_minmax(240px,1.2fr)] border-b border-border bg-muted text-xs font-semibold text-foreground">
          <div className="border-r border-border px-3 py-2">名称</div>
          <div className="border-r border-border px-3 py-2">类型</div>
          <div className="px-3 py-2">所在层级</div>
        </div>
        {searchResults.length ? (
          searchResults.map((result, index) => (
            <button
              key={result.key}
              type="button"
              className={`grid w-full grid-cols-[minmax(180px,1fr)_140px_minmax(240px,1.2fr)] border-b border-border text-left text-sm hover:bg-accent ${
                index === activeResultIndex ? 'bg-accent' : 'bg-background'
              }`}
              onMouseEnter={() => setActiveResultIndex(index)}
              onClick={() => openResult(index)}
            >
              <span className="truncate border-r border-border px-3 py-2 font-medium">
                {result.name}
              </span>
              <span className="truncate border-r border-border px-3 py-2 text-muted-foreground">
                {result.type}
              </span>
              <span className="truncate px-3 py-2 text-muted-foreground">
                {result.path}
              </span>
            </button>
          ))
        ) : (
          <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">
            {searchValue.trim() ? '没有匹配结果' : '输入搜索字符串开始查找'}
          </div>
        )}
      </div>
    </div>
  )
}

export { SearchPanel }
