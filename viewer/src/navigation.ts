// Navigation between universes, as a stack of universe ids from the root (the breadcrumb).
// Pure functions: the same universe may be reached through different parents, so the
// breadcrumb is the path actually taken, not a fixed parent link.
import type { Architecture, ArchitectureEdge, ArchitectureNode, Universe } from '../../src/core/types.ts'
import type { UniverseContext } from './context.ts'

/** Universe ids, from the root (index 0) to the current universe. Never empty. */
export type NavigationPath = readonly string[]

export function rootPath(architecture: Architecture): NavigationPath {
  return [architecture.root]
}

export function currentId(path: NavigationPath): string {
  return path[path.length - 1]!
}

export function universeAt(architecture: Architecture, id: string): Universe | undefined {
  return Object.hasOwn(architecture.universes, id) ? architecture.universes[id] : undefined
}

/** Opens the sub-universe of a node of the current universe, if it has one. */
export function openNode(architecture: Architecture, path: NavigationPath, nodeId: string): NavigationPath | undefined {
  const node = universeAt(architecture, currentId(path))?.nodes.find((n) => n.id === nodeId)
  return node?.universe === undefined ? undefined : [...path, node.universe]
}

/** Goes back to a breadcrumb level (0 = root). */
export function goToLevel(path: NavigationPath, level: number): NavigationPath {
  return path.slice(0, Math.min(Math.max(level, 0), path.length - 1) + 1)
}

/** One level up; stays at the root. */
export function up(path: NavigationPath): NavigationPath {
  return goToLevel(path, path.length - 2)
}

/** Node of `parent` that opens `child` (used to name breadcrumb steps). */
export function linkingNode(parent: Universe | undefined, child: string): ArchitectureNode | undefined {
  return parent?.nodes.find((node) => node.universe === child)
}

/** `#/platform/eu-west` (the root is implicit; empty at the root). */
export function toHash(path: NavigationPath): string {
  return path.length <= 1 ? '' : `#/${path.slice(1).map(encodeURIComponent).join('/')}`
}

/**
 * Reads a path from a URL hash, keeping its longest valid prefix: every step must be the
 * sub-universe of a node of the previous one.
 */
export function fromHash(architecture: Architecture, hash: string): NavigationPath {
  const path = [architecture.root]
  const steps = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  for (const step of steps) {
    let id: string
    try {
      id = decodeURIComponent(step)
    } catch {
      break
    }
    const parent = universeAt(architecture, currentId(path))
    if (!linkingNode(parent, id) || !universeAt(architecture, id)) break
    path.push(id)
  }
  return path
}

export interface Connection {
  edgeId: string
  direction: 'in' | 'out'
  /** The node at the other end. */
  node: ArchitectureNode
  label?: string
  /** The other end is a node of another universe (a door): its universe and breadcrumb level. */
  external?: { universe: string; level: number }
}

/**
 * Incoming and outgoing connections of a node within its universe, including those declared by
 * the ancestors (`context`): to other nodes of the universe or to doors.
 */
export function connectionsOf(universe: Universe, nodeId: string, context?: UniverseContext): Connection[] {
  const byId = new Map(universe.nodes.map((node) => [node.id, node]))
  const doors = new Map((context?.portals ?? []).flatMap((p) => (p.node ? [[p.id, p] as const] : [])))
  const connections: Connection[] = []
  const edges: ArchitectureEdge[] = [
    ...universe.edges.filter((edge) => !(edge.from === edge.to && (edge.fromPath || edge.toPath))),
    ...(context?.edges ?? []),
  ]
  for (const edge of edges) {
    for (const [direction, self, other] of [
      ['out', edge.from, edge.to],
      ['in', edge.to, edge.from],
    ] as const) {
      const door = doors.get(other)
      const node = byId.get(other) ?? door?.node
      if (self !== nodeId || !node) continue
      // A self-loop is listed once.
      if (direction === 'in' && edge.from === edge.to) continue
      connections.push({
        edgeId: edge.id,
        direction,
        node,
        ...(edge.label !== undefined && { label: edge.label }),
        ...(door && { external: { universe: door.universe.name, level: door.level } }),
      })
    }
  }
  return connections
}
