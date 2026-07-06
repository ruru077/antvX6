import { Button, InputNumber, Segmented, Slider, Switch } from 'antd'
import { useEffect } from 'react'
import { routeAllEdges } from '@/services/avoid-routing-service'
import { useGraphStore } from '@/store/graphStore'
import type { RouteDemoOptions, RouteEngine } from '@/store/routeDemoStore'
import { useRouteDemoStore } from '@/store/routeDemoStore'

const AVOID_ENGINES: RouteEngine[] = ['obstacle', 'avoid']
const X6_ENGINES: RouteEngine[] = ['orth', 'manhattan']
const ALL_ROUTING_ENGINES: RouteEngine[] = [
  'obstacle',
  'avoid',
  'orth',
  'manhattan',
]

type NumberOption = {
  key: keyof Pick<
    RouteDemoOptions,
    | 'edgeToNodeGap'
    | 'edgeToEdgeGap'
    | 'stubSize'
    | 'segmentPenalty'
    | 'anglePenalty'
    | 'simulinkCrossingPenalty'
    | 'reverseDirectionPenalty'
    | 'portDirectionPenalty'
    | 'gridSize'
    | 'gapSize'
    | 'cornerRadius'
    | 'x6RouterPadding'
    | 'x6RouterStep'
    | 'x6RouterMaxLoopCount'
    | 'x6RouterPrecision'
    | 'x6RouterMaxDirectionChange'
  >
  label: string
  min: number
  max: number
  step?: number
  engines?: RouteEngine[]
}

type BooleanOption = {
  key: keyof Pick<
    RouteDemoOptions,
    'x6RouterPerpendicular' | 'x6RouterSnapToGrid'
  >
  label: string
  engines: RouteEngine[]
}

const NUMBER_OPTIONS: NumberOption[] = [
  {
    key: 'edgeToNodeGap',
    label: 'Edge-node gap',
    min: 0,
    max: 64,
    engines: AVOID_ENGINES,
  },
  {
    key: 'edgeToEdgeGap',
    label: 'Edge-edge gap',
    min: 0,
    max: 48,
    engines: AVOID_ENGINES,
  },
  {
    key: 'stubSize',
    label: 'Stub size',
    min: 0,
    max: 100,
    engines: AVOID_ENGINES,
  },
  {
    key: 'segmentPenalty',
    label: 'Segment penalty',
    min: 0,
    max: 80,
    engines: AVOID_ENGINES,
  },
  {
    key: 'anglePenalty',
    label: 'Angle penalty',
    min: 0,
    max: 80,
    engines: AVOID_ENGINES,
  },
  {
    key: 'simulinkCrossingPenalty',
    label: 'Crossing penalty',
    min: 0,
    max: 5000,
    step: 50,
    engines: ['avoid'],
  },
  {
    key: 'reverseDirectionPenalty',
    label: 'Reverse penalty',
    min: 0,
    max: 200,
    engines: AVOID_ENGINES,
  },
  {
    key: 'portDirectionPenalty',
    label: 'Port penalty',
    min: 0,
    max: 300,
    engines: AVOID_ENGINES,
  },
  {
    key: 'gridSize',
    label: 'Grid snap',
    min: 0,
    max: 40,
    engines: AVOID_ENGINES,
  },
  {
    key: 'x6RouterPadding',
    label: 'Padding',
    min: 0,
    max: 100,
    engines: X6_ENGINES,
  },
  {
    key: 'x6RouterStep',
    label: 'Step',
    min: 1,
    max: 80,
    engines: ['manhattan'],
  },
  {
    key: 'x6RouterMaxLoopCount',
    label: 'Max loops',
    min: 100,
    max: 10000,
    step: 100,
    engines: ['manhattan'],
  },
  {
    key: 'x6RouterPrecision',
    label: 'Precision',
    min: 0,
    max: 5,
    engines: ['manhattan'],
  },
  {
    key: 'x6RouterMaxDirectionChange',
    label: 'Max direction change',
    min: 45,
    max: 180,
    step: 45,
    engines: ['manhattan'],
  },
  {
    key: 'gapSize',
    label: 'Jump gap',
    min: 0,
    max: 12,
    step: 0.5,
    engines: ALL_ROUTING_ENGINES,
  },
  {
    key: 'cornerRadius',
    label: 'Corner radius',
    min: 0,
    max: 16,
    engines: ALL_ROUTING_ENGINES,
  },
]

const BOOLEAN_OPTIONS: BooleanOption[] = [
  {
    key: 'x6RouterPerpendicular',
    label: 'Perpendicular',
    engines: ['manhattan'],
  },
  {
    key: 'x6RouterSnapToGrid',
    label: 'Snap to grid',
    engines: ['manhattan'],
  },
]

function RoutingDemoPanel() {
  const graph = useGraphStore((state) => state.graph)
  const { engine, realtime, setEngine, setOption, ...options } =
    useRouteDemoStore()

  useEffect(() => {
    if (!graph) return
    void routeAllEdges(graph)
  }, [graph, options.revision])

  const getSliderMin = (item: NumberOption) =>
    engine === 'avoid' && item.key === 'segmentPenalty' ? 1 : item.min

  return (
    <div className="routing-demo-panel">
      <div className="routing-demo-panel__header">
        <span>Route Obstacle 待实现交叉惩罚</span>
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
          { label: 'Avoid', value: 'avoid' },
          { label: 'Orth', value: 'orth' },
          { label: 'Manhattan', value: 'manhattan' },
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
        {BOOLEAN_OPTIONS.filter((item) => item.engines.includes(engine)).map(
          (item) => (
            <label className="routing-demo-panel__toggle" key={item.key}>
              <span>{item.label}</span>
              <Switch
                size="small"
                checked={options[item.key]}
                onChange={(checked) => setOption(item.key, checked)}
              />
            </label>
          ),
        )}
      </div>
      <div className="routing-demo-panel__fields">
        {NUMBER_OPTIONS.filter((item) =>
          (item.engines ?? ALL_ROUTING_ENGINES).includes(engine),
        ).map((item) => (
          <label className="routing-demo-panel__field" key={item.key}>
            <span>{item.label}</span>
            <Slider
              min={getSliderMin(item)}
              max={item.max}
              step={item.step ?? 1}
              value={options[item.key]}
              onChange={(value) => setOption(item.key, value)}
            />
            <InputNumber
              size="small"
              min={getSliderMin(item)}
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
