import { Button, InputNumber, Segmented, Slider, Switch } from 'antd'
import { routeAllEdges } from '@/services/avoid-routing-service'
import { useGraphStore } from '@/store/graphStore'
import type { RouteDemoOptions, RouteEngine } from '@/store/routeDemoStore'
import { useRouteDemoStore } from '@/store/routeDemoStore'

type NumberOption = {
  key: keyof Pick<
    RouteDemoOptions,
    | 'edgeToNodeGap'
    | 'edgeToEdgeGap'
    | 'stubSize'
    | 'segmentPenalty'
    | 'anglePenalty'
    | 'reverseDirectionPenalty'
    | 'portDirectionPenalty'
    | 'gridSize'
    | 'gapSize'
    | 'cornerRadius'
  >
  label: string
  min: number
  max: number
  step?: number
}

const NUMBER_OPTIONS: NumberOption[] = [
  { key: 'edgeToNodeGap', label: 'Edge-node gap', min: 0, max: 64 },
  { key: 'edgeToEdgeGap', label: 'Edge-edge gap', min: 0, max: 48 },
  { key: 'stubSize', label: 'Stub size', min: 0, max: 100 },
  { key: 'segmentPenalty', label: 'Segment penalty', min: 0, max: 80 },
  { key: 'anglePenalty', label: 'Angle penalty', min: 0, max: 80 },
  {
    key: 'reverseDirectionPenalty',
    label: 'Reverse penalty',
    min: 0,
    max: 200,
  },
  { key: 'portDirectionPenalty', label: 'Port penalty', min: 0, max: 300 },
  { key: 'gridSize', label: 'Grid snap', min: 0, max: 40 },
  { key: 'gapSize', label: 'Jump gap', min: 0, max: 12, step: 0.5 },
  { key: 'cornerRadius', label: 'Corner radius', min: 0, max: 16 },
]

function RoutingDemoPanel() {
  const graph = useGraphStore((state) => state.graph)
  const { engine, realtime, setEngine, setOption, ...options } =
    useRouteDemoStore()

  useEffect(() => {
    if (!graph) return
    void routeAllEdges(graph)
  }, [graph, options.revision])

  return (
    <div className="routing-demo-panel">
      <div className="routing-demo-panel__header">
        <span>Routing Demo</span>
        <Button size="small" onClick={() => graph && void routeAllEdges(graph)}>
          Route
        </Button>
      </div>
      <Segmented
        block
        size="small"
        value={engine}
        options={[
          { label: 'Off', value: 'off' },
          { label: 'Obstacle', value: 'obstacle' },
        ]}
        onChange={(value) => setEngine(value as RouteEngine)}
      />
      <div className="routing-demo-panel__toggles">
        <label className="routing-demo-panel__toggle">
          <span>Realtime</span>
          <Switch
            size="small"
            checked={realtime}
            onChange={(checked) => setOption('realtime', checked)}
          />
        </label>
      </div>
      <div className="routing-demo-panel__fields">
        {NUMBER_OPTIONS.map((item) => (
          <label className="routing-demo-panel__field" key={item.key}>
            <span>{item.label}</span>
            <Slider
              min={item.min}
              max={item.max}
              step={item.step ?? 1}
              value={options[item.key]}
              onChange={(value) => setOption(item.key, value)}
            />
            <InputNumber
              size="small"
              min={item.min}
              max={item.max}
              step={item.step ?? 1}
              value={options[item.key]}
              onChange={(value) => setOption(item.key, value ?? 0)}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

export { RoutingDemoPanel }
