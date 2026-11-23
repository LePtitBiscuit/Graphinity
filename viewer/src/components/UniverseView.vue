<script setup lang="ts">
import {
  Background,
  ControlButton,
  Controls,
  VueFlow,
  type EdgeTypesObject,
  type NodeMouseEvent,
  type NodeTypesObject,
  type Viewport,
  type VueFlowInstance,
} from '@xyflow/vue'
import { computed, inject, markRaw, onBeforeUnmount, provide, ref, shallowRef, watch } from 'vue'
import type { Universe, ViewerIcon } from '../../../src/core/types.ts'
import { drawnEdges, portalNode, type UniverseContext } from '../context.ts'
import { GESTURE, LOCATED, toFlow, type FlowNode, type RoutedFlowEdge } from '../flow.ts'
import { boundsOf, createScrollGesture, easeOut, enterTarget, EXIT_ZOOM, fitZoom, SCROLL_IDLE, wheelDistance, type Bounds, type Hold } from '../gestures.ts'
import { layoutUniverse, type MeasureText, type UniverseLayout } from '../layout.ts'
import { SHARED_ROUTES, type Routes } from '../routing.ts'
import GroupNode from './GroupNode.vue'
import PortalNode from './PortalNode.vue'
import RoutedEdge from './RoutedEdge.vue'
import ServiceNode from './ServiceNode.vue'

const props = defineProps<{
  universe: Universe
  icons: Record<string, ViewerIcon>
  /** Viewport to restore; the universe is fitted to the screen when absent (first visit). */
  initialViewport?: Viewport
  /** Doors and connections from the ancestors (see context.ts); key: the path taken. */
  context?: UniverseContext & { key: string }
  /** Name of the parent universe; absent at the root (no way out). */
  parentName?: string
  /** How this universe was reached: `in` from its parent, `out` from a sub-universe (animation). */
  arrival?: 'in' | 'out'
}>()

const emit = defineEmits<{
  select: [nodeId: string | undefined]
  /** `scrolled`: opened with the scroll wheel (the current viewport is then not worth keeping). */
  open: [nodeId: string, scrolled: boolean]
  /** Back to the universe at this breadcrumb level (a door was clicked). */
  exitTo: [level: number]
  /** Back to the parent with the scroll wheel. */
  leave: []
  /** The viewport settled; `key`: the path taken (`context.key`), or the universe id without context. */
  viewport: [key: string, viewport: Viewport]
}>()

const nodeTypes = { service: markRaw(ServiceNode), cluster: markRaw(GroupNode), portal: markRaw(PortalNode) } as NodeTypesObject<FlowNode>
const edgeTypes = { routed: markRaw(RoutedEdge) } as EdgeTypesObject<RoutedFlowEdge>
const MIN_ZOOM = 0.1
const MAX_ZOOM = 2
const fitViewOptions = { padding: 0.15, maxZoom: 1 }

const flow = shallowRef<{ nodes: FlowNode[]; edges: RoutedFlowEdge[] }>()
// Two-way bound: dragged positions are kept by Vue Flow (and reset on the next layout).
const nodes = shallowRef<FlowNode[]>([])
const layoutError = shallowRef<string>()

// The routes after a drag are computed once for all the edges of the canvas (routing.ts); a new
// layout (another universe, or a live reload) starts them over.
let shared: { flow: unknown; routes: Routes } | undefined
provide(SHARED_ROUTES, (create) => {
  if (!shared || shared.flow !== flow.value) shared = { flow: flow.value, routes: create() }
  return shared.routes
})

// Must match the edge label style in style.css and the description style in ServiceNode.vue.
const FONTS = {
  label: '500 11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  description: '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}
const context = document.createElement('canvas').getContext('2d')
const measureText: MeasureText = (text, kind) => {
  if (!context) return text.length * 6.5
  context.font = FONTS[kind]
  return context.measureText(text).width
}

// Layouts are deterministic: computed once per universe and path taken (its doors depend on
// it), reused when coming back.
const layouts = new WeakMap<Universe, Map<string, Promise<UniverseLayout>>>()
function layoutOf(universe: Universe, context: UniverseContext & { key: string } | undefined): Promise<UniverseLayout> {
  let byContext = layouts.get(universe)
  if (!byContext) layouts.set(universe, (byContext = new Map()))
  const key = context?.key ?? ''
  let layout = byContext.get(key)
  if (!layout) {
    const portals = context?.portals ?? []
    const doors = (role: 'in' | 'out') => portals.filter((p) => p.role === role).map(portalNode)
    // Doors connections come from at the start of the flow, the others at the end.
    const extended: Universe = {
      ...universe,
      nodes: [...doors('in'), ...universe.nodes, ...doors('out')],
      edges: [...drawnEdges(universe), ...(context?.edges ?? [])],
    }
    layout = layoutUniverse(extended, measureText, {
      first: new Set(portals.filter((p) => p.role === 'in').map((p) => p.id)),
      last: new Set(portals.filter((p) => p.role === 'out').map((p) => p.id)),
    })
    byContext.set(key, layout)
  }
  return layout
}

watch(
  () => props.universe,
  async (universe, previous) => {
    // Same universe with new data (live reload): keep the canvas, and its viewport, until the
    // new layout is ready.
    if (universe.id !== previous?.id) flow.value = undefined
    layoutError.value = undefined
    try {
      const context = props.context
      const layout = await layoutOf(universe, context)
      if (universe === props.universe) {
        const next = toFlow(layout, props.icons, universe.direction, new Map((context?.portals ?? []).map((p) => [p.id, p])))
        nodes.value = next.nodes
        flow.value = next
        bounds = boundsOf([...layout.nodes, ...layout.groups])
        enterable = layout.nodes.filter((n) => n.node.universe !== undefined).map(({ node, x, y, width, height }) => ({ id: node.id, rect: { x, y, width, height } }))
      }
    } catch (error) {
      layouts.delete(universe)
      layoutError.value = (error as Error).message
    }
  },
  { immediate: true },
)

/**
 * The universe background, fixed behind the diagram (it does not pan or zoom). The image path
 * comes from the loader: relative, inside the project; it is served under `files/`.
 */
const wallpaper = computed(() => {
  const background = props.universe.background
  if (!background) return undefined
  const { image, color, blur = 0 } = background
  return {
    color,
    image: image === undefined ? undefined : `url("files/${image.split('/').map(encodeURIComponent).join('/')}")`,
    // Scaled up a little when blurred, so that the blurred edges stay outside the screen.
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    transform: blur > 0 ? `scale(${1 + Math.min(0.2, (blur * 3) / 1000)})` : undefined,
  }
})

// The grid: shown unless the universe has a background image, or as its `background.grid` says.
// The button of the controls shows or hides it for the session (never saved); a change of the
// file's default replaces that choice.
const gridSetting = computed(() => props.universe.background?.grid)
const defaultGrid = computed(() => (gridSetting.value === undefined ? props.universe.background?.image === undefined : gridSetting.value !== false))
/** A color set in `background.grid`, or the theme's. */
const gridColor = computed(() =>
  typeof gridSetting.value === 'string'
    ? gridSetting.value
    : wallpaper.value?.image
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(255, 255, 255, 0.035)',
)
const showGrid = ref(gridChoice(props.universe.id, defaultGrid.value))
watch(defaultGrid, (value) => {
  gridChoices.delete(props.universe.id)
  showGrid.value = value
})
function toggleGrid() {
  showGrid.value = !showGrid.value
  gridChoices.set(props.universe.id, { default: defaultGrid.value, shown: showGrid.value })
}

function onClick({ node }: NodeMouseEvent<FlowNode>) {
  // A door leads back to its universe.
  if (node.type === 'portal') return emit('exitTo', node.data.portal.level)
  // Groups have no details: a click on one is like a click on the canvas.
  emit('select', node.type === 'service' ? node.id : undefined)
}

function onDoubleClick({ node }: NodeMouseEvent<FlowNode>) {
  if (node.type === 'service' && node.data.node.universe !== undefined) emit('open', node.id, false)
}

// Scroll navigation (gestures.ts). At the maximum zoom, scrolling on (up) fills a bar: when it is
// full, the universe of a node opens: the only node that opens a universe, or the one closest to
// the mouse cursor (moving the cursor to another node starts over for that one). Zooming out a little beyond the whole
// universe (EXIT_ZOOM), then scrolling on, goes back to the parent the same way. The bar fills
// with the amount scrolled; meanwhile the wheel no longer zooms, the diagram moves towards the
// node (or away) and fades, and stopping for a moment cancels it.
let instance: VueFlowInstance | undefined
/** Of the laid-out universe, to know when it is entirely visible. */
let bounds = { x: 0, y: 0, width: 0, height: 0 }
/** Laid-out nodes that open a universe (positions as laid out; dragging is read from Vue Flow). */
let enterable: { id: string; rect: Bounds }[] = []
const container = ref<HTMLElement>()
const gesture = createScrollGesture()
const hold = shallowRef<Hold>()
provide(GESTURE, hold)
/** Where the diagram grows from while entering (screen coordinates in the canvas). */
const holdOrigin = shallowRef<{ x: number; y: number }>()
/** The diagram during a gesture: towards the node when entering, away when leaving, fading. */
const stage = computed(() => {
  const state = hold.value
  if (!state) return undefined
  const p = easeOut(state.progress)
  const size = screenSize()
  const origin = state.kind === 'enter' && holdOrigin.value ? holdOrigin.value : { x: size.width / 2, y: size.height / 2 }
  const scale = state.kind === 'enter' ? 1 + 0.35 * p : 1 - 0.18 * p
  return {
    '--stage-scale': `${scale}`,
    '--stage-x': `${origin.x * (1 - scale)}px`,
    '--stage-y': `${origin.y * (1 - scale)}px`,
    '--stage-opacity': `${1 - 0.45 * p}`,
  }
})
const holdName = computed(() => {
  const target = hold.value?.target
  return target === undefined ? undefined : props.universe.nodes.find((n) => n.id === target)?.name
})
let clearTimer: ReturnType<typeof setTimeout> | undefined
// Scrolling that goes on from the previous universe must not start a gesture here (it would
// open or leave universes one after the other), nor zoom the universe that just arrived: it is
// ignored until a pause.
let armed = false
let lastWheel = performance.now()

function screenSize() {
  return container.value ? { width: container.value.clientWidth, height: container.value.clientHeight } : { width: 0, height: 0 }
}

function candidates() {
  return enterable.map(({ id, rect }) => {
    const node = instance?.getInternalNode(id)
    const at = node?.internals.positionAbsolute
    if (!node || !at) return { id, rect }
    return { id, rect: { x: at.x, y: at.y, width: node.measured?.width ?? rect.width, height: node.measured?.height ?? rect.height } }
  })
}

function cancel() {
  gesture.reset()
  hold.value = undefined
  clearTimeout(clearTimer)
}

function onWheel(event: WheelEvent) {
  const now = performance.now()
  if (!armed && now - lastWheel <= SCROLL_IDLE) {
    lastWheel = now
    event.stopPropagation()
    return
  }
  armed = true
  if (!instance || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
  const viewport = instance.getViewport()
  const size = screenSize()
  let kind: Hold['kind'] | undefined
  let target: string | undefined
  if (event.deltaY < 0 && viewport.zoom >= MAX_ZOOM - 0.01) {
    const all = candidates()
    const box = container.value?.getBoundingClientRect()
    const pointer = box ? { x: event.clientX - box.left, y: event.clientY - box.top } : { x: size.width / 2, y: size.height / 2 }
    target = enterTarget(all, viewport, pointer)
    const rect = all.find((c) => c.id === target)?.rect
    if (target !== undefined) kind = 'enter'
    if (rect) holdOrigin.value = { x: (rect.x + rect.width / 2) * viewport.zoom + viewport.x, y: (rect.y + rect.height / 2) * viewport.zoom + viewport.y }
  } else if (event.deltaY > 0 && props.parentName !== undefined) {
    const fit = fitZoom(bounds, size, fitViewOptions.padding, MIN_ZOOM, fitViewOptions.maxZoom)
    if (viewport.zoom <= Math.max(MIN_ZOOM, fit * EXIT_ZOOM) + 0.01) kind = 'exit'
  }
  if (!kind) return cancel()
  // The view stays still while the bar fills.
  event.stopPropagation()
  const state = gesture.feed(kind, target, wheelDistance(event, size.height), now)
  clearTimeout(clearTimer)
  if (state.done) {
    cancel()
    if (state.kind === 'enter' && state.target !== undefined) emit('open', state.target, true)
    else emit('leave')
    return
  }
  hold.value = state
  // The bar empties when the scrolling stops.
  clearTimer = setTimeout(() => (hold.value = gesture.state(performance.now())), SCROLL_IDLE + 20)
}

onBeforeUnmount(() => clearTimeout(clearTimer))

// Search (Explorer.vue): the view goes to the node or group found, and frames it. Found in
// another universe, this one has just been opened for it: it starts there instead of being fitted
// to the screen, without moving; found here, the view moves to it.
const locatedRef = inject(LOCATED, undefined)
/** Located in this canvas (another one may still be shown while the next one opens). */
const located = computed(() => (locatedRef?.value?.key === (props.context?.key ?? props.universe.id) ? locatedRef.value : undefined))
const fitOnOpen = !props.initialViewport && !located.value
let pending = located.value !== undefined
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

function goToLocated(animate: boolean) {
  const target = located.value
  const node = target && instance?.getInternalNode(target.id)
  if (!node || node.type === 'portal') return
  const group = node.type === 'cluster'
  // A node is shown a little larger than at the fit zoom, a group whole.
  void instance!.fitView({
    nodes: [{ id: target.id }],
    padding: group ? 0.15 : 0.6,
    minZoom: MIN_ZOOM,
    maxZoom: group ? 1 : 1.25,
    duration: animate && !reducedMotion.matches ? 450 : 0,
  })
}

function onInit(flowInstance: VueFlowInstance) {
  instance = flowInstance
  // Vue Flow runs the fit once the nodes are measured.
  if (pending) goToLocated(false)
  pending = false
}

watch(
  located,
  (target) => {
    if (target && instance) goToLocated(true)
  },
)
</script>

<script lang="ts">
/** Grid shown or hidden with the button, per universe, for the session. */
const gridChoices = new Map<string, { default: boolean; shown: boolean }>()

function gridChoice(id: string, fallback: boolean): boolean {
  const choice = gridChoices.get(id)
  return choice && choice.default === fallback ? choice.shown : fallback
}
</script>

<template>
  <div
    ref="container"
    class="universe"
    :style="[wallpaper?.color ? { backgroundColor: wallpaper.color } : {}, stage ?? {}]"
    @wheel.capture.passive="onWheel"
  >
    <div
      v-if="wallpaper?.image"
      class="wallpaper"
      aria-hidden="true"
      :style="{ backgroundImage: wallpaper.image, filter: wallpaper.filter, transform: wallpaper.transform }"
    />
    <p v-if="layoutError" class="status">Layout failed: {{ layoutError }}</p>
    <!-- Mounted once the layout is ready so that fit-view frames the final positions. -->
    <VueFlow
      v-else-if="flow"
      :key="universe.id"
      :class="[{ 'has-background': wallpaper }, arrival && `arrive-${arrival}`]"
      v-model:nodes="nodes"
      :edges="flow.edges"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      force-color-mode="dark"
      :fit-view="fitOnOpen"
      :fit-view-options="fitViewOptions"
      :default-viewport="initialViewport"
      :min-zoom="MIN_ZOOM"
      :max-zoom="MAX_ZOOM"
      :nodes-draggable="true"
      :nodes-connectable="false"
      :nodes-focusable="false"
      :edges-focusable="false"
      :elements-selectable="false"
      :edges-reconnectable="false"
      :zoom-on-double-click="false"
      :delete-key-code="null"
      :default-marker-color="null"
      @node-click="onClick"
      @node-double-click="onDoubleClick"
      @pane-click="emit('select', undefined)"
      @viewport-change-end="(viewport) => emit('viewport', props.context?.key ?? universe.id, viewport)"
      @init="onInit"
    >
      <Background v-if="showGrid" variant="lines" :gap="24" :line-width="1" :color="gridColor" />
      <Controls :show-interactive="false" :fit-view-options="fitViewOptions">
        <ControlButton :label="showGrid ? 'Hide the grid' : 'Show the grid'" :aria-pressed="showGrid" class="grid-toggle" @click="toggleGrid">
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M1 5.5h14M1 10.5h14M5.5 1v14M10.5 1v14" :opacity="showGrid ? 1 : 0.45" />
          </svg>
        </ControlButton>
      </Controls>
      <p v-if="universe.nodes.length === 0" class="status">This universe is empty.</p>
    </VueFlow>
    <!-- Scroll navigation: where it leads (entering also shows its bar on the node). -->
    <div v-if="hold" class="scroll-hint" role="status">
      <span>{{ hold.kind === 'exit' ? `Back to ${parentName}` : `Opening ${holdName}` }}</span>
      <span class="track"><span class="fill" :style="{ transform: `scaleX(${hold.progress})` }" /></span>
    </div>
  </div>
</template>

<style scoped>
.universe {
  position: relative;
  width: 100%;
  height: 100%;
  /* Not scrollable: the blurred wallpaper is scaled up beyond its box. */
  overflow: clip;
}
.wallpaper {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  pointer-events: none;
}
.scroll-hint {
  position: absolute;
  left: 50%;
  bottom: 64px;
  z-index: 10;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--na-card);
  border: 1px solid var(--na-card-border);
  border-radius: 10px;
  color: var(--na-text);
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
}
.track {
  display: block;
  width: 140px;
  height: 4px;
  overflow: hidden;
  background: var(--na-card-border);
  border-radius: 2px;
}
.fill {
  display: block;
  height: 100%;
  background: var(--na-accent);
  transform-origin: left;
  transition: transform 160ms ease-out;
}
/* During a gesture the diagram grows towards the node (or shrinks) and fades; it settles back
   smoothly when the gesture is cancelled. `scale`/`translate` compose with Vue Flow's transform. */
.universe :deep(.vue-flow__viewport) {
  scale: var(--stage-scale, 1);
  translate: var(--stage-x, 0px) var(--stage-y, 0px);
  opacity: var(--stage-opacity, 1);
  transition:
    scale 220ms cubic-bezier(0.2, 0.7, 0.3, 1),
    translate 220ms cubic-bezier(0.2, 0.7, 0.3, 1),
    opacity 220ms ease-out;
}
/* Arriving in a universe: from far away when going in, from close when coming back out. */
.arrive-in {
  animation: arrive-in 420ms cubic-bezier(0.2, 0.7, 0.3, 1);
}
.arrive-out {
  animation: arrive-out 420ms cubic-bezier(0.2, 0.7, 0.3, 1);
}
@keyframes arrive-in {
  from {
    opacity: 0;
    scale: 0.88;
  }
}
@keyframes arrive-out {
  from {
    opacity: 0;
    scale: 1.12;
  }
}
@media (prefers-reduced-motion: reduce) {
  .universe :deep(.vue-flow__viewport) {
    scale: 1;
    translate: none;
    transition: opacity 120ms;
  }
  .arrive-in,
  .arrive-out {
    animation: none;
  }
}
/* The universe background shows through the canvas. */
.has-background {
  --xy-background-color: transparent;
  background: transparent;
}
.status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--na-muted);
  font-size: 13px;
  pointer-events: none;
}
</style>
