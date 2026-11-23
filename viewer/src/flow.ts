// Maps a computed layout to Vue Flow nodes and edges. Nodes and groups can be dragged to
// rearrange the view (never saved: the files stay the source of truth); nothing can be created,
// deleted or connected.
import { MarkerType, Position, type Edge, type Node, type XYPosition } from '@xyflow/vue'
import type { InjectionKey, Ref } from 'vue'
import type { ArchitectureGroup, ArchitectureNode, Direction, IconRef, ViewerIcon } from '../../src/core/types.ts'
import type { Portal } from './context.ts'
import type { Hold } from './gestures.ts'
import { groupFlowId, type LaidOutEdge, type UniverseLayout } from './layout.ts'

export { groupFlowId }

export type ServiceFlowNode = Node<{ node: ArchitectureNode; logo?: ViewerIcon; direction: Direction }, 'service'>
export type GroupFlowNode = Node<{ group: ArchitectureGroup; logo?: ViewerIcon }, 'cluster'>
/** A door to a node of another universe (see context.ts); `node` is its stand-in for the layout. */
export type PortalFlowNode = Node<{ node: ArchitectureNode; portal: Portal; logo?: ViewerIcon; direction: Direction }, 'portal'>
export type FlowNode = ServiceFlowNode | GroupFlowNode | PortalFlowNode
export type RoutedFlowEdge = Edge<
  Pick<LaidOutEdge, 'points' | 'label'> &
    Pick<LaidOutEdge['edge'], 'color' | 'style' | 'fromSide' | 'toSide'> & {
    /** Laid-out positions of the source and target nodes (or groups), to tell when they have been moved. */
    sourceOrigin: XYPosition
    targetOrigin: XYPosition
  },
  'routed'
>

/** Scroll gesture in progress (gestures.ts): nodes show the bar of an `enter` that targets them. */
export const GESTURE: InjectionKey<Readonly<Ref<Hold | undefined>>> = Symbol('gesture')

/** Id of the node whose details are shown (selection is ours, not Vue Flow's). */
export const SELECTED_NODE: InjectionKey<Readonly<Ref<string | undefined>>> = Symbol('selected-node')

/** Arrowhead; without a color it follows the theme (`--xy-edge-stroke`). */
const arrow = (color: string | undefined) => ({ type: MarkerType.ArrowClosed, width: 16, height: 16, ...(color && { color }) })

/** Sides of a node where connections enter (target) and leave (source), following the flow. */
export const HANDLE_SIDES: Record<Direction, { source: Position; target: Position }> = {
  right: { source: Position.Right, target: Position.Left },
  left: { source: Position.Left, target: Position.Right },
  down: { source: Position.Bottom, target: Position.Top },
  up: { source: Position.Top, target: Position.Bottom },
}

export function toFlow(
  layout: UniverseLayout,
  icons: Record<string, ViewerIcon>,
  direction: Direction,
  portals: ReadonlyMap<string, Portal> = new Map(),
): { nodes: FlowNode[]; edges: RoutedFlowEdge[] } {
  const logoOf = (icon: IconRef | undefined) => (icon?.type === 'name' ? icons[icon.name] : undefined)
  const groupOrigins = new Map(layout.groups.map(({ group, x, y }) => [group.id, { x, y }]))
  // By Vue Flow id: connection ends are nodes or groups.
  const origins = new Map([
    ...layout.nodes.map(({ node, x, y }) => [node.id, { x, y }] as const),
    ...layout.groups.map(({ group, x, y }) => [groupFlowId(group.id), { x, y }] as const),
  ])

  // Parents must come before their children (the layout lists outer groups first). A group
  // inside another one is positioned relative to it and stays inside its frame.
  const groups: GroupFlowNode[] = layout.groups.map(({ group, x, y, width, height }) => {
    const logo = logoOf(group.icon)
    const parent = group.group === undefined ? undefined : groupOrigins.get(group.group)
    return {
      id: groupFlowId(group.id),
      type: 'cluster',
      position: parent ? { x: x - parent.x, y: y - parent.y } : { x, y },
      ...(parent && { parentId: groupFlowId(group.group!), extent: 'parent' as const }),
      width,
      height,
      data: { group, ...(logo && { logo }) },
      draggable: true,
      connectable: false,
      selectable: false,
      deletable: false,
      focusable: false,
    }
  })

  const nodes: (ServiceFlowNode | PortalFlowNode)[] = layout.nodes.map(({ node, x, y, width, height }): ServiceFlowNode | PortalFlowNode => {
    const logo = logoOf(node.icon)
    const portal = portals.get(node.id)
    if (portal) {
      return {
        id: node.id,
        type: 'portal',
        position: { x, y },
        width,
        height,
        data: { node, portal, direction, ...(logo && { logo }) },
        draggable: true,
        connectable: false,
        selectable: false,
        deletable: false,
        focusable: false,
      }
    }
    const parent = node.group === undefined ? undefined : groupOrigins.get(node.group)
    return {
      id: node.id,
      type: 'service',
      // Inside a group, positions are relative to it and the node cannot leave its frame (the
      // frame never grows over other nodes); dragging the group moves its nodes along.
      position: parent ? { x: x - parent.x, y: y - parent.y } : { x, y },
      ...(parent && { parentId: groupFlowId(node.group!), extent: 'parent' as const }),
      width,
      height,
      data: { node, direction, ...(logo && { logo }) },
      draggable: true,
      connectable: false,
      selectable: false,
      deletable: false,
      focusable: false,
    }
  })

  return {
    nodes: [...groups, ...nodes],
    edges: layout.edges.map((edge): RoutedFlowEdge => {
      const { color, style, arrow: heads = 'end', fromSide, toSide } = edge.edge
      return {
        id: edge.id,
        type: 'routed',
        source: edge.from,
        target: edge.to,
        data: {
          points: edge.points,
          sourceOrigin: origins.get(edge.from) ?? { x: 0, y: 0 },
          targetOrigin: origins.get(edge.to) ?? { x: 0, y: 0 },
          ...(edge.label && { label: edge.label }),
          ...(color && { color }),
          ...(style && { style }),
          ...(fromSide && { fromSide }),
          ...(toSide && { toSide }),
        },
        ...((heads === 'end' || heads === 'both') && { markerEnd: arrow(color) }),
        ...((heads === 'start' || heads === 'both') && { markerStart: arrow(color) }),
        selectable: false,
        deletable: false,
        focusable: false,
        reconnectable: false,
      }
    }),
  }
}
