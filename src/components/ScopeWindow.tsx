import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useMemo, useRef } from 'react'
import { FloatingWindow } from '@/components/ui/floating-window'
import { useSimulationStore } from '@/store/simulationStore'
import type { ScopeResult } from '@/api/simulation'

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2']

echarts.use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
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

function ScopeChart({ scope }: { scope: ScopeResult }) {
  const series = useMemo(() => getSeries(scope), [scope])
  const chartRef = useRef<HTMLDivElement>(null)
  const hasData = scope.time.length > 0 && series.length > 0

  useEffect(() => {
    if (!hasData || !chartRef.current) return

    const chartElement = chartRef.current
    const chart = echarts.init(chartElement)
    const textColor = getComputedStyle(chartElement).color

    chart.setOption({
      animation: false,
      color: COLORS,
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        top: 0,
        textStyle: {
          color: textColor,
        },
      },
      grid: {
        left: 64,
        right: 24,
        top: 44,
        bottom: 68,
      },
      xAxis: {
        type: 'value',
        name: '时间 (s)',
        min: 'dataMin',
        max: 'dataMax',
        axisLabel: {
          color: textColor,
        },
        axisLine: {
          lineStyle: {
            color: textColor,
          },
        },
        nameTextStyle: {
          color: textColor,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(128, 128, 128, 0.18)',
          },
        },
      },
      yAxis: {
        type: 'value',
        name: '值',
        scale: true,
        axisLabel: {
          color: textColor,
        },
        nameTextStyle: {
          color: textColor,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(128, 128, 128, 0.18)',
          },
        },
      },
      dataZoom: [
        {
          type: 'inside',
        },
        {
          type: 'slider',
          height: 20,
          bottom: 14,
        },
      ],
      series: series.map((values, index) => ({
        name: `通道 ${index + 1}`,
        type: 'line',
        showSymbol: false,
        sampling: 'lttb',
        data: values.map((value, timeIndex) => [scope.time[timeIndex], value]),
      })),
    })

    const resizeObserver = new ResizeObserver(() => chart.resize())
    resizeObserver.observe(chartElement)

    return () => {
      resizeObserver.disconnect()
      chart.dispose()
    }
  }, [hasData, scope.time, series])

  if (!hasData) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        暂无仿真数据，请先运行仿真
      </div>
    )
  }

  return (
    <div
      ref={chartRef}
      className="h-full min-h-0 w-full rounded-lg border bg-background text-foreground"
      role="img"
      aria-label={scope.name ?? 'Scope 仿真曲线'}
    />
  )
}

function ScopeWindow() {
  const selectedScopeId = useSimulationStore((state) => state.selectedScopeId)
  const results = useSimulationStore((state) => state.results)
  const closeScope = useSimulationStore((state) => state.closeScope)
  const scope = useMemo(() => {
    if (!results || !selectedScopeId) return null
    return (
      results.scopes.find((item) => item.uuid === selectedScopeId) ??
      results.scopes.find((item) => item.path === selectedScopeId) ??
      (results.scopes.length === 1 ? results.scopes[0] : null)
    )
  }, [results, selectedScopeId])

  if (!selectedScopeId) return null

  return (
    <FloatingWindow
      title={scope?.name ?? 'Scope'}
      defaultWidth={820}
      defaultHeight={560}
      minWidth={520}
      minHeight={360}
      onClose={closeScope}
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

export { ScopeWindow }
