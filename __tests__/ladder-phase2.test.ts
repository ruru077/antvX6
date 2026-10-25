import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import { LAD_EXAMPLES } from '../src/ladder/examples'
import FunctionMonitor from '../src/ladder/FunctionMonitor'
import LadderCanvas, { measureElement } from '../src/ladder/LadderCanvas'
import {
  cloneProgram,
  demoProgram,
  duplicateNetwork,
  functionBlocks,
  functionalElement,
  insertElement,
  renameVariable,
  prepareLoadedProgram,
  validateProgram,
} from '../src/ladder/model'
import type { LadProgram, LadSnapshot } from '../src/ladder/model'

const example = (id: string) =>
  LAD_EXAMPLES.find((entry) => entry.id === id)!.create()
describe('loading untrusted model JSON leaves the current document intact', () => {
  for (const malformed of [
    null,
    [],
    true,
    { schemaVersion: 2 },
    { kind: 'ladder', schemaVersion: 2, variables: {}, networks: [] },
  ]) {
    it(
      'reports invalid top-level data without throwing a TypeError: ' +
        JSON.stringify(malformed),
      () => {
        expect(validateProgram(malformed).length).toBeGreaterThan(0)
        expect(() => prepareLoadedProgram(malformed)).toThrow('模型数据错误')
      },
    )
  }
  it('rejects malformed entries, children and coils with bounded diagnostics', () => {
    for (const mutate of [
      (p: any) => {
        p.variables[0] = null
      },
      (p: any) => {
        p.networks[0] = false
      },
      (p: any) => {
        p.networks[0].condition = null
      },
      (p: any) => {
        p.networks[0].condition.children = { broken: true }
      },
      (p: any) => {
        p.networks[0].condition.children = [null]
      },
      (p: any) => {
        p.networks[0].coil = null
      },
    ]) {
      const program = example('ton')
      mutate(program)
      expect(validateProgram(program).length).toBeGreaterThan(0)
      expect(() => prepareLoadedProgram(program)).toThrow('当前文档未被替换')
    }
  })
  it('rejects implicit type coercion in names, IDs, BOOL flags and instance names', () => {
    for (const mutate of [
      (p: any) => {
        p.variables[0].name = true
      },
      (p: any) => {
        p.networks[0].id = 123
      },
      (p: any) => {
        p.networks[0].condition.children[0].negated = 'false'
      },
      (p: any) => {
        p.networks[0].coil.negated = 0
      },
      (p: any) => {
        p.networks[0].condition.children[1].instance = true
      },
      (p: any) => {
        p.networks[0].coil.mode = null
      },
    ]) {
      const program = example('ton')
      mutate(program)
      expect(validateProgram(program).length).toBeGreaterThan(0)
    }
  })
  it('normalizes an omitted optional comment on a clone and preserves the program version', () => {
    const original = demoProgram()
    delete (original.networks[0] as unknown as { label?: string }).label
    const prepared = prepareLoadedProgram(original)
    expect(prepared.schemaVersion).toBe(1)
    expect(prepared.networks[0].label).toBe('')
    expect(original.networks[0].label).toBeUndefined()
  })
  it('does not replace or mutate the existing document when loading fails', () => {
    let current = demoProgram()
    const saved = JSON.stringify(current)
    expect(() => {
      current = prepareLoadedProgram({ schemaVersion: 2, networks: [] })
    }).toThrow('模型数据错误')
    expect(JSON.stringify(current)).toBe(saved)
  })
})

describe('LAD v1/v2 authoring compatibility', () => {
  it('keeps existing self-hold and ordinary edits in v1', () => {
    const program = demoProgram()
    program.networks[0].label = 'changed'
    expect(renameVariable(program, 'Start', 'StartButton').schemaVersion).toBe(
      1,
    )
    expect(validateProgram(program)).toEqual([])
  })
  for (const item of LAD_EXAMPLES) {
    it('validates the teaching example ' + item.title, () => {
      const program = item.create()
      expect(validateProgram(program)).toEqual([])
      expect(item.steps.length).toBeGreaterThan(2)
      expect(program.schemaVersion).toBe(item.id === 'self-hold' ? 1 : 2)
    })
  }
  it('rejects unknown versions, and new instructions disguised as v1', () => {
    const program = example('ton')
    program.schemaVersion = 1
    expect(
      validateProgram(program).some((issue) => issue.path.endsWith('.type')),
    ).toBe(true)
    const sr = example('set-reset')
    sr.schemaVersion = 1
    expect(
      validateProgram(sr).filter((issue) => issue.path.endsWith('.mode'))
        .length,
    ).toBe(2)
    const unknown = JSON.parse(JSON.stringify(demoProgram())) as LadProgram
    ;(unknown as unknown as { schemaVersion: number }).schemaVersion = 99
    expect(validateProgram(unknown)[0].path).toBe('schemaVersion')
  })
  it('validates one S and one R for the same output but rejects normal mixing or duplicate S', () => {
    const sr = example('set-reset')
    expect(validateProgram(sr)).toEqual([])
    sr.networks[1].coil.mode = 'set'
    expect(
      validateProgram(sr).some((issue) => issue.message.includes('重复使用 S')),
    ).toBe(true)
    sr.networks[1].coil.mode = 'normal'
    expect(
      validateProgram(sr).some((issue) => issue.message.includes('混写')),
    ).toBe(true)
    sr.networks[1].coil.mode = 'reset'
    sr.networks[0].coil.negated = true
    expect(
      validateProgram(sr).some((issue) => issue.message.includes('同时求反')),
    ).toBe(true)
  })
  it('rejects duplicate R regardless of network order', () => {
    const sr = example('set-reset')
    sr.networks[0].coil.mode = 'reset'
    expect(
      validateProgram(sr).some((issue) => issue.message.includes('重复使用 R')),
    ).toBe(true)
  })
  it('allows valid timer boundaries and rejects fractional, negative and excessive PT', () => {
    const program = example('ton'),
      timer = functionBlocks(program)[0]
    for (const pt of [0, 250, 86400000]) {
      timer.presetMs = pt
      expect(validateProgram(program)).toEqual([])
    }
    for (const pt of [-1, 1.5, 86400001]) {
      timer.presetMs = pt
      expect(
        validateProgram(program).some((issue) =>
          issue.path.endsWith('.presetMs'),
        ),
      ).toBe(true)
    }
  })
  it('validates counter WORD bounds and declared control variables', () => {
    const program = example('ctu'),
      counter = functionBlocks(program)[0]
    for (const pv of [0, 65535]) {
      counter.preset = pv
      expect(validateProgram(program)).toEqual([])
    }
    for (const pv of [-1, 1.5, 65536]) {
      counter.preset = pv
      expect(
        validateProgram(program).some((issue) =>
          issue.path.endsWith('.preset'),
        ),
      ).toBe(true)
    }
    counter.preset = 3
    counter.controlVariable = 'missing'
    expect(
      validateProgram(program).some((issue) =>
        issue.path.endsWith('.controlVariable'),
      ),
    ).toBe(true)
  })
  it('renames counter RESET/LOAD references together with BOOL declarations', () => {
    for (const [key, from] of [
      ['ctu', 'Reset'],
      ['ctd', 'Load'],
    ]) {
      const original = example(key),
        renamed = renameVariable(original, from, 'Control')
      expect(functionBlocks(renamed)[0].controlVariable).toBe('Control')
      expect(validateProgram(renamed)).toEqual([])
      expect(functionBlocks(original)[0].controlVariable).toBe(from)
    }
  })
  it('keeps instance and BOOL namespaces disjoint', () => {
    const program = example('ton'),
      timer = functionBlocks(program)[0]
    expect(() => renameVariable(program, 'Enable', timer.instance!)).toThrow(
      '实例',
    )
    timer.instance = 'Enable'
    expect(
      validateProgram(program).some((issue) =>
        issue.path.endsWith('.instance'),
      ),
    ).toBe(true)
    timer.instance = 'bad-name'
    expect(
      validateProgram(program).some((issue) =>
        issue.path.endsWith('.instance'),
      ),
    ).toBe(true)
  })
  it('auto-names newly inserted blocks and every copied instance without sharing state', () => {
    const program = example('timer-comparison'),
      first = program.networks[0]
    const existing = functionBlocks(program).map((block) => block.instance)
    expect(new Set(existing).size).toBe(3)
    expect(functionalElement('TON', program).instance).not.toBe(existing[0])
    program.variables.push({
      name: 'Timer1_2',
      kind: 'memory',
      initialValue: false,
    })
    const duplicate = duplicateNetwork(first, program)
    const copied = duplicate.condition.children!.find(
      (block) => block.type === 'timer',
    )!
    expect(existing).not.toContain(copied.instance)
    expect(copied.instance).not.toBe('Timer1_2')
    expect(copied.presetMs).toBe(300)
    expect(duplicate.coil.variable).toBe('')
  })
  it('does not leak function parameters onto groups when wrapping a block in parallel', () => {
    const program = example('ton'),
      network = program.networks[0],
      timer = functionBlocks(program)[0]
    insertElement(
      network,
      timer.id,
      functionalElement('TOF', program),
      'parallel',
    )
    const parallel = network.condition.children![1]
    expect(parallel.type).toBe('parallel')
    expect(JSON.parse(JSON.stringify(parallel)).instance).toBeUndefined()
    expect(parallel.children![0].instance).toBe('Timer1')
    expect(validateProgram(program)).toEqual([])
  })
  it('detects duplicate instances across separate networks and modes', () => {
    const program = example('timer-comparison'),
      blocks = functionBlocks(program)
    blocks[1].instance = blocks[0].instance
    expect(
      validateProgram(program).some((issue) =>
        issue.path.endsWith('.instance'),
      ),
    ).toBe(true)
  })
})

describe('LAD function-block display uses server state only', () => {
  it('reserves enough space for parameters and independent status on every function block', () => {
    expect(measureElement(functionBlocks(example('ton'))[0])).toEqual({
      width: 188,
      height: 148,
    })
    expect(measureElement(example('ton').networks[0].condition)).toEqual({
      width: 312,
      height: 148,
    })
  })
  it('displays server ET/Q and control pin names in the diagram', () => {
    const program = example('ton'),
      block = functionBlocks(program)[0]
    const snapshot: LadSnapshot = {
      scanIndex: 2,
      timeMs: 200,
      variables: { Enable: true, Lamp: false },
      trace: { [block.id]: false },
      outputs: { Lamp: false },
      states: {
        [block.instance!]: {
          kind: 'timer',
          mode: 'TON',
          input: true,
          q: false,
          etMs: 123,
        },
      },
    }
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('aria-label="TON Timer1"')
    expect(html).toContain('PT 300 ms')
    expect(html).toContain('ET 123 ms · Q FALSE')
    expect(html).not.toContain('ET 100 ms')
  })
  it('shows initialized CTD Q from server without pretending its output coil has scanned', () => {
    const program = example('ctd'),
      block = functionBlocks(program)[0]
    const snapshot: LadSnapshot = {
      scanIndex: 0,
      timeMs: 0,
      variables: { Pulse: false, Load: false, Lamp: false },
      trace: {},
      outputs: { Lamp: false },
      states: {
        [block.instance!]: {
          kind: 'counter',
          mode: 'CTD',
          input: false,
          q: true,
          cv: 0,
        },
      },
    }
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('LOAD: Load')
    expect(html).toContain('CV 0 · Q TRUE')
    expect(html).toContain('>—</text>')
    const monitor = renderToStaticMarkup(
      createElement(FunctionMonitor, {
        elements: functionBlocks(program),
        snapshot,
        onSelect: () => {},
      }),
    )
    expect(monitor).toContain('TRUE')
  })
  it('does not invent timer progress before any server snapshot', () => {
    const program = example('ton')
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot: null,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('ET — ms · Q —')
    expect(html).not.toContain('ET 0 ms')
  })
  it('draws S/R letters and exposes clear accessible coil names', () => {
    const program = example('set-reset')
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot: null,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('aria-label="置位线圈 S Lamp"')
    expect(html).toContain('aria-label="复位线圈 R Lamp"')
    expect(html).toContain('>S</text>')
    expect(html).toContain('>R</text>')
  })
})
