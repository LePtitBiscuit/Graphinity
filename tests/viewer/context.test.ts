import { describe, expect, it } from 'vitest'
import type { Architecture, ArchitectureEdge, ArchitectureNode, Universe } from '../../src/core/types.ts'
import { drawnEdges, portalNode, universeContext } from '../../viewer/src/context.ts'
import { connectionsOf, fromHash, openNode, rootPath, type NavigationPath } from '../../viewer/src/navigation.ts'

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

/** A path through these universes, each opened by the first node that opens it. */
const at = (...ids: string[]): NavigationPath => ids.map((universe) => ({ universe }))

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
    expect(universeContext(architecture([]), at('root'))).toEqual({ portals: [], edges: [] })
  })

  it('shows the parent nodes connected to the universe node as doors, without edges', () => {
    const { portals, edges } = universeContext(
      architecture([], [{ from: 'ci', to: 'vps', label: 'deploy' }, { from: 'vps', to: 'backups' }]),
      at('root', 'org', 'vps'),
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
    const { portals, edges } = universeContext(arch, at('root', 'org', 'vps'))
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
    const middle = universeContext(arch, at('root', 'org'))
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
      at('root', 'org', 'vps'),
    )
    expect(portals.map((p) => [p.id, p.role])).toEqual([['portal:1:ci', 'in']])
  })

  it('ignores connections of distant ancestors to the universe node, and those to a container', () => {
    // github → org is about org, which contains vps: nothing in vps.
    const { portals } = universeContext(architecture([{ from: 'github', to: 'org' }]), at('root', 'org', 'vps'))
    expect(portals.map((p) => [p.id, p.node])).toEqual([['portal:1', undefined]])
  })

  it('adds a door back to the parent when no node is connected', () => {
    const [door] = universeContext(architecture([]), at('root', 'org')).portals
    expect(door).toMatchObject({ id: 'portal:0', level: 0, role: 'in', universe: { id: 'root' } })
    expect(portalNode(door!)).toEqual({ id: 'portal:0', name: 'ROOT', description: '↩ ROOT', size: 'large' })
  })

  it('depends on the path taken to the universe', () => {
    const arch = architecture([], [{ from: 'ci', to: 'vps', toPath: ['api'] }])
    // vps also opened from the root directly: the org's connection does not apply there.
    arch.universes['root']!.nodes.push(node('direct', 'vps'))
    arch.universes['root']!.edges.push({ id: 'e9', from: 'mail', to: 'direct', toPath: ['db'] })
    expect(universeContext(arch, at('root', 'org', 'vps')).edges.map((e) => e.from)).toEqual(['portal:1:ci'])
    expect(universeContext(arch, at('root', 'vps')).edges).toEqual([{ id: 'ctx:0:e9', from: 'portal:0:mail', to: 'db' }])
  })

  it('follows the node actually used when several nodes of the parent open the universe', () => {
    // `vps` and `spare` both open vps; each has its own connections in org.
    const arch = architecture([], [
      { from: 'ci', to: 'vps', toPath: ['api'] },
      { from: 'spare', to: 'backups' },
      { from: 'spare', fromPath: ['db'], to: 'ci' },
    ])
    arch.universes['org']!.nodes.push(node('spare', 'vps'))
    const org = openNode(arch, rootPath(arch), 'org')!
    const viaVps = universeContext(arch, openNode(arch, org, 'vps')!)
    const viaSpare = universeContext(arch, openNode(arch, org, 'spare')!)
    expect(viaVps.portals.map((p) => p.id)).toEqual(['portal:1:ci'])
    expect(viaVps.edges).toEqual([{ id: 'ctx:1:e0', from: 'portal:1:ci', to: 'api' }])
    expect(viaSpare.portals.map((p) => [p.id, p.role])).toEqual([
      ['portal:1:backups', 'out'],
      ['portal:1:ci', 'out'],
    ])
    expect(viaSpare.edges).toEqual([{ id: 'ctx:1:e2', from: 'db', to: 'portal:1:ci' }])
    // The same context after a reload (the hash names the node).
    expect(universeContext(arch, fromHash(arch, '#/org/vps~spare'))).toEqual(viaSpare)
  })

  it('has no context when the recorded node does not open the universe', () => {
    const arch = architecture([], [{ from: 'ci', to: 'vps' }])
    expect(universeContext(arch, [{ universe: 'root' }, { universe: 'org', node: 'org' }, { universe: 'vps', node: 'ci' }])).toEqual({ portals: [], edges: [] })
  })

  it('does not draw a connection into its own sub-universe as a loop', () => {
    const org = architecture([], [{ from: 'vps', to: 'vps', toPath: ['api'] }, { from: 'ci', to: 'vps' }]).universes['org']!
    expect(drawnEdges(org).map((e) => e.id)).toEqual(['e1'])
  })

  it('lists the connections with doors in the details of a node', () => {
    const arch = architecture([], [{ from: 'ci', to: 'vps', toPath: ['api'], label: 'deploy' }])
    const context = universeContext(arch, at('root', 'org', 'vps'))
    expect(connectionsOf(arch.universes['vps']!, 'api', context)).toEqual([
      { edgeId: 'ctx:1:e0', direction: 'in', node: arch.universes['org']!.nodes[0], label: 'deploy', external: { universe: 'ORG', level: 1 } },
    ])
  })

  it('shows a group connected higher up as a door with its name and icon', () => {
    const arch = architecture([], [
      { from: 'backups', fromGroup: true, to: 'vps', toPath: ['db'] },
      { from: 'vps', to: 'backups', toGroup: true },
    ])
    arch.universes['org']!.groups = [{ id: 'backups', name: 'Backup site', icon: { type: 'name', name: 'y' } }]
    const { portals, edges } = universeContext(arch, at('root', 'org', 'vps'))
    expect(portals.map((p) => [p.id, p.role, p.group, p.node])).toEqual([
      ['portal:1:group:backups', 'in', true, { id: 'backups', name: 'Backup site', icon: { type: 'name', name: 'y' } }],
    ])
    expect(edges).toEqual([{ id: 'ctx:1:e0', from: 'portal:1:group:backups', to: 'db' }])
  })

  it('draws a connection from a node to the inside of its own universe inside, from a door for that node', () => {
    const arch = architecture([], [
      { from: 'vps', to: 'vps', toPath: ['api'], label: 'health' },
      { from: 'vps', fromPath: ['db'], to: 'vps', toSide: 'top' },
    ])
    // Not drawn in org (a loop on vps)...
    expect(drawnEdges(arch.universes['org']!)).toEqual([])
    // ...but inside vps, from (and to) the door for vps.
    const { portals, edges } = universeContext(arch, at('root', 'org', 'vps'))
    expect(portals.map((p) => [p.id, p.role])).toEqual([['portal:1:vps', 'in']])
    expect(edges).toEqual([
      { id: 'ctx:1:e0', from: 'portal:1:vps', to: 'api', label: 'health' },
      { id: 'ctx:1:e1', from: 'db', to: 'portal:1:vps' },
    ])
    // Two levels down, from the root: the same, with the door for org.
    const deep = architecture([{ from: 'org', to: 'org', toPath: ['vps', 'api'] }])
    expect(universeContext(deep, at('root', 'org', 'vps')).edges).toEqual([{ id: 'ctx:0:e0', from: 'portal:0:org', to: 'api' }])
    expect(universeContext(deep, at('root', 'org')).edges).toEqual([{ id: 'ctx:0:e0', from: 'portal:0:org', to: 'vps' }])
  })

  it('attaches a connection from higher up to the frame of a group of the sub-universe', () => {
    const arch = architecture([
      { from: 'github', to: 'org', toPath: ['vps', 'edge'], toPathGroup: true, label: 'deploy' },
      { from: 'org', fromPath: ['tools'], fromPathGroup: true, to: 'mail', fromSide: 'bottom' },
    ])
    arch.universes['org']!.groups = [{ id: 'tools', name: 'Tools' }]
    arch.universes['vps']!.groups = [{ id: 'edge', name: 'Edge' }]
    // In org: on the frame of the group `tools`; to `vps`, the node that holds the group `edge`.
    const org = universeContext(arch, at('root', 'org'))
    expect(org.edges).toEqual([
      { id: 'ctx:0:e0', from: 'portal:0:github', to: 'vps', label: 'deploy' },
      { id: 'ctx:0:e1', from: 'tools', fromGroup: true, to: 'portal:0:mail', fromSide: 'bottom' },
    ])
    // In vps: on the frame of the group `edge`.
    const vps = universeContext(arch, at('root', 'org', 'vps'))
    expect(vps.edges).toEqual([{ id: 'ctx:0:e0', from: 'portal:0:github', to: 'edge', toGroup: true, label: 'deploy' }])
    // A group left out (not shown): no connection.
    arch.universes['vps']!.groups = []
    expect(universeContext(arch, at('root', 'org', 'vps')).edges).toEqual([])
  })

  it('lists the groups a node is connected to in its details', () => {
    const arch = architecture([])
    const org = arch.universes['org']!
    org.groups = [{ id: 'ci', name: 'Pipelines' }]
    org.edges = [
      { id: 'e0', from: 'vps', to: 'ci', toGroup: true, label: 'logs' },
      // The group `ci`, not the node `ci`.
      { id: 'e1', from: 'ci', fromGroup: true, to: 'backups' },
    ]
    expect(connectionsOf(org, 'vps')).toEqual([{ edgeId: 'e0', direction: 'out', node: { id: 'ci', name: 'Pipelines' }, group: true, label: 'logs' }])
    expect(connectionsOf(org, 'ci')).toEqual([])
    expect(connectionsOf(org, 'backups')).toEqual([{ edgeId: 'e1', direction: 'in', node: { id: 'ci', name: 'Pipelines' }, group: true }])
  })
})
