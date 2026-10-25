import { AvoidLib } from 'libavoid-js'
import { describe, expect, it } from 'vite-plus/test'

describe('locked routing runtime', () => {
  it('loads real WASM and supports the fixed routes used by the parent canvas', async () => {
    await AvoidLib.load()
    const avoid = AvoidLib.getInstance()
    const router = new avoid.Router(avoid.RouterFlag.OrthogonalRouting.value)
    const first = new avoid.Point(0, 0),
      last = new avoid.Point(100, 100)
    const source = new avoid.ConnEnd(first),
      target = new avoid.ConnEnd(last)
    try {
      const connection = new avoid.ConnRef(router, source, target)
      const polygon = new avoid.Polygon(4)
      const points = [
        [0, 0],
        [0, 40],
        [100, 40],
        [100, 100],
      ]
      points.forEach(([x, y], index) => {
        const point = new avoid.Point(x, y)
        polygon.setPoint(index, point)
        point.delete()
      })
      connection.setFixedRoute(polygon)
      polygon.delete()
      router.processTransaction()
      expect(connection.hasFixedRoute()).toBe(true)
      const route = connection.displayRoute()
      const actual = Array.from({ length: route.size() }, (_, index) => {
        const point = route.at(index)
        const coordinates = [point.x, point.y]
        point.delete()
        return coordinates
      })
      route.delete()
      expect(actual).toEqual(points)
    } finally {
      source.delete()
      target.delete()
      first.delete()
      last.delete()
      router.delete()
    }
  })
})
