// Normalized, JSON-serializable architecture model. Independent from Vue Flow and any renderer.

/** Icon reference: a named icon (e.g. a Simple Icons slug) or a local image file (SVG, PNG, WebP, JPEG). */
export type IconRef =
  | { type: 'name'; name: string }
  /** `path` is relative to the project directory, with `/` separators. */
  | { type: 'file'; path: string }

export type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

/** Style of the border of a node tile or a group frame. */
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'none'
/** Pattern of a connection line. */
export type LineStyle = 'solid' | 'dashed' | 'dotted'
/** Ends of a connection that carry an arrowhead. */
export type ArrowHeads = 'end' | 'start' | 'both' | 'none'

/**
 * Colors are normalized to `#rrggbb` (or `#rrggbbaa`): written in hexadecimal in the files, or
 * as one of the palette names (`blue`, `green`…), resolved by the engine.
 */
export type Color = string
/** Side of a node where a connection attaches. */
export type Side = 'left' | 'right' | 'top' | 'bottom'
/** Size of a node's tile (`medium` when absent). */
export type NodeSize = 'small' | 'medium' | 'large'

/** Where a node goes in the flow of its universe (`place`). */
export type NodePlace = 'first' | 'last'

/** Background of a universe, behind its diagram (fixed: it does not pan or zoom). */
export interface UniverseBackground {
  /** Local image, relative to the project directory, with `/` separators. */
  image?: string
  color?: Color
  /** Blur of the image, in px. */
  blur?: number
  /** Grid on the canvas, or its color (shown). Default: shown, unless there is an image. */
  grid?: boolean | Color
}

/** Short text shown on a corner of a node (a price, a version, a status…). */
export interface NodeTag {
  text: string
  corner: Corner
}

export interface ArchitectureNode {
  id: string
  name: string
  /** Absent when the configured icon is invalid: the viewer shows the generic icon. */
  icon?: IconRef
  description?: string
  /** Id of the sub-universe this node opens, if any. */
  universe?: string
  /** Id of the group of this universe the node belongs to, if any. */
  group?: string
  /** At most one per corner. Absent when the node has none. */
  tags?: NodeTag[]
  /** Border color of the tile. */
  color?: Color
  /** Border style of the tile (solid when absent). */
  border?: BorderStyle
  /** Fill color of the tile. */
  background?: Color
  /** `medium` when absent. */
  size?: NodeSize
  /** Placement hint: at the start or at the end of the flow. */
  place?: NodePlace
  /** Placement hint: further along the flow than this node of the same universe. */
  after?: string
}

/** A labelled frame around some nodes of a universe (a provider, a server, a network…). */
export interface ArchitectureGroup {
  id: string
  name: string
  icon?: IconRef
  /** Color of the frame (border and a light tint of the background). */
  color?: Color
  /** Border style of the frame (solid when absent). */
  border?: BorderStyle
  /** Blur of what is behind the frame (the universe background), in px. */
  blur?: number
  /** Id of the group it is inside of (a group of the same universe). */
  group?: string
  /** Fill of the frame: a color, or `none` (transparent). A light tint of `color` when absent. */
  background?: Color | 'none'
}

export interface ArchitectureEdge {
  /** Unique within its universe. */
  id: string
  from: string
  to: string
  label?: string
  /** Line and arrowhead color. */
  color?: Color
  /** Line pattern (solid when absent). */
  style?: LineStyle
  /** Arrowheads (`end` when absent). */
  arrow?: ArrowHeads
  /** `from` is a group of the universe (the connection attaches to its frame), not a node. */
  fromGroup?: true
  /** `to` is a group of the universe, not a node. */
  toGroup?: true
  /** Side of the source node it leaves from (default: follows the universe's direction). */
  fromSide?: Side
  /** Side of the target node it enters (default: follows the universe's direction). */
  toSide?: Side
  /**
   * The source is a node of the sub-universe of `from`: its path from there (`["api"]`, or
   * `["vps", "api"]` two levels down). Absent: the source is `from` itself.
   */
  fromPath?: string[]
  /** Same for the target, inside the sub-universe of `to`. */
  toPath?: string[]
}

/** Reading direction of a universe: where connections flow. */
export type Direction = 'right' | 'down' | 'left' | 'up'

export interface Universe {
  id: string
  name: string
  /** `right` unless the file says otherwise. */
  direction: Direction
  background?: UniverseBackground
  /** Source file, relative to the project directory, with `/` separators. */
  source: string
  /** Every group has at least one node. */
  groups: ArchitectureGroup[]
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
}

export interface Architecture {
  /** Id of the root universe. */
  root: string
  /** All reachable universes keyed by id, in discovery order. Null-prototype object. */
  universes: Record<string, Universe>
}

export interface ConfigError {
  /** File concerned, relative to the project directory, with `/` separators. */
  file: string
  /** Field concerned, e.g. `nodes[2].universe`. Absent for file-level errors. */
  field?: string
  message: string
  /** 1-based position in the file, when known. */
  line?: number
  column?: number
}

/** A Simple Icons logo: a single 24×24 SVG path and its brand color. */
export interface BrandIcon {
  type: 'brand'
  title: string
  /** Hex color without `#`. */
  hex: string
  path: string
}

/** An icon from another collection, written as an SVG file of the site. */
export interface ImageIcon {
  type: 'image'
  title: string
  /** Path of the file in the site, e.g. `icons/3f2a…svg`. */
  src: string
}

export type ViewerIcon = BrandIcon | ImageIcon

/** What the viewer loads (`architecture.json`). */
export interface ViewerData {
  architecture: Architecture
  /** Named icons used by the architecture, by reference (`github`, `logos:react`). Unresolved ones are absent. */
  icons: Record<string, ViewerIcon>
  /** Configuration errors (dev server only): the elements they concern are left out of `architecture`. */
  errors?: ConfigError[]
}

export type LoadResult = (
  | { ok: true; architecture: Architecture; errors: [] }
  /**
   * Some files have errors. `architecture` holds everything valid (each error only leaves out
   * the element it concerns), unless the root universe itself cannot be shown.
   */
  | { ok: false; errors: ConfigError[]; architecture?: Architecture }
) & {
  /** Absolute real paths of the configuration and icon files read (also on failure). */
  files: string[]
}
