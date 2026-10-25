import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vite-plus/test'
import {
  canvasDropZones,
  clientPointToSvg,
  dropTargetKey,
  edgeScrollDelta,
  hitTestCanvasDrop,
  layoutCanvas,
} from '../src/ladder/canvasDrag'
import { canDropLad } from '../src/ladder/drag'
import LadderCanvas, { measureElement } from '../src/ladder/LadderCanvas'
import { blankNetwork, contact, demoProgram, functionalElement } from '../src/ladder/model'
import type { LadSnapshot } from '../src/ladder/model'

describe('LAD SVG layout and server trace presentation', () => {
  it('reserves full height for nested parallel branches instead of overlapping symbols', () => {
    const leaf = contact('Start'),
      branch = {
        id: 'group',
        type: 'parallel' as const,
        children: [leaf, contact('Stop')],
      }
    expect(measureElement(branch)).toEqual({ width: 172, height: 196 })
    const nested = {
      id: 'nested',
      type: 'parallel' as const,
      children: [branch, contact('Start')],
    }
    expect(measureElement(nested)).toEqual({ width: 220, height: 306 })
  })
  it('extends series width and retains the maximum branch height', () => {
    const network = demoProgram().networks[0]
    expect(measureElement(network.condition)).toEqual({
      width: 296,
      height: 196,
    })
  })
  it('draws incoming power blue even when the contact output is false', () => {
    const program = demoProgram(),
      network = blankNetwork()
    program.networks = [network]
    const c = network.condition.children![0]
    const snapshot: LadSnapshot = {
      scanIndex: 1,
      timeMs: 100,
      variables: { Start: false, Motor: false },
      outputs: { Motor: false },
      trace: {
        [c.id]: false,
        [network.condition.id]: false,
        [network.coil.id]: false,
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
    expect(html).toContain('d="M 96 116 H 146" fill="none" stroke="#1769e0"')
    expect(html).toContain('d="M 170 116 H 220" fill="none" stroke="#64748b"')
    expect(html).not.toContain('>TRUE</text>')
  })
  it('never renders object prototype members as energized trace data', () => {
    const program = demoProgram(),
      network = blankNetwork()
    network.condition.children![0].id = 'constructor'
    network.coil.id = '__proto__'
    program.networks = [network]
    const snapshot: LadSnapshot = {
      scanIndex: 0,
      timeMs: 0,
      variables: {},
      outputs: {},
      trace: {},
    }
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot,
        onSelect: () => {},
      }),
    )
    expect(html).not.toContain('>TRUE</text>')
    expect(html).not.toContain('stroke="#1769e0"')
  })
  it('draws a negated coil with deenergized input and energized output separately', () => {
    const program = demoProgram(),
      network = blankNetwork()
    network.coil.negated = true
    program.networks = [network]
    const snapshot: LadSnapshot = {
      scanIndex: 1,
      timeMs: 100,
      variables: { Start: false, Motor: true },
      outputs: { Motor: true },
      trace: { [network.condition.id]: false, [network.coil.id]: true },
    }
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('d="M 636 116 H 663" stroke="#64748b"')
    expect(html).toContain('d="M 689 116 H 756" stroke="#1769e0"')
  })
  it('shows unevaluated trace as a dash after reset even if initial variables are true', () => {
    const program = demoProgram()
    program.variables.forEach((v) => {
      v.initialValue = true
    })
    const snapshot: LadSnapshot = {
      scanIndex: 0,
      timeMs: 0,
      variables: { Start: true, StopPressed: true, Motor: true },
      outputs: { Motor: true },
      trace: {},
    }
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot,
        onSelect: () => {},
      }),
    )
    expect(html).not.toContain('>TRUE</text>')
    expect(html).not.toContain('>FALSE</text>')
    expect(html).toContain('>—</text>')
  })
  it('keeps accessible full names while shortening long diagram labels', () => {
    const program = demoProgram(),
      name = 'this_is_a_long_64_character_variable_name'
    program.networks[0].coil.variable = name
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot: null,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('aria-label="线圈 ' + name + '"')
    expect(html).toContain('<title>' + name + '</title>this_is_a_l…')
  })
})

describe('LAD canvas drag geometry and engineering symbols', () => {
  it('pairs each interactive rect with its own noninteractive hover edge, never a parent group', () => {
    const program = demoProgram()
    program.schemaVersion = 2
    program.networks[0].condition.children!.push(functionalElement('TON', program))
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: null,
        snapshot: null,
        onSelect: () => {},
        onDragStart: () => {},
      }),
    )
    const targets = [...html.matchAll(/<rect\b[^>]*class="[^"]*lad-hover-target[^>]*>[\s\S]*?<\/rect>/g)]
    expect(targets).toHaveLength(8) // Network handle, root, parallel, three contacts, timer, coil.
    expect([...html.matchAll(/<\/rect><rect class="lad-hover-outline"/g)]).toHaveLength(targets.length)
    expect(html).not.toMatch(/<g\b[^>]*class="[^"]*lad-hover-target/)
    const outlines = [...html.matchAll(/<rect class="lad-hover-outline"[^>]*>/g)]
    expect(outlines).toHaveLength(targets.length)
    for (const [outline] of outlines) {
      expect(outline).toContain('fill="none" opacity="0"')
      expect(outline).toContain('pointer-events="none" aria-hidden="true"')
    }
    expect(html).toContain('<title>常开 Start：单击选择；拖动移动。</title>')
    expect(html).toContain('<title>TON Timer1：单击选择；拖动移动。</title>')
    expect(html).toContain('<title>并联支路：单击选择；拖动移动。</title>')
    expect(html).toContain('拖动网络序号可调整顺序。')
    expect(html).toContain('拖入线圈工具可替换类型。')
    expect(html).not.toContain('stroke="#1769e0"')
  })

  it('describes locked targets as view-only without promising drag or replacement actions', () => {
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program: demoProgram(),
        selection: null,
        snapshot: null,
        onSelect: () => {},
        onDragStart: () => {},
        locked: true,
      }),
    )
    expect(html).toContain('常开 Start：单击查看属性；运行中不可移动。')
    expect(html).toContain('运行中不可排序。')
    expect(html).toContain('线圈 Motor：单击查看属性；运行中不可替换。')
    expect(html).not.toContain('拖动移动')
    expect(html).not.toContain('拖动调整')
    expect(html).not.toContain('拖入线圈工具')
    expect(html).toContain('class="lad-hover-outline"')
  })

  it('keeps the old symbol and network coordinates for drop targets', () => {
    const program = demoProgram(),
      network = blankNetwork()
    program.networks = [network]
    const layout = layoutCanvas(program),
      zones = canvasDropZones(program)
    expect(layout.rows[0].y).toBe(116)
    expect(layout.width).toBe(804)
    const before = zones.find(
      (zone) =>
        zone.target.kind === 'element' &&
        zone.target.elementId === network.condition.children![0].id &&
        zone.target.mode === 'before',
    )!
    expect(before.anchor).toEqual({ x: 96, y: 116 })
    const coil = zones.find((zone) => zone.target.kind === 'coil')!
    expect(coil.anchor).toEqual({ x: 676, y: 116 })
    expect(
      zones
        .filter((zone) => zone.target.kind === 'network')
        .map((zone) => zone.target),
    ).toEqual([
      { kind: 'network', index: 0 },
      { kind: 'network', index: 1 },
    ])
  })

  it('resolves shared before/after boundaries deterministically regardless of zone order', () => {
    const program = demoProgram(),
      network = blankNetwork()
    const second = contact('Start')
    network.condition.children!.push(second)
    program.networks = [network]
    const zones = canvasDropZones(program).filter(
      (zone) => zone.target.kind === 'element',
    )
    const expected = {
      kind: 'element',
      networkId: network.id,
      elementId: second.id,
      mode: 'before',
    }
    expect(hitTestCanvasDrop(zones, { x: 220, y: 116 })?.target).toEqual(
      expected,
    )
    expect(
      hitTestCanvasDrop([...zones].reverse(), { x: 220, y: 116 })?.target,
    ).toEqual(expected)
    expect(hitTestCanvasDrop(zones, { x: 96, y: 116 })?.target).toEqual({
      kind: 'element',
      networkId: network.id,
      elementId: network.condition.children![0].id,
      mode: 'before',
    })
    expect(hitTestCanvasDrop(zones, { x: -20, y: 116 })).toBeNull()
    expect(hitTestCanvasDrop(zones, { x: NaN, y: 116 })).toBeNull()
  })

  it('offers distinct nested parallel branches and append-to-group target without modifying the document', () => {
    const program = demoProgram(),
      original = JSON.stringify(program),
      network = program.networks[0]
    const parallel = network.condition.children!.find(
      (element) => element.type === 'parallel',
    )!
    const zones = canvasDropZones(program)
    const branch = zones.find(
      (zone) =>
        zone.target.kind === 'element' &&
        zone.target.elementId === parallel.id &&
        zone.target.mode === 'branch',
    )!
    expect(branch.label).toBe('在此并联组追加支路')
    const leaves = parallel.children!.map((child) =>
      zones.find(
        (zone) =>
          zone.target.kind === 'element' &&
          zone.target.elementId === child.id &&
          zone.target.mode === 'before',
      )!,
    )
    expect(leaves[1].anchor.y - leaves[0].anchor.y).toBe(110)
    expect(JSON.stringify(program)).toBe(original)
    const root = zones.find(
      (zone) =>
        zone.target.kind === 'element' &&
        zone.target.elementId === network.condition.id &&
        zone.target.mode === 'before',
    )!
    expect(root.label).toContain('组内开头')
  })

  it('only exposes accepted destinations for coil and network drags', () => {
    const program = demoProgram()
    program.networks.push(blankNetwork())
    const zones = canvasDropZones(program)
    const coilZones = zones.filter((zone) =>
      canDropLad(program, { kind: 'tool', tool: 'coil-set' }, zone.target),
    )
    expect(coilZones.length).toBe(2)
    expect(coilZones.every((zone) => zone.target.kind === 'coil')).toBe(true)
    const networkZones = zones.filter((zone) =>
      canDropLad(
        program,
        { kind: 'network', networkId: program.networks[0].id },
        zone.target,
      ),
    )
    expect(networkZones.map((zone) => zone.target)).toEqual([
      { kind: 'network', index: 2 },
    ])
  })

  it('converts screen positions using scale and scroll translation and rejects singular transforms', () => {
    expect(
      clientPointToSvg(
        { x: 448, y: 192 },
        { a: 2, b: 0, c: 0, d: 2, e: 200, f: -40 },
      ),
    ).toEqual({ x: 124, y: 116 })
    expect(
      clientPointToSvg(
        { x: 448, y: 192 },
        { a: 2, b: 0, c: 0, d: 2, e: 200, f: -140 },
      ),
    ).toEqual({ x: 124, y: 166 })
    expect(
      clientPointToSvg({ x: 0, y: 0 }, { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }),
    ).toBeNull()
  })

  it('scrolls slowly only near edges inside the canvas viewport', () => {
    const viewport = { x: 100, y: 100, width: 400, height: 300 }
    expect(edgeScrollDelta({ x: 300, y: 250 }, viewport)).toEqual({
      x: 0,
      y: 0,
    })
    expect(edgeScrollDelta({ x: 99, y: 100 }, viewport)).toEqual({ x: 0, y: 0 })
    expect(edgeScrollDelta({ x: 100, y: 100 }, viewport)).toEqual({
      x: -12,
      y: -12,
    })
    const delta = edgeScrollDelta({ x: 490, y: 390 }, viewport)
    expect(delta.x).toBeGreaterThan(0)
    expect(delta.x).toBeLessThan(12)
    expect(delta.y).toBeGreaterThan(0)
    expect(delta.y).toBeLessThan(12)
  })

  it('renders drop hints only during an unlocked drag and exposes the active Chinese instruction', () => {
    const program = demoProgram(),
      target = { kind: 'coil' as const, networkId: program.networks[0].id }
    const props = {
      program,
      selection: null,
      snapshot: null,
      onSelect: () => {},
      dragPayload: { kind: 'tool' as const, tool: 'coil-set' as const },
      dropTarget: target,
    }
    const html = renderToStaticMarkup(createElement(LadderCanvas, props))
    expect(html).toContain('data-drop-active="true"')
    expect(html).toContain('data-drop-target="' + dropTargetKey(target) + '"')
    expect(html).toContain('data-drop-label="替换此网络的输出线圈"')
    expect(
      renderToStaticMarkup(
        createElement(LadderCanvas, { ...props, locked: true }),
      ),
    ).not.toContain('lad-drop-overlay')
    expect(
      renderToStaticMarkup(
        createElement(LadderCanvas, { ...props, dragPayload: null }),
      ),
    ).not.toContain('lad-drop-overlay')
  })

  it('uses square selection outlines and leaves nonselected engineering symbols without cards', () => {
    const program = demoProgram(),
      selected = program.networks[0].condition.children![0]
    const html = renderToStaticMarkup(
      createElement(LadderCanvas, {
        program,
        selection: {
          networkId: program.networks[0].id,
          elementId: selected.id,
        },
        snapshot: null,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('rx="0" fill="#e8f1ff" stroke="#1677ff"')
    expect(html).toContain('fill="transparent" stroke="none"')
    expect(html).not.toContain('rx="7"')
  })
})
