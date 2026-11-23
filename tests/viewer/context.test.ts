import { describe, expect, it } from 'vitest'
import type { Architecture, ArchitectureEdge, ArchitectureNode, Universe } from '../../src/core/types.ts'
import { drawnEdges, portalNode, universeContext } from '../../viewer/src/context.ts'
import { connectionsOf } from '../../viewer/src/navigation.ts'

const node = (id: string, universe?: string): ArchitectureNode => ({ id, name: id.toUpperCase(), icon: { type: 'name', name: 'x' }, ...(universe && { universe }) })
const universe = (id: string, nodes: ArchitectureNode[], edges: Omit<ArchitectureEdge, 'id'>[] = []): Universe => ({
  id,
  name: id.toUpperCase(),
  direction: 'right',
  source: `${id}.yml`,
  groups: [],
  nodes,
  edges: edges.map((edge, index) => ({ id: `e${index}`, ...edge })),
})

/** root → org (node `org`) → vps (node `vps`). */
function architecture(rootEdges: Omit<ArchitectureEdge, 'id'>[], orgEdges: Omit<ArchitectureEdge, 'id'>[] = []): Architecture {
  return {
    root: 'root',
    universes: {
      root: universe('root', [node('github'), node('org', 'org'), node('mail')], rootEdges),
      org: universe('org', [node('ci'), node('vps', 'vps'), node('backups')], orgEdges),
      vps: universe('vps', [node('api'), node('db')]),
    },
  }
}

describe('universeContext', () => {
  it('has nothing at the root', () => {
    expect(universeContext(architecture([]), ['root'])).toEqual({ portals: [], edges: [] })
  })

  it('shows the parent nodes connected to the universe node as doors, without edges', () => {
    const { portals, edges } = universeContext(
      architecture([], [{ from: 'ci', to: 'vps', label: 'deploy' }, { from: 'vps', to: 'backups' }]),
      ['root', 'org', 'vps'],
    )
    expect(portals.map((p) => [p.id, p.role, p.level, p.node?.id])).toEqual([
      ['portal:1:ci', 'in', 1, 'ci'],
      ['portal:1:backups', 'out', 1, 'backups'],
    ])
    expect(edges).toEqual([])
  })

  it('draws connections declared higher up that reach into the universe', () => {
    const arch = architecture(
      [{ from: 'github', to: 'org', toPath: ['vps', 'api'], label: 'webhook', color: '#4f8cff' }],
      [
        { from: 'ci', to: 'vps', toPath: ['api'], toSide: 'top' },
        { from: 'vps', fromPath: ['db'], to: 'backups', fromSide: 'right' },
        { from: 'vps', fromPath: ['api'], to: 'vps', toPath: ['db'], style: 'dashed' },
      ],
    )
    const { portals, edges } = universeContext(arch, ['root', 'org', 'vps'])
    expect(portals.map((p) => [p.id, p.role])).toEqual([
      ['portal:0:github', 'in'],
      ['portal:1:ci', 'in'],
      ['portal:1:backups', 'out'],
    ])
    expect(edges).toEqual([
      { id: 'ctx:0:e0', from: 'portal:0:github', to: 'api', label: 'webhook', color: '#4f8cff' },
      { id: 'ctx:1:e0', from: 'portal:1:ci', to: 'api', toSide: 'top' },
      { id: 'ctx:1:e1', from: 'db', to: 'portal:1:backups', fromSide: 'right' },
      { id: 'ctx:1:e2', from: 'api', to: 'db', style: 'dashed' },
    ])
    // In the middle universe, the same connections end on the node that contains them.
    const middle = universeContext(arch, ['root', 'org'])
    expect(middle.portals.map((p) => p.id)).toEqual(['portal:0:github'])
    expect(middle.edges).toEqual([{ id: 'ctx:0:e0', from: 'portal:0:github', to: 'vps', label: 'webhook', color: '#4f8cff' }])
  })

  it('keeps one door per node, at the start of the flow if any connection comes from it', () => {
    const { portals } = universeContext(
      architecture([], [
        { from: 'vps', to: 'ci' },
        { from: 'ci', to: 'vps', toPath: ['api'] },
        { from: 'ci', to: 'vps', toPath: ['db'] },
      ]),
      ['root', 'org', 'vps'],
    )
    expect(portals.map((p) => [p.id, p.role])).toEqual([['portal:1:ci', 'in']])
  })

  it('ignores connections of distant ancestors to the universe node, and those to a container', () => {
    // github → org is about org, which contains vps: nothing in vps.
    const { portals } = universeContext(architecture([{ from: 'github', to: 'org' }]), ['root', 'org', 'vps'])
    expect(portals.map((p) => [p.id, p.node])).toEqual([['portal:1', undefined]])
  })

  it('adds a door back to the parent when no node is connected', () => {
    const [door] = universeContext(architecture([]), ['root', 'org']).portals
    expect(door).toMatchObject({ id: 'portal:0', level: 0, role: 'in', universe: { id: 'root' } })
    expect(portalNode(door!)).toEqual({ id: 'portal:0', name: 'ROOT', description: '↩ ROOT', size: 'large' })
  })

  it('depends on the path taken to the universe', () => {
    const arch = architecture([], [{ from: 'ci', to: 'vps', toPath: ['api'] }])
    // vps also opened from the root directly: the org's connection does not apply there.
    arch.universes['root']!.nodes.push(node('direct', 'vps'))
    arch.universes['root']!.edges.push({ id: 'e9', from: 'mail', to: 'direct', toPath: ['db'] })
    expect(universeContext(arch, ['root', 'org', 'vps']).edges.map((e) => e.from)).toEqual(['portal:1:ci'])
    expect(universeContext(arch, ['root', 'vps']).edges).toEqual([{ id: 'ctx:0:e9', from: 'portal:0:mail', to: 'db' }])
  })

  it('does not draw a connection into its own sub-universe as a loop', () => {
    const org = architecture([], [{ from: 'vps', to: 'vps', toPath: ['api'] }, { from: 'ci', to: 'vps' }]).universes['org']!
    expect(drawnEdges(org).map((e) => e.id)).toEqual(['e1'])
  })

  it('lists the connections with doors in the details of a node', () => {
    const arch = architecture([], [{ from: 'ci', to: 'vps', toPath: ['api'], label: 'deploy' }])
    const context = universeContext(arch, ['root', 'org', 'vps'])
    expect(connectionsOf(arch.universes['vps']!, 'api', context)).toEqual([
      { edgeId: 'ctx:1:e0', direction: 'in', node: arch.universes['org']!.nodes[0], label: 'deploy', external: { universe: 'ORG', level: 1 } },
    ])
  })
})
