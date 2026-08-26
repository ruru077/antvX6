import { Button, InputNumber, Switch, Tooltip } from 'antd'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import {
  CopyIcon,
  FileDownIcon,
  Grid2X2Icon,
  ImageDownIcon,
  RotateCcwIcon,
} from 'lucide-react'
import type { ScopeResult } from '@/api/simulation'
import type { ButtonProps } from 'antd'

echarts.use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
])

function getSeries(scope: ScopeResult): number[][] {
  if (!scope.data.length) return []
  if (Array.isArray(scope.data[0])) {
    const rows = scope.data as number[][]
    const count = Math.max(0, ...rows.map((row) => row.length))
    return Array.from({ length: count }, (_, index) =>
      rows.map((row) => Number(row[index] ?? 0)),
    )
  }

  const flat = scope.data as number[]
  const count = Math.max(1, (scope.width ?? 1) * (scope.height ?? 1))
  return Array.from({ length: count }, (_, index) =>
    scope.time.map((_, timeIndex) =>
      Number(flat[timeIndex * count + index] ?? 0),
    ),
  )
}

interface ScopeChartSource {
  key: string
  name?: string
  scope: ScopeResult
}

type ChartToolbar = false | 'scope' | 'signal-analysis'

interface DataZoomRange {
  start?: number
  end?: number
  startValue?: number
  endValue?: number
}

interface DataZoomEvent extends DataZoomRange {
  batch?: DataZoomRange[]
}

function getSeriesColor(index: number) {
  return `hsl(${(index * 137.508) % 360} 68% 48%)`
}

function getCsvData(time: number[], signal: number[]) {
  const rowCount = Math.min(time.length, signal.length)
  return [
    'Time,Signal',
    ...Array.from(
      { length: rowCount },
      (_, index) => `${time[index]},${signal[index]}`,
    ),
  ].join('\r\n')
}

function sampleSignal(time: number[], signal: number[], step: number) {
  const count = Math.min(time.length, signal.length)
  if (count <= 1) {
    return { time: time.slice(0, count), data: signal.slice(0, count) }
  }

  const indices = [0]
  let lastTime = time[0]
  for (let index = 1; index < count - 1; index += 1) {
    if (time[index] - lastTime < step - step * 1e-9) continue
    indices.push(index)
    lastTime = time[index]
  }
  indices.push(count - 1)

  return {
    time: indices.map((index) => time[index]),
    data: indices.map((index) => signal[index]),
  }
}

function downloadFile(data: BlobPart, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

async function svgToPng(
  svg: string,
  width: number,
  height: number,
  backgroundColor: string,
) {
  const url = URL.createObjectURL(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
  )
  const image = new Image()
  try {
    image.src = url
    await image.decode()
  } finally {
    URL.revokeObjectURL(url)
  }

  const pixelRatio = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * pixelRatio
  canvas.height = height * pixelRatio
  const context = canvas.getContext('2d')
  if (!context) throw new Error('PNG canvas context is required')
  context.scale(pixelRatio, pixelRatio)
  context.fillStyle = backgroundColor
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

function ChartAction({ label, ...props }: ButtonProps & { label: string }) {
  return (
    <Tooltip title={label}>
      <Button size="small" aria-label={label} {...props} />
    </Tooltip>
  )
}

function ScopeCharts({
  sources,
  toolbar = false,
  fileName = 'scope',
}: {
  sources: ScopeChartSource[]
  toolbar?: ChartToolbar
  fileName?: string
}) {
  const [sampleTime, setSampleTime] = useState(0.1)
  const series = useMemo(
    () =>
      sources.flatMap((source) => {
        const values = getSeries(source.scope)
        return values.map((data, index) => {
          const sampled =
            toolbar !== false
              ? sampleSignal(source.scope.time, data, sampleTime)
              : { time: source.scope.time, data }
          return {
            key: `${source.key}:${index}`,
            name: source.name
              ? values.length === 1
                ? source.name
                : `${source.name} · 通道 ${index + 1}`
              : `通道 ${index + 1}`,
            ...sampled,
          }
        })
      }),
    [sampleTime, sources, toolbar],
  )
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<ReturnType<typeof echarts.init> | null>(null)
  const sampleTimeRef = useRef(sampleTime)
  const timeExtentRef = useRef<{ min: number; max: number } | null>(null)
  const snappingDataZoomRef = useRef(false)
  sampleTimeRef.current = sampleTime
  const [showGrid, setShowGrid] = useState(true)
  const [showLegend, setShowLegend] = useState(true)
  const hasData = series.some(
    (item) => item.time.length > 0 && item.data.length > 0,
  )
  const csvData = useMemo(
    () => getCsvData(series[0]?.time ?? [], series[0]?.data ?? []),
    [series],
  )

  useEffect(() => {
    if (!hasData || !chartRef.current) return

    const chartElement = chartRef.current
    const chart = echarts.init(chartElement, undefined, { renderer: 'svg' })
    chartInstanceRef.current = chart
    const handleDataZoom = (event: unknown) => {
      if (
        toolbar === false ||
        snappingDataZoomRef.current ||
        !timeExtentRef.current
      )
        return

      const zoomEvent = event as DataZoomEvent
      const range = zoomEvent.batch?.[0] ?? zoomEvent
      const { min, max } = timeExtentRef.current
      const extent = max - min
      const startValue =
        range.startValue ??
        (range.start === undefined
          ? undefined
          : min + (extent * range.start) / 100)
      const endValue =
        range.endValue ??
        (range.end === undefined ? undefined : min + (extent * range.end) / 100)
      if (startValue === undefined || endValue === undefined) return

      const step = sampleTimeRef.current
      const snap = (value: number) => {
        const snapped = min + Math.round((value - min) / step) * step
        return Math.min(max, Math.max(min, Number(snapped.toFixed(12))))
      }
      const snappedStart = snap(startValue)
      const snappedEnd = snap(endValue)
      const tolerance = step * 1e-6
      if (
        Math.abs(snappedStart - startValue) <= tolerance &&
        Math.abs(snappedEnd - endValue) <= tolerance
      )
        return

      snappingDataZoomRef.current = true
      chart.dispatchAction({
        type: 'dataZoom',
        batch: [
          {
            dataZoomIndex: 0,
            startValue: snappedStart,
            endValue: snappedEnd,
          },
          {
            dataZoomIndex: 1,
            startValue: snappedStart,
            endValue: snappedEnd,
          },
        ],
      })
      queueMicrotask(() => {
        snappingDataZoomRef.current = false
      })
    }
    chart.on('datazoom', handleDataZoom)
    const resizeObserver = new ResizeObserver(() => chart.resize())
    resizeObserver.observe(chartElement)

    return () => {
      resizeObserver.disconnect()
      chart.off('datazoom', handleDataZoom)
      chartInstanceRef.current = null
      chart.dispose()
    }
  }, [hasData, toolbar])

  useEffect(() => {
    const chart = chartInstanceRef.current
    const chartElement = chartRef.current
    if (!chart || !chartElement) return

    const textColor = getComputedStyle(chartElement).color
    const time = series[0]?.time
    timeExtentRef.current =
      toolbar && time?.length
        ? { min: time[0], max: time[time.length - 1] }
        : null

    chart.setOption(
      {
        animation: false,
        color: series.map((_, index) => getSeriesColor(index)),
        tooltip: { trigger: 'axis' },
        legend: { show: showLegend, top: 8, textStyle: { color: textColor } },
        grid: {
          left: 52,
          right: 42,
          top: showLegend ? 50 : 28,
          bottom: 46,
        },
        xAxis: {
          type: 'value',
          name: 'Time(s)',
          nameLocation: 'end',
          nameGap: 8,
          min: 'dataMin',
          max: 'dataMax',
          axisLabel: { color: textColor },
          axisLine: { lineStyle: { color: textColor } },
          nameTextStyle: { color: textColor },
          splitLine: {
            show: showGrid,
            lineStyle: { color: 'rgba(128, 128, 128, 0.18)' },
          },
        },
        yAxis: {
          type: 'value',
          name: 'Signal',
          nameLocation: 'end',
          nameGap: 8,
          nameRotate: 0,
          scale: true,
          axisLabel: { color: textColor },
          axisLine: { show: true, lineStyle: { color: textColor } },
          nameTextStyle: { color: textColor },
          splitLine: {
            show: showGrid,
            lineStyle: { color: 'rgba(128, 128, 128, 0.18)' },
          },
        },
        dataZoom: [
          { type: 'inside' },
          { type: 'slider', height: 16, bottom: 6 },
        ],
        series: series.map((item, index) => {
          const color = getSeriesColor(index)
          return {
            id: item.key,
            name: item.name,
            type: 'line',
            smooth: false,
            showSymbol: false,
            connectNulls: true,
            lineStyle: { color, width: 2, opacity: 1 },
            itemStyle: { color },
            emphasis: { lineStyle: { color, width: 3, opacity: 1 } },
            data: item.data.map((value, timeIndex) => [
              item.time[timeIndex],
              value,
            ]),
          }
        }),
      },
      { replaceMerge: ['series'] },
    )
  }, [series, showGrid, showLegend])

  if (!hasData) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        暂无仿真数据，请先运行仿真
      </div>
    )
  }

  async function downloadPng() {
    const chart = chartInstanceRef.current
    const chartElement = chartRef.current
    if (!chart || !chartElement) return
    const image = await svgToPng(
      chart.renderToSVGString(),
      chart.getWidth(),
      chart.getHeight(),
      getComputedStyle(chartElement).backgroundColor,
    )
    const link = document.createElement('a')
    link.href = image
    link.download = `${fileName}.png`
    link.click()
  }

  function resetZoom() {
    chartInstanceRef.current?.dispatchAction({
      type: 'dataZoom',
      batch: [
        { dataZoomIndex: 0, start: 0, end: 100 },
        { dataZoomIndex: 1, start: 0, end: 100 },
      ],
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {toolbar !== false && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Tooltip title="显示或隐藏图例">
            <div className="flex items-center gap-2 text-sm">
              <span>图例</span>
              <Switch
                size="small"
                checked={showLegend}
                aria-label="显示或隐藏图例"
                onChange={setShowLegend}
              />
            </div>
          </Tooltip>
          <Tooltip title="设置折线显示的采样时间间隔">
            <InputNumber<number>
              size="small"
              min={0.001}
              step={0.01}
              precision={3}
              value={sampleTime}
              addonBefore="采样时间"
              addonAfter="s"
              aria-label="采样时间"
              onChange={(value) => {
                if (value !== null && value > 0) setSampleTime(value)
              }}
            />
          </Tooltip>
          <div className="flex items-center gap-1">
            <ChartAction
              label={showGrid ? '隐藏网格' : '显示网格'}
              type={showGrid ? 'primary' : 'default'}
              aria-pressed={showGrid}
              icon={<Grid2X2Icon size={14} />}
              onClick={() => setShowGrid((visible) => !visible)}
            />
            {toolbar === 'scope' && (
              <ChartAction
                label="下载图片 (PNG)"
                icon={<ImageDownIcon size={14} />}
                onClick={downloadPng}
              />
            )}
            {toolbar === 'signal-analysis' ? (
              <>
                <ChartAction
                  disabled
                  label="下载数据（多数据格式待确认）"
                  icon={<FileDownIcon size={14} />}
                />
                <ChartAction
                  disabled
                  label="复制数据（多数据格式待确认）"
                  icon={<CopyIcon size={14} />}
                />
              </>
            ) : (
              <>
                <ChartAction
                  label="下载数据 (CSV)"
                  icon={<FileDownIcon size={14} />}
                  onClick={() =>
                    downloadFile(
                      csvData,
                      'text/csv;charset=utf-8',
                      `${fileName}.csv`,
                    )
                  }
                />
                <ChartAction
                  label="复制数据"
                  icon={<CopyIcon size={14} />}
                  onClick={() => void navigator.clipboard.writeText(csvData)}
                />
              </>
            )}
            <ChartAction
              label="重置缩放"
              icon={<RotateCcwIcon size={14} />}
              onClick={resetZoom}
            />
          </div>
        </div>
      )}
      <div
        ref={chartRef}
        className="min-h-0 w-full flex-1 bg-background text-foreground"
        role="img"
        aria-label="Scope 仿真折线图"
      />
    </div>
  )
}

function ScopeChart({ scope }: { scope: ScopeResult }) {
  const sources = useMemo(
    () => [{ key: scope.uuid ?? scope.path ?? 'scope', scope }],
    [scope],
  )
  return (
    <ScopeCharts
      sources={sources}
      toolbar="scope"
      fileName={scope.name?.trim() || 'scope'}
    />
  )
}

function ScopeComparisonChart({
  scopes,
}: {
  scopes: { key: string; name: string; scope: ScopeResult }[]
}) {
  return <ScopeCharts sources={scopes} toolbar="signal-analysis" />
}

export { ScopeChart, ScopeComparisonChart }
