import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadArchitecture, type Side, type Universe } from '../../src/core/index.ts'
import {
  BEHIND_OFFSET,
  DEFAULT_SIDES,
  layoutUniverse,
  NODE_WIDTH,
  nodeGeometry,
  roundedPath,
  TILE_LEFT,
  TILE_SIZE,
  TILE_TOP,
  GROUP_HEADER,
  type LaidOutNode,
  type Point,
  type Rect,
  type UniverseLayout,
} from '../../viewer/src/layout.ts'

const example = fileURLToPath(new URL('../../examples/kestrel/architecture.yml', import.meta.url))
const measure = (text: string) => text.length * 6.5

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function checkLayout(layout: UniverseLayout, direction: Universe['direction'] = 'right'): void {
  const { nodes, edges } = layout
  for (const [i, a] of nodes.entries()) {
    for (const b of nodes.slice(i + 1)) expect(overlaps(a, b), `${a.node.id} overlaps ${b.node.id}`).toBe(false)
  }
  const byId = new Map(nodes.map((n) => [n.node.id, n]))
  for (const edge of edges) {
    expect(edge.points.length).toBeGreaterThanOrEqual(2)
    // Orthogonal route: every segment is horizontal or vertical.
    for (let i = 1; i < edge.points.length; i++) {
      const [p, q] = [edge.points[i - 1]!, edge.points[i]!]
      expect(p.x === q.x || p.y === q.y, `${edge.id} segment ${i} is diagonal`).toBe(true)
    }
    // Connections attach to the tiles: across the middle of the tile on the left and right; into
    // the top of the tile and out below the text at the bottom. On the sides set in the
    // configuration; otherwise on the sides the universe flows through (ELK's route), or on any
    // side when a direct route replaced a detour.
    const source = byId.get(edge.from)!
    const target = byId.get(edge.to)!
    const defaults = DEFAULT_SIDES[direction]
    // On a side of the tile, within its extent (several connections are spread along it).
    const onSide = (n: LaidOutNode, point: Point | undefined, side: Side) => {
      if (!point) return false
      const { tile, tileLeft } = nodeGeometry(n.node.size)
      const [left, top] = [n.x + tileLeft, n.y + TILE_TOP]
      const acrossX = point.x >= left && point.x <= left + tile
      const acrossY = point.y >= top && point.y <= top + tile
      switch (side) {
        case 'left':
          return point.x === left && acrossY
        case 'right':
          // A node that opens a universe: on the tile drawn behind it.
          return point.x === left + tile + (n.node.universe !== undefined ? BEHIND_OFFSET : 0) && acrossY
        case 'top':
          return point.y === top && acrossX
        case 'bottom':
          return point.y === n.y + n.height && acrossX
      }
    }
    const sides: Side[] = ['left', 'right', 'top', 'bottom']
    const isAnchor = (n: LaidOutNode, point: Point | undefined, side: Side | undefined) => (side ? [side] : sides).some((s) => onSide(n, point, s))
    expect(isAnchor(source, edge.points[0], edge.edge.fromSide), `${edge.id} start`).toBe(true)
    expect(isAnchor(target, edge.points.at(-1), edge.edge.toSide), `${edge.id} end`).toBe(true)
    // Off the flow's sides (and not set in the configuration): a direct route, at most 3 turns.
    const onFlow =
      (edge.edge.fromSide !== undefined || isAnchor(source, edge.points[0], defaults.out)) &&
      (edge.edge.toSide !== undefined || isAnchor(target, edge.points.at(-1), defaults.in))
    if (!onFlow) expect(edge.points.length, `${edge.id} is a direct route`).toBeLessThanOrEqual(5)
    if (edge.label) {
      for (const node of nodes) expect(overlaps(edge.label, node), `label of ${edge.id} overlaps ${node.node.id}`).toBe(false)
    }
  }
}

describe('layoutUniverse', async () => {
  // The example may have errors while it is being edited: what is valid is enough here.
  const architecture = (await loadArchitecture(example)).architecture
  if (!architecture) throw new Error('example failed to load')
  const result = { architecture }
  const universes = Object.values(architecture.universes)

  it.each(universes.map((u) => [u.id, u] as const))('lays out %s without overlaps', async (_, universe) => {
    const layout = await layoutUniverse(universe, measure)
    expect(layout.nodes.map((n) => n.node.id)).toEqual(universe.nodes.map((n) => n.id))
    checkLayout(layout, universe.direction)
  })

  it.each(['right', 'down', 'left', 'up'] as const)('follows the universe direction: %s', async (direction) => {
    const catalog = { ...result.architecture.universes['catalog']!, direction }
    const layout = await layoutUniverse(catalog, measure)
    checkLayout(layout, direction)
    const at = (id: string) => layout.nodes.find((n) => n.node.id === id)!
    // The API comes first in the flow, the search engine after it.
    if (direction === 'right') expect(at('search').x).toBeGreaterThan(at('api').x)
    if (direction === 'left') expect(at('search').x).toBeLessThan(at('api').x)
    if (direction === 'down') expect(at('search').y).toBeGreaterThan(at('api').y)
    if (direction === 'up') expect(at('search').y).toBeLessThan(at('api').y)
  })

  it('only draws the connection closing a loop against the flow', async () => {
    const node = (id: string) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' } })
    const vps: Universe = {
      id: 'vps',
      name: 'VPS',
      direction: 'down',
      source: 'vps.yml',
      groups: [],
      nodes: ['nginx', 'frontend', 'api', 'postgres', 'redis'].map(node),
      edges: [
        { id: 'e0', from: 'nginx', to: 'frontend' },
        { id: 'e1', from: 'nginx', to: 'api' },
        { id: 'e2', from: 'api', to: 'postgres' },
        { id: 'e3', from: 'api', to: 'redis' },
        { id: 'e4', from: 'api', to: 'nginx' }, // closes the loop nginx → api → nginx
      ],
    }
    const rows = async (universe: Universe) => {
      const layout = await layoutUniverse(universe, measure)
      checkLayout(layout, universe.direction)
      const y = new Map<number, string[]>()
      for (const n of layout.nodes) y.set(n.y, [...(y.get(n.y) ?? []), n.node.id])
      return [...y.entries()].sort((a, b) => a[0] - b[0]).map(([, ids]) => ids.sort())
    }
    // The loop does not move nginx: same rows as without the connection back.
    const expected = [['nginx'], ['api', 'frontend'], ['postgres', 'redis']]
    expect(await rows(vps)).toEqual(expected)
    expect(await rows({ ...vps, edges: vps.edges.slice(0, 4) })).toEqual(expected)
    // Without any loop, a connection to a node listed earlier still follows the flow.
    const plain = await layoutUniverse({ ...vps, edges: [{ id: 'e0', from: 'redis', to: 'nginx' }] }, measure)
    const y = (id: string) => plain.nodes.find((n) => n.node.id === id)!.y
    expect(y('redis')).toBeLessThan(y('nginx'))
    // A loop without entry starts at the node listed first in the file.
    const loop = (order: string[]): Universe => ({
      ...vps,
      nodes: order.map(node),
      edges: [
        { id: 'e0', from: 'x', to: 'y' },
        { id: 'e1', from: 'y', to: 'z' },
        { id: 'e2', from: 'z', to: 'x' },
      ],
    })
    expect(await rows(loop(['x', 'y', 'z']))).toEqual([['x'], ['y'], ['z']])
    expect(await rows(loop(['z', 'y', 'x']))).toEqual([['z'], ['x'], ['y']])
  })

  it.each(['right', 'down'] as const)('frames grouped nodes and routes connections across groups (%s)', async (direction) => {
    const node = (id: string, group?: string) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' }, ...(group && { group }) })
    const universe: Universe = {
      id: 'u',
      name: 'U',
      direction,
      source: 'u.yml',
      groups: [{ id: 'vercel', name: 'Vercel' }, { id: 'data', name: 'Data' }],
      nodes: [node('client'), node('next', 'vercel'), node('hono', 'vercel'), node('db', 'data'), node('cache', 'data'), node('mail')],
      edges: [
        { id: 'e0', from: 'client', to: 'next', label: 'HTTPS' },
        { id: 'e1', from: 'next', to: 'hono', label: 'RPC' },
        { id: 'e2', from: 'hono', to: 'db', label: 'SQL' },
        { id: 'e3', from: 'hono', to: 'cache' },
        { id: 'e4', from: 'hono', to: 'mail' },
      ],
    }
    const layout = await layoutUniverse(universe, measure)
    checkLayout(layout, direction)
    expect(layout.groups.map((g) => g.group.id)).toEqual(['vercel', 'data'])

    const inside = (outer: Rect, inner: Rect) =>
      inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height
    for (const group of layout.groups) {
      for (const laid of layout.nodes) {
        if (laid.node.group === group.group.id) expect(inside(group, laid), `${laid.node.id} in ${group.group.id}`).toBe(true)
        else expect(overlaps(group, laid), `${laid.node.id} outside ${group.group.id}`).toBe(false)
      }
      // Room for the header above the first nodes.
      const top = Math.min(...layout.nodes.filter((n) => n.node.group === group.group.id).map((n) => n.y))
      expect(top - group.y).toBeGreaterThanOrEqual(GROUP_HEADER)
    }
    const [vercel, data] = layout.groups
    expect(overlaps(vercel!, data!)).toBe(false)
  })

  it.each(['right', 'down'] as const)('follows the placement hints place and after (%s)', async (direction) => {
    const node = (id: string, extra: object = {}) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' }, ...extra })
    const universe: Universe = {
      id: 'u',
      name: 'U',
      direction,
      source: 'u.yml',
      groups: [],
      // a → b → c; d, e and f have no connections.
      nodes: [node('a'), node('b'), node('c'), node('d', { after: 'b' }), node('e', { place: 'last' }), node('f'), node('g', { place: 'first' })],
      edges: [
        { id: 'e0', from: 'a', to: 'b' },
        { id: 'e1', from: 'b', to: 'c' },
        { id: 'e2', from: 'f', to: 'c' },
      ],
    }
    const layout = await layoutUniverse(universe, measure)
    checkLayout(layout, direction)
    const at = (id: string) => {
      const n = layout.nodes.find((laid) => laid.node.id === id)!
      return direction === 'right' ? n.x : n.y
    }
    expect(at('d')).toBeGreaterThan(at('b')) // after b, although it has no connection
    expect(at('e')).toBe(at('c')) // the last layer
    expect(at('g')).toBe(at('a')) // the first layer
    // Without hints, d and e would be in the first layer.
    const plain = await layoutUniverse({ ...universe, nodes: universe.nodes.map(({ place: _p, after: _a, ...n }) => n) }, measure)
    const first = (id: string) => (direction === 'right' ? plain.nodes.find((n) => n.node.id === id)!.x : plain.nodes.find((n) => n.node.id === id)!.y)
    expect(first('d')).toBe(first('a'))
    expect(first('e')).toBe(first('a'))
  })

  it('replaces a detour around a group by a direct route', async () => {
    // The group holds a target of the hub (obs) and a source of it (reg): ELK keeps the group in
    // one layer, so reg → hub goes against the flow and around the diagram.
    const node = (id: string, group?: string) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' }, ...(group && { group }) })
    const universe: Universe = {
      id: 'u',
      name: 'U',
      direction: 'down',
      source: 'u.yml',
      groups: [{ id: 'shared', name: 'Shared' }],
      nodes: [node('top'), node('hub'), node('obs', 'shared'), node('reg', 'shared'), node('store', 'shared')],
      edges: [
        { id: 'e0', from: 'top', to: 'hub' },
        { id: 'e1', from: 'hub', to: 'obs', label: 'metrics' },
        { id: 'e2', from: 'hub', to: 'store' },
        { id: 'e3', from: 'reg', to: 'hub', label: 'images' },
      ],
    }
    const layout = await layoutUniverse(universe, measure)
    checkLayout(layout, 'down')
    const at = (id: string) => layout.nodes.find((n) => n.node.id === id)!
    const back = layout.edges.find((e) => e.id === 'e3')!
    // Within the box spanned by both nodes (plus the short stubs): no detour.
    const [reg, hub] = [at('reg'), at('hub')]
    const box = { minX: Math.min(reg.x, hub.x) - 20, maxX: Math.max(reg.x + reg.width, hub.x + hub.width) + 20, minY: Math.min(reg.y, hub.y) - 20, maxY: Math.max(reg.y + reg.height, hub.y + hub.height) + 20 }
    for (const p of back.points) expect(p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY, `${p.x},${p.y}`).toBe(true)
    // The label follows the route.
    const label = back.label!
    expect(label.x + label.width / 2 >= box.minX && label.x + label.width / 2 <= box.maxX).toBe(true)
  })

  it('keeps labeled and unlabeled siblings in the same column', async () => {
    const node = (id: string, group?: string) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' }, ...(group && { group }) })
    const layout = await layoutUniverse(
      {
        id: 'vps',
        name: 'VPS',
        direction: 'right',
        source: 'vps.yml',
        groups: [{ id: 'data', name: 'Data' }],
        nodes: [node('nginx'), node('frontend'), node('api'), node('postgres', 'data'), node('redis', 'data')],
        edges: [
          { id: 'e0', from: 'nginx', to: 'frontend', label: 'HTTPS' },
          { id: 'e1', from: 'nginx', to: 'api', label: '/api' },
          { id: 'e2', from: 'api', to: 'postgres', label: 'SQL' },
          { id: 'e3', from: 'api', to: 'redis' },
        ],
      },
      measure,
    )
    const x = (id: string) => layout.nodes.find((n) => n.node.id === id)!.x
    expect(x('postgres')).toBe(x('redis'))
    expect(x('frontend')).toBe(x('api'))
  })

  it('sizes nodes by content and labels by text width', async () => {
    const layout = await layoutUniverse(result.architecture.universes['catalog']!, measure)
    // Same size; the API has a description, the database does not.
    const api = layout.nodes.find((n) => n.node.id === 'api')!
    const db = layout.nodes.find((n) => n.node.id === 'db')!
    expect(api.height).toBeGreaterThan(db.height)
    const queries = layout.edges.find((e) => e.label?.text === 'queries')!.label!
    expect(queries.width).toBeGreaterThan(measure('queries'))
    expect(layout.edges.find((e) => e.to === 'stock')!.label).toBeUndefined()
  })

  it('handles empty universes, isolated nodes, parallel edges and self-loops', async () => {
    const node = (id: string) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' } })
    const universe: Universe = {
      id: 'u',
      name: 'U',
      direction: 'right',
      source: 'u.yml',
      groups: [],
      nodes: [node('a'), node('b'), node('lonely'), node('e0')],
      edges: [
        { id: 'e0', from: 'a', to: 'b', label: 'one' },
        { id: 'e1', from: 'a', to: 'b', label: 'two' },
        { id: 'e2', from: 'b', to: 'b' },
        { id: 'e3', from: 'e0', to: 'a' },
      ],
    }
    checkLayout(await layoutUniverse(universe, measure))
    expect(await layoutUniverse({ ...universe, nodes: [], edges: [] }, measure)).toEqual({ groups: [], nodes: [], edges: [] })
  })
})

describe('roundedPath', () => {
  it('draws straight segments', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M 0 0 L 10 0')
    expect(roundedPath([])).toBe('')
  })

  it('rounds corners, never beyond half a segment', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6 }], 8)).toBe(
      'M 0 0 L 17 0 Q 20 0 20 3 L 20 6',
    )
  })
})

describe('layoutUniverse - node sizes and connection sides', () => {
  const node = (id: string, size?: 'small' | 'medium' | 'large') => ({ id, name: id, icon: { type: 'name' as const, name: 'x' }, ...(size && { size }) })
  const base = (direction: Universe['direction'] = 'right'): Universe => ({
    id: 'u',
    name: 'U',
    direction,
    source: 'u.yml',
    groups: [],
    nodes: [node('a'), node('b')],
    edges: [],
  })

  it('gives each size its box and tile, without overlaps', async () => {
    expect([nodeGeometry('small'), nodeGeometry(undefined), nodeGeometry('large')].map((g) => [g.width, g.tile])).toEqual([
      [120, 40],
      [NODE_WIDTH, TILE_SIZE],
      [176, 80],
    ])
    for (const size of ['small', 'medium', 'large'] as const) {
      const g = nodeGeometry(size)
      // The tile is centred in its box.
      expect(g.tileLeft * 2 + g.tile).toBe(g.width)
    }
    const universe = { ...base(), nodes: [node('a', 'small'), node('b'), node('c', 'large')], edges: [{ id: 'e0', from: 'a', to: 'b' }, { id: 'e1', from: 'b', to: 'c' }] }
    const layout = await layoutUniverse(universe, measure)
    const [a, b, c] = layout.nodes
    expect([a!.width, b!.width, c!.width]).toEqual([120, NODE_WIDTH, 176])
    expect(c!.height - b!.height).toBe(80 - TILE_SIZE)
    for (const [i, p] of layout.nodes.entries()) for (const q of layout.nodes.slice(i + 1)) expect(overlaps(p, q)).toBe(false)
    // Default sides, on the tile of each size: out of the right of a, into the left of c.
    const middle = (n: Rect, tile: number) => n.y + TILE_TOP + tile / 2
    expect(layout.edges[0]!.points[0]).toEqual({ x: a!.x + 40 + 40, y: middle(a!, 40) })
    expect(layout.edges[1]!.points.at(-1)).toEqual({ x: c!.x + 48, y: middle(c!, 80) })
  })

  it.each(['right', 'down'] as const)('attaches connections to the configured sides, also against the flow (%s)', async (direction) => {
    const universe: Universe = {
      ...base(direction),
      edges: [
        { id: 'e0', from: 'a', to: 'b', fromSide: 'top', toSide: 'top' },
        { id: 'e1', from: 'a', to: 'b', fromSide: 'left', toSide: 'right' },
        { id: 'e2', from: 'a', to: 'b', fromSide: 'bottom' },
        { id: 'e3', from: 'a', to: 'b' },
      ],
    }
    const layout = await layoutUniverse(universe, measure)
    const [a, b] = layout.nodes
    // On the side of the tile, within it (connections sharing a side are spread along it).
    const on = (n: Rect, side: Side, p: Point | undefined) => {
      const [left, top] = [n.x + TILE_LEFT, n.y + TILE_TOP]
      const acrossX = p!.x >= left && p!.x <= left + TILE_SIZE
      const acrossY = p!.y >= top && p!.y <= top + TILE_SIZE
      if (side === 'left') return p!.x === left && acrossY
      if (side === 'right') return p!.x === left + TILE_SIZE && acrossY
      if (side === 'top') return p!.y === top && acrossX
      return p!.y === n.y + n.height && acrossX
    }
    const [top, sides, bottom, plain] = layout.edges
    expect(on(a!, 'top', top!.points[0])).toBe(true)
    expect(on(b!, 'top', top!.points.at(-1))).toBe(true)
    expect(on(a!, 'left', sides!.points[0])).toBe(true)
    expect(on(b!, 'right', sides!.points.at(-1))).toBe(true)
    expect(on(a!, 'bottom', bottom!.points[0])).toBe(true)
    // Only the configured end moves: the other one keeps the default side.
    const defaultSide = direction === 'right' ? 'left' : 'top'
    expect(on(b!, defaultSide, bottom!.points.at(-1))).toBe(true)
    expect(on(b!, defaultSide, plain!.points.at(-1))).toBe(true)
    // Two connections on the same side get their own place on it.
    expect(bottom!.points.at(-1)).not.toEqual(plain!.points.at(-1))
    for (const edge of layout.edges) {
      for (let i = 1; i < edge.points.length; i++) {
        const [p, q] = [edge.points[i - 1]!, edge.points[i]!]
        expect(p.x === q.x || p.y === q.y, `${edge.id} segment ${i} is diagonal`).toBe(true)
      }
    }
  })
})

describe('layoutUniverse - doors at the start and end of the flow', () => {
  const node = (id: string) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' } })
  it.each(['right', 'down'] as const)('puts "first" nodes in the first layer and "last" ones in the last (%s)', async (direction) => {
    const universe: Universe = {
      id: 'u',
      name: 'U',
      direction,
      source: 'u.yml',
      groups: [],
      nodes: [node('a'), node('b'), node('c'), node('in'), node('out'), node('alone')],
      edges: [
        { id: 'e0', from: 'a', to: 'b' },
        { id: 'e1', from: 'b', to: 'c' },
        { id: 'e2', from: 'in', to: 'b' },
        { id: 'e3', from: 'b', to: 'out' },
      ],
    }
    const layout = await layoutUniverse(universe, measure, { first: new Set(['in', 'alone']), last: new Set(['out']) })
    const along = (id: string) => {
      const n = layout.nodes.find((l) => l.node.id === id)!
      return direction === 'right' ? n.x : n.y
    }
    const all = layout.nodes.map((n) => along(n.node.id))
    expect(along('in')).toBe(Math.min(...all))
    expect(along('alone')).toBe(Math.min(...all))
    expect(along('out')).toBe(Math.max(...all))
  })
})
