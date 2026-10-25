import { describe, expect, it } from 'vite-plus/test'
import {
  blankNetwork,
  cloneProgram,
  contact,
  demoProgram,
  duplicateNetwork,
  emptyProgram,
  findElement,
  insertElement,
  removeElement,
  renameVariable,
  selectionFromIssue,
  simplifyProgramBranches,
  functionalElement,
  ladId,
  validateProgram,
  visitElements,
} from '../src/ladder/model'

describe('LAD authoring model (not an execution engine)', () => {
  it('ships a valid self-hold program with independent input, stop and output', () => {
    const program = demoProgram()
    expect(validateProgram(program)).toEqual([])
    expect(program.networks[0].condition.children![0].type).toBe('parallel')
    expect(program.variables.map((v) => v.name)).toEqual([
      'Start',
      'StopPressed',
      'Motor',
    ])
    expect(program.networks[0].condition.children![1].negated).toBe(true)
  })
  it('keeps explicit empty-model errors instead of inventing variables', () => {
    expect(validateProgram(emptyProgram()).map((issue) => issue.path)).toEqual([
      'variables',
      'networks',
    ])
  })
  it('renames all references including self-hold and coil without mutating the source', () => {
    const original = demoProgram(),
      next = renameVariable(original, 'Motor', 'Pump')
    expect(next.variables[2].name).toBe('Pump')
    expect(next.networks[0].coil.variable).toBe('Pump')
    expect(next.networks[0].condition.children![0].children![1].variable).toBe(
      'Pump',
    )
    expect(original.networks[0].coil.variable).toBe('Motor')
    expect(validateProgram(next)).toEqual([])
  })
  it('rejects duplicate names and unsafe identifiers during rename', () => {
    expect(() => renameVariable(demoProgram(), 'Motor', 'Start')).toThrow(
      '已存在',
    )
    expect(() => renameVariable(demoProgram(), 'Motor', 'bad-name')).toThrow(
      '变量名',
    )
  })
  it('duplicates a network with new unique IDs and demands explicit coil rebinding', () => {
    const program = demoProgram(),
      original = program.networks[0],
      copy = duplicateNetwork(original)
    const originals = [original.id, original.coil.id]
    visitElements(original.condition, (e) => originals.push(e.id))
    const copies = [copy.id, copy.coil.id]
    visitElements(copy.condition, (e) => copies.push(e.id))
    expect(copies.every((id) => !originals.includes(id))).toBe(true)
    program.networks.push(copy)
    expect(validateProgram(program)).toEqual([
      { path: 'networks[1].coil.variable', message: '线圈未绑定已声明变量' },
    ])
  })
  it('inserts in series before and after selected contacts, preserving order', () => {
    const network = blankNetwork(),
      selected = network.condition.children![0]
    const before = contact('B'),
      after = contact('C')
    insertElement(network, selected.id, before, 'before')
    insertElement(network, selected.id, after, 'after')
    expect(network.condition.children!.map((e) => e.variable)).toEqual([
      'B',
      'Start',
      'C',
    ])
  })
  it('wraps a single selected contact in parallel and can append another branch', () => {
    const network = blankNetwork(),
      selected = network.condition.children![0],
      added = contact('B')
    insertElement(network, selected.id, added, 'parallel')
    const parallel = network.condition.children![0]
    expect(parallel.type).toBe('parallel')
    expect(parallel.children!.map((e) => e.variable)).toEqual(['Start', 'B'])
    insertElement(network, parallel.id, contact('C'), 'branch')
    expect(parallel.children!.length).toBe(3)
  })
  it('wraps a branch in series rather than creating accidental third parallel input', () => {
    const network = demoProgram().networks[0],
      parallel = network.condition.children![0],
      selected = parallel.children![0]
    insertElement(network, selected.id, contact('StopPressed', true), 'after')
    expect(parallel.children!.length).toBe(2)
    expect(parallel.children![0].type).toBe('series')
    expect(parallel.children![0].children!.map((e) => e.variable)).toEqual([
      'Start',
      'StopPressed',
    ])
  })
  it('keeps root a series when parallelizing a whole rung condition', () => {
    const network = blankNetwork(),
      originalId = network.condition.id
    insertElement(network, originalId, contact('B'), 'parallel')
    expect(network.condition.type).toBe('series')
    expect(network.condition.children![0].type).toBe('parallel')
    expect(network.condition.children![0].children![0].id).toBe(originalId)
  })
  it('supports nested parallel groups and targeted recursive deletion', () => {
    const program = demoProgram(),
      network = program.networks[0],
      parent = network.condition.children![0],
      childId = parent.children![0].id
    insertElement(network, childId, contact('StopPressed'), 'parallel')
    expect(validateProgram(program)).toEqual([])
    expect(parent.children![0].type).toBe('parallel')
    const nestedId = parent.children![0].children![1].id
    expect(findElement(network, nestedId)?.variable).toBe('StopPressed')
    removeElement(network, nestedId)
    expect(findElement(network, nestedId)).toBeUndefined()
    expect(validateProgram(program)).toEqual([])
    expect(parent.children![0].id).toBe(childId)
  })
  it('promotes the remaining branch without changing its identity or binding', () => {
    const program = demoProgram(),
      network = program.networks[0],
      parallel = network.condition.children![0]
    const remaining = structuredClone(parallel.children![1])
    removeElement(network, parallel.children![0].id)
    expect(network.condition.children![0]).toEqual(remaining)
    expect(findElement(network, parallel.id)).toBeUndefined()
    expect(validateProgram(program)).toEqual([])
  })
  it('keeps two branches when deleting one of three', () => {
    const p = demoProgram(),
      n = p.networks[0],
      group = n.condition.children![0]
    group.children!.push(contact('StopPressed'))
    removeElement(n, group.children![1].id)
    expect(n.condition.children![0].id).toBe(group.id)
    expect(group.children!.map((e) => e.variable)).toEqual([
      'Start',
      'StopPressed',
    ])
    expect(validateProgram(p)).toEqual([])
  })
  it('removes a series branch emptied by deletion, retaining the other branch', () => {
    const p = demoProgram(),
      n = p.networks[0],
      group = n.condition.children![0]
    const removed = group.children![1]
    group.children![1] = { id: ladId(), type: 'series', children: [removed] }
    const remaining = structuredClone(group.children![0])
    removeElement(n, removed.id)
    expect(n.condition.children![0]).toEqual(remaining)
    expect(validateProgram(p)).toEqual([])
  })
  it('repairs the reported Start -> TON -> Motor draft without changing state or ports', () => {
    const p = demoProgram(),
      n = p.networks[0],
      group = n.condition.children![0]
    p.schemaVersion = 2
    group.children = [
      { id: ladId(), type: 'series', children: [group.children![0]] },
    ]
    const timer = functionalElement('TON', p)
    timer.presetMs = 300
    n.condition.children = [group, timer]
    const before = structuredClone(p),
      repaired = simplifyProgramBranches(p)
    expect(p).toEqual(before)
    expect(repaired.networks[0].condition.id).toBe(n.condition.id)
    expect(repaired.networks[0].condition.children).toEqual([
      group.children[0],
      timer,
    ])
    expect(repaired.variables).toEqual(p.variables)
    expect(repaired.networks[0].coil).toEqual(n.coil)
    expect(validateProgram(repaired)).toEqual([])
    expect(simplifyProgramBranches(repaired)).toEqual(repaired)
  })
  it('leaves unrelated empty groups invalid instead of energizing the coil', () => {
    const p = demoProgram(),
      n = p.networks[0],
      group = n.condition.children![0]
    group.children = []
    const empty = structuredClone(group)
    removeElement(n, n.condition.children![1].id)
    expect(n.condition.children).toEqual([empty])
    expect(validateProgram(simplifyProgramBranches(p))[0].message).toContain(
      '两条支路',
    )
  })
  it('clearing the root reports an empty branch', () => {
    const program = demoProgram(),
      network = program.networks[0]
    removeElement(network, network.condition.id)
    expect(validateProgram(program)[0].message).toContain('不能为空')
  })
  it('detects illegal writes and duplicate coils', () => {
    const program = demoProgram()
    program.networks[0].coil.variable = 'Start'
    expect(validateProgram(program)[0].message).toContain('输入变量')
    program.networks[0].coil.variable = 'Motor'
    program.networks.push(blankNetwork())
    expect(
      validateProgram(program).some((issue) =>
        issue.message.includes('多个线圈'),
      ),
    ).toBe(true)
  })
  it('detects undefined references, duplicate IDs, and invalid scan periods', () => {
    const program = demoProgram()
    program.scanPeriodMs = 0.5
    program.networks[0].coil.id = program.networks[0].id
    program.networks[0].condition.children![1].variable = 'missing'
    const issues = validateProgram(program)
    expect(issues.some((issue) => issue.path === 'scanPeriodMs')).toBe(true)
    expect(issues.some((issue) => issue.message.includes('ID'))).toBe(true)
    expect(issues.some((issue) => issue.message.includes('未绑定'))).toBe(true)
  })
  it('can locate server diagnostics at nested contact, coil and network', () => {
    const program = demoProgram(),
      network = program.networks[0]
    expect(
      selectionFromIssue(
        program,
        'networks[0].condition.children[0].children[1].variable',
      ),
    ).toEqual({
      networkId: network.id,
      elementId: network.condition.children![0].children![1].id,
    })
    expect(
      selectionFromIssue(program, 'networks[0].coil.variable')?.elementId,
    ).toBe(network.coil.id)
    expect(selectionFromIssue(program, 'variables[0].name')).toBeNull()
    expect(selectionFromIssue(program, 'networks[99]')).toBeNull()
  })
  it('cloning and edit history can preserve branches and initialization unchanged', () => {
    const before = demoProgram(),
      after = cloneProgram(before)
    after.variables[0].initialValue = true
    after.networks[0].condition.children!.reverse()
    expect(before.variables[0].initialValue).toBe(false)
    expect(before.networks[0].condition.children![0].type).toBe('parallel')
  })
  it('uses the same 64-character ID and 200-character comment limits as Link', () => {
    const program = demoProgram()
    program.networks[0].label = 'x'.repeat(201)
    program.networks[0].condition.id = 'x'.repeat(65)
    expect(
      validateProgram(program).some((issue) => issue.path.endsWith('.label')),
    ).toBe(true)
    expect(
      validateProgram(program).some((issue) => issue.path.endsWith('.id')),
    ).toBe(true)
    const copy = duplicateNetwork(program.networks[0])
    expect(copy.label.length).toBe(200)
    expect(copy.label.endsWith('（副本）')).toBe(true)
  })
  it('counts coils toward the shared 2048-element limit', () => {
    const program = demoProgram(),
      network = blankNetwork()
    network.condition.children = Array.from({ length: 2046 }, () =>
      contact('Start'),
    )
    program.networks = [network]
    expect(validateProgram(program)).toEqual([])
    network.condition.children.push(contact('Start'))
    expect(
      validateProgram(program).some((issue) => issue.message.includes('2048')),
    ).toBe(true)
  })
})
