import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { applyLadDrop, canDropLad } from '../src/ladder/drag'
import {
  blankNetwork,
  cloneProgram,
  contact,
  demoProgram,
  findElement,
  functionalElement,
  functionBlocks,
  ladId,
  validateProgram,
  visitElements,
} from '../src/ladder/model'
import type { LadDragPayload, LadDropTarget } from '../src/ladder/drag'
import type {
  FunctionMode,
  InsertMode,
  LadElement,
  LadProgram,
} from '../src/ladder/model'

afterEach(() => vi.unstubAllGlobals())

function linear(): LadProgram {
  const program = demoProgram()
  program.networks[0].condition.children = [
    contact('Start'),
    contact('StopPressed', true),
    contact('Motor'),
  ]
  return program
}
function secondNetwork(program: LadProgram) {
  const network = blankNetwork('Start', '')
  program.networks.push(network)
  return network
}
function target(
  program: LadProgram,
  element: LadElement,
  mode: InsertMode = 'after',
  networkIndex = 0,
): LadDropTarget {
  return {
    kind: 'element',
    networkId: program.networks[networkIndex].id,
    elementId: element.id,
    mode,
  }
}
function source(
  program: LadProgram,
  element: LadElement,
  networkIndex = 0,
): LadDragPayload {
  return {
    kind: 'element',
    networkId: program.networks[networkIndex].id,
    elementId: element.id,
  }
}
function ids(program: LadProgram): string[] {
  const result: string[] = []
  program.networks.forEach((network) => {
    result.push(network.id, network.coil.id)
    visitElements(network.condition, (element) => result.push(element.id))
  })
  return result
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function expectDrop(
  program: LadProgram,
  payload: LadDragPayload,
  destination: LadDropTarget,
) {
  expect(canDropLad(program, payload, destination)).toBe(true)
  const result = applyLadDrop(program, payload, destination)
  expect(result).not.toBeNull()
  expect(new Set(ids(result!.program)).size).toBe(ids(result!.program).length)
  return result!
}
function expectNoDrop(
  program: LadProgram,
  payload: LadDragPayload,
  destination: LadDropTarget,
) {
  const original = JSON.stringify(program)
  expect(canDropLad(program, payload, destination)).toBe(false)
  expect(applyLadDrop(program, payload, destination)).toBeNull()
  expect(JSON.stringify(program)).toBe(original)
}

describe('LAD immutable palette drops', () => {
  it.each(['contact-open', 'contact-closed', 'not'] as const)(
    'inserts %s and keeps a v1 program v1',
    (tool) => {
      const program = freeze(linear()),
        anchor = program.networks[0].condition.children![1]
      const result = expectDrop(
        program,
        { kind: 'tool', tool },
        target(program, anchor, 'before'),
      )
      const inserted = result.program.networks[0].condition.children![1]
      expect(inserted.type).toBe(tool === 'not' ? 'not' : 'contact')
      if (tool !== 'not')
        expect(inserted.negated).toBe(tool === 'contact-closed')
      expect(result.program.schemaVersion).toBe(1)
      expect(result.selection).toEqual({
        networkId: program.networks[0].id,
        elementId: inserted.id,
      })
      expect(program.networks[0].condition.children).toHaveLength(3)
    },
  )
  it.each([
    'TON',
    'TOF',
    'TP',
    'CTU',
    'CTD',
    'R_TRIG',
    'F_TRIG',
  ] as FunctionMode[])(
    'creates a unique %s instance and upgrades to v2',
    (mode) => {
      const program = linear()
      program.variables.push({
        name: 'Timer1',
        kind: 'memory',
        initialValue: false,
      })
      const present = functionalElement('TON', program)
      program.networks[0].condition.children!.push(present)
      program.schemaVersion = 2
      const anchor = program.networks[0].condition.children![0]
      const result = expectDrop(
        freeze(program),
        { kind: 'tool', tool: mode },
        target(program, anchor),
      )
      const inserted = findElement(
        result.program.networks[0],
        result.selection!.elementId,
      )!
      expect(inserted.mode).toBe(mode)
      expect(inserted.instance).not.toBe('Timer1')
      expect(inserted.instance).not.toBe(present.instance)
      expect(result.program.schemaVersion).toBe(2)
      expect(
        new Set(functionBlocks(result.program).map((e) => e.instance)).size,
      ).toBe(2)
    },
  )
  it('upgrades an actual v1 document only when inserting a v2 instruction', () => {
    const p = linear()
    const result = expectDrop(
      p,
      { kind: 'tool', tool: 'TON' },
      target(p, p.networks[0].condition),
    )
    expect(p.schemaVersion).toBe(1)
    expect(result.program.schemaVersion).toBe(2)
  })
  it('allows an unfinished document with unbound contacts, coil and no input variables', () => {
    const p = linear()
    p.variables = []
    p.networks[0].coil.variable = ''
    const result = expectDrop(
      p,
      { kind: 'tool', tool: 'contact-closed' },
      target(p, p.networks[0].condition),
    )
    const e = findElement(
      result.program.networks[0],
      result.selection!.elementId,
    )!
    expect(e.variable).toBe('')
    expect(validateProgram(result.program).length).toBeGreaterThan(0)
  })
  it('fills an empty or not-yet-initialized series root', () => {
    for (const children of [[], undefined]) {
      const p = linear()
      p.networks[0].condition.children = children
      const result = expectDrop(
        p,
        { kind: 'tool', tool: 'contact-open' },
        target(p, p.networks[0].condition),
      )
      expect(result.program.networks[0].condition.children).toHaveLength(1)
    }
  })
  it('can add a branch into an empty parallel placeholder', () => {
    const p = linear(),
      group: LadElement = { id: ladId(), type: 'parallel', children: [] }
    p.networks[0].condition.children = [group]
    const result = expectDrop(
      p,
      { kind: 'tool', tool: 'not' },
      target(p, group, 'branch'),
    )
    expect(findElement(result.program.networks[0], group.id)).toBeUndefined()
    expect(result.program.networks[0].condition.children![0].type).toBe('not')
  })
  it('inserts parallel to a complete root while retaining the original subtree IDs', () => {
    const p = linear(),
      root = p.networks[0].condition
    const originalIds = ids(p)
    const result = expectDrop(
      p,
      { kind: 'tool', tool: 'contact-open' },
      target(p, root, 'parallel'),
    )
    expect(result.program.networks[0].condition.type).toBe('series')
    expect(result.program.networks[0].condition.children![0].type).toBe(
      'parallel',
    )
    expect(originalIds.every((id) => ids(result.program).includes(id))).toBe(
      true,
    )
  })
  it('does not mutate or allocate IDs during hover validation', () => {
    const p = freeze(linear()),
      original = JSON.stringify(p)
    const randomUUID = vi.fn(() => 'unused')
    vi.stubGlobal('crypto', { randomUUID })
    expect(
      canDropLad(
        p,
        { kind: 'tool', tool: 'TON' },
        target(p, p.networks[0].condition, 'parallel'),
      ),
    ).toBe(true)
    expect(randomUUID).not.toHaveBeenCalled()
    expect(JSON.stringify(p)).toBe(original)
  })
})

describe('LAD endpoint coil replacement', () => {
  it.each([
    ['coil-negated', 'normal', true],
    ['coil-set', 'set', false],
    ['coil-reset', 'reset', false],
  ] as const)('%s preserves coil ID and binding', (tool, mode, negated) => {
    const p = freeze(linear()),
      coil = p.networks[0].coil
    const result = expectDrop(
      p,
      { kind: 'tool', tool },
      { kind: 'coil', networkId: p.networks[0].id },
    )
    expect(result.program.networks[0].coil).toEqual({ ...coil, mode, negated })
    expect(result.selection?.elementId).toBe(coil.id)
    expect(result.program.schemaVersion).toBe(mode === 'normal' ? 1 : 2)
  })
  it('returns no edit for the same effective ordinary coil', () => {
    const p = linear()
    expectNoDrop(
      p,
      { kind: 'tool', tool: 'coil-normal' },
      { kind: 'coil', networkId: p.networks[0].id },
    )
  })
  it('changes S to ordinary without downgrading the version or changing the binding', () => {
    const p = linear()
    p.schemaVersion = 2
    p.networks[0].coil.mode = 'set'
    const result = expectDrop(
      p,
      { kind: 'tool', tool: 'coil-normal' },
      { kind: 'coil', networkId: p.networks[0].id },
    )
    expect(result.program.schemaVersion).toBe(2)
    expect(result.program.networks[0].coil).toEqual({
      ...p.networks[0].coil,
      mode: 'normal',
      negated: false,
    })
  })
  it('rejects moving coils or placing non-coil tools on the coil slot', () => {
    const p = linear(),
      n = p.networks[0]
    expectNoDrop(
      p,
      { kind: 'element', networkId: n.id, elementId: n.coil.id },
      target(p, n.condition),
    )
    expectNoDrop(
      p,
      { kind: 'tool', tool: 'TON' },
      { kind: 'coil', networkId: n.id },
    )
    expectNoDrop(p, { kind: 'tool', tool: 'coil-set' }, target(p, n.condition))
  })
})

describe('LAD element moves and one-step undo data', () => {
  it('reorders siblings in both directions without changing any IDs', () => {
    const p = freeze(linear()),
      [a, b, c] = p.networks[0].condition.children!
    const moved = expectDrop(p, source(p, a), target(p, c))
    expect(
      moved.program.networks[0].condition.children!.map((e) => e.id),
    ).toEqual([b.id, c.id, a.id])
    const restored = expectDrop(
      moved.program,
      source(moved.program, moved.program.networks[0].condition.children![2]),
      target(
        moved.program,
        moved.program.networks[0].condition.children![0],
        'before',
      ),
    )
    expect(restored.program).toEqual(p)
    expect(new Set(ids(moved.program))).toEqual(new Set(ids(p)))
  })
  it('returns null for adjacent sibling positions and first/last positions inside their parent', () => {
    const p = linear(),
      root = p.networks[0].condition,
      [a, b, c] = root.children!
    expectNoDrop(p, source(p, a), target(p, b, 'before'))
    expectNoDrop(p, source(p, c), target(p, b, 'after'))
    expectNoDrop(p, source(p, a), target(p, root, 'before'))
    expectNoDrop(p, source(p, c), target(p, root, 'after'))
  })
  it('moves a child to a different point inside an ancestor series', () => {
    const p = linear(),
      root = p.networks[0].condition,
      [a, b, c] = root.children!
    const result = expectDrop(p, source(p, c), target(p, root, 'before'))
    expect(
      result.program.networks[0].condition.children!.map((e) => e.id),
    ).toEqual([c.id, a.id, b.id])
  })
  it('forbids an element dropped on itself and an ancestor dropped into descendants', () => {
    const p = demoProgram(),
      root = p.networks[0].condition,
      group = root.children![0],
      child = group.children![0]
    for (const mode of [
      'before',
      'after',
      'parallel',
      'branch',
    ] as InsertMode[]) {
      expectNoDrop(p, source(p, group), target(p, group, mode))
      expectNoDrop(p, source(p, group), target(p, child, mode))
      expectNoDrop(p, source(p, root), target(p, group, mode))
    }
  })
  it('keeps function state identity, parameters and control binding across networks', () => {
    const p = linear()
    p.schemaVersion = 2
    const timer = functionalElement('TP', p),
      counter = functionalElement('CTD', p)
    timer.presetMs = 739
    counter.preset = 22
    counter.controlVariable = 'Start'
    const group: LadElement = {
      id: ladId(),
      type: 'series',
      children: [timer, counter],
    }
    p.networks[0].condition.children = [group]
    const second = secondNetwork(p),
      original = cloneProgram(p)
    const result = expectDrop(
      freeze(p),
      source(p, group),
      target(p, second.condition, 'after', 1),
    )
    expect(findElement(result.program.networks[1], group.id)).toEqual(group)
    expect(result.program.networks[0].condition.children).toEqual([])
    expect(functionBlocks(result.program).map((e) => e.instance)).toEqual([
      timer.instance,
      counter.instance,
    ])
    expect(result.selection).toEqual({
      networkId: second.id,
      elementId: group.id,
    })
    expect(p).toEqual(original)
    // An undo implementation need only restore this untouched prior document, not reverse individual removals/inserts.
    expect(original.networks[0].condition.children![0]).toEqual(group)
  })
  it('moves the entire root cross-network while leaving a usable empty source root', () => {
    const p = demoProgram(),
      first = p.networks[0],
      root = first.condition,
      second = secondNetwork(p)
    const result = expectDrop(
      p,
      source(p, root),
      target(p, second.condition, 'before', 1),
    )
    expect(result.program.networks[0].id).toBe(first.id)
    expect(result.program.networks[0].coil).toEqual(first.coil)
    expect(result.program.networks[0].condition.id).not.toBe(root.id)
    expect(result.program.networks[0].condition).toMatchObject({
      type: 'series',
      children: [],
    })
    expect(findElement(result.program.networks[1], root.id)).toEqual(root)
    const repaired = expectDrop(
      result.program,
      { kind: 'tool', tool: 'contact-open' },
      target(result.program, result.program.networks[0].condition),
    )
    expect(repaired.program.networks[0].condition.children).toHaveLength(1)
  })
  it('simplifies the source parallel after moving one branch across networks', () => {
    const p = demoProgram(),
      root = p.networks[0].condition,
      parallel = root.children![0],
      child = parallel.children![0]
    const second = secondNetwork(p)
    const result = expectDrop(
      p,
      source(p, child),
      target(p, second.condition, 'after', 1),
    )
    expect(findElement(result.program.networks[0], parallel.id)).toBeUndefined()
    expect(result.program.networks[0].condition.children![0]).toEqual(
      parallel.children![1],
    )
    expect(
      validateProgram(result.program).some((issue) =>
        issue.message.includes('两条支路'),
      ),
    ).toBe(false)
  })
  it('appends a parallel branch and treats the existing final branch as no-op', () => {
    const p = demoProgram(),
      parallel = p.networks[0].condition.children![0],
      [a, b] = parallel.children!
    expectNoDrop(p, source(p, b), target(p, parallel, 'branch'))
    const result = expectDrop(p, source(p, a), target(p, parallel, 'branch'))
    expect(
      findElement(result.program.networks[0], parallel.id)?.children!.map(
        (e) => e.id,
      ),
    ).toEqual([b.id, a.id])
  })
  it('wraps a moved contact into a branch series instead of creating a third parallel input', () => {
    const p = demoProgram(),
      root = p.networks[0].condition,
      parallel = root.children![0],
      stop = root.children![1],
      a = parallel.children![0]
    const result = expectDrop(p, source(p, stop), target(p, a, 'after'))
    const branch = findElement(result.program.networks[0], parallel.id)!
      .children![0]
    expect(branch.type).toBe('series')
    expect(branch.children!.map((e) => e.id)).toEqual([a.id, stop.id])
    expect(
      findElement(result.program.networks[0], parallel.id)!.children,
    ).toHaveLength(2)
  })
})

describe('LAD network insertion boundaries', () => {
  function three() {
    const p = linear()
    secondNetwork(p)
    secondNetwork(p)
    return p
  }
  it('moves downward using the original-list boundary index', () => {
    const p = freeze(three()),
      [a, b, c] = p.networks
    const result = expectDrop(
      p,
      { kind: 'network', networkId: a.id },
      { kind: 'network', index: 3 },
    )
    expect(result.program.networks.map((n) => n.id)).toEqual([b.id, c.id, a.id])
    expect(result.selection).toEqual({
      networkId: a.id,
      elementId: a.condition.id,
    })
  })
  it('moves upward and preserves every network parameter and ID', () => {
    const p = three(),
      [a, b, c] = p.networks
    c.label = 'last network'
    const result = expectDrop(
      p,
      { kind: 'network', networkId: c.id },
      { kind: 'network', index: 0 },
    )
    expect(result.program.networks).toEqual([c, a, b])
  })
  it('rejects both no-op boundaries and out-of-range/fractional positions', () => {
    const p = three(),
      id = p.networks[1].id
    for (const index of [1, 2, -1, 4, 1.5, NaN, Infinity])
      expectNoDrop(
        p,
        { kind: 'network', networkId: id },
        { kind: 'network', index },
      )
  })
  it('does not invent a network or output binding for a tool or element on a boundary', () => {
    const p = three(),
      root = p.networks[0].condition
    expectNoDrop(
      p,
      { kind: 'tool', tool: 'TON' },
      { kind: 'network', index: 0 },
    )
    expectNoDrop(p, source(p, root), { kind: 'network', index: 1 })
    expectNoDrop(
      p,
      { kind: 'network', networkId: p.networks[0].id },
      target(p, root),
    )
  })
})

describe('LAD drag bounds and stale payloads', () => {
  it('rejects stale source/target IDs and invalid slot modes without fallback insertions', () => {
    const p = linear(),
      root = p.networks[0].condition
    expectNoDrop(
      p,
      { kind: 'element', networkId: p.networks[0].id, elementId: 'missing' },
      target(p, root),
    )
    expectNoDrop(p, source(p, root.children![0]), {
      kind: 'element',
      networkId: 'missing',
      elementId: root.id,
      mode: 'after',
    })
    expectNoDrop(
      p,
      { kind: 'tool', tool: 'not' },
      {
        kind: 'element',
        networkId: p.networks[0].id,
        elementId: 'missing',
        mode: 'after',
      },
    )
    expectNoDrop(
      p,
      { kind: 'tool', tool: 'not' },
      target(p, root.children![0], 'branch'),
    )
    expectNoDrop(
      p,
      { kind: 'tool', tool: 'unknown' } as unknown as LadDragPayload,
      target(p, root),
    )
  })
  it('guards the element cap but still permits moves and unrelated repairs at the limit', () => {
    const p = linear(),
      root = p.networks[0].condition
    root.children = Array.from({ length: 2046 }, () => contact('Start'))
    expectNoDrop(p, { kind: 'tool', tool: 'not' }, target(p, root))
    const result = expectDrop(
      p,
      source(p, root.children[0]),
      target(p, root.children.at(-1)!),
    )
    expect(ids(result.program).length).toBe(ids(p).length)
  })
  it('guards wrapping depth but permits a deep child to move upward and repair the topology', () => {
    const p = linear(),
      leaf = contact('Start')
    let child = leaf
    for (let i = 0; i < 14; i++)
      child = { id: ladId(), type: 'series', children: [child] }
    p.networks[0].condition.children = [child]
    expectNoDrop(
      p,
      { kind: 'tool', tool: 'contact-open' },
      target(p, leaf, 'parallel'),
    )
    const result = expectDrop(
      p,
      source(p, leaf),
      target(p, p.networks[0].condition, 'after'),
    )
    expect(result.program.networks[0].condition.children!.at(-1)!.id).toBe(
      leaf.id,
    )
  })
  it('detects the reduced height before wrapping an ancestor after detaching its deep child', () => {
    const p = linear(),
      deep: LadElement = {
        id: ladId(),
        type: 'series',
        children: [contact('Start')],
      }
    let parent = deep
    for (let i = 0; i < 13; i++)
      parent = { id: ladId(), type: 'series', children: [parent] }
    p.networks[0].condition.children = [parent]
    // The moved outer subtree is too tall for a new nested branch; reject without changing the original.
    expectNoDrop(
      p,
      source(p, parent),
      target(p, p.networks[0].condition, 'parallel'),
    )
    // Removing the next subtree shortens the old root before it is wrapped: both resulting branches fit depth 16.
    const nested = parent.children![0]
    const branched = expectDrop(
      p,
      source(p, nested),
      target(p, p.networks[0].condition, 'parallel'),
    )
    expect(findElement(branched.program.networks[0], nested.id)).toEqual(nested)
    expect(
      findElement(branched.program.networks[0], parent.id)?.children,
    ).toEqual([])
    expect(
      validateProgram(branched.program).some((issue) =>
        issue.message.includes('嵌套深度'),
      ),
    ).toBe(false)
    // Moving the leaf instead remains legal for a simple upward append.
    expectDrop(
      p,
      source(p, deep.children![0]),
      target(p, p.networks[0].condition, 'after'),
    )
  })
})
