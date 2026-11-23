<script setup lang="ts">
// One universe at a time, with a breadcrumb of the path taken. The path is mirrored in the URL
// hash, so browser back/forward and reloads keep the position in the hierarchy.
import type { Viewport } from '@xyflow/vue'
import { computed, onBeforeUnmount, onMounted, provide, shallowRef, watch } from 'vue'
import type { ViewerData } from '../../../src/core/types.ts'
import { SELECTED_NODE } from '../flow.ts'
import {
  currentId,
  fromHash,
  goToLevel,
  openNode,
  toHash,
  universeAt,
  up,
  type NavigationPath,
} from '../navigation.ts'
import NodeDetails from './NodeDetails.vue'
import UniverseView from './UniverseView.vue'
import { universeContext } from '../context.ts'

const props = defineProps<{ data: ViewerData }>()
const architecture = computed(() => props.data.architecture)

const path = shallowRef<NavigationPath>(fromHash(architecture.value, location.hash))
const selectedId = shallowRef<string>()
provide(SELECTED_NODE, selectedId)

/** Last viewport of each visited universe (restored when coming back). */
const viewports = new Map<string, Viewport>()

// Live reload: stay where we are, as far as the new data allows.
watch(architecture, (next) => {
  path.value = fromHash(next, location.hash)
  if (toHash(path.value) !== (location.hash === '#' ? '' : location.hash)) history.replaceState(null, '', urlFor(path.value))
})

const universe = computed(() => universeAt(architecture.value, currentId(path.value)))
/** What the ancestors say about the current universe: doors and connections (context.ts). */
const context = computed(() => ({ ...universeContext(architecture.value, path.value), key: path.value.join('/') }))
const parentName = computed(() =>
  path.value.length > 1 ? (universeAt(architecture.value, path.value[path.value.length - 2]!)?.name ?? '') : undefined,
)
const selectedNode = computed(() => universe.value?.nodes.find((node) => node.id === selectedId.value))
const crumbs = computed(() =>
  path.value.map((id, level) => ({ id, level, name: universeAt(architecture.value, id)?.name ?? id })),
)

/** How the current universe was reached (its arrival animation): deeper `in`, higher `out`. */
const arrival = shallowRef<'in' | 'out'>()

function navigate(next: NavigationPath) {
  if (next.join('/') === path.value.join('/')) return
  arrival.value = next.length > path.value.length ? 'in' : next.length < path.value.length ? 'out' : undefined
  path.value = next
  selectedId.value = undefined
  history.pushState(null, '', urlFor(next))
}

function urlFor(next: NavigationPath): string {
  return `${location.pathname}${location.search}${toHash(next)}`
}

/** `scrolled`: opened with the scroll wheel, at maximum zoom: that viewport is not kept, the
 * universe is fitted again when coming back to it. */
function open(nodeId: string, scrolled = false) {
  const next = openNode(architecture.value, path.value, nodeId)
  if (!next) return
  if (scrolled) viewports.delete(currentId(path.value))
  navigate(next)
}

/** Back to the parent with the scroll wheel, zoomed out: the parent's own viewport is restored. */
function leave() {
  viewports.delete(currentId(path.value))
  navigate(up(path.value))
}

function onPopState() {
  const next = fromHash(architecture.value, location.hash)
  arrival.value = next.length > path.value.length ? 'in' : next.length < path.value.length ? 'out' : undefined
  path.value = next
  selectedId.value = undefined
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') selectedId.value = undefined
}

onMounted(() => {
  // Replace an invalid or partial hash with the path actually shown.
  if (toHash(path.value) !== (location.hash === '#' ? '' : location.hash)) history.replaceState(null, '', urlFor(path.value))
  addEventListener('popstate', onPopState)
  addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  removeEventListener('popstate', onPopState)
  removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="explorer">
    <nav class="toolbar" aria-label="Universes">
      <button
        type="button"
        class="back"
        aria-label="Back to parent universe"
        title="Back to parent universe"
        :disabled="path.length <= 1"
        @click="navigate(up(path))"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 3 5 8l5 5" />
        </svg>
      </button>
      <ol class="breadcrumb">
        <li v-for="crumb in crumbs" :key="crumb.level">
          <button
            v-if="crumb.level < crumbs.length - 1"
            type="button"
            class="crumb"
            @click="navigate(goToLevel(path, crumb.level))"
          >
            {{ crumb.name }}
          </button>
          <span v-else class="crumb current" aria-current="page">{{ crumb.name }}</span>
        </li>
      </ol>
    </nav>

    <!-- Keyed by universe: each visit gets a fresh canvas; its viewport is restored from memory. -->
    <UniverseView
      v-if="universe"
      :key="universe.id"
      :universe="universe"
      :icons="data.icons"
      :initial-viewport="viewports.get(universe.id)"
      :context="context"
      :parent-name="parentName"
      :arrival="arrival"
      @select="(id) => (selectedId = id)"
      @open="open"
      @exit-to="(level) => navigate(goToLevel(path, level))"
      @leave="leave"
      @viewport="(id, viewport) => viewports.set(id, viewport)"
    />
    <p v-else class="status">Universe "{{ currentId(path) }}" is not available.</p>

    <NodeDetails
      v-if="universe && selectedNode"
      :node="selectedNode"
      :universe="universe"
      :architecture="architecture"
      :icons="data.icons"
      :context="context"
      @open="open(selectedNode.id)"
      @close="selectedId = undefined"
      @select="(id) => (selectedId = id)"
      @exit-to="(level) => navigate(goToLevel(path, level))"
    />
  </div>
</template>

<style scoped>
.explorer {
  position: relative;
  width: 100%;
  height: 100%;
}
.toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 340px);
}
button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.back {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--na-card-border);
  border-radius: 6px;
  background: var(--na-card);
  color: var(--na-text);
}
.back svg {
  width: 16px;
  height: 16px;
}
.back:disabled {
  cursor: default;
  color: var(--na-edge);
}
.back:not(:disabled):hover {
  border-color: var(--na-accent);
}
.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}
.breadcrumb li + li::before {
  content: '/';
  margin: 0 8px;
  color: var(--na-edge);
}
.crumb {
  padding: 0;
  border: 0;
  background: none;
  color: var(--na-muted);
}
.crumb:hover {
  color: var(--na-text);
}
.current {
  font-weight: 600;
  color: var(--na-text);
}
.status {
  display: grid;
  place-items: center;
  height: 100%;
  margin: 0;
  color: var(--na-muted);
  font-size: 13px;
}
</style>
