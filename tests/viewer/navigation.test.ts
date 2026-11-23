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
  pathKey,
  rootPath,
  toHash,
  universeIds,
  up,
  type NavigationPath,
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
  const dbIds = ['kestrel', 'platform', 'eu-west', 'checkout', 'orders-db']
  /** Opens the given nodes one after the other from the root. */
  const walk = (...nodes: string[]): NavigationPath =>
    nodes.reduce<NavigationPath>((path, node) => openNode(architecture, path, node)!, rootPath(architecture))
  const db = walk('platform', 'eu-west', 'checkout', 'db')

  it('walks five levels down, then back to the root', () => {
    const root = rootPath(architecture)
    expect(root).toEqual([{ universe: 'kestrel' }])

    const platform = openNode(architecture, root, 'platform')!
    expect(platform).toEqual([{ universe: 'kestrel' }, { universe: 'platform', node: 'platform' }])
    const cluster = openNode(architecture, platform, 'eu-west')!
    const checkout = openNode(architecture, cluster, 'checkout')!
    const orders = openNode(architecture, checkout, 'db')!
    expect(universeIds(orders)).toEqual(dbIds)
    expect(orders[4]).toEqual({ universe: 'orders-db', node: 'db' }) // opened by the node `db`
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
    expect(universeIds(viaEu)).toEqual(['kestrel', 'platform', 'eu-west', 'checkout'])
    expect(universeIds(viaUs)).toEqual(['kestrel', 'platform', 'us-east', 'checkout'])
    expect(universeIds(up(viaUs))).toEqual(['kestrel', 'platform', 'us-east'])
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
    expect(toHash(architecture, db)).toBe('#/platform/eu-west/checkout/orders-db')
    expect(toHash(architecture, rootPath(architecture))).toBe('')
    expect(fromHash(architecture, '#/platform/eu-west/checkout/orders-db')).toEqual(db)
    expect(fromHash(architecture, '')).toEqual(rootPath(architecture))
    expect(fromHash(architecture, '#')).toEqual(rootPath(architecture))
  })

  it('keeps the longest valid prefix of a hand-edited hash', () => {
    const ids = (hash: string) => universeIds(fromHash(architecture, hash))
    expect(ids('#/eu-west')).toEqual(['kestrel']) // skips a level
    expect(ids('#/platform/nope/checkout')).toEqual(['kestrel', 'platform'])
    expect(ids('#/platform/%E0%A4%A')).toEqual(['kestrel', 'platform'])
    expect(ids('#/__proto__')).toEqual(['kestrel'])
    expect(ids('#/constructor')).toEqual(['kestrel'])
    // A node that does not open that universe, or a malformed step.
    expect(ids('#/platform~architecture')).toEqual(['kestrel'])
    expect(ids('#/platform~platform~platform')).toEqual(['kestrel'])
    expect(ids('#/platform~%E0%A4%A')).toEqual(['kestrel'])
    expect(ids('#/platform~platform/eu-west')).toEqual(['kestrel', 'platform', 'eu-west'])
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
    expect(fromHash(architecture, toHash(architecture, path))).toEqual(path)
    expect(goToLevel(path, 0)).toEqual([{ universe: 'u0' }])
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
    expect(universeIds(up(viaA))).toEqual(['root', 'a'])
    expect(universeIds(up(viaB))).toEqual(['root', 'b'])
    // Each parent has a single node opening it: the hash names no node.
    expect(toHash(architecture, viaB)).toBe('#/b/shared')
    expect(fromHash(architecture, '#/b/shared')).toEqual(viaB)
  })

  it('keeps the node used when several nodes of one universe open the same universe', () => {
    const architecture: Architecture = {
      root: 'root',
      universes: {
        root: universe('root', [node('a', 'shared'), node('plain'), node('b', 'shared'), node('c', 'other')]),
        shared: universe('shared', [node('inner', 'other')]),
        other: universe('other', []),
      },
    }
    const root = rootPath(architecture)
    const viaA = openNode(architecture, root, 'a')!
    const viaB = openNode(architecture, root, 'b')!
    expect(viaA).toEqual([{ universe: 'root' }, { universe: 'shared', node: 'a' }])
    expect(viaB).toEqual([{ universe: 'root' }, { universe: 'shared', node: 'b' }])
    expect(pathKey(viaA)).not.toBe(pathKey(viaB))
    // Back and breadcrumb return to the parent, whichever node was used.
    expect(up(viaB)).toEqual(root)
    expect(goToLevel(openNode(architecture, viaB, 'inner')!, 1)).toEqual(viaB)

    // The hash names the node only when it is not the first one that opens the universe.
    expect(toHash(architecture, viaA)).toBe('#/shared')
    expect(toHash(architecture, viaB)).toBe('#/shared~b')
    expect(toHash(architecture, openNode(architecture, viaB, 'inner')!)).toBe('#/shared~b/other')
    expect(toHash(architecture, openNode(architecture, root, 'c')!)).toBe('#/other')
    expect(fromHash(architecture, '#/shared~b')).toEqual(viaB)
    expect(fromHash(architecture, '#/shared~b/other')).toEqual(openNode(architecture, viaB, 'inner'))
    // A hash without a node opens it through the first such node; naming it works too.
    expect(fromHash(architecture, '#/shared')).toEqual(viaA)
    expect(fromHash(architecture, '#/shared~a')).toEqual(viaA)
    // A node that does not open that universe stops the path.
    expect(fromHash(architecture, '#/shared~plain')).toEqual(root)
    expect(fromHash(architecture, '#/shared~c')).toEqual(root)
    expect(linkingNode(architecture.universes['root'], 'shared', 'b')?.id).toBe('b')
    expect(linkingNode(architecture.universes['root'], 'shared', 'c')).toBeUndefined()
  })

  it('opens an empty universe', () => {
    const architecture: Architecture = {
      root: 'root',
      universes: { root: universe('root', [node('e', 'empty')]), empty: universe('empty', []) },
    }
    expect(universeIds(openNode(architecture, rootPath(architecture), 'e')!)).toEqual(['root', 'empty'])
  })
})
