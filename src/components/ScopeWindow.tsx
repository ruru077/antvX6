import { ChartNoAxesCombinedIcon } from 'lucide-react'
import { ScopeChart } from '@/components/ScopeChart'
import { FloatingWindow } from '@/components/ui/floating-window'
import { useGraphStore } from '@/store/graphStore'
import { useSimulationStore } from '@/store/simulationStore'

function ScopeWindowInstance({ scopeId }: { scopeId: string }) {
  const graph = useGraphStore((state) => state.graph)
  const results = useSimulationStore((state) => state.results)
  const closeScope = useSimulationStore((state) => state.closeScope)
  const [scopeLabel, setScopeLabel] = useState<string>()
  const scope = useMemo(() => {
    if (!results) return null
    return (
      results.scopes.find((item) => item.uuid === scopeId) ??
      results.scopes.find((item) => item.path === scopeId) ??
      (results.scopes.length === 1 ? results.scopes[0] : null)
    )
  }, [results, scopeId])

  useEffect(() => {
    if (!graph) return

    const syncScopeLabel = () => {
      const node = graph.getCellById(scopeId)
      if (!node) return
      setScopeLabel(node.attr<string>('label/text')?.trim() || 'Scope')
    }

    syncScopeLabel()
    graph.on('node:added', syncScopeLabel)
    graph.on('node:change:attrs', syncScopeLabel)
    return () => {
      graph.off('node:added', syncScopeLabel)
      graph.off('node:change:attrs', syncScopeLabel)
    }
  }, [graph, scopeId])

  return (
    <FloatingWindow
      windowId={`scope:${scopeId}`}
      title={scopeLabel ?? 'Scope'}
      taskbarIcon={ChartNoAxesCombinedIcon}
      defaultWidth={720}
      defaultHeight={500}
      minWidth={520}
      minHeight={360}
      onClose={() => closeScope(scopeId)}
    >
      {scope ? (
        <ScopeChart scope={scope} />
      ) : (
        <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          暂无该 Scope 的仿真结果，请先点击仿真
        </div>
      )}
    </FloatingWindow>
  )
}

function ScopeWindow() {
  const openScopeIds = useSimulationStore((state) => state.openScopeIds)

  return openScopeIds.map((scopeId) => (
    <ScopeWindowInstance key={scopeId} scopeId={scopeId} />
  ))
}

export { ScopeWindow }
