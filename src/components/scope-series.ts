import type { ScopeResult } from '@/api/simulation'

/** Preserve every held-signal transition unless the user explicitly chooses a line. */
export function scopeSeriesDisplay(
  scope: Pick<ScopeResult, 'time' | 'sampleHold'>,
  signal: number[],
  samplingInterval: number,
  allowSampling: boolean,
  stepOverride: boolean | null,
) {
  const held = stepOverride ?? scope.sampleHold === true
  if (held || !allowSampling)
    return {
      time: scope.time,
      data: signal,
      step: held ? ('end' as const) : (false as const),
    }

  const count = Math.min(scope.time.length, signal.length)
  const indices = count ? [0] : []
  let lastTime = scope.time[0]
  for (let index = 1; index < count - 1; index += 1) {
    if (
      scope.time[index] - lastTime <
      samplingInterval - samplingInterval * 1e-9
    )
      continue
    indices.push(index)
    lastTime = scope.time[index]
  }
  if (count > 1) indices.push(count - 1)
  return {
    time: indices.map((index) => scope.time[index]),
    data: indices.map((index) => signal[index]),
    step: false as const,
  }
}
