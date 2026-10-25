import { describe, expect, it } from 'vite-plus/test'
import { scopeSeriesDisplay } from '../src/components/scope-series'

const time = [0, 0.1, 0.2, 0.3, 0.4]

describe('Scope sample-and-hold rendering', () => {
  it('keeps short LAD pulses at their actual sample times even with a larger display interval', () => {
    const pulse = [0, 1, 0, 1, 0]
    expect(
      scopeSeriesDisplay({ time, sampleHold: true }, pulse, 0.3, true, null),
    ).toEqual({ time, data: pulse, step: 'end' })
  })

  it('keeps the existing line and sampling behavior for unmarked and continuous scopes', () => {
    for (const sampleHold of [undefined, false]) {
      expect(
        scopeSeriesDisplay({ time, sampleHold }, time, 0.3, true, null),
      ).toEqual({ time: [0, 0.3, 0.4], data: [0, 0.3, 0.4], step: false })
    }
  })

  it('renders mixed LAD and plant comparisons independently', () => {
    const sources = [
      { time, sampleHold: true, data: [0, 0, 0, 1, 1] },
      { time, data: [0, 0, 0, 0, 0.1] },
    ]
    const series = sources.map((scope) =>
      scopeSeriesDisplay(scope, scope.data, 0.3, true, null),
    )
    expect(series.map((item) => item.step)).toEqual(['end', false])
    expect(series.map((item) => item.time.length)).toEqual([5, 3])
  })

  it('honors an explicit user display override in either direction', () => {
    expect(
      scopeSeriesDisplay({ time, sampleHold: true }, time, 0.3, true, false)
        .step,
    ).toBe(false)
    expect(scopeSeriesDisplay({ time }, time, 0.3, true, true)).toEqual({
      time,
      data: time,
      step: 'end',
    })
  })

  it('keeps empty and single-sample continuous results well formed', () => {
    expect(scopeSeriesDisplay({ time: [] }, [], 0.3, true, null)).toEqual({
      time: [],
      data: [],
      step: false,
    })
    expect(scopeSeriesDisplay({ time: [0] }, [1], 0.3, true, null)).toEqual({
      time: [0],
      data: [1],
      step: false,
    })
  })

  it('does not rewrite raw result timestamps or values when display sampling changes', () => {
    const result = {
      time: [0, 0.1, 0.2, 0.3, 0.4],
      data: [0, 0, 0, 1, 1],
      sampleHold: true,
    }
    const original = structuredClone(result)
    Object.freeze(result.time)
    Object.freeze(result.data)
    Object.freeze(result)
    for (const override of [null, true, false]) {
      scopeSeriesDisplay(result, result.data, 0.3, true, override)
      scopeSeriesDisplay(result, result.data, 0.3, false, override)
    }
    expect(result).toEqual(original)
    const displayed = scopeSeriesDisplay(result, result.data, 0.3, true, null)
    // The default held view also supplies every original pair to the existing CSV export.
    expect(
      displayed.time.map((t, index) => [t, displayed.data[index]]),
    ).toEqual(original.time.map((t, index) => [t, original.data[index]]))
  })
})
