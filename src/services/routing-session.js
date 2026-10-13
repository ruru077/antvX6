// Ephemeral routing state belongs to a graph incarnation, never to a global tab.
const sessions = new WeakMap()
const geometryKeys = new Set([
  'position',
  'size',
  'angle',
  'ports',
  'source',
  'target',
  'vertices',
  'router',
  'attrs',
])

export function isRoutingReplay(graph) {
  return !!graph?.getPlugin?.('history')?.freezed
}

export function getRoutingSession(graph) {
  let state = sessions.get(graph)
  if (state) return state
  state = {
    epoch: 0,
    revision: 0,
    pending: new Map(),
    snapshots: new Map(),
    nodeDrags: new Map(),
    editing: new Set(),
    promise: null,
    disposed: false,
  }
  sessions.set(graph, state)
  const changed = ({ cell, key, options = {} }) => {
    // History replays the original options, including routingWrite.
    if (isRoutingReplay(graph)) {
      invalidateRouting(graph)
      return
    }
    if (options.routingWrite || !geometryKeys.has(key)) return
    state.revision++
    if (cell.isEdge() && key === 'vertices') {
      state.pending.delete(cell)
      if (!state.snapshots.has(cell)) state.revision++
    }
  }
  const reset = () => invalidateRouting(graph)
  const removed = ({ cell }) => {
    state.revision++
    state.pending.delete(cell)
    state.snapshots.delete(cell)
    state.nodeDrags.delete(cell)
    state.editing.delete(cell)
  }
  graph.on('cell:change:*', changed)
  graph.on('cell:removed', removed)
  graph.on('history:undo', reset)
  graph.on('history:redo', reset)
  graph.on('history:cancel', reset)
  graph.model.on('reseted', reset)
  state.dispose = () => {
    invalidateRouting(graph)
    state.disposed = true
    graph.off('cell:change:*', changed)
    graph.off('cell:removed', removed)
    graph.off('history:undo', reset)
    graph.off('history:redo', reset)
    graph.off('history:cancel', reset)
    graph.model.off('reseted', reset)
  }
  return state
}

export function invalidateRouting(graph) {
  const state = sessions.get(graph)
  if (!state) return
  state.epoch++
  state.revision++
  state.pending.clear()
  state.snapshots.clear()
  state.nodeDrags.clear()
  state.editing.clear()
}

export function routingMode(edge) {
  return (
    edge.getData()?.routingMode ??
    (edge.getVertices().length && !edge.getRouter() ? 'manual' : 'auto')
  )
}

export function sameVertices(a, b) {
  return (
    a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y)
  )
}
