import { describe, expect, it } from 'vitest'
import { NODE_WIDTH, TILE_LEFT, TILE_SIZE, TILE_TOP, type Point, type Rect } from '../../viewer/src/layout.ts'
import { edgeCrossings, LANE_GAP, overlaps, routeAll, routeAround, shiftOf, type Connection, type NodeBox } from '../../viewer/src/route.ts'

const box = (x: number, y: number, height = 104): Rect => ({ x, y, width: NODE_WIDTH, height })
const middle = (b: Rect) => b.y + TILE_TOP + TILE_SIZE / 2

/** Does any segment of the route go through the inside of `b`? */
function crosses(points: Point[], b: Rect): boolean {
  return points.slice(1).some((p, i) => {
    const q = points[i]!
    return (
      Math.max(p.x, q.x) > b.x && Math.min(p.x, q.x) < b.x + b.width && Math.max(p.y, q.y) > b.y && Math.min(p.y, q.y) < b.y + b.height
    )
  })
}

function check(points: Point[]) {
  for (let i = 1; i < points.length; i++) {
    const [p, q] = [points[i - 1]!, points[i]!]
    expect(p.x === q.x || p.y === q.y, 'orthogonal').toBe(true)
  }
}

describe('routeAround', () => {
  it('goes straight between facing sides when nothing is in the way', () => {
    const a = box(0, 0)
    const b = box(400, 0)
    const { points, label } = routeAround(a, b, [])
    check(points)
    expect(points).toEqual([
      { x: TILE_LEFT + TILE_SIZE, y: middle(a) },
      { x: 400 + TILE_LEFT, y: middle(b) },
    ])
    expect(label.y).toBe(middle(a))
  })

  it('goes around a node in the way', () => {
    const a = box(0, 0)
    const b = box(600, 0)
    const wall = box(300, 0)
    const { points } = routeAround(a, b, [wall])
    check(points)
    expect(crosses(points, wall)).toBe(false)
    expect(points.at(-1)!.x).toBeLessThanOrEqual(600 + TILE_LEFT + TILE_SIZE)
  })

  it('takes the sides that face each other once a node is moved above its source', () => {
    const api = box(0, 400)
    const nginx = box(0, 0, 134)
    const { points } = routeAround(api, nginx, [])
    check(points)
    // Leaves the top of the API tile, enters below the Nginx text.
    expect(points[0]).toEqual({ x: NODE_WIDTH / 2, y: 400 + TILE_TOP })
    expect(points.at(-1)).toEqual({ x: NODE_WIDTH / 2, y: 134 })
    expect(points).toHaveLength(2)
  })

  it('never crosses the other nodes in the reported case (API moved below, to the left)', () => {
    // VPS universe after dragging the API: Nginx on top, Frontend below it, the API far left
    // below them, PostgreSQL and Redis in the Data group to the right.
    const nginx = box(176, 12, 134)
    const frontend = box(176, 236)
    const api = box(-135, 351)
    const postgres = box(352, 479)
    const redis = box(516, 479, 119)
    const all = [nginx, frontend, api, postgres, redis]
    const others = (...ends: Rect[]) => all.filter((b) => !ends.includes(b))

    for (const [from, to] of [
      [nginx, api],
      [nginx, frontend],
      [api, postgres],
      [api, redis],
    ] as const) {
      const { points } = routeAround(from, to, others(from, to))
      check(points)
      for (const obstacle of others(from, to)) expect(crosses(points, obstacle)).toBe(false)
    }
  })

  it('keeps the sides set in the configuration', () => {
    const a = box(0, 0)
    const b = box(400, 0)
    // Free: straight from the right of a to the left of b.
    expect(routeAround(a, b, []).points[0]).toEqual({ x: a.x + TILE_LEFT + TILE_SIZE, y: middle(a) })
    const { points } = routeAround(a, b, [], { from: 'top', to: 'bottom' })
    check(points)
    expect(points[0]).toEqual({ x: a.x + a.width / 2, y: a.y + TILE_TOP })
    expect(points.at(-1)).toEqual({ x: b.x + b.width / 2, y: b.y + b.height })
    // Only one end set: the other is chosen.
    const left = routeAround(a, b, [], { to: 'right' }).points
    expect(left.at(-1)).toEqual({ x: b.x + TILE_LEFT + TILE_SIZE, y: middle(b) })
  })

  it('attaches to the tile of each node size', () => {
    const large = { ...box(0, 0, 128), width: 176, tile: 80, tileLeft: 48 }
    const { points } = routeAround(large, box(400, 0), [])
    expect(points[0]).toEqual({ x: 48 + 80, y: TILE_TOP + 40 })
  })

  it('is deterministic', () => {
    const args = [box(0, 0), box(300, 300), [box(150, 150)]] as const
    expect(routeAround(...args)).toEqual(routeAround(...args))
  })
})

describe('edgeCrossings', () => {
  it('counts crossings, not meetings at an end or parallel segments', () => {
    const route = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    expect(edgeCrossings(route, [[{ x: 50, y: -50 }, { x: 50, y: 50 }]])).toBe(1)
    expect(edgeCrossings(route, [[{ x: 100, y: 0 }, { x: 100, y: 50 }]])).toBe(0)
    expect(edgeCrossings(route, [[{ x: 0, y: 10 }, { x: 100, y: 10 }]])).toBe(0)
  })
})

describe('overlaps', () => {
  it('counts segments drawn along another route, not crossings or meetings at a node', () => {
    const route = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]
    expect(overlaps(route, [[{ x: 50, y: 2 }, { x: 200, y: 2 }]])).toBe(1) // along the first segment
    expect(overlaps(route, [[{ x: 100, y: 50 }, { x: 100, y: 300 }]])).toBe(1) // along the second
    expect(overlaps(route, [[{ x: 50, y: -50 }, { x: 50, y: 50 }]])).toBe(0) // crossing
    expect(overlaps(route, [[{ x: 95, y: 0 }, { x: 105, y: 0 }]])).toBe(0) // a few pixels, at a corner
    expect(overlaps(route, [[{ x: 0, y: 20 }, { x: 100, y: 20 }]])).toBe(0) // parallel, apart
  })
})

describe('shiftOf', () => {
  it('finds the side of an end and its distance from the middle, and routeAround keeps it', () => {
    const a = box(0, 0)
    const middle = TILE_TOP + TILE_SIZE / 2
    expect(shiftOf({ x: TILE_LEFT + TILE_SIZE, y: middle + 9 }, a)).toEqual({ side: 'right', by: 9 })
    expect(shiftOf({ x: TILE_LEFT, y: middle - 9 }, a)).toEqual({ side: 'left', by: -9 })
    expect(shiftOf({ x: NODE_WIDTH / 2 + 5, y: TILE_TOP }, a)).toEqual({ side: 'top', by: 5 })
    expect(shiftOf({ x: NODE_WIDTH / 2 - 5, y: 104 }, a)).toEqual({ side: 'bottom', by: -5 })
    const b = box(400, 0)
    const route = routeAround(a, b, [], {}, [], { from: { side: 'right', by: 9 }, to: { side: 'left', by: 9 } })
    expect(route.points[0]).toEqual({ x: TILE_LEFT + TILE_SIZE, y: middle + 9 })
    expect(route.points.at(-1)).toEqual({ x: 400 + TILE_LEFT, y: middle + 9 })
  })
})

describe('routeAll', () => {
  const boxes = (entries: Record<string, Rect>) => new Map<string, NodeBox>(Object.entries(entries))
  const segmentsOf = (points: Point[]) => points.slice(1).map((q, i) => [points[i]!, q] as const)
  const intersects = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

  it('spreads the ends sharing a side, in the order of their directions, so that they do not cross', () => {
    // One source on top, three targets below it, left to right.
    const nodes = boxes({ hub: box(300, 0), a: box(0, 300), b: box(300, 300), c: box(600, 300) })
    const connections: Connection[] = ['a', 'b', 'c'].map((to) => ({ id: to, from: 'hub', to }))
    const routes = routeAll(nodes, connections, { out: 'bottom', in: 'top' })
    const starts = ['a', 'b', 'c'].map((id) => routes.get(id)!.points[0]!)
    // All three leave the bottom of the hub, at distinct places, ordered like their targets.
    for (const start of starts) expect(start.y).toBe(104)
    expect(starts[0]!.x).toBeLessThan(starts[1]!.x)
    expect(starts[1]!.x).toBeLessThan(starts[2]!.x)
    for (const route of routes.values()) check(route.points)
  })

  it('orders the ends of a side by where their routes turn, so that a fan of connections does not cross', () => {
    // A hub on top; targets below it on both sides, near and far: the routes turning closest to
    // the hub must take the outer places of its bottom side.
    const nodes = boxes({
      hub: box(600, 0),
      nearLeft: box(300, 200),
      farLeft: box(0, 600),
      nearRight: box(900, 200),
      farRight: box(1200, 600),
      below: box(600, 600),
    })
    const targets = ['nearLeft', 'farLeft', 'nearRight', 'farRight', 'below']
    const routes = routeAll(nodes, targets.map((to) => ({ id: to, from: 'hub', to })), { out: 'bottom', in: 'top' })
    const all = targets.map((id) => routes.get(id)!.points)
    for (const [i, route] of all.entries()) {
      check(route)
      expect(edgeCrossings(route, all.slice(i + 1)), targets[i]).toBe(0)
      expect(overlaps(route, all.slice(i + 1)), targets[i]).toBe(0)
    }
  })

  it('draws connections sharing a corridor side by side, not on top of each other', () => {
    // Two pairs of nodes far apart: both connections go down the same column between them.
    const nodes = boxes({ a: box(0, 0), b: box(0, 160), c: box(600, 600), d: box(600, 760) })
    const connections: Connection[] = [
      { id: 'ac', from: 'a', to: 'c', fromSide: 'right', toSide: 'left' },
      { id: 'bd', from: 'b', to: 'd', fromSide: 'right', toSide: 'left' },
    ]
    const routes = routeAll(nodes, connections)
    const [ac, bd] = [routes.get('ac')!.points, routes.get('bd')!.points]
    check(ac)
    check(bd)
    expect(overlaps(ac, [bd])).toBe(0)
    // The two vertical segments are parallel lanes.
    const verticals = (points: Point[]) => segmentsOf(points).filter(([p, q]) => p.x === q.x && p.y !== q.y).map(([p]) => p.x)
    const gap = Math.abs(verticals(ac)[0]! - verticals(bd)[0]!)
    expect(gap).toBeGreaterThanOrEqual(LANE_GAP)
  })

  it('draws a straight line between nearly aligned facing ends', () => {
    const nodes = boxes({ a: box(0, 0), b: box(400, 10) })
    const route = routeAll(nodes, [{ id: 'e', from: 'a', to: 'b', fromSide: 'right', toSide: 'left' }]).get('e')!
    expect(route.points).toHaveLength(2)
    expect(route.points[0]!.y).toBe(route.points[1]!.y)
  })

  it('puts labels on their route, off the nodes and off each other', () => {
    const nodes = boxes({ a: box(0, 0), b: box(400, 0), c: box(0, 300), d: box(400, 300) })
    const label = { width: 120, height: 18 }
    const connections: Connection[] = [
      { id: 'ab', from: 'a', to: 'b', label },
      { id: 'cd', from: 'c', to: 'd', label },
      { id: 'ad', from: 'a', to: 'd', label },
    ]
    const routes = routeAll(nodes, connections, { out: 'right', in: 'left' })
    const rects = [...routes.values()].map(({ label: center }) => ({ x: center!.x - 60, y: center!.y - 9, width: 120, height: 18 }))
    for (const rect of rects) for (const node of nodes.values()) expect(intersects(rect, node)).toBe(false)
    for (const [i, a] of rects.entries()) for (const b of rects.slice(i + 1)) expect(intersects(a, b)).toBe(false)
    // Each label sits on a segment of its own route.
    for (const route of routes.values()) {
      const { x, y } = route.label!
      const on = segmentsOf(route.points).some(
        ([p, q]) => x >= Math.min(p.x, q.x) - 0.5 && x <= Math.max(p.x, q.x) + 0.5 && y >= Math.min(p.y, q.y) - 0.5 && y <= Math.max(p.y, q.y) + 0.5,
      )
      expect(on).toBe(true)
    }
  })

  it('keeps the given route for a connection from a node to itself, and is deterministic', () => {
    const nodes = boxes({ a: box(0, 0), b: box(400, 0) })
    const loop = [{ x: 132, y: 40 }, { x: 160, y: 40 }, { x: 160, y: -10 }, { x: 72, y: -10 }, { x: 72, y: 12 }]
    const connections: Connection[] = [
      { id: 'loop', from: 'a', to: 'a', fallback: loop },
      { id: 'ab', from: 'a', to: 'b' },
    ]
    expect(routeAll(nodes, connections).get('loop')!.points).toEqual(loop)
    expect(routeAll(nodes, connections)).toEqual(routeAll(nodes, connections))
  })
})
