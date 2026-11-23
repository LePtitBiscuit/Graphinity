// The routes of every connection once nodes have been dragged: computed once for the whole
// universe (route.ts `routeAll`, as the layout did for the first view), so that connections keep
// making room for each other. Each edge component reads its own route from it.
import { useVueFlow, type XYPosition } from '@xyflow/vue'
import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'
import type { FlowNode, RoutedFlowEdge } from './flow.ts'
import { BEHIND_OFFSET, DEFAULT_SIDES, groupTitle, nodeGeometry, type Rect } from './layout.ts'
import { routeAll, type NodeBox, type PlannedRoute } from './route.ts'

/** Routes by connection id; undefined while no node has moved (the layout's routes are drawn). */
export type Routes = ComputedRef<Map<string, PlannedRoute> | undefined>

/**
 * Provided by the universe view: returns the routes shared by the edges of the current canvas,
 * creating them with `create` on first use.
 */
export const SHARED_ROUTES: InjectionKey<(create: () => Routes) => Routes> = Symbol('shared-routes')

/** The routes of the canvas this edge belongs to. */
export function useRoutes(): Routes {
  const flow = useVueFlow<FlowNode, RoutedFlowEdge>()
  const create = () => routesOf(flow)
  const share = inject(SHARED_ROUTES, undefined)
  return share ? share(create) : create()
}

function routesOf(flow: ReturnType<typeof useVueFlow<FlowNode, RoutedFlowEdge>>): Routes {
  return computed(() => {
    const edges = flow.getEdges.value
    // Where the layout put each node, to tell which ones have been moved.
    const origins = new Map<string, XYPosition>()
    for (const edge of edges) {
      if (!edge.data) continue
      origins.set(edge.source, edge.data.sourceOrigin)
      origins.set(edge.target, edge.data.targetOrigin)
    }
    const boxes = new Map<string, NodeBox>()
    const moves = new Map<string, XYPosition>()
    let moved = false
    let direction: keyof typeof DEFAULT_SIDES | undefined
    /** Group titles, kept clear of labels. */
    const headers: Rect[] = []
    for (const node of flow.getNodes.value) {
      // Groups are not obstacles: connections cross their frames.
      if (node.type === 'cluster') {
        const internal = flow.getInternalNode(node.id)
        if (internal) {
          const box = { ...internal.internals.positionAbsolute, width: node.width ?? internal.measured.width ?? 0, height: node.height ?? 0 }
          headers.push(groupTitle(box, node.data.group.name))
        }
        continue
      }
      direction ??= node.data.direction
      const internal = flow.getInternalNode(node.id)
      if (!internal) continue
      const { x, y } = internal.internals.positionAbsolute
      const { tile, tileLeft } = nodeGeometry(node.data.node.size)
      // Doors are not drawn doubled, even for a node that opens a universe.
      const behind = node.type === 'service' && node.data.node.universe !== undefined ? BEHIND_OFFSET : 0
      // The laid-out size (as the layout routed with), not the measured one.
      const width = node.width ?? internal.measured.width ?? 0
      const height = node.height ?? internal.measured.height ?? 0
      boxes.set(node.id, { x, y, width, height, tile, tileLeft, behind })
      const origin = origins.get(node.id)
      if (!origin) continue
      const move = { x: x - origin.x, y: y - origin.y }
      moves.set(node.id, move)
      if (move.x !== 0 || move.y !== 0) moved = true
    }
    if (!moved) return undefined
    return routeAll(
      boxes,
      edges.map((edge) => {
        const data = edge.data
        const [from, to] = [moves.get(edge.source), moves.get(edge.target)]
        // The layout's route still fits when both ends moved together (or not at all).
        const together = data && from && to && from.x === to.x && from.y === to.y
        return {
          id: edge.id,
          from: edge.source,
          to: edge.target,
          ...(data?.fromSide && { fromSide: data.fromSide }),
          ...(data?.toSide && { toSide: data.toSide }),
          ...(data?.label && { label: { width: data.label.width, height: data.label.height } }),
          ...(together && { fallback: data.points.map((p) => ({ x: p.x + from.x, y: p.y + from.y })) }),
        }
      }),
      direction && DEFAULT_SIDES[direction],
      headers,
    )
  })
}
