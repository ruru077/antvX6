import {
  ApartmentOutlined,
  LineChartOutlined,
  SisternodeOutlined,
} from '@ant-design/icons'
import { Splitter, Tree } from 'antd'
import { useShallow } from 'zustand/shallow'
import { ScopeComparisonChart } from '@/components/ScopeChart'
import { focusCellInSubGraph } from '@/services/graph-navigation-service'
import { useSimulationStore } from '@/store/simulationStore'
import { useSubGraphStore } from '@/store/subGraphStore'
import type { ScopeResult } from '@/api/simulation'
import type { TreeDataNode } from 'antd'
import type { GraphJSON, SubGraphMap } from '~/types'

type GraphJsonCell = GraphJSON['cells'][number] & {
  id?: string
  shape?: string
  attrs?: { label?: { text?: unknown } }
  data?: { blockType?: unknown; title?: unknown }
}

interface ScopeItem {
  graphId: string
  cellId: string
  name: string
}

function getScopeName(cell: GraphJsonCell) {
  const label = cell.attrs?.label?.text
  const title = cell.data?.title
  if (typeof label === 'string' && label.trim()) return label.trim()
  if (typeof title === 'string' && title.trim()) return title.trim()
  return cell.id as string
}

function getLayerScopes(subGraphs: SubGraphMap, graphId: string): ScopeItem[] {
  return ((subGraphs[graphId]?.graphJson.cells ?? []) as GraphJsonCell[])
    .filter(
      (cell) =>
        cell.shape !== 'edge' &&
        cell.id &&
        String(cell.data?.blockType ?? '').toLowerCase() === 'scope',
    )
    .map((cell) => ({
      graphId,
      cellId: cell.id as string,
      name: getScopeName(cell),
    }))
}

function buildScopeTree(
  subGraphs: SubGraphMap,
  graphId: string,
  rootId: string,
): TreeDataNode {
  const layer = subGraphs[graphId]
  const scopes = getLayerScopes(subGraphs, graphId)
  return {
    key: `graph:${graphId}`,
    title: `${graphId === rootId ? rootId : layer.name} (${scopes.length})`,
    icon: graphId === rootId ? <ApartmentOutlined /> : <SisternodeOutlined />,
    checkable: false,
    children: [
      ...scopes.map((scope) => ({
        key: `scope:${scope.graphId}:${scope.cellId}`,
        title: scope.name,
        icon: <LineChartOutlined />,
        isLeaf: true,
      })),
      ...layer.childrenIds.map((id) => buildScopeTree(subGraphs, id, rootId)),
    ],
  }
}

function collectScopes(subGraphs: SubGraphMap, graphId: string): ScopeItem[] {
  const layer = subGraphs[graphId]
  if (!layer) return []
  return [
    ...getLayerScopes(subGraphs, graphId),
    ...layer.childrenIds.flatMap((id) => collectScopes(subGraphs, id)),
  ]
}

function findScopeResult(
  results: ScopeResult[],
  scopeId: string,
): ScopeResult | null {
  return (
    results.find((scope) => scope.uuid === scopeId) ??
    results.find((scope) => scope.path === scopeId) ??
    null
  )
}

function SignalAnalysisPanel() {
  const { rootId, subGraphs } = useSubGraphStore(
    useShallow((state) => ({
      rootId: state.rootId,
      subGraphs: state.subGraphs,
    })),
  )
  const results = useSimulationStore((state) => state.results)
  const scopes = useMemo(
    () => collectScopes(subGraphs, rootId),
    [rootId, subGraphs],
  )
  const treeData = useMemo(
    () =>
      subGraphs[rootId] ? [buildScopeTree(subGraphs, rootId, rootId)] : [],
    [rootId, subGraphs],
  )
  const [selectedScopeKeys, setSelectedScopeKeys] = useState<string[]>([])
  const selectedScopes = scopes.filter((scope) =>
    selectedScopeKeys.includes(`scope:${scope.graphId}:${scope.cellId}`),
  )
  const chartScopes = selectedScopes.flatMap((scope) => {
    const result = findScopeResult(results?.scopes ?? [], scope.cellId)
    return result
      ? [
          {
            key: `${scope.graphId}:${scope.cellId}`,
            name: scope.name,
            scope: result,
          },
        ]
      : []
  })

  function selectScope(scope: ScopeItem) {
    focusCellInSubGraph(scope.graphId, scope.cellId)
  }

  return (
    <Splitter
      orientation="horizontal"
      className="min-h-0 flex-1 bg-background"
      classNames={{ dragger: 'diagram-splitter-dragger' }}
    >
      <Splitter.Panel defaultSize="32%" min="20%" max="55%">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-muted px-3 text-sm font-medium text-foreground">
            <span>Scope</span>
            <span className="text-xs font-normal text-muted-foreground">
              共 {scopes.length} 个
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <Tree
              blockNode
              checkable
              checkStrictly
              defaultExpandAll
              showIcon
              showLine
              treeData={treeData}
              checkedKeys={selectedScopeKeys}
              className="min-w-max bg-transparent"
              onCheck={(keys) => {
                const checkedKeys = Array.isArray(keys) ? keys : keys.checked
                setSelectedScopeKeys(
                  checkedKeys
                    .map(String)
                    .filter((key) => key.startsWith('scope:')),
                )
              }}
              onSelect={(_, info) => {
                const key = String(info.node.key)
                if (!key.startsWith('scope:')) return
                const scope = scopes.find(
                  (item) => `scope:${item.graphId}:${item.cellId}` === key,
                )
                if (scope) selectScope(scope)
              }}
            />
          </div>
        </div>
      </Splitter.Panel>

      <Splitter.Panel min="35%">
        <div className="flex h-full min-h-0 flex-col gap-2 p-2">
          <div className="min-h-0 flex-1">
            {chartScopes.length ? (
              <ScopeComparisonChart scopes={chartScopes} />
            ) : (
              <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                {selectedScopes.length
                  ? '所选 Scope 暂无仿真结果，请先运行仿真'
                  : scopes.length
                    ? '请选择需要对比的 Scope 模块'
                    : '当前模型没有 Scope'}
              </div>
            )}
          </div>
        </div>
      </Splitter.Panel>
    </Splitter>
  )
}

export { SignalAnalysisPanel }
