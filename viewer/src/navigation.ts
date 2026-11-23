// Navigation between universes, as a stack of steps from the root (the breadcrumb). Pure
// functions: the same universe may be reached through different parents, or through several
// nodes of one parent, so each step records the node that opened it, not just the universe.
import type { Architecture, ArchitectureEdge, ArchitectureNode, Universe } from '../../src/core/types.ts'
import type { UniverseContext } from './context.ts'

/** One level of the path: a universe, and the node of the previous level that opened it. */
export interface NavigationStep {
  universe: string
  /** Id of the node of the previous universe that opened this one; absent at the root. */
  node?: string
}

/** Steps from the root (index 0) to the current universe. Never empty. */
export type NavigationPath = readonly NavigationStep[]

/** Separates a universe id from the node that opened it in a URL hash step (never in an id). */
const NODE_SEPARATOR = '~'

export function rootPath(architecture: Architecture): NavigationPath {
  return [{ universe: architecture.root }]
}

export function currentId(path: NavigationPath): string {
  return path[path.length - 1]!.universe
}

/** Universe ids of the path, from the root. */
export function universeIds(path: NavigationPath): string[] {
  return path.map((step) => step.universe)
}

/** Identifies a path (the universes and the nodes that opened them). */
export function pathKey(path: NavigationPath): string {
  return path.map((step) => (step.node === undefined ? step.universe : `${step.node}${NODE_SEPARATOR}${step.universe}`)).join('/')
}

export function universeAt(architecture: Architecture, id: string): Universe | undefined {
  return Object.hasOwn(architecture.universes, id) ? architecture.universes[id] : undefined
}

/** Opens the sub-universe of a node of the current universe, if it has one. */
export function openNode(architecture: Architecture, path: NavigationPath, nodeId: string): NavigationPath | undefined {
  const node = universeAt(architecture, currentId(path))?.nodes.find((n) => n.id === nodeId)
  return node?.universe === undefined ? undefined : [...path, { universe: node.universe, node: node.id }]
}

/** Goes back to a breadcrumb level (0 = root). */
export function goToLevel(path: NavigationPath, level: number): NavigationPath {
  return path.slice(0, Math.min(Math.max(level, 0), path.length - 1) + 1)
}

/** One level up; stays at the root. */
export function up(path: NavigationPath): NavigationPath {
  return goToLevel(path, path.length - 2)
}

/**
 * Node of `parent` that opens `child`: the one named by `nodeId` (it must open `child`), or the
 * first one when no node is named.
 */
export function linkingNode(parent: Universe | undefined, child: string, nodeId?: string): ArchitectureNode | undefined {
  return parent?.nodes.find((node) => node.universe === child && (nodeId === undefined || node.id === nodeId))
}

/**
 * `#/platform/eu-west` (the root is implicit; empty at the root). A step names the node that
 * opened it (`#/shared~b`) only when it is not the first node of its parent that opens that
 * universe, so the usual links stay short and older links keep working.
 */
export function toHash(architecture: Architecture, path: NavigationPath): string {
  if (path.length <= 1) return ''
  const steps = path.slice(1).map((step, index) => {
    const first = linkingNode(universeAt(architecture, path[index]!.universe), step.universe)
    const universe = encodeURIComponent(step.universe)
    return step.node !== undefined && step.node !== first?.id ? `${universe}${NODE_SEPARATOR}${encodeURIComponent(step.node)}` : universe
  })
  return `#/${steps.join('/')}`
}

/**
 * Reads a path from a URL hash, keeping its longest valid prefix: every step must be the
 * sub-universe of a node of the previous one (the named node, or the first that opens it).
 */
export function fromHash(architecture: Architecture, hash: string): NavigationPath {
  const path: NavigationStep[] = [{ universe: architecture.root }]
  const steps = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  for (const step of steps) {
    const [universePart = '', nodePart, ...rest] = step.split(NODE_SEPARATOR)
    if (rest.length > 0) break
    let id: string
    let nodeId: string | undefined
    try {
      id = decodeURIComponent(universePart)
      nodeId = nodePart === undefined ? undefined : decodeURIComponent(nodePart)
    } catch {
      break
    }
    const node = linkingNode(universeAt(architecture, currentId(path)), id, nodeId)
    if (!node || !universeAt(architecture, id)) break
    path.push({ universe: id, node: node.id })
  }
  return path
}

export interface Connection {
  edgeId: string
  direction: 'in' | 'out'
  /** The node at the other end (for a group: its name and icon). */
  node: ArchitectureNode
  /** The other end is a group of the universe (its frame), not a node. */
  group?: true
  label?: string
  /** The other end is a node of another universe (a door): its universe and breadcrumb level. */
  external?: { universe: string; level: number }
}

/**
 * Incoming and outgoing connections of a node within its universe, including those declared by
 * the ancestors (`context`): to other nodes or groups of the universe, or to doors.
 */
export function connectionsOf(universe: Universe, nodeId: string, context?: UniverseContext): Connection[] {
  const byId = new Map(universe.nodes.map((node) => [node.id, node]))
  const groups = new Map(universe.groups.map((group) => [group.id, group]))
  const doors = new Map((context?.portals ?? []).flatMap((p) => (p.node ? [[p.id, p] as const] : [])))
  const connections: Connection[] = []
  const edges: ArchitectureEdge[] = [
    // Not `vps → vps/api` (drawn inside the sub-universe only).
    ...universe.edges.filter((edge) => !(edge.from === edge.to && !edge.fromGroup && !edge.toGroup && (edge.fromPath || edge.toPath))),
    ...(context?.edges ?? []),
  ]
  for (const edge of edges) {
    for (const [direction, self, selfIsGroup, other, otherIsGroup] of [
      ['out', edge.from, edge.fromGroup, edge.to, edge.toGroup],
      ['in', edge.to, edge.toGroup, edge.from, edge.fromGroup],
    ] as const) {
      if (self !== nodeId || selfIsGroup) continue
      const door = otherIsGroup ? undefined : doors.get(other)
      const group = otherIsGroup ? groups.get(other) : undefined
      const node = group ? { id: group.id, name: group.name, ...(group.icon && { icon: group.icon }) } : otherIsGroup ? undefined : (byId.get(other) ?? door?.node)
      if (!node) continue
      // A self-loop is listed once.
      if (direction === 'in' && edge.from === edge.to && !edge.fromGroup && !edge.toGroup) continue
      connections.push({
        edgeId: edge.id,
        direction,
        node,
        ...(group && { group: true as const }),
        ...(edge.label !== undefined && { label: edge.label }),
        ...(door && { external: { universe: door.universe.name, level: door.level } }),
      })
    }
  }
  return connections
}
