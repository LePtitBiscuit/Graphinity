// Search of the nodes and groups of every universe, by name (case and accents ignored), and the
// path that shows a result. Pure functions, unit-tested; the whole architecture is already in the
// page, so searching needs no index file and no request.
import type { Architecture, IconRef } from '../../src/core/types.ts'
import { universeAt, type NavigationPath, type NavigationStep } from './navigation.ts'

export interface SearchEntry {
  kind: 'node' | 'group'
  id: string
  name: string
  icon?: IconRef
  /** Id and name of its universe. */
  universe: string
  universeName: string
  /** Name of the group it is in, if any. */
  groupName?: string
  /** Fewest steps from the root to its universe (results of shallow universes come first). */
  depth: number
  /** `name` folded for matching (`fold`), and the index in `name` of each of its characters. */
  folded: string
  origin: number[]
}

export interface SearchResult {
  entry: SearchEntry
  /** Matched part of `entry.name`: [start, end). */
  match: [number, number]
  /** In the universe shown. */
  here: boolean
}

/** Results shown at most; the others are counted (`total`). */
export const SEARCH_LIMIT = 50

/** Lower case, without accents; `origin[i]`: index in `text` of the character `folded[i]` comes from. */
export function fold(text: string): { folded: string; origin: number[] } {
  let folded = ''
  const origin: number[] = []
  let index = 0
  for (const char of text) {
    const plain = char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    for (let i = 0; i < plain.length; i++) origin.push(index)
    folded += plain
    index += char.length
  }
  return { folded, origin }
}

/** Fewest steps from the root to each universe (universes are a hierarchy without cycles). */
export function universeDepths(architecture: Architecture): Map<string, number> {
  const depths = new Map([[architecture.root, 0]])
  const queue = [architecture.root]
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const node of universeAt(architecture, id)?.nodes ?? []) {
      if (node.universe === undefined || depths.has(node.universe) || !universeAt(architecture, node.universe)) continue
      depths.set(node.universe, depths.get(id)! + 1)
      queue.push(node.universe)
    }
  }
  return depths
}

/** Every node and group of every universe reachable from the root, shallow universes first. */
export function searchIndex(architecture: Architecture): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const [id, depth] of universeDepths(architecture)) {
    const universe = universeAt(architecture, id)!
    const groups = new Map(universe.groups.map((group) => [group.id, group.name]))
    const base = { universe: id, universeName: universe.name, depth }
    for (const group of universe.groups) {
      const groupName = group.group === undefined ? undefined : groups.get(group.group)
      entries.push({
        kind: 'group',
        id: group.id,
        name: group.name,
        ...(group.icon && { icon: group.icon }),
        ...base,
        ...(groupName !== undefined && { groupName }),
        ...fold(group.name),
      })
    }
    for (const node of universe.nodes) {
      const groupName = node.group === undefined ? undefined : groups.get(node.group)
      entries.push({
        kind: 'node',
        id: node.id,
        name: node.name,
        ...(node.icon && { icon: node.icon }),
        ...base,
        ...(groupName !== undefined && { groupName }),
        ...fold(node.name),
      })
    }
  }
  return entries
}

/** Where the query is found in a folded name, and how well: whole name, start, start of a word, anywhere. */
function matchOf(folded: string, query: string): { at: number; rank: number } | undefined {
  const first = folded.indexOf(query)
  if (first < 0) return undefined
  if (folded === query) return { at: 0, rank: 0 }
  if (first === 0) return { at: 0, rank: 1 }
  for (let at = first; at >= 0; at = folded.indexOf(query, at + 1)) {
    if (!/[\p{L}\p{N}]/u.test(folded[at - 1]!)) return { at, rank: 2 }
  }
  return { at: first, rank: 3 }
}

/**
 * The entries whose name contains the query (case, accents and repeated spaces ignored): those
 * of the universe shown first, then by how well the name matches, the depth of the universe and
 * the name. At most `limit` results; `total` counts them all.
 */
export function search(
  index: readonly SearchEntry[],
  query: string,
  current: string,
  limit = SEARCH_LIMIT,
): { results: SearchResult[]; total: number } {
  const folded = fold(query.trim().replace(/\s+/g, ' ')).folded
  if (!folded) return { results: [], total: 0 }
  const found: (SearchResult & { rank: number })[] = []
  for (const entry of index) {
    const match = matchOf(entry.folded, folded)
    if (!match) continue
    const start = entry.origin[match.at]!
    const last = entry.origin[match.at + folded.length - 1]!
    const end = last + (entry.name.codePointAt(last)! > 0xffff ? 2 : 1)
    found.push({ entry, match: [start, end], here: entry.universe === current, rank: match.rank })
  }
  found.sort(
    (a, b) =>
      Number(b.here) - Number(a.here) ||
      a.rank - b.rank ||
      a.entry.depth - b.entry.depth ||
      a.entry.name.localeCompare(b.entry.name),
  )
  return { results: found.slice(0, limit).map(({ rank: _rank, ...result }) => result), total: found.length }
}

/**
 * The path that shows a universe, keeping as much of the current path as possible: the path
 * itself or one of its levels when the universe is on it, otherwise the fewest steps down from
 * the deepest level that leads to it (from the root at worst). Each step records the first node
 * that opens it. Undefined when the universe cannot be reached.
 */
export function pathTo(architecture: Architecture, path: NavigationPath, target: string): NavigationPath | undefined {
  for (let level = path.length - 1; level >= 0; level--) {
    const steps = stepsDown(architecture, path[level]!.universe, target)
    if (steps) return [...path.slice(0, level + 1), ...steps]
  }
  return undefined
}

/** Fewest steps from a universe down to another one (none when it is the same). */
function stepsDown(architecture: Architecture, from: string, target: string): NavigationStep[] | undefined {
  const reached = new Map<string, NavigationStep[]>([[from, []]])
  const queue = [from]
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const steps = reached.get(id)!
    if (id === target) return steps
    for (const node of universeAt(architecture, id)?.nodes ?? []) {
      if (node.universe === undefined || reached.has(node.universe) || !universeAt(architecture, node.universe)) continue
      reached.set(node.universe, [...steps, { universe: node.universe, node: node.id }])
      queue.push(node.universe)
    }
  }
  return undefined
}
