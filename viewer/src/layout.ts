// Automatic layout of one universe with ELK (layered in the universe's direction, orthogonal edges).
// Pure geometry: independent from Vue Flow so it can be unit-tested.
import type { ELK, ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api.js'
import type { ArchitectureEdge, ArchitectureGroup, ArchitectureNode, Direction, NodeSize, Side, Universe } from '../../src/core/types.ts'
import { edgeCrossings, overlaps, routeAll, shiftOf, type NodeBox } from './route.ts'

// A node is a square tile (the icon) with its name and description below it. Its layout box also
// keeps room around the tile for the corner tags. These are the sizes of a `medium` node; see
// `nodeGeometry` for the others.
export const NODE_WIDTH = 144
export const TILE_SIZE = 56
/** Distance from the top of the box to the tile (room for the top tags). */
export const TILE_TOP = 12
export const TILE_LEFT = (NODE_WIDTH - TILE_SIZE) / 2
/** Between the tile and the name (room for the bottom tags). */
export const TEXT_GAP = 14
export const NAME_HEIGHT = 18
export const DESCRIPTION_LINE_HEIGHT = 15
const BOTTOM_PADDING = 4
/** Room at the top of a group for its icon and name. */
export const GROUP_HEADER = 44
const GROUP_PADDING = 20

/**
 * Where the title of a group is drawn (its icon and name, GroupNode.vue: 16px padding, 13px
 * semibold text), approximately: connections and labels keep clear of it.
 */
export function groupTitle(group: Rect, name: string): Rect {
  return { x: group.x, y: group.y, width: Math.min(group.width, Math.ceil(50 + name.length * 7.5)), height: GROUP_HEADER }
}
export const LABEL_HEIGHT = 18
/**
 * A node that opens a universe is drawn doubled: a copy of its tile behind it, shifted by this
 * much down and to the right. Connections on its right side attach to the tile behind.
 */
export const BEHIND_OFFSET = 6
export const LABEL_PADDING_X = 6

export interface NodeGeometry {
  /** Width of the layout box. */
  width: number
  /** Side of the square tile. */
  tile: number
  /** From the left of the box to the tile. */
  tileLeft: number
  /** Side of the icon in the tile. */
  icon: number
  /** How far the tile behind sticks out on the right (`BEHIND_OFFSET` for a node that opens a universe, else 0). */
  behind?: number
}

const GEOMETRIES: Record<NodeSize, NodeGeometry> = {
  small: { width: 120, tile: 40, tileLeft: 40, icon: 22 },
  medium: { width: NODE_WIDTH, tile: TILE_SIZE, tileLeft: TILE_LEFT, icon: 30 },
  large: { width: 176, tile: 80, tileLeft: 48, icon: 44 },
}

/** Box and tile sizes of a node (`medium` when no size is given). */
export function nodeGeometry(size: NodeSize | undefined): NodeGeometry {
  return GEOMETRIES[size ?? 'medium'] ?? GEOMETRIES.medium
}

export interface Point {
  x: number
  y: number
}

export interface Rect extends Point {
  width: number
  height: number
}

export interface LaidOutNode extends Rect {
  node: ArchitectureNode
}

export interface LaidOutGroup extends Rect {
  group: ArchitectureGroup
}

export interface LaidOutEdge {
  /** The connection as configured (style, color, arrowheads). */
  edge: ArchitectureEdge
  id: string
  /** Vue Flow ids of its ends: a node id, or `groupFlowId(id)` for a group (`endOf`). */
  from: string
  to: string
  /** Start point, bend points, end point (from the side of the source tile, or frame, to the target's). */
  points: Point[]
  label?: Rect & { text: string }
  /**
   * Its nodes share a layer of the flow (`align`, `beside`): it goes across the flow, so the
   * router prefers no side (its route is drawn by the router only, ELK does not see it).
   */
  across?: true
}

export interface UniverseLayout {
  groups: LaidOutGroup[]
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
}

/** Rendered width of a text: an edge label, or a node description (wrapped on 2 lines at most). */
export type MeasureText = (text: string, kind: 'label' | 'description') => number

const ELK_DIRECTIONS: Record<Direction, string> = { right: 'RIGHT', down: 'DOWN', left: 'LEFT', up: 'UP' }

const LAYOUT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.edgeRouting': 'ORTHOGONAL',
  // Groups are laid out together with their content, and connections may cross their border.
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  // All coordinates relative to the universe, also inside groups.
  'elk.json.shapeCoords': 'ROOT',
  'elk.json.edgeCoords': 'ROOT',
  'elk.spacing.nodeNode': '32',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '12',
  'elk.spacing.edgeLabel': '4',
  'elk.spacing.componentComponent': '48',
  'elk.layered.spacing.nodeNodeBetweenLayers': '32',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '12',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  // Keep the order of the configuration file when it does not cost crossings.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  // Connections forming a loop (a → b → a) cannot all follow the flow. The arrows are followed
  // from the nodes without incoming connections, and only the connection that closes a loop is
  // drawn against the flow; a loop without entry starts at the node listed first in the file.
  // (The default heuristic favours nodes with more outgoing connections: a single connection
  // closing a loop could then move a whole branch.)
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  'elk.edgeLabels.placement': 'CENTER',
}

/** When the layers are chosen by Graphinity (`sharedLayers`): ELK follows the positions given. */
const INTERACTIVE_LAYERS: Record<string, string> = {
  'elk.layered.layering.strategy': 'INTERACTIVE',
  'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
}

// ELK is most of the bundle: loaded as a separate chunk, starting as soon as this module loads.
// elkjs is CommonJS: bundlers expose its constructor as the default export, but under Node's
// module resolution (used to type-check the tests) the default export is typed as the module.
const elk: Promise<ELK> = import('elkjs/lib/elk.bundled.js').then(
  (module) => new (module.default as unknown as new () => ELK)(),
)

/** Vue Flow id of a group (node ids cannot contain ":"). */
export const groupFlowId = (id: string) => `group:${id}`

/** Vue Flow id of an end of a connection: the node, or the group (`fromGroup`, `toGroup`). */
export function endOf(edge: ArchitectureEdge, end: 'from' | 'to'): string {
  return end === 'from' ? (edge.fromGroup ? groupFlowId(edge.from) : edge.from) : edge.toGroup ? groupFlowId(edge.to) : edge.to
}

// ELK ids share one namespace: prefix them so node, group and edge ids cannot collide.
const nodeKey = (id: string) => `n:${id}`
const groupKey = (id: string) => `g:${id}`
const edgeKey = (id: string) => `e:${id}`
/** One port per node and side, shared by the connections that use it (first pass). */
const portKey = (id: string, side: Side) => `n:${id}:${side}`
/** The ELK shape of an end of a connection. */
const shapeKey = (edge: ArchitectureEdge, end: 'from' | 'to') =>
  (end === 'from' ? edge.fromGroup : edge.toGroup) ? groupKey(end === 'from' ? edge.from : edge.to) : nodeKey(end === 'from' ? edge.from : edge.to)
/** One port per connection end (second pass). */
const endKey = (edgeId: string, end: 'from' | 'to') => `p:${edgeId}:${end}`
/** A side of a node, as a map key. */
const sideKey = (id: string, side: Side) => `${id}\u0000${side}`
/** The invisible connection that places a node `after` another. */
const hiddenKey = (id: string) => `h:${id}`

/** Ids of the ports on one side of a node, in order along the side (top to bottom, left to right). */
type PortSpread = string[]

const centerOf = (shape: ElkNode | undefined): Point => ({ x: (shape?.x ?? 0) + (shape?.width ?? 0) / 2, y: (shape?.y ?? 0) + (shape?.height ?? 0) / 2 })

/**
 * The connection ends on each side of each node, ordered like the nodes at their other ends were
 * placed by the first pass: along a left or right side by the other node's height, along a top or
 * bottom side by its horizontal position. Ports in that order do not make connections cross.
 */
function spreadPorts(
  universe: Universe,
  ends: readonly { from: Side; to: Side }[],
  shapes: ReadonlyMap<string, ElkNode>,
  isFree: (key: string) => boolean,
): Map<string, PortSpread> {
  const bySide = new Map<string, { key: string; other: Point; index: number }[]>()
  universe.edges.forEach((edge, index) => {
    if (isFree(edgeKey(edge.id))) return
    for (const end of ['from', 'to'] as const) {
      // A group has no ports (see `build`).
      if (end === 'from' ? edge.fromGroup : edge.toGroup) continue
      const node = end === 'from' ? edge.from : edge.to
      const side = ends[index]![end]
      const list = bySide.get(sideKey(node, side)) ?? []
      list.push({ key: endKey(edge.id, end), other: centerOf(shapes.get(shapeKey(edge, end === 'from' ? 'to' : 'from'))), index })
      bySide.set(sideKey(node, side), list)
    }
  })
  const spreads = new Map<string, PortSpread>()
  for (const [key, list] of bySide) {
    const side = key.slice(key.indexOf('\u0000') + 1) as Side
    const along = (p: Point) => (side === 'left' || side === 'right' ? p.y : p.x)
    list.sort((a, b) => along(a.other) - along(b.other) || a.index - b.index)
    spreads.set(key, list.map((end) => end.key))
  }
  return spreads
}

/** Kept on each side of a label placed between two layers chosen by Graphinity. */
const LABEL_ROOM = 16

/** Distance between two layers given to ELK as positions: larger than any node or group. */
const LAYER_STEP = 100_000

/**
 * Layers chosen by Graphinity, for a universe where nodes share a layer (`beside`, `align`): ELK
 * cannot keep two nodes in one layer, so the layers are computed here and given to ELK as
 * positions (its `INTERACTIVE` layering). `undefined` when no node shares a layer: ELK chooses.
 *
 * Each group lays out its own content (ELK's hierarchy): the layers are computed per container
 * (the universe, or a group), between its children (nodes and groups). Nodes kept together form
 * one class, which takes one layer; a connection between two nodes of a class (`free`) leaves the
 * layering, and ELK does not see it: the router draws it across. Like ELK's `DEPTH_FIRST` cycle
 * breaking, the arrows are followed from the classes without incoming connections, in the order
 * of the file, and a connection closing a loop goes against the flow; each class then takes the
 * longest path to it, and a class without incoming connections is drawn just before the first
 * one it leads to.
 */
function sharedLayers(
  universe: Universe,
  groups: ReadonlyMap<string, ArchitectureGroup>,
  options: LayoutOptions,
): { layers: Map<string, number>; free: Set<string> } | undefined {
  const nodes = new Map(universe.nodes.map((node) => [node.id, node]))
  const together: [string, string][] = []
  for (const node of universe.nodes) if (node.beside !== undefined && nodes.has(node.beside)) together.push([node.id, node.beside])
  for (const edge of universe.edges) {
    if (edge.align && !edge.fromGroup && !edge.toGroup && nodes.has(edge.from) && nodes.has(edge.to)) together.push([edge.from, edge.to])
  }
  if (together.length === 0) return undefined

  // Containers and their children (ELK keys), in the order `build` adds them.
  const containerOf = new Map<string, string>()
  const children = new Map<string, string[]>([['root', []]])
  const add = (key: string, container: string) => {
    if (containerOf.has(key)) return
    containerOf.set(key, container)
    children.set(container, [...(children.get(container) ?? []), key])
  }
  const addGroup = (group: ArchitectureGroup, depth = 0): string => {
    const key = groupKey(group.id)
    if (containerOf.has(key)) return key
    const parent = group.group === undefined || depth > 16 ? undefined : groups.get(group.group)
    add(key, parent ? addGroup(parent, depth + 1) : 'root')
    return key
  }
  for (const node of universe.nodes) {
    const group = node.group === undefined ? undefined : groups.get(node.group)
    add(nodeKey(node.id), group ? addGroup(group) : 'root')
  }
  const order = new Map([...children.values()].flatMap((list) => list.map((key, index) => [key, index] as const)))

  // Classes: union-find over the nodes kept together (of one container).
  const parent = new Map<string, string>()
  const find = (key: string): string => {
    const up = parent.get(key)
    if (up === undefined || up === key) return key
    const root = find(up)
    parent.set(key, root)
    return root
  }
  for (const [a, b] of together) {
    const [ka, kb] = [nodeKey(a), nodeKey(b)]
    if (containerOf.get(ka) !== containerOf.get(kb)) continue
    const [ra, rb] = [find(ka), find(kb)]
    if (ra !== rb) parent.set(order.get(ra)! <= order.get(rb)! ? rb : ra, order.get(ra)! <= order.get(rb)! ? ra : rb)
  }

  // The connections ELK lays out (visible, and the invisible ones of `after`), between the
  // children of the container that holds both ends.
  const chain = (key: string): string[] => {
    const keys = [key]
    for (let at = containerOf.get(key); at !== undefined && keys.length < 32; at = containerOf.get(at)) keys.push(at)
    return keys
  }
  const links = new Map<string, [string, string][]>()
  const free = new Set<string>()
  const link = (id: string, from: string, to: string) => {
    if (from === to || !containerOf.has(from) || !containerOf.has(to)) return
    const [up, down] = [chain(from), chain(to)]
    const common = up.find((key) => down.includes(key) && key !== from && key !== to)
    if (common === undefined) return
    const a = up[up.indexOf(common) - 1]!
    const b = down[down.indexOf(common) - 1]!
    if (a === b) return
    if (find(a) === find(b)) free.add(id)
    else links.set(common, [...(links.get(common) ?? []), [find(a), find(b)]])
  }
  for (const edge of universe.edges) link(edgeKey(edge.id), shapeKey(edge, 'from'), shapeKey(edge, 'to'))
  for (const node of universe.nodes) if (node.after !== undefined && nodes.has(node.after)) link(hiddenKey(node.id), nodeKey(node.after), nodeKey(node.id))

  const layers = new Map<string, number>()
  for (const [container, keys] of children) {
    const classes = [...new Set(keys.map(find))]
    const has = (cls: string, test: (node: ArchitectureNode) => boolean) =>
      keys.some((key) => find(key) === cls && key.startsWith('n:') && test(nodes.get(key.slice(2))!))
    const first = new Set(classes.filter((cls) => has(cls, (node) => options.first?.has(node.id) === true || node.place === 'first')))
    const last = new Set(classes.filter((cls) => !first.has(cls) && has(cls, (node) => options.last?.has(node.id) === true || node.place === 'last')))
    // Arrows into a first class, or out of a last one, go against the flow.
    const arrows = (links.get(container) ?? []).map(([a, b]): [string, string] => (first.has(b) || last.has(a) ? [b, a] : [a, b]))
    const next = new Map<string, string[]>(classes.map((cls) => [cls, []]))
    const incoming = new Map<string, number>(classes.map((cls) => [cls, 0]))
    for (const [a, b] of arrows) {
      next.get(a)?.push(b)
      incoming.set(b, (incoming.get(b) ?? 0) + 1)
    }
    // Loops: depth first from the classes without incoming arrows, then the others, in order.
    const forward = new Map<string, string[]>(classes.map((cls) => [cls, []]))
    const state = new Map<string, 'open' | 'done'>()
    const visit = (cls: string) => {
      state.set(cls, 'open')
      for (const to of next.get(cls) ?? []) {
        if (state.get(to) === 'open') forward.get(to)!.push(cls)
        else {
          forward.get(cls)!.push(to)
          if (!state.has(to)) visit(to)
        }
      }
      state.set(cls, 'done')
    }
    for (const cls of classes) if (incoming.get(cls) === 0 && !state.has(cls)) visit(cls)
    for (const cls of classes) if (!state.has(cls)) visit(cls)
    // Longest path, in topological order.
    const before = new Map<string, string[]>(classes.map((cls) => [cls, []]))
    for (const [from, targets] of forward) for (const to of targets) before.get(to)!.push(from)
    const sorted: string[] = []
    const placed = new Set<string>()
    const place = (cls: string) => {
      if (placed.has(cls)) return
      placed.add(cls)
      for (const from of before.get(cls)!) place(from)
      sorted.push(cls)
    }
    for (const cls of classes) place(cls)
    const layer = new Map<string, number>()
    for (const cls of sorted) layer.set(cls, Math.max(0, ...before.get(cls)!.map((from) => layer.get(from)! + 1)))
    // A class nothing leads to sits just before the first one it leads to.
    for (const cls of [...sorted].reverse()) {
      const targets = forward.get(cls)!
      if (before.get(cls)!.length === 0 && !first.has(cls) && targets.length > 0) layer.set(cls, Math.min(...targets.map((to) => layer.get(to)!)) - 1)
    }
    const end = Math.max(0, ...layer.values())
    for (const cls of last) layer.set(cls, end)
    const start = Math.min(0, ...layer.values())
    for (const key of keys) layers.set(key, layer.get(find(key))! - start)
  }
  return { layers, free }
}

/** The position that puts a shape in `layer` of the flow (ELK's `INTERACTIVE` layering). */
function layerPosition(layer: number, direction: Direction): Point {
  switch (direction) {
    case 'right':
      return { x: layer * LAYER_STEP, y: 0 }
    case 'left':
      return { x: -layer * LAYER_STEP, y: 0 }
    case 'down':
      return { x: 0, y: layer * LAYER_STEP }
    case 'up':
      return { x: 0, y: -layer * LAYER_STEP }
  }
}

/** 0 for a group at the top, 1 inside another group, and so on. */
export function groupDepth(group: ArchitectureGroup, groups: ReadonlyMap<string, ArchitectureGroup>): number {
  let depth = 0
  for (let parent = group.group; parent !== undefined && depth <= 16; parent = groups.get(parent)?.group) depth++
  return depth
}

export function nodeHeight(node: ArchitectureNode, measureText: MeasureText): number {
  const { width, tile } = nodeGeometry(node.size)
  const lines = node.description ? (measureText(node.description, 'description') > width ? 2 : 1) : 0
  return TILE_TOP + tile + TEXT_GAP + NAME_HEIGHT + lines * DESCRIPTION_LINE_HEIGHT + BOTTOM_PADDING
}

/** Sides where connections leave (`out`) and enter (`in`) a node by default, following the flow. */
export const DEFAULT_SIDES: Record<Direction, { out: Side; in: Side }> = {
  right: { out: 'right', in: 'left' },
  left: { out: 'left', in: 'right' },
  down: { out: 'bottom', in: 'top' },
  up: { out: 'top', in: 'bottom' },
}

const ELK_SIDES: Record<Side, string> = { left: 'WEST', right: 'EAST', top: 'NORTH', bottom: 'SOUTH' }

/**
 * Where connections attach on a side of a node box: across the middle of the tile on the left
 * and right, at the top of the box (above the tile) and below the text at the bottom, so that
 * connections never cross the name.
 */
function portPosition(side: Side, geometry: NodeGeometry, height: number, rank = 0, count = 1): Point {
  // Several ports on a side are spread evenly along the tile; a single one is in the middle.
  const along = Math.round((geometry.tile * (rank + 1)) / (count + 1))
  switch (side) {
    case 'left':
      return { x: 0, y: TILE_TOP + along }
    case 'right':
      return { x: geometry.width, y: TILE_TOP + along }
    case 'top':
      return { x: geometry.tileLeft + along, y: 0 }
    case 'bottom':
      return { x: geometry.tileLeft + along, y: height }
  }
}

/** Moves an end of a connection from the border of the node box to the border of its tile. */
function toTile(point: Point, side: Side, geometry: NodeGeometry): Point {
  switch (side) {
    case 'left':
      return { x: point.x + geometry.tileLeft, y: point.y }
    case 'right':
      return { x: point.x - geometry.tileLeft + (geometry.behind ?? 0), y: point.y }
    case 'top':
      return { x: point.x, y: point.y + TILE_TOP }
    case 'bottom':
      return point
  }
}

export interface LayoutOptions {
  /** Nodes placed at the start of the flow (first layer), e.g. doors connections come from. */
  first?: ReadonlySet<string>
  /** Nodes placed at the end of the flow (last layer). */
  last?: ReadonlySet<string>
}

export async function layoutUniverse(universe: Universe, measureText: MeasureText, options: LayoutOptions = {}): Promise<UniverseLayout> {
  const direction = universe.direction
  const defaults = DEFAULT_SIDES[direction] ?? DEFAULT_SIDES.right
  const groups = new Map(universe.groups.map((group) => [group.id, group]))
  const heights = new Map(universe.nodes.map((node) => [node.id, nodeHeight(node, measureText)]))
  const geometries = new Map(
    universe.nodes.map((node) => [node.id, { ...nodeGeometry(node.size), ...(node.universe !== undefined && { behind: BEHIND_OFFSET }) }]),
  )
  // Nodes sharing a layer (`beside`, `align`): the layers are chosen here (see `sharedLayers`).
  const shared = sharedLayers(universe, groups, options)
  /** Connections ELK does not see (across a layer): the router draws them. */
  const isFree = (key: string) => shared?.free.has(key) === true
  /** The sides each node needs a port on. */
  const sides = new Map<string, Set<Side>>(universe.nodes.map((node) => [node.id, new Set([defaults.in, defaults.out])]))
  const ends = universe.edges.map((edge) => ({ from: edge.fromSide ?? defaults.out, to: edge.toSide ?? defaults.in }))
  universe.edges.forEach((edge, index) => {
    if (isFree(edgeKey(edge.id))) return
    if (!edge.fromGroup) sides.get(edge.from)?.add(ends[index]!.from)
    if (!edge.toGroup) sides.get(edge.to)?.add(ends[index]!.to)
  })

  const labels = universe.edges.map((edge) =>
    // ELK gives labeled edges an extra layer: a 1px blank label on unlabeled edges keeps every
    // edge the same length, so nodes line up in columns. (ELK ignores labels with empty text.)
    edge.label
      ? { text: edge.label, width: Math.ceil(measureText(edge.label, 'label')) + 2 * LABEL_PADDING_X, height: LABEL_HEIGHT }
      : { text: ' ', width: 1, height: 1 },
  )

  // Layers chosen here: ELK places no labels, so the gaps leave room for them: between the layers
  // for the largest label along the flow; inside a layer for every label across it between the
  // same two nodes, one after the other along their parallel lines (half as much again, as the
  // router places labels at fixed stops along a line).
  const vertical = direction === 'down' || direction === 'up'
  const along = Math.max(
    32,
    ...universe.edges.flatMap((edge, index) => (edge.label && !isFree(edgeKey(edge.id)) ? [labels[index]![vertical ? 'height' : 'width'] + 2 * LABEL_ROOM] : [])),
  )
  const acrossPairs = new Map<string, number[]>()
  universe.edges.forEach((edge, index) => {
    if (!edge.label || !isFree(edgeKey(edge.id))) return
    const pair = [edge.from, edge.to].sort().join('\u0000')
    acrossPairs.set(pair, [...(acrossPairs.get(pair) ?? []), labels[index]![vertical ? 'width' : 'height']])
  })
  const across = Math.max(
    32,
    ...[...acrossPairs.values()].map((sizes) => (sizes.length === 1 ? sizes[0]! : 1.5 * sizes.reduce((sum, size) => sum + size, 0)) + 2 * LABEL_ROOM),
  )
  const sharedOptions: Record<string, string> | undefined = shared && {
    ...INTERACTIVE_LAYERS,
    'elk.layered.spacing.nodeNodeBetweenLayers': String(along),
    'elk.spacing.nodeNode': String(across),
  }

  /**
   * The ELK graph. Without `ports`, one port per node and side, shared by its connections (first
   * pass). With them, one port per connection end, spread along the side of the tile (second pass).
   */
  const build = (pass: { ports?: ReadonlyMap<string, PortSpread> } = {}): ElkNode => {
    // Groups take the place of their first node, so the file order still guides the layout. A
    // group inside another one is laid out inside it (the engine guarantees a tree).
    const rootChildren: ElkNode[] = []
    /** The position of a shape in its layer, when the layers are chosen here. */
    const at = (key: string): Partial<Point> => {
      const layer = shared?.layers.get(key)
      return layer === undefined ? {} : layerPosition(layer, direction)
    }
    const groupNodes = new Map<string, ElkNode>()
    const groupNode = (group: ArchitectureGroup, depth = 0): ElkNode => {
      let elkGroup = groupNodes.get(group.id)
      if (elkGroup) return elkGroup
      elkGroup = {
        id: groupKey(group.id),
        ...at(groupKey(group.id)),
        layoutOptions: {
          'elk.padding': `[top=${GROUP_HEADER},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
          ...sharedOptions,
        },
        children: [],
      }
      groupNodes.set(group.id, elkGroup)
      const parent = group.group === undefined || depth > 16 ? undefined : groups.get(group.group)
      ;(parent ? groupNode(parent, depth + 1).children! : rootChildren).push(elkGroup)
      return elkGroup
    }
    for (const node of universe.nodes) {
      const height = heights.get(node.id)!
      const geometry = geometries.get(node.id)!
      const ports: ElkPort[] = [...sides.get(node.id)!].flatMap((side): ElkPort[] => {
        const spread = pass.ports ? (pass.ports.get(sideKey(node.id, side)) ?? []) : undefined
        const count = spread ? spread.length : 1
        return Array.from({ length: count }, (_, rank) => {
          const at = portPosition(side, geometry, height, rank, count)
          const id = spread ? spread[rank]! : portKey(node.id, side)
          return { id, x: at.x, y: at.y, width: 0, height: 0, layoutOptions: { 'elk.port.side': ELK_SIDES[side] } }
        })
      })
      const layer = options.first?.has(node.id) || node.place === 'first' ? 'FIRST' : options.last?.has(node.id) || node.place === 'last' ? 'LAST' : undefined
      const elkNode: ElkNode = {
        id: nodeKey(node.id),
        ...at(nodeKey(node.id)),
        width: geometry.width,
        height,
        layoutOptions: {
          'elk.portConstraints': 'FIXED_POS',
          ...(layer && { 'elk.layered.layering.layerConstraint': layer }),
        },
        ports,
      }
      const group = node.group === undefined ? undefined : groups.get(node.group)
      ;(group ? groupNode(group).children! : rootChildren).push(elkNode)
    }
    return {
      id: 'root',
      layoutOptions: {
        ...LAYOUT_OPTIONS,
        'elk.direction': ELK_DIRECTIONS[direction] ?? 'RIGHT',
        ...sharedOptions,
      },
      children: rootChildren,
      edges: [
        ...universe.edges.flatMap((edge, index) => {
          if (isFree(edgeKey(edge.id))) return []
          // A connection to a group attaches to the group itself, without a port: ELK (0.12) fails
          // on ports of groups inside groups in vertical flows, and the sides are drawn by routeAll.
          const port = (end: 'from' | 'to') => {
            const [id, group, side] = end === 'from' ? [edge.from, edge.fromGroup, ends[index]!.from] : [edge.to, edge.toGroup, ends[index]!.to]
            return group ? groupKey(id) : pass.ports ? endKey(edge.id, end) : portKey(id, side)
          }
          // Layers chosen here: no labels for ELK, which would put them in layers of their own
          // (the router places them, in the room left between the layers).
          return [{ id: edgeKey(edge.id), sources: [port('from')], targets: [port('to')], ...(!shared && { labels: [labels[index]!] }) }]
        }),
        // `after`: an invisible connection from that node, so that this one comes later in the flow.
        ...universe.nodes.flatMap((node) =>
          node.after !== undefined && heights.has(node.after) && !isFree(hiddenKey(node.id))
            ? [{ id: hiddenKey(node.id), sources: [nodeKey(node.after)], targets: [nodeKey(node.id)] }]
            : [],
        ),
      ],
    }
  }

  const shapes = new Map<string, ElkNode>()
  const routes = new Map<string, ElkExtendedEdge>()
  const collect = (shape: ElkNode) => {
    shapes.set(shape.id, shape)
    for (const edge of shape.edges ?? []) routes.set(edge.id, edge)
    for (const child of shape.children ?? []) collect(child)
  }
  collect(await (await elk).layout(build()))

  // Second pass, when a side carries several connections: each gets its own port, ordered as the
  // other ends were placed by the first pass, so that they do not cross.
  const ports = spreadPorts(universe, ends, shapes, isFree)
  if ([...ports.values()].some((list) => list.length > 1)) {
    shapes.clear()
    routes.clear()
    collect(await (await elk).layout(build({ ports })))
  }

  const laidNodes: LaidOutNode[] = universe.nodes.map((node) => {
    const laid = shapes.get(nodeKey(node.id))
    return { node, x: laid?.x ?? 0, y: laid?.y ?? 0, width: geometries.get(node.id)!.width, height: heights.get(node.id)! }
  })
  const laidGroups: LaidOutGroup[] = universe.groups.flatMap((group) => {
    const laid = shapes.get(groupKey(group.id))
    return laid ? [{ group, x: laid.x ?? 0, y: laid.y ?? 0, width: laid.width ?? 0, height: laid.height ?? 0 }] : []
  })
  const boxes = new Map<string, NodeBox>([
    ...laidNodes.map((laid) => [laid.node.id, { ...laid, ...geometries.get(laid.node.id)! }] as const),
    ...laidGroups.map((laid) => [groupFlowId(laid.group.id), frameBox(laid)] as const),
  ])

  return {
    // Outer groups first (Vue Flow needs parents before their children, and draws them below).
    groups: [...laidGroups].sort((a, b) => groupDepth(a.group, groups) - groupDepth(b.group, groups)),
    nodes: laidNodes,
    edges: reroute(
      elkEdges(universe, routes, ends, geometries, labels).map((laid) => (isFree(edgeKey(laid.id)) ? { ...laid, across: true as const } : laid)),
      boxes,
      defaults,
      laidGroups.map((laid) => groupTitle(laid, laid.group.name)),
      shared !== undefined,
    ),
  }
}

/**
 * ELK places the nodes; the connections are then drawn again by the viewer's own router
 * (route.ts), all together: the same one that redraws them after a drag, so that the first view
 * already looks like it. ELK keeps every connection in the flow, which makes long detours for
 * the doors and for connections going against it. ELK's route stays for a connection from a node
 * to itself, and when every simple route would go through a node; all of ELK's routes stay when
 * they are less tangled (`tangle`) than the new ones.
 */
/** A group frame as an end of connections (route.ts): they attach to its border. */
export function frameBox(rect: Rect): NodeBox {
  const { x, y, width, height } = rect
  return { x, y, width, height, tile: width, tileHeight: height, tileLeft: 0, tileTop: 0, frame: true }
}

function reroute(
  edges: LaidOutEdge[],
  boxes: ReadonlyMap<string, NodeBox>,
  flow: { out: Side; in: Side },
  /** Group titles, kept clear of labels. */
  headers: readonly Rect[],
  /** ELK placed no labels (layers chosen by Graphinity): the router's routes are always taken. */
  routerOnly = false,
): LaidOutEdge[] {
  const planned = routeAll(
    boxes,
    edges.map((laid) => ({
      id: laid.id,
      from: laid.from,
      to: laid.to,
      ...(laid.edge.fromSide && { fromSide: laid.edge.fromSide }),
      ...(laid.edge.toSide && { toSide: laid.edge.toSide }),
      ...(laid.label && { label: { width: laid.label.width, height: laid.label.height } }),
      ...(laid.across && { across: true }),
      fallback: laid.points,
    })),
    flow,
    headers,
  )
  const rerouted = edges.map((laid) => {
    const route = planned.get(laid.id)
    if (!route || route.points.length < 2) return laid
    const label = laid.label && route.label && { ...laid.label, x: route.label.x - laid.label.width / 2, y: route.label.y - laid.label.height / 2 }
    return { ...laid, points: route.points, ...(label && { label }) }
  })
  // Never worse than ELK: its routes stay when they cross and overlap each other less, and keep
  // the sides set in the configuration (ELK chooses the sides of groups itself).
  const chosen = routerOnly || tangle(rerouted) <= tangle(edges) || !edges.every((laid) => keepsGroupSides(laid, boxes)) ? rerouted : edges
  // A connection ELK did not lay out (across a layer) has only the router's route.
  return chosen.map((laid, index) => (laid.points.length < 2 ? rerouted[index]! : laid))
}

/** Does an ELK route leave and enter the groups at its ends by the sides set in the configuration? */
function keepsGroupSides(laid: LaidOutEdge, boxes: ReadonlyMap<string, NodeBox>): boolean {
  const { edge, points } = laid
  if (points.length < 2) return true
  for (const [group, side, point, id] of [
    [edge.fromGroup, edge.fromSide, points[0]!, laid.from],
    [edge.toGroup, edge.toSide, points.at(-1)!, laid.to],
  ] as const) {
    const box = boxes.get(id)
    if (group && side && box && shiftOf(point, box).side !== side) return false
  }
  return true
}

/** How tangled the connections are: crossings and segments drawn on top of each other, then turns, tiny steps and length. */
function tangle(edges: readonly LaidOutEdge[]): number {
  let score = 0
  for (const [i, edge] of edges.entries()) {
    const later = edges.slice(i + 1).map((other) => other.points)
    score += 100 * (edgeCrossings(edge.points, later) + overlaps(edge.points, later))
    const last = edge.points.length - 2
    for (let k = 0; k <= last; k++) {
      const [a, b] = [edge.points[k]!, edge.points[k + 1]!]
      const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
      score += 0.05 * length
      // Turns, and tiny steps that look like glitches.
      if (k > 0) score += 10
      if (k > 0 && k < last && length < 12) score += 60
    }
  }
  return score
}

/** The routes and labels computed by ELK, in the order of the file. */
function elkEdges(
  universe: Universe,
  routes: ReadonlyMap<string, ElkExtendedEdge>,
  ends: readonly { from: Side; to: Side }[],
  geometries: ReadonlyMap<string, NodeGeometry>,
  /** The size of each label (its place comes from ELK, or from the router when ELK has none). */
  sizes: readonly { width: number; height: number }[],
): LaidOutEdge[] {
  return universe.edges.map((edge, index) => {
    const laid = routes.get(edgeKey(edge.id))
    const section = laid?.sections?.[0]
    const points = section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : []
    // Ends on a node move to its tile; ends on a group stay on its frame.
    if (points.length >= 2) {
      const { from, to } = ends[index]!
      if (!edge.fromGroup) points[0] = toTile(points[0]!, from, geometries.get(edge.from) ?? nodeGeometry(undefined))
      if (!edge.toGroup) points[points.length - 1] = toTile(points[points.length - 1]!, to, geometries.get(edge.to) ?? nodeGeometry(undefined))
    }
    // Without a label from ELK, its size only: the router places it.
    const label = laid?.labels?.[0] ?? { x: 0, y: 0, ...sizes[index]! }
    return {
      edge,
      id: edge.id,
      from: endOf(edge, 'from'),
      to: endOf(edge, 'to'),
      points: points.map(({ x, y }) => ({ x, y })),
      ...(edge.label && {
        label: { text: edge.label, x: label.x ?? 0, y: label.y ?? 0, width: label.width ?? 0, height: label.height ?? 0 },
      }),
    }
  })
}

/** SVG path through orthogonal points, with rounded corners. */
export function roundedPath(points: Point[], radius = 8): string {
  const [first, ...rest] = points
  if (!first) return ''
  let d = `M ${first.x} ${first.y}`
  for (let i = 0; i < rest.length; i++) {
    const corner = rest[i]!
    const prev = points[i]!
    const next = rest[i + 1]
    if (!next) {
      d += ` L ${corner.x} ${corner.y}`
      break
    }
    const r = Math.min(radius, distance(prev, corner) / 2, distance(corner, next) / 2)
    const before = towards(corner, prev, r)
    const after = towards(corner, next, r)
    d += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`
  }
  return d
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Point at `length` from `from` in the direction of `to`. */
function towards(from: Point, to: Point, length: number): Point {
  const d = distance(from, to)
  if (d === 0) return from
  return { x: from.x + ((to.x - from.x) / d) * length, y: from.y + ((to.y - from.y) / d) * length }
}
