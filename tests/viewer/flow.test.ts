import { describe, expect, it } from 'vitest'
import type { Universe } from '../../src/core/index.ts'
import { toFlow, type RoutedFlowEdge } from '../../viewer/src/flow.ts'
import { layoutUniverse } from '../../viewer/src/layout.ts'

const node = (id: string, extra = {}) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' }, ...extra })

async function flowOf(universe: Universe) {
  return toFlow(await layoutUniverse(universe, (text) => text.length * 6.5), {}, universe.direction)
}

describe('toFlow', () => {
  it('lays out groups inside groups, parents first, each inside its parent', async () => {
    const flow = await flowOf({
      id: 'u',
      name: 'U',
      direction: 'right',
      source: 'u.yml',
      // Listed inner first: the flow must still give parents before children.
      groups: [
        { id: 'vnet', name: 'VNet', group: 'region' },
        { id: 'region', name: 'Region', group: 'cloud' },
        { id: 'cloud', name: 'Cloud', background: 'none' },
      ],
      nodes: [node('user'), node('front', { group: 'cloud' }), node('app', { group: 'region' }), node('db', { group: 'vnet' })],
      edges: [
        { id: 'e0', from: 'user', to: 'front' },
        { id: 'e1', from: 'front', to: 'app' },
        { id: 'e2', from: 'app', to: 'db' },
      ],
    })
    const ids = flow.nodes.map((n) => n.id)
    expect(ids.slice(0, 3)).toEqual(['group:cloud', 'group:region', 'group:vnet'])
    const byId = new Map(flow.nodes.map((n) => [n.id, n]))
    expect(byId.get('group:cloud')!.parentId).toBeUndefined()
    expect(byId.get('group:region')).toMatchObject({ parentId: 'group:cloud', extent: 'parent' })
    expect(byId.get('group:vnet')).toMatchObject({ parentId: 'group:region', extent: 'parent' })
    expect(byId.get('db')).toMatchObject({ parentId: 'group:vnet' })
    expect(byId.get('user')!.parentId).toBeUndefined()
    // Relative positions inside the parent, and the child frame fits inside it.
    for (const [child, parent] of [['group:region', 'group:cloud'], ['group:vnet', 'group:region'], ['db', 'group:vnet']] as const) {
      const c = byId.get(child)!
      const p = byId.get(parent)!
      expect(c.position.x).toBeGreaterThan(0)
      expect(c.position.y).toBeGreaterThan(0)
      expect(c.position.x + (c.width as number)).toBeLessThanOrEqual(p.width as number)
      expect(c.position.y + (c.height as number)).toBeLessThanOrEqual(p.height as number)
    }
  })

  it('maps arrowheads, colors and line styles of connections', async () => {
    const flow = await flowOf({
      id: 'u',
      name: 'U',
      direction: 'right',
      source: 'u.yml',
      groups: [],
      nodes: [node('a'), node('b')],
      edges: [
        { id: 'e0', from: 'a', to: 'b' },
        { id: 'e1', from: 'a', to: 'b', color: '#f85149', style: 'dashed', arrow: 'both' },
        { id: 'e2', from: 'b', to: 'a', style: 'dotted', arrow: 'start' },
        { id: 'e3', from: 'b', to: 'a', arrow: 'none' },
      ],
    })
    const edge = (id: string) => flow.edges.find((e) => e.id === id) as RoutedFlowEdge
    const marker = { type: 'arrowclosed', width: 16, height: 16 }

    expect(edge('e0')).toMatchObject({ markerEnd: marker })
    expect(edge('e0').markerStart).toBeUndefined()
    expect(edge('e0').data).not.toHaveProperty('color')

    expect(edge('e1')).toMatchObject({
      markerEnd: { ...marker, color: '#f85149' },
      markerStart: { ...marker, color: '#f85149' },
      data: { color: '#f85149', style: 'dashed' },
    })
    expect(edge('e2')).toMatchObject({ markerStart: marker, data: { style: 'dotted' } })
    expect(edge('e2').markerEnd).toBeUndefined()
    expect(edge('e3').markerStart).toBeUndefined()
    expect(edge('e3').markerEnd).toBeUndefined()
  })

  it('puts groups first, as parents of their nodes, with relative positions', async () => {
    const flow = await flowOf({
      id: 'u',
      name: 'U',
      direction: 'right',
      source: 'u.yml',
      groups: [{ id: 'g', name: 'G', color: '#4f8cff', border: 'dashed' }],
      nodes: [node('a', { group: 'g', color: '#ff8800', border: 'dotted' }), node('b')],
      edges: [{ id: 'e0', from: 'a', to: 'b', fromSide: 'top', toSide: 'bottom' }],
    })
    // Configured sides go with the connection, for rerouting after a drag.
    expect(flow.edges[0]!.data).toMatchObject({ fromSide: 'top', toSide: 'bottom' })
    const [group, a, b] = flow.nodes
    expect(group).toMatchObject({ id: 'group:g', type: 'cluster', data: { group: { color: '#4f8cff', border: 'dashed' } } })
    expect(a).toMatchObject({ id: 'a', parentId: 'group:g', extent: 'parent', data: { node: { color: '#ff8800', border: 'dotted' } } })
    // The frame never grows over other nodes: a node stays inside its group.
    expect(a).not.toHaveProperty('expandParent')
    expect(b).not.toHaveProperty('parentId')
    expect(a!.position.x).toBeGreaterThan(0)
    expect(a!.position.x).toBeLessThan(group!.width as number)
  })
})
