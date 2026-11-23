// Route of a connection whose nodes have been moved by the user (ELK cannot route around nodes it
// did not place), or that ELK drew as a long detour (layout.ts). This picks, among simple right-angled paths between the sides of the two
// nodes, the one that crosses no other node (or the fewest), then the shortest with the fewest
// turns. Sides set in the configuration are kept. Pure geometry, unit-tested.
import type { Side } from '../../src/core/types.ts'
import { TILE_LEFT, TILE_SIZE, TILE_TOP, type Point, type Rect } from './layout.ts'

const SIDES: Side[] = ['right', 'bottom', 'left', 'top']

/**
 * A node box, with the size of its tile (default: a `medium` node), or a group frame (`frame`):
 * connections attach to the border of the tile, which is then the whole frame.
 */
export interface NodeBox extends Rect {
  tile?: number
  tileLeft?: number
  /** From the top of the box to the tile (default `TILE_TOP`). */
  tileTop?: number
  /** Height of the tile when it is not square (default: `tile`). */
  tileHeight?: number
  /** How far the tile behind a doubled node sticks out on the right (see `BEHIND_OFFSET`). */
  behind?: number
  /** A group frame: an end of connections, never an obstacle (connections cross frames). */
  frame?: boolean
}

/** The tile of a box (where connections attach), relative to the box. */
function tileOf(box: NodeBox): { left: number; top: number; width: number; height: number } {
  const width = box.tile ?? TILE_SIZE
  return { left: box.tileLeft ?? TILE_LEFT, top: box.tileTop ?? TILE_TOP, width, height: box.tileHeight ?? width }
}

/** Length of the tile along a side: where the ends on that side are spread. */
function span(box: NodeBox, side: Side): number {
  const tile = tileOf(box)
  return side === 'left' || side === 'right' ? tile.height : tile.width
}

/** Length of the straight part leaving and entering a node, beyond its box. */
const STUB = 16
/** Margin kept around other nodes. */
const CLEARANCE = 8
export const CROSSING_COST = 10_000
const BACKTRACK_COST = 5_000
const TURN_COST = 24
/** A step shorter than this in the middle of a route looks like a glitch. */
const SHORT_SEGMENT = 12
const SHORT_SEGMENT_COST = 80
/**
 * Leaving or entering a node on another side than the layout did: connections sharing a side keep
 * their own place on it only while they stay there.
 */
const SIDE_CHANGE_COST = 160
/**
 * Leaving or entering by another side than the universe flows through (when the configuration
 * sets none): breaks near ties in favour of the flow, never prevents a real shortcut.
 */
const OFF_FLOW_COST = 40
/** Running horizontally through the title of a group (over its name). */
const TITLE_COST = 150

/** How many horizontal segments run through one of the titles. */
function throughTitles(points: readonly Point[], titles: readonly Rect[]): number {
  let count = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i]!, points[i + 1]!]
    if (a.y !== b.y) continue
    for (const title of titles) {
      if (a.y > title.y && a.y < title.y + title.height && Math.max(a.x, b.x) > title.x && Math.min(a.x, b.x) < title.x + title.width) count++
    }
  }
  return count
}

export interface Route {
  /** From the side of the source tile to the side of the target tile. */
  points: Point[]
  /** Where to put the label: middle of the longest segment. */
  label: Point
  /** `routeCost` of the points. */
  cost: number
  /** The sides it leaves and enters by. */
  from: Side
  to: Side
}

/**
 * Where a connection attaches on a side of a node box, and the point just outside the box it
 * goes through. Horizontal ends are the middle of a tile side; the bottom end is below the text
 * (connections never cross the name), the top end is the top of the tile.
 */
function anchor(box: NodeBox, side: Side, shift = 0): { point: Point; exit: Point } {
  const tile = tileOf(box)
  // `shift` moves the end along the side, from its middle (several connections on one side).
  const middle = box.y + tile.top + tile.height / 2 + (side === 'left' || side === 'right' ? shift : 0)
  const center = box.x + box.width / 2 + (side === 'top' || side === 'bottom' ? shift : 0)
  switch (side) {
    case 'right':
      return { point: { x: box.x + tile.left + tile.width + (box.behind ?? 0), y: middle }, exit: { x: box.x + box.width + STUB, y: middle } }
    case 'left':
      return { point: { x: box.x + tile.left, y: middle }, exit: { x: box.x - STUB, y: middle } }
    case 'top':
      return { point: { x: center, y: box.y + tile.top }, exit: { x: center, y: box.y - STUB } }
    case 'bottom':
      return { point: { x: center, y: box.y + box.height }, exit: { x: center, y: box.y + box.height + STUB } }
  }
}

/** Ways to join two exit points with horizontal and vertical segments. */
function middles(p: Point, q: Point): Point[][] {
  const mx = (p.x + q.x) / 2
  const my = (p.y + q.y) / 2
  return [
    [{ x: q.x, y: p.y }],
    [{ x: p.x, y: q.y }],
    [{ x: mx, y: p.y }, { x: mx, y: q.y }],
    [{ x: p.x, y: my }, { x: q.x, y: my }],
  ]
}

/** Drops repeated points and points in the middle of a straight line. */
function simplify(points: Point[]): Point[] {
  const out: Point[] = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (last && last.x === point.x && last.y === point.y) continue
    const before = out[out.length - 2]
    if (before && last && ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y))) {
      // Straight on: keep going, unless it turns back (scored as a backtrack below).
      const forward = (point.x - last.x) * (last.x - before.x) + (point.y - last.y) * (last.y - before.y) >= 0
      if (forward) out.pop()
    }
    out.push(point)
  }
  return out
}

/** Does the horizontal or vertical segment a–b go through the inside of `box`? */
function crosses(a: Point, b: Point, box: Rect, margin: number): boolean {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  return (
    maxX > box.x - margin &&
    minX < box.x + box.width + margin &&
    maxY > box.y - margin &&
    minY < box.y + box.height + margin
  )
}

/**
 * Cost of a route: its length, plus penalties for crossing other nodes (or its own ends), turning
 * back, turning, and tiny steps in the middle. Lower is better.
 */
export function routeCost(points: Point[], source: Rect, target: Rect, obstacles: readonly Rect[]): number {
  let cost = 0
  const last = points.length - 2
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i]!, points[i + 1]!]
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    cost += length
    if (i > 0 && i < last && length < SHORT_SEGMENT) cost += SHORT_SEGMENT_COST
    for (const box of obstacles) if (crosses(a, b, box, CLEARANCE)) cost += CROSSING_COST
    // Leaving the source and entering the target are the only segments allowed inside them.
    if (i > 0 && crosses(a, b, source, 0)) cost += CROSSING_COST
    if (i < last && crosses(a, b, target, 0)) cost += CROSSING_COST
    if (i > 0) {
      const p = points[i - 1]!
      const turn = (a.x - p.x) * (b.y - a.y) - (a.y - p.y) * (b.x - a.x)
      if (turn !== 0) cost += TURN_COST
      else if ((a.x - p.x) * (b.x - a.x) + (a.y - p.y) * (b.y - a.y) < 0) cost += BACKTRACK_COST
    }
  }
  return cost
}

/** Collinear segments closer than this are drawn on top of each other. */
const OVERLAP_GAP = 4
/** Overlaps shorter than this (where connections meet at a node) are not counted. */
const OVERLAP_MIN = 12
export const OVERLAP_COST = 400

/** Crossing a connection already drawn: worth a detour of this many pixels. */
export const EDGE_CROSSING_COST = 90

/** How many times `points` crosses a segment of `others` (strictly, not at an end). */
export function edgeCrossings(points: readonly Point[], others: readonly (readonly Point[])[]): number {
  let count = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i]!, points[i + 1]!]
    const horizontal = a.y === b.y
    for (const other of others) {
      for (let j = 0; j < other.length - 1; j++) {
        const [c, d] = [other[j]!, other[j + 1]!]
        if ((c.y === d.y) === horizontal) continue
        const [h1, h2, v1, v2] = horizontal ? [a, b, c, d] : [c, d, a, b]
        const [x, y] = [v1.x, h1.y]
        if (x > Math.min(h1.x, h2.x) && x < Math.max(h1.x, h2.x) && y > Math.min(v1.y, v2.y) && y < Math.max(v1.y, v2.y)) count++
      }
    }
  }
  return count
}

/** How many segments of `points` run along a segment of `others` (drawn on top of each other). */
export function overlaps(points: readonly Point[], others: readonly (readonly Point[])[]): number {
  let count = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i]!, points[i + 1]!]
    for (const other of others) {
      for (let j = 0; j < other.length - 1; j++) {
        const [c, d] = [other[j]!, other[j + 1]!]
        const horizontal = a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < OVERLAP_GAP
        const vertical = a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < OVERLAP_GAP
        if (!horizontal && !vertical) continue
        const [p, q, r, s] = horizontal ? [a.x, b.x, c.x, d.x] : [a.y, b.y, c.y, d.y]
        const shared = Math.min(Math.max(p, q), Math.max(r, s)) - Math.max(Math.min(p, q), Math.min(r, s))
        if (shared > OVERLAP_MIN) count++
      }
    }
  }
  return count
}

function labelPoint(points: Point[]): Point {
  let best = { length: -1, at: points[0]! }
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i]!, points[i + 1]!]
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    if (length > best.length) best = { length, at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }
  return best.at
}

/**
 * `source`, `target` (nodes or group frames) and `obstacles` (the other nodes) are boxes in flow coordinates.
 * `sides`: the sides set in the configuration, which are kept; the others are chosen.
 */
/** Where an end of a connection is along a side of its node: the side, and the distance from its middle. */
export interface EndShift {
  side: Side
  by: number
}

/** The side and shift of `point`, an end of a connection on the tile of `box`. */
export function shiftOf(point: Point, box: NodeBox): EndShift {
  const tile = tileOf(box)
  const middle = box.y + tile.top + tile.height / 2
  const center = box.x + box.width / 2
  if (Math.abs(point.x - (box.x + tile.left)) < 0.5) return { side: 'left', by: point.y - middle }
  if (Math.abs(point.x - (box.x + tile.left + tile.width + (box.behind ?? 0))) < 0.5) return { side: 'right', by: point.y - middle }
  if (Math.abs(point.y - (box.y + tile.top)) < 0.5) return { side: 'top', by: point.x - center }
  return { side: 'bottom', by: point.x - center }
}

export function routeAround(
  source: NodeBox,
  target: NodeBox,
  obstacles: readonly Rect[],
  sides: { from?: Side; to?: Side } = {},
  /** Routes already drawn: running along them costs `OVERLAP_COST` per segment, crossing them `EDGE_CROSSING_COST`. */
  others: readonly (readonly Point[])[] = [],
  /** Where the ends were attached: kept when the route uses the same side. */
  shifts: { from?: EndShift; to?: EndShift } = {},
  /** The sides the universe flows through: preferred for the ends the configuration does not set. */
  flow?: { out: Side; in: Side },
  /** Group titles: running horizontally through one costs `TITLE_COST`. */
  titles: readonly Rect[] = [],
): Route {
  let best: { points: Point[]; cost: number; from: Side; to: Side } | undefined
  for (const from of sides.from ? [sides.from] : SIDES) {
    for (const to of sides.to ? [sides.to] : SIDES) {
      const a = anchor(source, from, shifts.from?.side === from ? shifts.from.by : 0)
      const b = anchor(target, to, shifts.to?.side === to ? shifts.to.by : 0)
      for (const middle of middles(a.exit, b.exit)) {
        const points = simplify([a.point, a.exit, ...middle, b.exit, b.point])
        const moved = (shifts.from && shifts.from.side !== from ? 1 : 0) + (shifts.to && shifts.to.side !== to ? 1 : 0)
        const offFlow = flow ? (from !== flow.out ? 1 : 0) + (to !== flow.in ? 1 : 0) : 0
        const cost =
          routeCost(points, source, target, obstacles) +
          OVERLAP_COST * overlaps(points, others) +
          EDGE_CROSSING_COST * edgeCrossings(points, others) +
          SIDE_CHANGE_COST * moved +
          OFF_FLOW_COST * offFlow +
          TITLE_COST * throughTitles(points, titles)
        if (!best || cost < best.cost) best = { points, cost, from, to }
      }
    }
  }
  return { points: best!.points, label: labelPoint(best!.points), cost: best!.cost, from: best!.from, to: best!.to }
}

/** How many times the route goes through a node: another one, or its own ends after leaving them. */
function crossings(points: readonly Point[], source: Rect, target: Rect, obstacles: readonly Rect[]): number {
  let count = 0
  const last = points.length - 2
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i]!, points[i + 1]!]
    for (const box of obstacles) if (crosses(a, b, box, CLEARANCE)) count++
    if (i > 0 && crosses(a, b, source, 0)) count++
    if (i < last && crosses(a, b, target, 0)) count++
  }
  return count
}

// ---- Every connection of a universe, together -------------------------------------------------

/** A connection to route with the others of its universe. */
export interface Connection {
  id: string
  from: string
  to: string
  /** Sides set in the configuration (kept). */
  fromSide?: Side
  toSide?: Side
  /** Size of its label, if it has one. */
  label?: { width: number; height: number }
  /**
   * A route to keep when every simple route goes through a node (the layout's, ELK's), and for a
   * connection from a node to itself.
   */
  fallback?: readonly Point[]
}

export interface PlannedRoute {
  points: Point[]
  /** Center of the label. */
  label?: Point
}

/** Between connections that share a corridor: drawn side by side, this far apart. */
export const LANE_GAP = 8
/** Room kept around a label. */
const LABEL_MARGIN = 2

interface Plan {
  connection: Connection
  points: Point[]
  /** A connection from a node to itself, or whose nodes are unknown: its route stays as given. */
  fixed: boolean
  /**
   * The fallback route is kept (no simple route avoids every node): its shape stays, but its ends
   * still take their place along the sides and its segments their lanes.
   */
  kept?: boolean
  source?: NodeBox
  target?: NodeBox
  obstacles: NodeBox[]
  from?: Side
  to?: Side
}

/**
 * Routes every connection of a universe, so that they make room for each other (the layout's
 * first view and the view after a drag use it alike):
 *
 * 1. each connection takes its best simple route (`routeAround`), which picks the sides;
 * 2. the ends sharing a side of a node are spread along it, ordered by the way they turn after
 *    leaving it, so that they do not cross near the node (`compareDepartures`);
 * 3. the routes are drawn again from these ends, each one avoiding running along or crossing the
 *    others as they are (2 and 3 are repeated while the order changes), and nearly aligned
 *    facing ends are lined up;
 * 4. segments still running along each other are moved apart into parallel lanes;
 * 5. labels go where they cover no node, no other label and as few lines as possible.
 *
 * Deterministic: the same boxes and connections give the same routes.
 */
export function routeAll(
  boxes: ReadonlyMap<string, NodeBox>,
  connections: readonly Connection[],
  /** The sides the universe flows through (see `DEFAULT_SIDES`), preferred when free. */
  flow?: { out: Side; in: Side },
  /** The titles of the groups: kept clear of labels, and of routes running along them. */
  keepClear: readonly Rect[] = [],
): Map<string, PlannedRoute> {
  const entries = [...boxes.entries()]
  const copy = (points: readonly Point[] | undefined) => (points ?? []).map(({ x, y }) => ({ x, y }))

  // 1. Sides.
  const plans: Plan[] = connections.map((connection) => {
    const source = boxes.get(connection.from)
    const target = boxes.get(connection.to)
    if (!source || !target || connection.from === connection.to) return { connection, points: copy(connection.fallback), fixed: true, obstacles: [] }
    const obstacles = entries.filter(([id, box]) => id !== connection.from && id !== connection.to && !box.frame).map(([, box]) => box)
    const route = routeAround(source, target, obstacles, configured(connection), [], {}, flow, keepClear)
    if (route.cost >= CROSSING_COST && (connection.fallback?.length ?? 0) >= 2) {
      const points = copy(connection.fallback)
      const [from, to] = [shiftOf(points[0]!, source).side, shiftOf(points.at(-1)!, target).side]
      return { connection, points, fixed: false, kept: true, source, target, obstacles, from, to }
    }
    return { connection, points: route.points, fixed: false, source, target, obstacles, from: route.from, to: route.to }
  })

  // 2 and 3. Ends spread along their side, then the routes drawn again from there, each around
  // the routes drawn before it. Spreading depends on where the routes turn, which depends on the
  // ends: a few rounds, until the order of the ends no longer changes.
  let shifts = spreadEnds(plans)
  for (let round = 0; round < SPREAD_ROUNDS; round++) {
    for (const [index, plan] of plans.entries()) {
      if (plan.fixed || plan.kept) continue
      // Every other connection as it is now: also the ones after this one (their first route).
      const others = plans.flatMap((other, j) => (j === index ? [] : [other.points]))
      const route = routeAround(
        plan.source!,
        plan.target!,
        plan.obstacles,
        { from: plan.from!, to: plan.to! },
        others,
        { from: { side: plan.from!, by: shifts.get(`${index}:from`) ?? 0 }, to: { side: plan.to!, by: shifts.get(`${index}:to`) ?? 0 } },
        undefined,
        keepClear,
      )
      plan.points = route.points
    }
    const next = spreadEnds(plans)
    if ([...next].every(([key, by]) => shifts.get(key) === by)) break
    shifts = next
  }
  // The order of the last routes, kept by moving their ends along the sides (not drawing them
  // again, which could change their shapes and so the order).
  reanchor(plans, spreadEnds(plans), keepClear)

  // Nearly aligned ends facing each other: a straight line rather than a small step.
  straighten(plans)

  // 4. Parallel lanes.
  separate(plans)

  // 5. Labels.
  const labels = placeLabels(plans, [...boxes.values()].filter((box) => !box.frame), keepClear)

  return new Map(plans.map((plan, index) => [plan.connection.id, { points: plan.points, ...(labels.has(index) && { label: labels.get(index)! }) }]))
}

function configured(connection: Connection): { from?: Side; to?: Side } {
  return { ...(connection.fromSide && { from: connection.fromSide }), ...(connection.toSide && { to: connection.toSide }) }
}

/**
 * Moves the ends of each route to their place along the side (`shifts`), keeping its shape: the
 * segment attached to the node moves with its end. A straight route, or one that would then
 * cross more nodes, is drawn again from the new ends instead.
 */
function reanchor(plans: Plan[], shifts: ReadonlyMap<string, number>, titles: readonly Rect[]): void {
  for (const [index, plan] of plans.entries()) {
    if (plan.fixed) continue
    const [from, to] = [shifts.get(`${index}:from`) ?? 0, shifts.get(`${index}:to`) ?? 0]
    const before = plan.points
    const points = before.map((p) => ({ ...p }))
    if (points.length >= 3) {
      for (const [end, by] of [['from', from], ['to', to]] as const) {
        const side = plan[end]!
        const box = end === 'from' ? plan.source! : plan.target!
        const { point } = anchor(box, side, by)
        const [tip, next] = end === 'from' ? [0, 1] : [points.length - 1, points.length - 2]
        const key = side === 'left' || side === 'right' ? 'y' : 'x'
        points[tip] = point
        points[next]![key] = point[key]
      }
    }
    const kept =
      points.length >= 3 &&
      crossings(points, plan.source!, plan.target!, plan.obstacles) <= crossings(before, plan.source!, plan.target!, plan.obstacles)
    if (!kept && plan.kept) continue
    plan.points = kept
      ? simplify(points)
      : routeAround(
          plan.source!,
          plan.target!,
          plan.obstacles,
          { from: plan.from!, to: plan.to! },
          plans.flatMap((other, j) => (j === index ? [] : [other.points])),
          { from: { side: plan.from!, by: from }, to: { side: plan.to!, by: to } },
          undefined,
          titles,
        ).points
  }
}

/** Rounds of spreading the ends and drawing the routes again (see `routeAll`). */
const SPREAD_ROUNDS = 4

/** How a route leaves a side of a node: which way it first turns along the side, and how far out. */
interface Departure {
  /** -1 towards the start of the side (top or left), 1 towards its end, 0 straight on. */
  turn: number
  /** Distance from the node to that first turn (straight on: infinite). */
  depth: number
  /** Where the route ends, along the side's axis. */
  far: number
}

function departure(points: readonly Point[], side: Side, end: 'from' | 'to'): Departure {
  const route = end === 'from' ? points : [...points].reverse()
  const along = (p: Point) => (side === 'left' || side === 'right' ? p.y : p.x)
  const across = (p: Point) => (side === 'left' || side === 'right' ? p.x : p.y)
  const far = along(route.at(-1)!)
  for (let i = 0; i < route.length - 1; i++) {
    const delta = along(route[i + 1]!) - along(route[i]!)
    if (delta !== 0) return { turn: Math.sign(delta), depth: Math.abs(across(route[i]!) - across(route[0]!)), far }
  }
  return { turn: 0, depth: Infinity, far }
}

/**
 * Order of two ends on the same side, so that their routes do not cross near the node: those
 * turning towards the start of the side first, then those going straight on, then those turning
 * towards its end; among routes turning the same way, the one that turns closest to the node is
 * on the outside (it turns away before the other one reaches its height).
 */
function compareDepartures(a: Departure, b: Departure): number {
  if (a.turn !== b.turn) return a.turn - b.turn
  if (a.turn === 0 || a.depth === b.depth) return a.far - b.far
  return a.turn > 0 ? b.depth - a.depth : a.depth - b.depth
}

/**
 * Distance from the middle of its side for each end (`<plan index>:from|to`): the ends of a side
 * ordered by `compareDepartures`, spread evenly along the tile; a single end stays in the middle.
 */
function spreadEnds(plans: readonly Plan[]): Map<string, number> {
  const bySide = new Map<string, { key: string; departure: Departure; index: number; tile: number }[]>()
  for (const [index, plan] of plans.entries()) {
    if (plan.fixed) continue
    for (const end of ['from', 'to'] as const) {
      const side = plan[end]!
      const box = end === 'from' ? plan.source! : plan.target!
      const node = end === 'from' ? plan.connection.from : plan.connection.to
      const key = `${node}\u0000${side}`
      const list = bySide.get(key) ?? []
      list.push({ key: `${index}:${end}`, departure: departure(plan.points, side, end), index, tile: span(box, side) })
      bySide.set(key, list)
    }
  }
  const shifts = new Map<string, number>()
  for (const list of bySide.values()) {
    list.sort((a, b) => compareDepartures(a.departure, b.departure) || a.index - b.index)
    const count = list.length
    for (const [rank, end] of list.entries()) {
      shifts.set(end.key, count === 1 ? 0 : Math.round((end.tile * (rank + 1)) / (count + 1) - end.tile / 2))
    }
  }
  return shifts
}

/** Steps up to this size between two facing ends are removed by moving one of the ends. */
const STRAIGHTEN_MAX = 16
/** Two ends on one side stay at least this far apart. */
const END_GAP = 6

/**
 * A route between facing sides with a small step in the middle (its ends were spread a little
 * differently on both nodes) becomes a straight line when one end can move to face the other:
 * still on its tile, away from the other ends of that side, and crossing nothing more.
 */
function straighten(plans: Plan[]): void {
  /** Positions of the ends along each side of each node. */
  const ends = new Map<string, { plan: number; at: number }[]>()
  const along = (side: Side, p: Point) => (side === 'left' || side === 'right' ? p.y : p.x)
  const key = (node: string, side: Side) => `${node}\u0000${side}`
  for (const [index, plan] of plans.entries()) {
    if (plan.fixed || plan.points.length < 2) continue
    for (const [node, side, point] of [
      [plan.connection.from, plan.from!, plan.points[0]!],
      [plan.connection.to, plan.to!, plan.points.at(-1)!],
    ] as const) {
      const list = ends.get(key(node, side)) ?? []
      list.push({ plan: index, at: along(side, point) })
      ends.set(key(node, side), list)
    }
  }
  for (const [index, plan] of plans.entries()) {
    const points = plan.points
    if (plan.fixed || points.length !== 4) continue
    const horizontal = (plan.from === 'left' || plan.from === 'right') && (plan.to === 'left' || plan.to === 'right')
    const vertical = (plan.from === 'top' || plan.from === 'bottom') && (plan.to === 'top' || plan.to === 'bottom')
    if (!horizontal && !vertical) continue
    const [start, end] = [points[0]!, points[3]!]
    const step = horizontal ? end.y - start.y : end.x - start.x
    if (step === 0 || Math.abs(step) > STRAIGHTEN_MAX) continue
    for (const moving of ['to', 'from'] as const) {
      const node = moving === 'to' ? plan.connection.to : plan.connection.from
      const side = moving === 'to' ? plan.to! : plan.from!
      const box = moving === 'to' ? plan.target! : plan.source!
      const target = moving === 'to' ? along(side, start) : along(side, end)
      const tile = tileOf(box)
      const tileStart = side === 'left' || side === 'right' ? box.y + tile.top : box.x + tile.left
      if (target < tileStart + 2 || target > tileStart + span(box, side) - 2) continue
      const list = ends.get(key(node, side)) ?? []
      if (list.some((other) => other.plan !== index && Math.abs(other.at - target) < END_GAP)) continue
      const line = moving === 'to' ? [start, horizontal ? { x: end.x, y: start.y } : { x: start.x, y: end.y }] : [horizontal ? { x: start.x, y: end.y } : { x: end.x, y: start.y }, end]
      if (crossings(line, plan.source!, plan.target!, plan.obstacles) > crossings(points, plan.source!, plan.target!, plan.obstacles)) continue
      plan.points = line.map((p) => ({ ...p }))
      const mine = list.find((other) => other.plan === index)
      if (mine) mine.at = target
      break
    }
  }
}

interface Segment {
  plan: number
  /** Index of its first point in the route. */
  index: number
  vertical: boolean
  /** x of a vertical segment, y of a horizontal one. */
  at: number
  min: number
  max: number
  /** First and last segments (attached to a node) and fallback routes do not move. */
  fixed: boolean
  /**
   * The ends of the segment, lowest coordinate first along it, and which way the route turns
   * there across it (-1 towards lower coordinates, 1 towards higher, 0 at a node).
   */
  low: { at: number; turn: number }
  high: { at: number; turn: number }
}

/**
 * Order of two parallel segments in a corridor (lanes by increasing coordinate), so that the
 * routes do not cross where they leave it: at each end of the corridor, a segment that ends
 * inside the span of the other and turns towards lower coordinates takes the lower lane, and
 * the other way round. When both ends disagree, a crossing cannot be avoided: the first end wins.
 */
function compareLanes(s: Segment, t: Segment): number {
  const at = (inner: { turn: number }, innerIsS: boolean) => (inner.turn === 0 ? 0 : innerIsS ? inner.turn : -inner.turn)
  const low = s.low.at > t.low.at ? at(s.low, true) : s.low.at < t.low.at ? at(t.low, false) : 0
  const high = s.high.at < t.high.at ? at(s.high, true) : s.high.at > t.high.at ? at(t.high, false) : 0
  return low || high
}

/** Insertion sort: `compare` need not be transitive (lanes of a few segments). */
function sortBy<T>(items: T[], compare: (a: T, b: T) => number): T[] {
  for (let i = 1; i < items.length; i++) {
    const item = items[i]!
    let j = i - 1
    while (j >= 0 && compare(items[j]!, item) > 0) {
      items[j + 1] = items[j]!
      j--
    }
    items[j + 1] = item
  }
  return items
}

/**
 * Moves apart the segments that run along each other (closer than `OVERLAP_GAP`, sharing more
 * than `OVERLAP_MIN`): each group becomes parallel lanes `LANE_GAP` apart, ordered by
 * `compareLanes` so that they do not cross where they leave the corridor. A segment
 * that would then go through a node, or make its route turn back, stays where it was.
 */
function separate(plans: Plan[]): void {
  const segments: Segment[] = []
  for (const [p, plan] of plans.entries()) {
    const points = plan.points
    for (let i = 0; i < points.length - 1; i++) {
      const [a, b] = [points[i]!, points[i + 1]!]
      if (a.x === b.x && a.y === b.y) continue
      const vertical = a.x === b.x
      const along = (q: Point) => (vertical ? q.y : q.x)
      const across = (q: Point) => (vertical ? q.x : q.y)
      const at = vertical ? a.x : a.y
      // The route turns at each end of the segment, towards its previous or next point.
      const turnAt = (corner: Point, neighbour: Point | undefined) => (neighbour === undefined ? 0 : Math.sign(across(neighbour) - across(corner)))
      const ends = [
        { at: along(a), turn: turnAt(a, points[i - 1]) },
        { at: along(b), turn: turnAt(b, points[i + 2]) },
      ].sort((p, q) => p.at - q.at)
      segments.push({
        plan: p,
        index: i,
        vertical,
        at,
        min: vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x),
        max: vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x),
        fixed: plan.fixed || i === 0 || i === points.length - 2,
        low: ends[0]!,
        high: ends[1]!,
      })
    }
  }

  // Groups of segments along each other (transitively).
  const parent = segments.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const [s, t] = [segments[i]!, segments[j]!]
      if (s.plan === t.plan || s.vertical !== t.vertical || Math.abs(s.at - t.at) >= OVERLAP_GAP) continue
      if (Math.min(s.max, t.max) - Math.max(s.min, t.min) > OVERLAP_MIN) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, Segment[]>()
  for (const [i, segment] of segments.entries()) {
    const root = find(i)
    groups.set(root, [...(groups.get(root) ?? []), segment])
  }

  for (const group of groups.values()) {
    if (group.length < 2 || group.every((s) => s.fixed)) continue
    group.sort((a, b) => a.at - b.at || a.plan - b.plan || a.index - b.index)
    sortBy(group, compareLanes)
    // Lanes centred on the group, or placed around the segment that cannot move.
    const anchor = group.findIndex((s) => s.fixed)
    const base = anchor >= 0 ? group[anchor]!.at - anchor * LANE_GAP : group.reduce((sum, s) => sum + s.at, 0) / group.length - ((group.length - 1) * LANE_GAP) / 2
    for (const [rank, segment] of group.entries()) {
      if (segment.fixed) continue
      move(plans[segment.plan]!, segment, Math.round(base + rank * LANE_GAP))
    }
  }
}

/** Moves a segment across (both its points), unless the route would then cross a node or turn back. */
function move(plan: Plan, segment: Segment, to: number): void {
  const points = plan.points
  const before = points.map((p) => ({ ...p }))
  const key = segment.vertical ? 'x' : 'y'
  points[segment.index]![key] = to
  points[segment.index + 1]![key] = to
  const directions = (route: readonly Point[]) => route.slice(1).map((q, i) => [Math.sign(q.x - route[i]!.x), Math.sign(q.y - route[i]!.y)].join())
  const turnsBack = directions(points).some((d, i) => d !== directions(before)[i])
  const crossesMore =
    plan.source && plan.target && crossings(points, plan.source, plan.target, plan.obstacles) > crossings(before, plan.source, plan.target, plan.obstacles)
  if (turnsBack || crossesMore) plan.points.splice(0, points.length, ...before)
}

/** Does the segment a–b touch the rectangle? */
function touches(a: Point, b: Point, rect: Rect): boolean {
  return crosses(a, b, rect, 0)
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** Where along a segment a label may go (share of its length). */
const LABEL_STOPS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9]

/**
 * The center of each label (by plan index): on a segment of its route, covering no node (above
 * all), no group title and no label placed before it if possible, then crossing as few other connections as possible; in the
 * middle of a long segment away from the ends (and their arrowheads) otherwise.
 */
function placeLabels(plans: readonly Plan[], nodes: readonly Rect[], keepClear: readonly Rect[]): Map<number, Point> {
  const placed: Rect[] = []
  const centers = new Map<number, Point>()
  for (const [index, plan] of plans.entries()) {
    const size = plan.connection.label
    const points = plan.points
    if (!size || points.length < 2) continue
    const others = plans.flatMap((other, j) => (j === index ? [] : [other.points]))
    const segments = points.length - 1
    let best: { cost: number; rect: Rect; center: Point } | undefined
    for (let i = 0; i < segments; i++) {
      const [a, b] = [points[i]!, points[i + 1]!]
      const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
      const atEnd = segments > 2 && (i === 0 || i === segments - 1)
      for (const stop of LABEL_STOPS) {
        const center = { x: a.x + (b.x - a.x) * stop, y: a.y + (b.y - a.y) * stop }
        const rect = {
          x: center.x - size.width / 2 - LABEL_MARGIN,
          y: center.y - size.height / 2 - LABEL_MARGIN,
          width: size.width + 2 * LABEL_MARGIN,
          height: size.height + 2 * LABEL_MARGIN,
        }
        let cost = Math.abs(stop - 0.5) * 30 - Math.min(length, 300) * 0.1 + (atEnd ? 60 : 0)
        for (const node of nodes) if (intersects(rect, node)) cost += 5000
        for (const area of keepClear) if (intersects(rect, area)) cost += 2000
        for (const label of placed) if (intersects(rect, label)) cost += 1000
        for (const route of others) for (let k = 0; k < route.length - 1; k++) if (touches(route[k]!, route[k + 1]!, rect)) cost += 40
        if (!best || cost < best.cost) best = { cost, rect, center }
      }
    }
    placed.push(best!.rect)
    centers.set(index, { x: Math.round(best!.center.x), y: Math.round(best!.center.y) })
  }
  return centers
}
