const equal = (a, b) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5
const endpoint = (terminal) =>
  terminal.hasStub ? terminal.stubPoint : terminal.point
const dedupe = (points) =>
  points
    .filter((point, i) => !i || !equal(point, points[i - 1]))
    .map((p) => ({ x: p.x, y: p.y }))

export function routeHitsNodes(points, boxes, entry) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i]
    // The first/last port rays may be diagonal for rotated/elliptic ports.
    if (
      i === 1 &&
      entry?.source.hasStub &&
      equal(a, entry.source.point) &&
      equal(b, entry.source.stubPoint)
    )
      continue
    if (
      i === points.length - 1 &&
      entry?.target.hasStub &&
      equal(a, entry.target.stubPoint) &&
      equal(b, entry.target.point)
    )
      continue
    if (Math.abs(a.x - b.x) >= 0.5 && Math.abs(a.y - b.y) >= 0.5) return true
    for (const box of boxes) {
      if (Math.abs(a.y - b.y) < 0.5) {
        if (
          a.y > box.y + 0.01 &&
          a.y < box.y + box.height - 0.01 &&
          Math.min(a.x, b.x) < box.x + box.width - 0.01 &&
          Math.max(a.x, b.x) > box.x + 0.01
        )
          return true
      } else if (
        a.x > box.x + 0.01 &&
        a.x < box.x + box.width - 0.01 &&
        Math.min(a.y, b.y) < box.y + box.height - 0.01 &&
        Math.max(a.y, b.y) > box.y + 0.01
      )
        return true
    }
  }
  return false
}

export function validRoute(points, entry, boxes) {
  if (points.length < 2 || routeHitsNodes(points, boxes, entry)) return false
  for (const [terminal, tail] of [
    [entry.source, points],
    [entry.target, [...points].reverse()],
  ]) {
    if (!equal(tail[0], terminal.point)) return false
    if (terminal.hasStub && (!tail[1] || !equal(tail[1], terminal.stubPoint)))
      return false
    const start = endpoint(terminal),
      next = tail[terminal.hasStub ? 2 : 1]
    if (!next || equal(start, next)) continue
    if (terminal.direction === 'left' && next.x > start.x + 0.5) return false
    if (terminal.direction === 'right' && next.x < start.x - 0.5) return false
    if (terminal.direction === 'top' && next.y > start.y + 0.5) return false
    if (terminal.direction === 'bottom' && next.y < start.y - 0.5) return false
  }
  return true
}

function join(entry, middle) {
  return dedupe([
    entry.source.point,
    ...(entry.source.hasStub ? [entry.source.stubPoint] : []),
    ...middle,
    ...(entry.target.hasStub ? [entry.target.stubPoint] : []),
    entry.target.point,
  ])
}

// A callback routes only the changed prefix/suffix. Retained bends never go through avoid.
export function repairManualRoute(entry, snapshot, connect, boxes) {
  const old = snapshot.points
  if (old.length < 2) return null
  const ds = {
    x: entry.source.point.x - snapshot.source.point.x,
    y: entry.source.point.y - snapshot.source.point.y,
  }
  const dt = {
    x: entry.target.point.x - snapshot.target.point.x,
    y: entry.target.point.y - snapshot.target.point.y,
  }
  if (
    equal(ds, dt) &&
    entry.source.direction === snapshot.source.direction &&
    entry.target.direction === snapshot.target.direction
  ) {
    const translated = old.map((p) => ({ x: p.x + ds.x, y: p.y + ds.y }))
    if (validRoute(translated, entry, boxes)) return translated
  }
  const startIndex = snapshot.source.hasStub ? 2 : 1
  const endIndex = old.length - (snapshot.target.hasStub ? 2 : 1)
  const middle = old.slice(startIndex, endIndex).map((p) => ({ ...p }))
  if (middle.length) {
    // Preserve all but the bend adjacent to each changed stub first.
    const adjust = (terminal, previous, bend) => {
      const oldStub = endpoint(previous),
        stub = endpoint(terminal)
      if (equal(stub, oldStub)) return
      if (Math.abs(bend.x - oldStub.x) < 0.5) bend.x = stub.x
      else if (Math.abs(bend.y - oldStub.y) < 0.5) bend.y = stub.y
    }
    adjust(entry.source, snapshot.source, middle[0])
    adjust(entry.target, snapshot.target, middle[middle.length - 1])
    const simple = join(entry, middle)
    if (validRoute(simple, entry, boxes)) return simple
  }
  // Keep the longest possible contiguous original middle section; deterministic ties.
  const originalMiddle = old.slice(startIndex, endIndex)
  for (let keep = originalMiddle.length; keep > 0; keep--) {
    for (let start = 0; start + keep <= originalMiddle.length; start++) {
      const retained = originalMiddle.slice(start, start + keep)
      const virtual = (point, side) => ({
        kind: 'repair',
        point,
        hasStub: false,
        direction: undefined,
        routePortId: `repair:${entry.edge.id}:${side}`,
        routeNodeId: `repair:${entry.edge.id}:${side}`,
      })
      const prefix = connect({
        ...entry,
        target: virtual(retained[0], 'target'),
      })
      if (!prefix) continue
      const suffix = connect({
        ...entry,
        source: virtual(retained[retained.length - 1], 'source'),
      })
      if (!suffix) continue
      const candidate = dedupe([...prefix, ...retained, ...suffix])
      if (validRoute(candidate, entry, boxes)) return candidate
    }
  }
  return null
}

export function scoreFixedPaths(points, fixed) {
  let score = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i]
    for (const path of fixed)
      for (let j = 1; j < path.points.length; j++) {
        const c = path.points[j - 1],
          d = path.points[j]
        if (equal(a, c) || equal(a, d) || equal(b, c) || equal(b, d)) continue
        if (a.y === b.y && c.y === d.y && a.y === c.y) {
          score +=
            Math.max(
              0,
              Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
                Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)),
            ) * 100
        } else if (a.x === b.x && c.x === d.x && a.x === c.x) {
          score +=
            Math.max(
              0,
              Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
                Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)),
            ) * 100
        } else {
          const h = a.y === b.y ? [a, b] : [c, d]
          const v = a.y === b.y ? [c, d] : [a, b]
          if (
            h[0].y === h[1].y &&
            v[0].x === v[1].x &&
            v[0].x > Math.min(h[0].x, h[1].x) &&
            v[0].x < Math.max(h[0].x, h[1].x) &&
            h[0].y > Math.min(v[0].y, v[1].y) &&
            h[0].y < Math.max(v[0].y, v[1].y)
          )
            score += 1500
        }
      }
  }
  return score
}
