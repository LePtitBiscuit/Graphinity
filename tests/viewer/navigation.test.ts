import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadArchitecture, type Architecture, type Universe } from '../../src/core/index.ts'
import {
  connectionsOf,
  currentId,
  fromHash,
  goToLevel,
  linkingNode,
  openNode,
  rootPath,
  toHash,
  up,
} from '../../viewer/src/navigation.ts'

const example = fileURLToPath(new URL('../../examples/kestrel/architecture.yml', import.meta.url))

async function kestrel(): Promise<Architecture> {
  // The example may have errors while it is being edited: what is valid is enough here.
  const { architecture } = await loadArchitecture(example)
  if (!architecture) throw new Error('example failed to load')
  return architecture
}

describe('navigation - Kestrel Logistics', async () => {
  const architecture = await kestrel()
  const db = ['kestrel', 'platform', 'eu-west', 'checkout', 'orders-db']

  it('walks five levels down, then back to the root', () => {
    const root = rootPath(architecture)
    expect(root).toEqual(['kestrel'])

    const platform = openNode(architecture, root, 'platform')!
    expect(platform).toEqual(['kestrel', 'platform'])
    const cluster = openNode(architecture, platform, 'eu-west')!
    const checkout = openNode(architecture, cluster, 'checkout')!
    const orders = openNode(architecture, checkout, 'db')!
    expect(orders).toEqual(db)
    expect(architecture.universes[currentId(orders)]!.nodes.map((n) => n.id)).toContain('primary')

    // Back button: one level at a time, stopping at the root.
    expect(up(orders)).toEqual(checkout)
    expect(up(up(up(up(orders))))).toEqual(root)
    expect(up(root)).toEqual(root)

    // Breadcrumb: any parent level directly.
    expect(goToLevel(orders, 0)).toEqual(root)
    expect(goToLevel(orders, 2)).toEqual(cluster)
    expect(goToLevel(orders, 4)).toEqual(orders)
    expect(goToLevel(orders, 99)).toEqual(orders)
  })

  it('reaches a shared universe through the path actually taken', () => {
    const platform = openNode(architecture, rootPath(architecture), 'platform')!
    const viaEu = openNode(architecture, openNode(architecture, platform, 'eu-west')!, 'checkout')!
    const viaUs = openNode(architecture, openNode(architecture, platform, 'us-east')!, 'checkout')!
    expect(viaEu).toEqual(['kestrel', 'platform', 'eu-west', 'checkout'])
    expect(viaUs).toEqual(['kestrel', 'platform', 'us-east', 'checkout'])
    expect(up(viaUs)).toEqual(['kestrel', 'platform', 'us-east'])
  })

  it('only opens nodes that have a sub-universe, in the current universe', () => {
    const root = rootPath(architecture)
    expect(openNode(architecture, root, 'stripe')).toBeUndefined()
    expect(openNode(architecture, root, 'eu-west')).toBeUndefined() // belongs to the platform
    expect(openNode(architecture, root, 'missing')).toBeUndefined()
    expect(openNode(architecture, db, 'primary')).toBeUndefined()
  })

  it('names breadcrumb steps after the node that opened them', () => {
    expect(linkingNode(architecture.universes['platform'], 'eu-west')?.name).toBe('eu-west-1')
    expect(linkingNode(architecture.universes['checkout'], 'orders-db')?.name).toBe('Orders DB')
  })

  it('round-trips paths through the URL hash', () => {
    expect(toHash(db)).toBe('#/platform/eu-west/checkout/orders-db')
    expect(toHash(rootPath(architecture))).toBe('')
    expect(fromHash(architecture, '#/platform/eu-west/checkout/orders-db')).toEqual(db)
    expect(fromHash(architecture, '')).toEqual(['kestrel'])
    expect(fromHash(architecture, '#')).toEqual(['kestrel'])
  })

  it('keeps the longest valid prefix of a hand-edited hash', () => {
    expect(fromHash(architecture, '#/eu-west')).toEqual(['kestrel']) // skips a level
    expect(fromHash(architecture, '#/platform/nope/checkout')).toEqual(['kestrel', 'platform'])
    expect(fromHash(architecture, '#/platform/%E0%A4%A')).toEqual(['kestrel', 'platform'])
    expect(fromHash(architecture, '#/__proto__')).toEqual(['kestrel'])
    expect(fromHash(architecture, '#/constructor')).toEqual(['kestrel'])
  })

  it('lists the connections of a node', () => {
    const node = (id: string) => ({ id, name: id, icon: { type: 'name' as const, name: 'x' } })
    const vps: Universe = {
      id: 'vps',
      name: 'VPS',
      direction: 'right',
      source: 'vps.yml',
      groups: [],
      nodes: ['nginx', 'frontend', 'api', 'postgres', 'redis'].map(node),
      edges: [
        { id: 'e0', from: 'nginx', to: 'frontend', label: 'HTTPS' },
        { id: 'e1', from: 'nginx', to: 'api', label: '/api' },
        { id: 'e2', from: 'api', to: 'postgres', label: 'SQL' },
        { id: 'e3', from: 'api', to: 'redis' },
        { id: 'e4', from: 'api', to: 'api', label: 'retry' },
      ],
    }
    expect(connectionsOf(vps, 'api').map((c) => [c.direction, c.node.id, c.label])).toEqual([
      ['in', 'nginx', '/api'],
      ['out', 'postgres', 'SQL'],
      ['out', 'redis', undefined],
      ['out', 'api', 'retry'], // a self-loop is listed once
    ])
    expect(connectionsOf(vps, 'frontend')).toHaveLength(1)
  })
})

describe('navigation - arbitrary depth and shared universes', () => {
  const node = (id: string, universe?: string) => ({
    id,
    name: id,
    icon: { type: 'name' as const, name: 'x' },
    ...(universe && { universe }),
  })
  const universe = (id: string, nodes: Universe['nodes']): Universe => ({ id, name: id, direction: 'right', source: `${id}.yml`, groups: [], nodes, edges: [] })

  it('navigates 200 levels deep and back', () => {
    const depth = 200
    const universes: Record<string, Universe> = {}
    for (let i = 0; i < depth; i++) universes[`u${i}`] = universe(`u${i}`, i + 1 < depth ? [node('down', `u${i + 1}`)] : [])
    const architecture: Architecture = { root: 'u0', universes }

    let path = rootPath(architecture)
    for (let i = 1; i < depth; i++) path = openNode(architecture, path, 'down')!
    expect(path).toHaveLength(depth)
    expect(currentId(path)).toBe(`u${depth - 1}`)
    expect(fromHash(architecture, toHash(path))).toEqual(path)
    expect(goToLevel(path, 0)).toEqual(['u0'])
  })

  it('keeps the path taken when a universe is shared by two parents', () => {
    const architecture: Architecture = {
      root: 'root',
      universes: {
        root: universe('root', [node('a', 'a'), node('b', 'b')]),
        a: universe('a', [node('s', 'shared')]),
        b: universe('b', [node('s', 'shared')]),
        shared: universe('shared', []),
      },
    }
    const viaA = openNode(architecture, openNode(architecture, rootPath(architecture), 'a')!, 's')!
    const viaB = openNode(architecture, openNode(architecture, rootPath(architecture), 'b')!, 's')!
    expect(up(viaA)).toEqual(['root', 'a'])
    expect(up(viaB)).toEqual(['root', 'b'])
  })

  it('opens an empty universe', () => {
    const architecture: Architecture = {
      root: 'root',
      universes: { root: universe('root', [node('e', 'empty')]), empty: universe('empty', []) },
    }
    expect(openNode(architecture, rootPath(architecture), 'e')).toEqual(['root', 'empty'])
  })
})
