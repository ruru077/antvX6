import {
  cloneProgram,
  contact,
  findElement,
  functionalElement,
  insertElement,
  isFunctionBlock,
  ladId,
  removeElement,
  simplifyParallelBranches,
  visitElements,
} from './model'
import type {
  CoilMode,
  FunctionMode,
  InsertMode,
  LadElement,
  LadNetwork,
  LadProgram,
  LadSelection,
} from './model'

export type LadDragPayload =
  | {
      kind: 'tool'
      tool:
        | 'contact-open'
        | 'contact-closed'
        | 'not'
        | 'coil-normal'
        | 'coil-negated'
        | 'coil-set'
        | 'coil-reset'
        | FunctionMode
    }
  | { kind: 'element'; networkId: string; elementId: string }
  | { kind: 'network'; networkId: string }

export type LadDropTarget =
  | {
      kind: 'element'
      networkId: string
      elementId: string
      mode: InsertMode
    }
  | { kind: 'coil'; networkId: string }
  | { kind: 'network'; index: number }

type DropResult = { program: LadProgram; selection: LadSelection | null }
type StructuralStats = {
  count: number
  depth: number
  ids: Map<string, number>
}
type Position = {
  element: LadElement
  parent?: Position
  depth: number
  height: number
}
type DragIndex = {
  count: number
  depth: number
  networks: Map<string, LadNetwork>
  elements: Map<string, Map<string, Position>>
}
// Documents are immutable edit-history entries. Cache their topology once, not once per SVG drop zone.
const dragIndexes = new WeakMap<LadProgram, DragIndex>()

const functionModes = new Set<string>([
  'TON',
  'TOF',
  'TP',
  'CTU',
  'CTD',
  'R_TRIG',
  'F_TRIG',
])
const coilTools: Record<string, { mode: CoilMode; negated: boolean }> = {
  'coil-normal': { mode: 'normal', negated: false },
  'coil-negated': { mode: 'normal', negated: true },
  'coil-set': { mode: 'set', negated: false },
  'coil-reset': { mode: 'reset', negated: false },
}

function stats(program: LadProgram): StructuralStats {
  const result: StructuralStats = { count: 0, depth: 0, ids: new Map() }
  const id = (value: string) =>
    result.ids.set(value, (result.ids.get(value) ?? 0) + 1)
  const walk = (element: LadElement, depth: number) => {
    result.count++
    result.depth = Math.max(result.depth, depth)
    id(element.id)
    element.children?.forEach((child) => walk(child, depth + 1))
  }
  program.networks.forEach((network) => {
    id(network.id)
    id(network.coil.id)
    result.count++
    walk(network.condition, 1)
  })
  return result
}

function dragIndex(program: LadProgram): DragIndex {
  const cached = dragIndexes.get(program)
  if (cached) return cached
  const index: DragIndex = {
    count: 0,
    depth: 0,
    networks: new Map(),
    elements: new Map(),
  }
  program.networks.forEach((network) => {
    index.networks.set(network.id, network)
    const entries = new Map<string, Position>()
    index.elements.set(network.id, entries)
    const walk = (
      element: LadElement,
      depth: number,
      parent?: Position,
    ): number => {
      const position: Position = { element, depth, parent, height: 1 }
      entries.set(element.id, position)
      index.count++
      index.depth = Math.max(index.depth, depth)
      element.children?.forEach((child) => {
        position.height = Math.max(
          position.height,
          walk(child, depth + 1, position) + 1,
        )
      })
      return position.height
    }
    index.count++ // Every coil counts toward the shared element cap; the network itself does not.
    walk(network.condition, 1)
  })
  dragIndexes.set(program, index)
  return index
}

function isAncestor(ancestor: Position, descendant: Position): boolean {
  for (
    let current: Position | undefined = descendant;
    current;
    current = current.parent
  ) {
    if (current === ancestor) return true
  }
  return false
}

function unchangedPosition(
  source: Position,
  target: Position,
  mode: InsertMode,
): boolean {
  const parent = source.parent
  if (!parent) return false
  if (mode === 'branch')
    return (
      parent === target && target.element.children?.at(-1) === source.element
    )
  if (mode !== 'before' && mode !== 'after') return false
  if (target.element.type === 'series') {
    if (parent !== target) return false
    return mode === 'before'
      ? target.element.children?.[0] === source.element
      : target.element.children?.at(-1) === source.element
  }
  if (parent.element.type !== 'series' || target.parent !== parent) return false
  const sourceIndex = parent.element.children!.indexOf(source.element)
  const targetIndex = parent.element.children!.indexOf(target.element)
  return sourceIndex === targetIndex + (mode === 'before' ? -1 : 1)
}

// Reject illegal destinations, not unrelated unfinished bindings in the editor.
function feasible(
  program: LadProgram,
  payload: LadDragPayload,
  target: LadDropTarget,
): boolean {
  if (!payload || !target || !Array.isArray(program.networks)) return false
  if (payload.kind === 'network') {
    if (
      target.kind !== 'network' ||
      !Number.isInteger(target.index) ||
      target.index < 0 ||
      target.index > program.networks.length
    )
      return false
    const from = program.networks.findIndex(
      (network) => network.id === payload.networkId,
    )
    return from >= 0 && target.index !== from && target.index !== from + 1
  }
  if (target.kind === 'network') return false
  const index = dragIndex(program)
  const destination = index.networks.get(target.networkId)
  if (!destination) return false
  if (payload.kind === 'tool' && Object.hasOwn(coilTools, payload.tool)) {
    if (target.kind !== 'coil') return false
    const wanted = coilTools[payload.tool]
    return (
      (destination.coil.mode ?? 'normal') !== wanted.mode ||
      destination.coil.negated !== wanted.negated
    )
  }
  if (
    target.kind !== 'element' ||
    !['before', 'after', 'parallel', 'branch'].includes(target.mode)
  )
    return false
  const selected = index.elements.get(destination.id)?.get(target.elementId)
  if (
    !selected ||
    (target.mode === 'branch' && selected.element.type !== 'parallel')
  )
    return false
  if (payload.kind === 'tool')
    return (
      ['contact-open', 'contact-closed', 'not'].includes(payload.tool) ||
      functionModes.has(payload.tool)
    )
  if (payload.kind !== 'element') return false
  const origin = index.networks.get(payload.networkId)
  if (!origin) return false
  const source = index.elements.get(origin.id)?.get(payload.elementId)
  if (!source || source.element.id === selected.element.id) return false
  // A group cannot be inserted into its own descendants. This also rejects root-to-own-rung drops.
  if (origin === destination && isAncestor(source, selected)) return false
  return (
    origin !== destination || !unchangedPosition(source, selected, target.mode)
  )
}

function heightWithout(element: LadElement, excluded: string): number {
  let height = 1
  element.children?.forEach((child) => {
    if (child.id !== excluded)
      height = Math.max(height, heightWithout(child, excluded) + 1)
  })
  return height
}

function insertedTool(
  program: LadProgram,
  tool: Extract<LadDragPayload, { kind: 'tool' }>['tool'],
): LadElement {
  if (tool === 'contact-open' || tool === 'contact-closed')
    return contact(
      program.variables.find((variable) => variable.kind === 'input')?.name ??
        '',
      tool === 'contact-closed',
    )
  if (tool === 'not') return { id: ladId(), type: 'not' }
  program.schemaVersion = 2
  return functionalElement(tool as FunctionMode, program)
}

function finish(
  original: LadProgram,
  next: LadProgram,
  selection: LadSelection,
): DropResult | null {
  if (JSON.stringify(original) === JSON.stringify(next)) return null
  const before = stats(original),
    after = stats(next)
  // Existing binding/empty-group diagnostics do not block editing. Prevent newly exceeding structural caps.
  if (
    after.count > Math.max(2048, before.count) ||
    after.depth > Math.max(16, before.depth)
  )
    return null
  for (const [id, count] of after.ids) {
    if (count > Math.max(1, before.ids.get(id) ?? 0)) return null
  }
  return { program: next, selection }
}

/** Apply one immutable edit; callers can store the returned document as one undo step. */
export function applyLadDrop(
  program: LadProgram,
  payload: LadDragPayload,
  target: LadDropTarget,
): DropResult | null {
  if (!canDropLad(program, payload, target)) return null
  const next = cloneProgram(program)
  if (payload.kind === 'network' && target.kind === 'network') {
    const from = next.networks.findIndex(
      (network) => network.id === payload.networkId,
    )
    const [moved] = next.networks.splice(from, 1)
    next.networks.splice(
      target.index > from ? target.index - 1 : target.index,
      0,
      moved,
    )
    return finish(program, next, {
      networkId: moved.id,
      elementId: moved.condition.id,
    })
  }
  if (target.kind === 'network') return null
  const destination = next.networks.find(
    (network) => network.id === target.networkId,
  )!
  if (payload.kind === 'tool' && target.kind === 'coil') {
    const wanted = coilTools[payload.tool]
    destination.coil.mode = wanted.mode
    destination.coil.negated = wanted.negated
    if (wanted.mode !== 'normal') next.schemaVersion = 2
    return finish(program, next, {
      networkId: destination.id,
      elementId: destination.coil.id,
    })
  }
  if (target.kind !== 'element') return null
  let moved: LadElement
  if (payload.kind === 'tool') moved = insertedTool(next, payload.tool)
  else if (payload.kind === 'element') {
    const origin = next.networks.find(
      (network) => network.id === payload.networkId,
    )!
    moved = structuredClone(findElement(origin, payload.elementId)!)
    if (origin.condition.id === moved.id) {
      // A rung and its coil remain; the moved root keeps its ID and the original rung gets a new empty target.
      origin.condition = { id: ladId(), type: 'series', children: [] }
    } else {
      // Keep destination group IDs until insertion finishes (e.g. reorder branches).
      removeElement(origin, moved.id, false)
    }
    visitElements(moved, (element) => {
      if (isFunctionBlock(element)) next.schemaVersion = 2
    })
  } else return null
  const selected = findElement(destination, target.elementId)!
  if (
    (selected.type === 'series' || selected.type === 'parallel') &&
    !selected.children
  )
    selected.children = []
  insertElement(destination, target.elementId, moved, target.mode)
  next.networks.forEach(simplifyParallelBranches)
  return finish(program, next, {
    networkId: destination.id,
    elementId: moved.id,
  })
}

/** Hover checks have no document side effects and share exactly the same acceptance rules as a drop. */
export function canDropLad(
  program: LadProgram,
  payload: LadDragPayload,
  target: LadDropTarget,
): boolean {
  if (!feasible(program, payload, target)) return false
  if (payload.kind === 'network' || target.kind !== 'element') return true
  const index = dragIndex(program)
  const destination = index.elements
    .get(target.networkId)!
    .get(target.elementId)!
  const source =
    payload.kind === 'element'
      ? index.elements.get(payload.networkId)!.get(payload.elementId)!
      : undefined
  let wrappers = 0,
    insertedDepth = destination.depth
  let existingDepth = 0
  if (target.mode === 'parallel') {
    wrappers = destination.parent ? 1 : 2
    insertedDepth += wrappers
    existingDepth = insertedDepth
  } else if (target.mode === 'branch' || destination.element.type === 'series')
    insertedDepth++
  else if (destination.parent?.element.type !== 'series') {
    wrappers = 1
    insertedDepth++
    existingDepth = insertedDepth
  }
  const added =
    wrappers + (payload.kind === 'tool' ? 1 : source?.parent ? 0 : 1)
  if (index.count + added > Math.max(2048, index.count)) return false
  let newDepth = insertedDepth + (source?.height ?? 1) - 1
  if (existingDepth) {
    const remainingHeight =
      source &&
      payload.kind === 'element' &&
      payload.networkId === target.networkId &&
      isAncestor(destination, source)
        ? heightWithout(destination.element, source.element.id)
        : destination.height
    newDepth = Math.max(newDepth, existingDepth + remainingHeight - 1)
  }
  return newDepth <= Math.max(16, index.depth)
}
