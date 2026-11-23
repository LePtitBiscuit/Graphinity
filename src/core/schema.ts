// Structural validation of one universe file. Input is untrusted: only known fields are read,
// every value is type- and size-checked. File references are returned unresolved.
//
// Every problem is reported, and only the element it concerns is left out: an invalid icon or
// description is dropped from its node, a connection with an invalid property is dropped, a node
// without a valid id or name is dropped, an invalid direction or connection side falls back to
// the default…
import type { FieldPath } from './parse.ts'
import type { ArrowHeads, BorderStyle, Color, Corner, Direction, LineStyle, NodePlace, NodeSize, NodeTag, Side } from './types.ts'

export interface SchemaIssue {
  path: FieldPath
  message: string
}

export interface RawNode {
  id: string
  name: string
  /** Absent when missing or invalid: the node is shown with the generic icon. */
  icon?: string
  description?: string
  universe?: string
  group?: string
  tags?: NodeTag[]
  color?: Color
  border?: BorderStyle
  background?: Color
  size?: NodeSize
  place?: NodePlace
  /** Placement hint, unresolved: the id of another node of the universe (checked by `checkPlacement`). */
  after?: string
}

export interface RawGroup {
  id: string
  name: string
  icon?: string
  color?: Color
  border?: BorderStyle
  blur?: number
  /** The group it is inside of. */
  group?: string
  background?: Color | 'none'
}

export interface RawEdge {
  from: string
  to: string
  label?: string
  color?: Color
  style?: LineStyle
  arrow?: ArrowHeads
  fromSide?: Side
  toSide?: Side
  /** `from` / `to` is a group of the universe, not a node. */
  fromGroup?: true
  toGroup?: true
  /** Node ids inside the sub-universe of `from` / `to` (`vps/api` → `["api"]`), resolved by the loader. */
  fromPath?: string[]
  toPath?: string[]
  /** Position of the connection in the file (for the loader's errors). */
  index: number
}

/** `image` is returned unresolved (relative to the file). */
export interface RawBackground {
  image?: string
  color?: Color
  blur?: number
  /** Shown or not, or shown in a color. */
  grid?: boolean | Color
}

/** What the universe itself declares; its nodes and groups are returned by index. */
export interface RawUniverse {
  /** Absent when missing or invalid (the loader then derives one from the file name). */
  id?: string
  name?: string
  direction: Direction
  background?: RawBackground
  /** Valid connections only. */
  edges: RawEdge[]
}

/** Letters, digits, `.`, `_`, `-`; starts with a letter or digit (rules out `__proto__`). */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const MAX_ID_LENGTH = 100
const MAX_NAME_LENGTH = 200
const MAX_LABEL_LENGTH = 200
const MAX_REFERENCE_LENGTH = 500
const MAX_DESCRIPTION_LENGTH = 5000
const MAX_TAG_LENGTH = 40

const UNIVERSE_FIELDS = ['id', 'name', 'direction', 'background', 'groups', 'nodes', 'connections']
export const DIRECTIONS: readonly Direction[] = ['right', 'down', 'left', 'up']
const BACKGROUND_FIELDS = ['image', 'color', 'blur', 'grid']
const GROUP_FIELDS = ['id', 'name', 'icon', 'color', 'border', 'blur', 'group', 'background']
const NODE_FIELDS = ['id', 'name', 'icon', 'description', 'universe', 'group', 'tags', 'color', 'border', 'background', 'size', 'place', 'after']
const EDGE_FIELDS = ['from', 'to', 'label', 'color', 'style', 'arrow']
const END_FIELDS = ['node', 'group', 'side']
export const SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom']
export const NODE_SIZES: readonly NodeSize[] = ['small', 'medium', 'large']
export const NODE_PLACES: readonly NodePlace[] = ['first', 'last']
/** Blur radius, in px. */
export const MAX_BLUR = 40
/** Groups inside groups: at most this many levels (a group at the top is level 1). */
export const MAX_GROUP_DEPTH = 4
export const BORDER_STYLES: readonly BorderStyle[] = ['solid', 'dashed', 'dotted', 'none']
export const LINE_STYLES: readonly LineStyle[] = ['solid', 'dashed', 'dotted']
export const ARROW_HEADS: readonly ArrowHeads[] = ['end', 'start', 'both', 'none']
/** Named colors, tuned for the dark background. */
export const COLOR_NAMES: Readonly<Record<string, Color>> = {
  gray: '#8a93a5',
  white: '#e6e9ef',
  blue: '#4f8cff',
  teal: '#2fb8ac',
  green: '#3fb950',
  yellow: '#d29922',
  orange: '#f0883e',
  red: '#f85149',
  pink: '#db61a2',
  purple: '#a371f7',
}
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const TAG_FIELDS = ['text', 'corner']
/** Tags without an explicit corner fill the free corners in this order. */
export const CORNERS: readonly Corner[] = ['top-right', 'top-left', 'bottom-right', 'bottom-left']

export interface ValidationResult {
  /** What could be read of the universe; absent only when the file is not a mapping. */
  universe?: RawUniverse
  /** Nodes that can be shown, by their index in the file (holes for the others). */
  nodes: (RawNode | undefined)[]
  /** Groups that can be shown, by their index in the file (holes for the others, empty groups included). */
  groups: (RawGroup | undefined)[]
  issues: SchemaIssue[]
}

export function validateUniverse(data: unknown): ValidationResult {
  const issues: SchemaIssue[] = []
  const report = (path: FieldPath, message: string) => issues.push({ path, message })

  if (!isRecord(data)) {
    report([], 'A universe must be a mapping with "id", "name", "nodes" and "connections"')
    return { nodes: [], groups: [], issues }
  }
  // Renamed: a clear message rather than "unknown field" (and its connections are not read).
  const fields = Object.hasOwn(data, 'edges') ? Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'edges')) : data
  if (fields !== data) report(['edges'], '"edges" was renamed to "connections"')
  checkFields(fields, UNIVERSE_FIELDS, [], report)

  const id = readId(data, 'id', [], report)
  const name = readText(data, 'name', [], MAX_NAME_LENGTH, true, report)
  const direction = readDirection(data, report)
  const background = readBackground(data, report)

  const groups: (RawGroup | undefined)[] = []
  const groupIds = new Set<string>()
  for (const [index, item] of readList(data, 'groups', false, report).entries()) {
    const { id: groupId, group } = readGroup(item, ['groups', index], report)
    if (groupId !== undefined && groupIds.has(groupId)) {
      report(['groups', index, 'id'], `Duplicate group id "${groupId}"`)
      groups.push(undefined)
      continue
    }
    // Like nodes: a group with a valid id stays known even if another of its fields is invalid.
    if (groupId !== undefined) groupIds.add(groupId)
    groups.push(group)
  }
  const cut = checkGroupNesting(groups, groupIds, report)

  const nodes: (RawNode | undefined)[] = []
  const nodeIds = new Set<string>()
  /** Groups named by any node, valid or not (an invalid node must not make its group "empty"). */
  const usedGroups = new Set<unknown>()
  for (const [index, item] of readList(data, 'nodes', true, report).entries()) {
    if (isRecord(item)) usedGroups.add(item['group'])
    const { id: nodeId, node } = readNode(item, ['nodes', index], groupIds, report)
    if (nodeId !== undefined && nodeIds.has(nodeId)) {
      report(['nodes', index, 'id'], `Duplicate node id "${nodeId}"`)
      nodes.push(undefined)
      continue
    }
    // A node with a valid id stays known to connections even if another of its fields is
    // invalid: its own error is enough, without one more per connection.
    if (nodeId !== undefined) nodeIds.add(nodeId)
    nodes.push(node)
  }

  // A group holding a used group is used too. A parent left out for an error still counts: its
  // own error is enough, without "has no nodes" on each group above it.
  const byId = new Map(groups.flatMap((group) => (group ? [[group.id, group] as const] : [])))
  const parentOf = (id: string) => byId.get(id)?.group ?? cut.get(id)
  for (const id of [...usedGroups]) {
    let parent = typeof id === 'string' ? parentOf(id) : undefined
    for (let level = 0; parent !== undefined && level <= groups.length && !usedGroups.has(parent); level++) {
      usedGroups.add(parent)
      parent = parentOf(parent)
    }
  }
  // An empty group is most likely a typo in a node's "group" field: reported, not shown.
  for (const [index, group] of groups.entries()) {
    if (group && !usedGroups.has(group.id)) {
      report(['groups', index], `Group "${group.id}" has no nodes`)
      groups[index] = undefined
    }
  }

  const shown = new Set(nodes.flatMap((node) => (node ? [node.id] : [])))
  checkPlacement(nodes, shown, report)

  const shownGroups = new Set(groups.flatMap((group) => (group ? [group.id] : [])))
  const edges: RawEdge[] = []
  const opening = new Set(nodes.flatMap((node) => (node?.universe !== undefined ? [node.id] : [])))
  const known: KnownEnds = { ids: nodeIds, opening, groups: groupIds }
  for (const [index, item] of readList(data, 'connections', false, report).entries()) {
    const edge = readEdge(item, ['connections', index], known, report)
    // A connection to a node or group that is not shown (already reported) is not shown either.
    const visible = (id: string, group: boolean | undefined) => (group ? shownGroups.has(id) : shown.has(id))
    if (!edge || !visible(edge.from, edge.fromGroup) || !visible(edge.to, edge.toGroup)) continue
    if (checkGroupEnds(edge, nodes, groups, ['connections', index], report)) edges.push(edge)
  }
  checkPlacementAgainstConnections(nodes, edges, report)

  return {
    universe: {
      ...(id !== undefined && { id }),
      ...(name !== undefined && { name }),
      direction,
      ...(background && { background }),
      edges,
    },
    nodes,
    groups,
    issues,
  }
}

/**
 * `after` must name another node of the universe, and must not lead back to the node (`a` after
 * `b`, `b` after `a`): an invalid hint is reported and left out.
 */
function checkPlacement(nodes: (RawNode | undefined)[], shown: ReadonlySet<string>, report: Report): void {
  for (const [index, node] of nodes.entries()) {
    const target = node?.after
    if (!node || target === undefined) continue
    if (target === node.id) report(['nodes', index, 'after'], `A node cannot be placed after itself ("${target}")`)
    else if (!shown.has(target)) report(['nodes', index, 'after'], `Unknown node "${target}" (placement hints reference nodes of the same universe)`)
    else continue
    delete node.after
  }
  const byId = new Map(nodes.flatMap((node) => (node ? [[node.id, node] as const] : [])))
  for (const [index, node] of nodes.entries()) {
    if (node?.after === undefined) continue
    const chain = [node.id]
    for (let next: string | undefined = node.after; next !== undefined; next = byId.get(next)?.after) {
      if (next === node.id) {
        report(['nodes', index, 'after'], `Placement hints form a loop (${[...chain, next].join(' → ')})`)
        delete node.after
        break
      }
      if (chain.includes(next)) break // a loop further on, reported on its own nodes
      chain.push(next)
    }
  }
}

/**
 * `a` after `b` cannot hold when the connections already lead from `a` to `b` (`a → … → b`): the
 * layout would have to ignore it. Reported and left out.
 */
function checkPlacementAgainstConnections(nodes: (RawNode | undefined)[], edges: readonly RawEdge[], report: Report): void {
  const next = new Map<string, string[]>()
  for (const edge of edges) {
    // Between nodes only: a group end does not order the nodes it holds.
    if (edge.from === edge.to || edge.fromGroup || edge.toGroup) continue
    next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to])
  }
  for (const [index, node] of nodes.entries()) {
    const target = node?.after
    if (!node || target === undefined) continue
    // Breadth-first search from the node, keeping the way back to print the path.
    const previous = new Map<string, string>([[node.id, node.id]])
    const queue = [node.id]
    for (let at = queue.shift(); at !== undefined && !previous.has(target); at = queue.shift()) {
      for (const to of next.get(at) ?? []) {
        if (!previous.has(to)) {
          previous.set(to, at)
          queue.push(to)
        }
      }
    }
    if (!previous.has(target)) continue
    const path = [target]
    while (path[0] !== node.id) path.unshift(previous.get(path[0]!)!)
    report(['nodes', index, 'after'], `"${node.id}" cannot be placed after "${target}": the connections lead from it to "${target}" (${path.join(' → ')})`)
    delete node.after
  }
}

/**
 * A group end cannot be linked to itself, nor to a node or group inside it (its frame holds the
 * other end): reported, and the connection is left out. Returns whether the connection is kept.
 */
function checkGroupEnds(
  edge: RawEdge,
  nodes: readonly (RawNode | undefined)[],
  groups: readonly (RawGroup | undefined)[],
  path: FieldPath,
  report: Report,
): boolean {
  if (!edge.fromGroup && !edge.toGroup) return true
  const nodeGroup = new Map(nodes.flatMap((node) => (node?.group !== undefined ? [[node.id, node.group] as const] : [])))
  const parent = new Map(groups.flatMap((group) => (group?.group !== undefined ? [[group.id, group.group] as const] : [])))
  /** The groups holding an end, innermost first (the nesting is a tree of at most MAX_GROUP_DEPTH levels). */
  const holders = (id: string, group: boolean | undefined): string[] => {
    const chain: string[] = []
    for (let at = group ? parent.get(id) : nodeGroup.get(id); at !== undefined && chain.length <= MAX_GROUP_DEPTH; at = parent.get(at)) chain.push(at)
    return chain
  }
  if (edge.fromGroup && edge.toGroup && edge.from === edge.to) {
    report(path, `A group cannot be connected to itself ("${edge.from}")`)
    return false
  }
  for (const [group, other, otherIsGroup] of [
    [edge.fromGroup && edge.from, edge.to, edge.toGroup],
    [edge.toGroup && edge.to, edge.from, edge.fromGroup],
  ] as const) {
    if (!group || !holders(other, otherIsGroup).includes(group)) continue
    report(path, `Group "${group}" holds ${otherIsGroup ? 'group' : 'node'} "${other}": a connection cannot link a group to what is inside it`)
    return false
  }
  return true
}

function readGroup(item: unknown, path: FieldPath, report: Report): { id?: string; group?: RawGroup } {
  if (!isRecord(item)) {
    report(path, 'A group must be a mapping with "id" and "name"')
    return {}
  }
  checkFields(item, GROUP_FIELDS, path, report)
  const id = readId(item, 'id', path, report)
  const name = readText(item, 'name', path, MAX_NAME_LENGTH, true, report)
  const icon = readText(item, 'icon', path, MAX_REFERENCE_LENGTH, false, report)
  const color = readColor(item, 'color', path, report)
  const border = readChoice(item, 'border', BORDER_STYLES, path, report)
  const blur = readBlur(item, path, report)
  const parent = readText(item, 'group', path, MAX_ID_LENGTH, false, report)
  let background: Color | 'none' | undefined
  if (item['background'] === 'none') background = 'none'
  else {
    const color = readColor(item, 'background', path, () => {})
    if (color) background = color
    else if (color === null)
      report(
        [...path, 'background'],
        `"background" must be none or a color (#4f8cff, or one of ${Object.keys(COLOR_NAMES).join(', ')}), got ${JSON.stringify(item['background'])}`,
      )
  }
  // Without a name there is nothing to show; an invalid color, border, blur or background is simply not applied.
  if (id === undefined || name === undefined) return { ...(id !== undefined && { id }) }
  return {
    id,
    group: {
      id,
      name,
      ...(icon !== undefined && { icon }),
      ...(color != null && { color }),
      ...(border != null && { border }),
      ...(blur !== undefined && { blur }),
      ...(parent !== undefined && { group: parent }),
      ...(background !== undefined && { background }),
    },
  }
}

/**
 * Groups inside groups: the parent must be declared, and the nesting must be a tree of at most
 * `MAX_GROUP_DEPTH` levels. A wrong parent is reported and left out (the group is then at the top).
 * Returns the parents left out, by group id.
 */
function checkGroupNesting(groups: (RawGroup | undefined)[], ids: Set<string>, report: Report): Map<string, string> {
  const byId = new Map(groups.flatMap((group) => (group ? [[group.id, group] as const] : [])))
  const cut = new Map<string, string>()
  for (const [index, group] of groups.entries()) {
    if (group?.group === undefined) continue
    const path = ['groups', index, 'group']
    if (group.group === group.id) {
      report(path, `Group "${group.id}" cannot be inside itself`)
      cut.set(group.id, group.group)
      delete group.group
    } else if (!ids.has(group.group)) {
      report(path, `Unknown group "${group.group}" (declare it in "groups")`)
      cut.set(group.id, group.group)
      delete group.group
    }
  }
  for (const [index, group] of groups.entries()) {
    if (group?.group === undefined) continue
    const chain = [group.id]
    for (let parent: string | undefined = group.group; parent !== undefined; parent = byId.get(parent)?.group) {
      if (parent === group.id) {
        report(['groups', index, 'group'], `Groups inside each other: ${[...chain, parent].join(' → ')}`)
        cut.set(group.id, group.group)
        delete group.group
        break
      }
      chain.push(parent)
      if (chain.length > MAX_GROUP_DEPTH) {
        const more = byId.get(parent)?.group !== undefined ? '… → ' : ''
        report(
          ['groups', index, 'group'],
          `Group "${group.id}" is nested too deep: ${more}${chain.toReversed().join(' → ')} (max ${MAX_GROUP_DEPTH} levels)`,
        )
        cut.set(group.id, group.group)
        delete group.group
        break
      }
    }
  }
  return cut
}

/** `background: { image, color, blur }` of a universe; each invalid part is left out. */
function readBackground(record: Record<string, unknown>, report: Report): RawBackground | undefined {
  if (!Object.hasOwn(record, 'background') || record['background'] === null) return undefined
  const value = record['background']
  const path = ['background']
  if (!isRecord(value)) {
    report(path, `"background" must be a mapping with "image", "color", "blur" or "grid", got ${describe(value)}`)
    return undefined
  }
  checkFields(value, BACKGROUND_FIELDS, path, report)
  const image = readText(value, 'image', path, MAX_REFERENCE_LENGTH, false, report)
  const color = readColor(value, 'color', path, report)
  const blur = readBlur(value, path, report)
  let grid: boolean | Color | undefined
  if (Object.hasOwn(value, 'grid') && value['grid'] !== null) {
    if (typeof value['grid'] === 'boolean') grid = value['grid']
    else {
      // A color: shown, in that color.
      const color = readColor(value, 'grid', path, () => {})
      if (color) grid = color
      else
        report(
          [...path, 'grid'],
          `"grid" must be true, false or a color (#ffffff22, or one of ${Object.keys(COLOR_NAMES).join(', ')}), got ${JSON.stringify(value['grid'])}`,
        )
    }
  }
  const background = {
    ...(image !== undefined && { image }),
    ...(color != null && { color }),
    ...(blur !== undefined && { blur }),
    ...(grid !== undefined && { grid }),
  }
  return Object.keys(background).length > 0 ? background : undefined
}

/** A blur radius in px, from 0 to MAX_BLUR; left out when invalid. */
function readBlur(record: Record<string, unknown>, path: FieldPath, report: Report): number | undefined {
  if (!Object.hasOwn(record, 'blur') || record['blur'] === null) return undefined
  const value = record['blur']
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_BLUR) {
    report([...path, 'blur'], `"blur" must be a number of pixels from 0 to ${MAX_BLUR}, got ${JSON.stringify(value)}`)
    return undefined
  }
  return value
}

/** A color: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` or a palette name; normalized to lowercase hex. */
function readColor(record: Record<string, unknown>, key: string, path: FieldPath, report: Report): Color | undefined | null {
  if (!Object.hasOwn(record, key) || record[key] === null) return undefined
  const value = record[key]
  if (typeof value === 'string' && Object.hasOwn(COLOR_NAMES, value.toLowerCase())) return COLOR_NAMES[value.toLowerCase()]!
  if (typeof value === 'string' && HEX_COLOR.test(value)) {
    const hex = value.slice(1).toLowerCase()
    return `#${hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex}`
  }
  report(
    [...path, key],
    `"${key}" must be a hex color (#4f8cff) or one of ${Object.keys(COLOR_NAMES).join(', ')}, got ${JSON.stringify(value)}`,
  )
  return null
}

/** An optional value among fixed choices. */
function readChoice<T extends string>(
  record: Record<string, unknown>,
  key: string,
  choices: readonly T[],
  path: FieldPath,
  report: Report,
): T | undefined | null {
  if (!Object.hasOwn(record, key) || record[key] === null) return undefined
  const value = record[key]
  if (typeof value !== 'string' || !(choices as readonly string[]).includes(value)) {
    report([...path, key], `"${key}" must be one of ${choices.join(', ')}, got ${JSON.stringify(value)}`)
    return null
  }
  return value as T
}

/**
 * Up to 4 tags, one per corner: text (string or number) or `{ text, corner }`. Invalid tags are
 * reported and left out; beyond 4, the first 4 are kept.
 */
function readTags(record: Record<string, unknown>, path: FieldPath, report: Report): NodeTag[] | undefined {
  if (!Object.hasOwn(record, 'tags') || record['tags'] === null) return undefined
  const value = record['tags']
  const at = [...path, 'tags']
  if (!Array.isArray(value)) {
    report(at, `"tags" must be a list, got ${describe(value)}`)
    return undefined
  }
  if (value.length > CORNERS.length) {
    report(at, `A node has at most ${CORNERS.length} tags (one per corner), got ${value.length}`)
  }
  const fail = report
  const tags: { text: string; corner?: Corner; index: number }[] = []
  for (const [index, item] of value.entries()) {
    const tagPath = [...at, index]
    let text: unknown = item
    let corner: Corner | undefined
    if (isRecord(item)) {
      checkFields(item, TAG_FIELDS, tagPath, fail)
      text = item['text']
      const rawCorner = item['corner']
      if (rawCorner !== undefined && rawCorner !== null) {
        if (typeof rawCorner !== 'string' || !(CORNERS as readonly string[]).includes(rawCorner)) {
          fail([...tagPath, 'corner'], `"corner" must be one of ${CORNERS.join(', ')}, got ${JSON.stringify(rawCorner)}`)
          continue
        }
        corner = rawCorner as Corner
      }
    }
    const textPath = isRecord(item) ? [...tagPath, 'text'] : tagPath
    if (typeof text === 'number' && Number.isFinite(text)) text = String(text)
    if (typeof text !== 'string') {
      fail(textPath, text === undefined ? 'Missing required field "text"' : `A tag must be a text or a number, got ${describe(text)}`)
      continue
    }
    if (text.trim() === '') {
      fail(textPath, 'A tag must not be empty')
      continue
    }
    if (text.length > MAX_TAG_LENGTH) {
      fail(textPath, `A tag is too long (${text.length} characters, max ${MAX_TAG_LENGTH})`)
      continue
    }
    tags.push({ text, index, ...(corner && { corner }) })
  }
  const taken = new Map<Corner, number>()
  const kept = tags.filter((tag) => {
    if (!tag.corner) return true
    if (!taken.has(tag.corner)) {
      taken.set(tag.corner, tag.index)
      return true
    }
    fail([...at, tag.index, 'corner'], `Corner "${tag.corner}" is already used by tag ${taken.get(tag.corner)! + 1}`)
    return false
  })
  // Explicit corners first, then the free corners in order; at most one tag per corner.
  const free = CORNERS.filter((corner) => !taken.has(corner))
  return kept.flatMap(({ text, corner }) => {
    const at = corner ?? free.shift()
    return at ? [{ text, corner: at }] : []
  })
}

/** Optional, `right` by default (also when invalid). */
function readDirection(record: Record<string, unknown>, report: Report): Direction {
  if (!Object.hasOwn(record, 'direction') || record['direction'] === null) return 'right'
  const value = record['direction']
  if (typeof value !== 'string' || !(DIRECTIONS as readonly string[]).includes(value)) {
    report(['direction'], `"direction" must be one of ${DIRECTIONS.join(', ')}, got ${JSON.stringify(value)}`)
    return 'right'
  }
  return value as Direction
}

type Report = (path: FieldPath, message: string) => void

function readNode(
  item: unknown,
  path: FieldPath,
  groupIds: Set<string>,
  report: Report,
): { id?: string; node?: RawNode } {
  if (!isRecord(item)) {
    report(path, 'A node must be a mapping with "id", "name" and "icon"')
    return {}
  }
  checkFields(item, NODE_FIELDS, path, report)
  const id = readId(item, 'id', path, report)
  const name = readText(item, 'name', path, MAX_NAME_LENGTH, true, report)
  const icon = readText(item, 'icon', path, MAX_REFERENCE_LENGTH, true, report)
  const description = readText(item, 'description', path, MAX_DESCRIPTION_LENGTH, false, report)
  const universe = readText(item, 'universe', path, MAX_REFERENCE_LENGTH, false, report)
  let group = readText(item, 'group', path, MAX_ID_LENGTH, false, report)
  if (group !== undefined && !groupIds.has(group)) {
    report([...path, 'group'], `Unknown group "${group}" (declare it in "groups")`)
    group = undefined
  }
  const tags = readTags(item, path, report)
  const color = readColor(item, 'color', path, report)
  const border = readChoice(item, 'border', BORDER_STYLES, path, report)
  const background = readColor(item, 'background', path, report)
  const size = readChoice(item, 'size', NODE_SIZES, path, report)
  const place = readChoice(item, 'place', NODE_PLACES, path, report)
  let after = readText(item, 'after', path, MAX_ID_LENGTH, false, report)
  // One placement hint per node: "place" puts it at an end of the flow, "after" relative to a node.
  if (place != null && after !== undefined) {
    report([...path, 'after'], `A node takes one placement hint: "place" is already set (use either place or after)`)
    after = undefined
  }
  // A node needs an id and a name to be shown; any other invalid property is left out.
  if (id === undefined || name === undefined) return { ...(id !== undefined && { id }) }
  return {
    id,
    node: {
      id,
      name,
      ...(icon !== undefined && { icon }),
      ...(description !== undefined && { description }),
      ...(universe !== undefined && { universe }),
      ...(group !== undefined && { group }),
      ...(tags !== undefined && tags.length > 0 && { tags }),
      ...(color != null && { color }),
      ...(border != null && { border }),
      ...(background != null && { background }),
      ...(size != null && { size }),
      ...(place != null && { place }),
      ...(after !== undefined && { after }),
    },
  }
}

/** Ids of the universe's nodes, of those that open a sub-universe, and of its groups. */
interface KnownEnds {
  ids: Set<string>
  opening: Set<string>
  groups: Set<string>
}

function readEdge(
  item: unknown,
  path: FieldPath,
  known: KnownEnds,
  report: Report,
): RawEdge | undefined {
  if (!isRecord(item)) {
    report(path, 'A connection must be a mapping with "from" and "to"')
    return undefined
  }
  checkFields(item, EDGE_FIELDS, path, report)
  const from = readEnd(item, 'from', path, known, report)
  const to = readEnd(item, 'to', path, known, report)
  const label = readText(item, 'label', path, MAX_LABEL_LENGTH, false, report)
  const color = readColor(item, 'color', path, report)
  const style = readChoice(item, 'style', LINE_STYLES, path, report)
  const arrow = readChoice(item, 'arrow', ARROW_HEADS, path, report)
  // A connection is shown only if everything that draws it is valid; an invalid label is left out.
  // An invalid side falls back to the default side.
  if (from === undefined || to === undefined || color === null || style === null || arrow === null) return undefined
  return {
    from: from.node,
    to: to.node,
    ...(label !== undefined && { label }),
    ...(color !== undefined && { color }),
    ...(style !== undefined && { style }),
    ...(arrow !== undefined && { arrow }),
    ...(from.side && { fromSide: from.side }),
    ...(to.side && { toSide: to.side }),
    ...(from.group && { fromGroup: true as const }),
    ...(to.group && { toGroup: true as const }),
    ...(from.path && { fromPath: from.path }),
    ...(to.path && { toPath: to.path }),
    index: Number(path[path.length - 1]),
  }
}

/** A node path: `api`, or `vps/api` (the node `api` of the universe opened by `vps`), up to 8 levels. */
const MAX_PATH_DEPTH = 8

/**
 * An end of a connection: a node id or path, or a group id (when no node has that id), or
 * `{ node, side }` / `{ group, side }`.
 */
function readEnd(
  record: Record<string, unknown>,
  key: 'from' | 'to',
  path: FieldPath,
  known: KnownEnds,
  report: Report,
): { node: string; group?: true; side?: Side; path?: string[] } | undefined {
  const value = record[key]
  let node: string | undefined
  let side: Side | undefined
  let nodePath: FieldPath = [...path, key]
  if (isRecord(value)) {
    const at = [...path, key]
    checkFields(value, END_FIELDS, at, report)
    side = readChoice(value, 'side', SIDES, at, report) ?? undefined
    const named = (field: string) => Object.hasOwn(value, field) && value[field] !== null && value[field] !== undefined
    if (named('group')) {
      if (named('node')) {
        report(at, 'An end names a node or a group, not both ("node" and "group" are set)')
        return undefined
      }
      const group = readText(value, 'group', at, MAX_ID_LENGTH, true, report)
      if (group === undefined) return undefined
      if (!known.groups.has(group)) {
        report([...at, 'group'], `Unknown group "${group}" (connections must reference groups of the same universe)`)
        return undefined
      }
      return { node: group, group: true, ...(side && { side }) }
    }
    if (!named('node')) {
      report([...at, 'node'], 'Missing required field "node" (or "group")')
      return undefined
    }
    node = readText(value, 'node', at, MAX_ID_LENGTH, true, report)
    nodePath = [...at, 'node']
  } else {
    node = readText(record, key, path, MAX_ID_LENGTH, true, report)
  }
  if (node === undefined) return undefined
  const [first = '', ...inner] = node.split('/')
  if (inner.length > 0) {
    const segments = [first, ...inner]
    const bad = segments.find((segment) => !ID_PATTERN.test(segment))
    if (bad !== undefined) {
      report(nodePath, `Invalid node path "${node}": "${bad}" is not a node id (ids separated by "/", e.g. "vps/api")`)
      return undefined
    }
    if (segments.length > MAX_PATH_DEPTH) {
      report(nodePath, `Node path "${node}" is too deep (${segments.length} levels, max ${MAX_PATH_DEPTH})`)
      return undefined
    }
  }
  const explicit = isRecord(value)
  if (!known.ids.has(first)) {
    // A plain id names a group when no node has it.
    if (!explicit && known.groups.has(first)) {
      if (inner.length === 0) return { node: first, group: true, ...(side && { side }) }
      report(nodePath, `Group "${first}" does not open a universe ("${node}")`)
      return undefined
    }
    report(
      nodePath,
      explicit
        ? `Unknown node "${first}" (connections must reference nodes of the same universe)`
        : `Unknown node or group "${first}" (connections must reference nodes or groups of the same universe)`,
    )
    return undefined
  }
  if (inner.length > 0 && !known.opening.has(first)) {
    report(nodePath, `Node "${first}" does not open a universe ("${node}")`)
    return undefined
  }
  return { node: first, ...(side && { side }), ...(inner.length > 0 && { path: inner }) }
}

function readId(
  record: Record<string, unknown>,
  key: string,
  path: FieldPath,
  report: Report,
): string | undefined {
  const value = readText(record, key, path, MAX_ID_LENGTH, true, report)
  if (value === undefined) return undefined
  if (!ID_PATTERN.test(value)) {
    report(
      [...path, key],
      `Invalid id "${value}": use letters, digits, ".", "_" or "-", starting with a letter or digit`,
    )
    return undefined
  }
  return value
}

function readText(
  record: Record<string, unknown>,
  key: string,
  path: FieldPath,
  maxLength: number,
  required: boolean,
  report: Report,
): string | undefined {
  if (!Object.hasOwn(record, key) || record[key] === undefined || record[key] === null) {
    if (required) report([...path, key], `Missing required field "${key}"`)
    return undefined
  }
  const value = record[key]
  if (typeof value !== 'string') {
    report([...path, key], `"${key}" must be a string, got ${describe(value)}`)
    return undefined
  }
  if (value.trim() === '') {
    report([...path, key], `"${key}" must not be empty`)
    return undefined
  }
  if (value.length > maxLength) {
    report([...path, key], `"${key}" is too long (${value.length} characters, max ${maxLength})`)
    return undefined
  }
  return value
}

function readList(
  record: Record<string, unknown>,
  key: string,
  required: boolean,
  report: Report,
): unknown[] {
  if (!Object.hasOwn(record, key) || record[key] === undefined || record[key] === null) {
    if (required) report([key], `Missing required field "${key}"`)
    return []
  }
  const value = record[key]
  if (!Array.isArray(value)) {
    report([key], `"${key}" must be a list, got ${describe(value)}`)
    return []
  }
  return value
}

function checkFields(
  record: Record<string, unknown>,
  allowed: string[],
  path: FieldPath,
  report: Report,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      report([...path, key], `Unknown field "${key}" (allowed: ${allowed.join(', ')})`)
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(value: unknown): string {
  if (Array.isArray(value)) return 'a list'
  if (value === null) return 'null'
  if (typeof value === 'object') return 'a mapping'
  return typeof value
}
