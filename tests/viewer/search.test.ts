import { describe, expect, it } from 'vitest'
import type { Architecture, ArchitectureGroup, ArchitectureNode, Universe } from '../../src/core/types.ts'
import { fold, pathTo, search, searchIndex, universeDepths } from '../../viewer/src/search.ts'

const node = (id: string, name: string, extra: Partial<ArchitectureNode> = {}): ArchitectureNode => ({ id, name, ...extra })
const universe = (id: string, name: string, nodes: ArchitectureNode[], groups: ArchitectureGroup[] = []): Universe => ({
  id,
  name,
  direction: 'right',
  source: `${id}.yml`,
  groups,
  nodes,
  edges: [],
})

/**
 * root ─ platform (node `platform`) ─ cluster (nodes `eu` and `us`) ─ db (node `orders`)
 *      └ data (node `data`) ─ db (node `store`)
 */
function architecture(): Architecture {
  return {
    root: 'root',
    universes: {
      root: universe('root', 'Company', [
        node('platform', 'Platform', { universe: 'platform' }),
        node('data', 'Data', { universe: 'data' }),
        node('api', 'Public API', { group: 'edge' }),
      ], [{ id: 'edge', name: 'Edge' }]),
      platform: universe('platform', 'Platform', [
        node('eu', 'EU cluster', { universe: 'cluster' }),
        node('us', 'US cluster', { universe: 'cluster' }),
        node('api', 'API gateway', { group: 'services' }),
      ], [{ id: 'services', name: 'Services' }, { id: 'core', name: 'Core APIs', group: 'services' }]),
      cluster: universe('cluster', 'Cluster', [node('orders', 'Orders', { universe: 'db' }), node('api', 'Api')]),
      data: universe('data', 'Data', [node('store', 'Store', { universe: 'db' })]),
      db: universe('db', 'Database', [node('primary', 'Primary'), node('replica-a', 'Réplica'), node('replica-b', 'Réplica')]),
    },
  }
}

describe('fold', () => {
  it('ignores case and accents, and maps each character back to the name', () => {
    expect(fold('Réplica')).toEqual({ folded: 'replica', origin: [0, 1, 2, 3, 4, 5, 6] })
    // A decomposed accent (two code units) folds to one letter.
    expect(fold('Réx')).toEqual({ folded: 'rex', origin: [0, 1, 3] })
  })
})

describe('searchIndex', () => {
  it('lists every node and group once per universe, with its universe and group', () => {
    const index = searchIndex(architecture())
    // The cluster and the database are reached by several nodes: listed once.
    expect(index.filter((e) => e.id === 'primary')).toHaveLength(1)
    expect(index.find((e) => e.universe === 'root' && e.id === 'api')).toMatchObject({ kind: 'node', universeName: 'Company', groupName: 'Edge', depth: 0 })
    expect(index.find((e) => e.id === 'core')).toMatchObject({ kind: 'group', groupName: 'Services', depth: 1 })
    expect(universeDepths(architecture())).toEqual(new Map([['root', 0], ['platform', 1], ['data', 1], ['cluster', 2], ['db', 2]]))
  })
})

describe('search', () => {
  const index = searchIndex(architecture())
  const names = (query: string, current = 'root') => search(index, query, current).results.map((r) => `${r.entry.universe}/${r.entry.id}`)

  it('finds nothing for an empty query', () => {
    expect(search(index, '   ', 'root')).toEqual({ results: [], total: 0 })
  })

  it('shows the universe shown first, then the best matches, the shallowest universes first', () => {
    // Whole name, start of the name, start of a word, anywhere.
    expect(names('api')).toEqual(['root/api', 'cluster/api', 'platform/api', 'platform/core'])
    expect(names('api', 'cluster')).toEqual(['cluster/api', 'platform/api', 'root/api', 'platform/core'])
  })

  it('ignores case, accents and repeated spaces, and gives the matched part of the name', () => {
    const [result] = search(index, '  REPLI ', 'db').results
    expect(result).toMatchObject({ here: true, match: [0, 5] })
    expect(names('eu   cluster')).toEqual(['platform/eu'])
    const [gateway] = search(index, 'gate', 'root').results
    expect(gateway!.entry.name.slice(...gateway!.match)).toBe('gate')
  })

  it('finds groups as well as nodes', () => {
    expect(search(index, 'services', 'root').results.map((r) => r.entry.kind)).toEqual(['group'])
  })

  it('shows at most `limit` results and counts them all', () => {
    const { results, total } = search(index, 'a', 'root', 2)
    expect(results).toHaveLength(2)
    expect(total).toBeGreaterThan(2)
  })
})

describe('pathTo', () => {
  const arch = architecture()
  const path = (...steps: [string, string?][]) => steps.map(([universe, node]) => ({ universe, ...(node && { node }) }))

  it('stays on the path when the universe is on it', () => {
    const here = path(['root'], ['platform', 'platform'], ['cluster', 'us'])
    expect(pathTo(arch, here, 'cluster')).toEqual(here)
    expect(pathTo(arch, here, 'platform')).toEqual(here.slice(0, 2))
    expect(pathTo(arch, here, 'root')).toEqual(here.slice(0, 1))
  })

  it('goes down from the deepest level that leads to it, else from the root', () => {
    const here = path(['root'], ['platform', 'platform'], ['cluster', 'us'])
    expect(pathTo(arch, here, 'db')).toEqual([...here, { universe: 'db', node: 'orders' }])
    expect(pathTo(arch, path(['root'], ['data', 'data']), 'cluster')).toEqual(path(['root'], ['platform', 'platform'], ['cluster', 'eu']))
  })

  it('is undefined for a universe that cannot be reached', () => {
    expect(pathTo(arch, path(['root']), 'nowhere')).toBeUndefined()
  })
})
