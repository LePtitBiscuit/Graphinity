// What the ancestors of the current universe say about it: the connections declared higher up
// that reach into it (`ci → vps/api`), and the nodes of the parent connected to the node that
// opens it. Nodes of other universes are shown as "doors" (portals): clicking one goes back to
// its universe. Pure functions, unit-tested; depends on the path actually taken (a universe may
// be reached through different parents, or through several nodes of one parent).
import type { Architecture, ArchitectureEdge, ArchitectureNode, Universe } from '../../src/core/types.ts'
import { linkingNode, universeAt, type NavigationPath } from './navigation.ts'

export interface Portal {
  /**
   * Vue Flow / ELK id: `portal:<level>:<node id>`, `portal:<level>:group:<group id>` for a group,
   * or `portal:<level>` for the generic door.
   */
  id: string
  /** Breadcrumb level of the universe it belongs to (where clicking it goes). */
  level: number
  universe: Universe
  /** The node it stands for (for a group: its name and icon); absent for the generic door back to the parent. */
  node?: ArchitectureNode
  /** The node stands for this group of that universe. */
  group?: true
  /** `in`: connections come from it (start of the flow); `out`: they go to it (end of the flow). */
  role: 'in' | 'out'
}

export interface UniverseContext {
  portals: Portal[]
  /** Connections between nodes of the universe and portals, or between nodes of the universe. */
  edges: ArchitectureEdge[]
}

const EMPTY: UniverseContext = { portals: [], edges: [] }

type End =
  | { kind: 'inside'; node: string; exact: boolean; group?: true }
  | { kind: 'self' }
  | { kind: 'external'; level: number; node: string; group?: true }
  | { kind: 'ignored' }

export function universeContext(architecture: Architecture, path: NavigationPath): UniverseContext {
  const depth = path.length - 1
  if (depth < 1) return EMPTY
  const universes = path.map((step) => universeAt(architecture, step.universe))
  if (universes.some((u) => !u)) return EMPTY
  /** The node that opened each level: the one recorded in the path. */
  const chain: string[] = []
  for (let level = 0; level < depth; level++) {
    const step = path[level + 1]!
    const node = linkingNode(universes[level], step.universe, step.node)
    if (!node) return EMPTY
    chain.push(node.id)
  }

  /**
   * Where the end `endPath`, declared in the universe at `level`, is seen from the current universe.
   * `group`: its last id is a group (of the universe it reaches), not a node.
   */
  const classify = (endPath: string[], level: number, group?: true): End => {
    const last = endPath.length - 1
    for (let t = 0; level + t < depth; t++) {
      if (t > last) return { kind: 'ignored' } // an ancestor that contains the universe
      // A group does not open a universe: on the way down, it is a group of that ancestor.
      if (group && t === last) return { kind: 'external', level: level + t, node: endPath[t]!, group: true }
      if (endPath[t] !== chain[level + t]) return { kind: 'external', level: level + t, node: endPath[t]! }
    }
    const rest = endPath.slice(depth - level)
    if (group && rest.length === 1) return { kind: 'inside', node: rest[0]!, exact: true, group: true }
    return rest.length === 0 ? { kind: 'self' } : { kind: 'inside', node: rest[0]!, exact: rest.length === 1 }
  }

  const current = universes[depth]!
  const portals = new Map<string, Portal>()
  const edges: ArchitectureEdge[] = []
  const portalFor = (end: { level: number; node: string; group?: true }, role: Portal['role']): string | undefined => {
    const universe = universes[end.level]!
    const group = end.group ? universe.groups.find((g) => g.id === end.node) : undefined
    // A group is shown as a door with its name and icon.
    const node = end.group ? group && { id: group.id, name: group.name, ...(group.icon && { icon: group.icon }) } : universe.nodes.find((n) => n.id === end.node)
    if (!node) return undefined
    const id = end.group ? `portal:${end.level}:group:${node.id}` : `portal:${end.level}:${node.id}`
    const known = portals.get(id)
    // A door that is a source of some connection stays at the start of the flow.
    if (!known) portals.set(id, { id, level: end.level, universe, node, role, ...(end.group && { group: true as const }) })
    else if (role === 'in') known.role = 'in'
    return id
  }

  for (let level = 0; level < depth; level++) {
    for (const edge of universes[level]!.edges) {
      // A group is in the universe that declares it, never on the way down: always a door.
      const from: End = edge.fromGroup ? { kind: 'external', level, node: edge.from, group: true } : classify([edge.from, ...(edge.fromPath ?? [])], level, edge.fromPathGroup)
      const to: End = edge.toGroup ? { kind: 'external', level, node: edge.to, group: true } : classify([edge.to, ...(edge.toPath ?? [])], level, edge.toPathGroup)
      const {
        id: _id,
        from: _f,
        to: _t,
        fromPath: _fp,
        toPath: _tp,
        fromGroup: _fg,
        toGroup: _tg,
        fromPathGroup: _fpg,
        toPathGroup: _tpg,
        align: _al,
        fromSide,
        toSide,
        ...style
      } = edge
      // An end on a group of this universe attaches to its frame.
      const fromHere = from.kind === 'inside' && from.group ? { fromGroup: true as const } : {}
      const toHere = to.kind === 'inside' && to.group ? { toGroup: true as const } : {}
      const id = `ctx:${level}:${edge.id}`
      if (from.kind === 'inside' && to.kind === 'inside') {
        edges.push({
          id,
          from: from.node,
          to: to.node,
          ...fromHere,
          ...toHere,
          ...style,
          ...(from.exact && fromSide && { fromSide }),
          ...(to.exact && toSide && { toSide }),
        })
      } else if (from.kind === 'inside' && to.kind === 'external') {
        const portal = portalFor(to, 'out')
        if (portal) edges.push({ id, from: from.node, to: portal, ...fromHere, ...style, ...(from.exact && fromSide && { fromSide }) })
      } else if (from.kind === 'external' && to.kind === 'inside') {
        const portal = portalFor(from, 'in')
        if (portal) edges.push({ id, from: portal, to: to.node, ...toHere, ...style, ...(to.exact && toSide && { toSide }) })
      } else if (level === depth - 1 && from.kind === 'external' && to.kind === 'self') {
        // A node of the parent connected to the node that opens this universe: a door, no edge.
        portalFor(from, 'in')
      } else if (level === depth - 1 && from.kind === 'self' && to.kind === 'external') {
        portalFor(to, 'out')
      }
    }
  }

  // Edges must reference nodes (or groups) that exist (a node of the universe may have been left out).
  const ids = new Set([...current.nodes.map((n) => n.id), ...portals.keys()])
  const groupIds = new Set(current.groups.map((g) => g.id))
  const exists = (id: string, group: true | undefined) => (group ? groupIds.has(id) : ids.has(id))
  const shown = edges.filter((edge) => exists(edge.from, edge.fromGroup) && exists(edge.to, edge.toGroup))
  const list = [...portals.values()]
  if (list.length === 0) list.push({ id: `portal:${depth - 1}`, level: depth - 1, universe: universes[depth - 1]!, role: 'in' })
  return { portals: list, edges: shown }
}

/**
 * The connections a universe draws itself: a connection from a node to the inside of its own
 * sub-universe (`vps → vps/api`) is not drawn as a loop, only inside.
 */
export function drawnEdges(universe: Universe): ArchitectureEdge[] {
  return universe.edges.filter((edge) => !isInnerLoop(edge))
}

/** `vps → vps/api`: a node connected to the inside of its own sub-universe. */
export function isInnerLoop(edge: ArchitectureEdge): boolean {
  return edge.from === edge.to && !edge.fromGroup && !edge.toGroup && (edge.fromPath !== undefined || edge.toPath !== undefined)
}

/**
 * A portal as a node for the layout: its node's name and icon, or the parent universe's name.
 * Doors are large (they frame the universe), whatever the size of their node up there.
 */
export function portalNode(portal: Portal): ArchitectureNode {
  const { node } = portal
  return {
    id: portal.id,
    name: node?.name ?? portal.universe.name,
    // The line "↩ <universe>" below the name takes the place of a description (layout height).
    description: `↩ ${portal.universe.name}`,
    ...(node?.icon && { icon: node.icon }),
    size: 'large',
  }
}
