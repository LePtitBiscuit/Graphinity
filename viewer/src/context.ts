// What the ancestors of the current universe say about it: the connections declared higher up
// that reach into it (`ci → vps/api`), and the nodes of the parent connected to the node that
// opens it. Nodes of other universes are shown as "doors" (portals): clicking one goes back to
// its universe. Pure functions, unit-tested; depends on the path actually taken (a universe may
// be reached through different parents).
import type { Architecture, ArchitectureEdge, ArchitectureNode, Universe } from '../../src/core/types.ts'
import { linkingNode, universeAt, type NavigationPath } from './navigation.ts'

export interface Portal {
  /** Vue Flow / ELK id: `portal:<level>:<node id>`, or `portal:<level>` for the generic door. */
  id: string
  /** Breadcrumb level of the universe it belongs to (where clicking it goes). */
  level: number
  universe: Universe
  /** The node it stands for; absent for the generic door back to the parent. */
  node?: ArchitectureNode
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
  | { kind: 'inside'; node: string; exact: boolean }
  | { kind: 'self' }
  | { kind: 'external'; level: number; node: string }
  | { kind: 'ignored' }

export function universeContext(architecture: Architecture, path: NavigationPath): UniverseContext {
  const depth = path.length - 1
  if (depth < 1) return EMPTY
  const universes = path.map((id) => universeAt(architecture, id))
  if (universes.some((u) => !u)) return EMPTY
  const chain: string[] = []
  for (let level = 0; level < depth; level++) {
    const node = linkingNode(universes[level], path[level + 1]!)
    if (!node) return EMPTY
    chain.push(node.id)
  }

  /** Where the end `endPath`, declared in the universe at `level`, is seen from the current universe. */
  const classify = (endPath: string[], level: number): End => {
    for (let t = 0; level + t < depth; t++) {
      if (t >= endPath.length) return { kind: 'ignored' } // an ancestor that contains the universe
      if (endPath[t] !== chain[level + t]) return { kind: 'external', level: level + t, node: endPath[t]! }
    }
    const rest = endPath.slice(depth - level)
    return rest.length === 0 ? { kind: 'self' } : { kind: 'inside', node: rest[0]!, exact: rest.length === 1 }
  }

  const current = universes[depth]!
  const portals = new Map<string, Portal>()
  const edges: ArchitectureEdge[] = []
  const portalFor = (end: { level: number; node: string }, role: Portal['role']): string | undefined => {
    const universe = universes[end.level]!
    const node = universe.nodes.find((n) => n.id === end.node)
    if (!node) return undefined
    const id = `portal:${end.level}:${node.id}`
    const known = portals.get(id)
    // A door that is a source of some connection stays at the start of the flow.
    if (!known) portals.set(id, { id, level: end.level, universe, node, role })
    else if (role === 'in') known.role = 'in'
    return id
  }

  for (let level = 0; level < depth; level++) {
    for (const edge of universes[level]!.edges) {
      const from = classify([edge.from, ...(edge.fromPath ?? [])], level)
      const to = classify([edge.to, ...(edge.toPath ?? [])], level)
      const { id: _id, from: _f, to: _t, fromPath: _fp, toPath: _tp, fromSide, toSide, ...style } = edge
      const id = `ctx:${level}:${edge.id}`
      if (from.kind === 'inside' && to.kind === 'inside') {
        edges.push({
          id,
          from: from.node,
          to: to.node,
          ...style,
          ...(from.exact && fromSide && { fromSide }),
          ...(to.exact && toSide && { toSide }),
        })
      } else if (from.kind === 'inside' && to.kind === 'external') {
        const portal = portalFor(to, 'out')
        if (portal) edges.push({ id, from: from.node, to: portal, ...style, ...(from.exact && fromSide && { fromSide }) })
      } else if (from.kind === 'external' && to.kind === 'inside') {
        const portal = portalFor(from, 'in')
        if (portal) edges.push({ id, from: portal, to: to.node, ...style, ...(to.exact && toSide && { toSide }) })
      } else if (level === depth - 1 && from.kind === 'external' && to.kind === 'self') {
        // A node of the parent connected to the node that opens this universe: a door, no edge.
        portalFor(from, 'in')
      } else if (level === depth - 1 && from.kind === 'self' && to.kind === 'external') {
        portalFor(to, 'out')
      }
    }
  }

  // Edges must reference nodes that exist (a node of the universe may have been left out).
  const ids = new Set([...current.nodes.map((n) => n.id), ...portals.keys()])
  const shown = edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to))
  const list = [...portals.values()]
  if (list.length === 0) list.push({ id: `portal:${depth - 1}`, level: depth - 1, universe: universes[depth - 1]!, role: 'in' })
  return { portals: list, edges: shown }
}

/**
 * The connections a universe draws itself: a connection from a node to the inside of its own
 * sub-universe (`vps → vps/api`) is not drawn as a loop, only inside.
 */
export function drawnEdges(universe: Universe): ArchitectureEdge[] {
  return universe.edges.filter((edge) => !(edge.from === edge.to && (edge.fromPath || edge.toPath)))
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
