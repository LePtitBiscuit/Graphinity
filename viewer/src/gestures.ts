// Navigation with the scroll wheel: at the maximum zoom, or once zoomed out a little beyond the
// whole universe, scrolling on fills a progress bar with the amount scrolled; when it is full,
// a universe opens (or the parent comes back). Pure logic with an injected clock.

export type GestureKind = 'enter' | 'exit'

export interface Hold {
  kind: GestureKind
  /** The node being entered (`enter` only). */
  target?: string
  /** 0 to 1. */
  progress: number
  done: boolean
}

export interface ScrollGestureOptions {
  /** Distance to scroll, in pixels (see `wheelDistance`), to fill the bar. */
  amount?: number
  /** A pause longer than this (ms) cancels the gesture. */
  idle?: number
}

/** About five notches of a mouse wheel (100 px each), or a long swipe on a touchpad. */
export const SCROLL_AMOUNT = 500
export const SCROLL_IDLE = 350
/**
 * Leaving starts when zoomed out below this share of the zoom at which the whole universe fits:
 * the universe can be zoomed out a little beyond "all visible" first.
 */
export const EXIT_ZOOM = 0.6

/** Ease-out: the transition moves fast at first, then settles (0 → 0, 1 → 1). */
export function easeOut(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  return 1 - (1 - p) ** 3
}

export function createScrollGesture({ amount = SCROLL_AMOUNT, idle = SCROLL_IDLE }: ScrollGestureOptions = {}) {
  let current: { kind: GestureKind; target?: string; scrolled: number; last: number } | undefined

  const state = (now: number): Hold | undefined => {
    if (!current) return undefined
    if (now - current.last > idle) {
      current = undefined
      return undefined
    }
    const progress = Math.min(1, current.scrolled / amount)
    return { kind: current.kind, ...(current.target !== undefined && { target: current.target }), progress, done: progress >= 1 }
  }

  return {
    /** A scroll of `distance` pixels that continues (or starts) the gesture. */
    feed(kind: GestureKind, target: string | undefined, distance: number, now: number): Hold {
      if (!current || current.kind !== kind || current.target !== target || now - current.last > idle) {
        current = { kind, ...(target !== undefined && { target }), scrolled: 0, last: now }
      }
      current.scrolled += Math.abs(distance)
      current.last = now
      return state(now)!
    },
    /** The gesture as it is now; `undefined` when there is none (never started, cancelled, reset). */
    state,
    reset(): void {
      current = undefined
    },
  }
}

/** The vertical distance of a wheel event in pixels, whatever its unit (pixels, lines, pages). */
export function wheelDistance(event: { deltaY: number; deltaMode: number }, pageHeight: number): number {
  // 0: pixels, 1: lines (Firefox with some mice), 2: pages. 25 px per line, as d3-zoom counts.
  return event.deltaY * (event.deltaMode === 1 ? 25 : event.deltaMode === 2 ? pageHeight : 1)
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** The zoom at which `bounds` fits in `size`, as Vue Flow's fit view computes it. */
export function fitZoom(bounds: Bounds, size: { width: number; height: number }, padding: number, minZoom: number, maxZoom: number): number {
  if (bounds.width <= 0 || bounds.height <= 0 || size.width <= 0 || size.height <= 0) return maxZoom
  const zoom = Math.min(size.width / (bounds.width * (1 + padding)), size.height / (bounds.height * (1 + padding)))
  return Math.min(maxZoom, Math.max(minZoom, zoom))
}

/** Smallest rectangle around all `rects`. */
export function boundsOf(rects: readonly Bounds[]): Bounds {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.width))
  const maxY = Math.max(...rects.map((r) => r.y + r.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * The node to enter: the only candidate, or the one closest to `pointer` — the mouse cursor, in
 * screen coordinates of the canvas (the center of the screen when it is not known). A node under
 * the cursor is at distance 0. `rects` are in flow coordinates; `viewport` maps them to the screen
 * (`x * zoom + vx`).
 */
export function enterTarget(
  candidates: readonly { id: string; rect: Bounds }[],
  viewport: { x: number; y: number; zoom: number },
  pointer: { x: number; y: number },
): string | undefined {
  if (candidates.length <= 1) return candidates[0]?.id
  const cx = (pointer.x - viewport.x) / viewport.zoom
  const cy = (pointer.y - viewport.y) / viewport.zoom
  let best: string | undefined
  let bestDistance = [Infinity, Infinity]
  for (const { id, rect } of candidates) {
    // Distance to the node's rectangle (0 when the cursor is on it), then to its center to break ties.
    const dx = Math.max(rect.x - cx, 0, cx - (rect.x + rect.width))
    const dy = Math.max(rect.y - cy, 0, cy - (rect.y + rect.height))
    const distance = [Math.hypot(dx, dy), Math.hypot(rect.x + rect.width / 2 - cx, rect.y + rect.height / 2 - cy)]
    if (distance[0]! < bestDistance[0]! || (distance[0] === bestDistance[0] && distance[1]! < bestDistance[1]!)) {
      best = id
      bestDistance = distance
    }
  }
  return best
}
