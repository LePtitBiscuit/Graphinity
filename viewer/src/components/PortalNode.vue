<script setup lang="ts">
// A door: a node of another universe (an ancestor) connected to this one, or the way back to the
// parent. Drawn large, as translucent frosted glass with a dashed outline; clicking it goes back
// to its universe (handled by UniverseView). Sizes must match layout.ts.
import { Handle, type NodeProps } from '@xyflow/vue'
import { computed } from 'vue'
import { HANDLE_SIDES, type PortalFlowNode } from '../flow.ts'
import { nodeGeometry, TEXT_GAP, TILE_TOP } from '../layout.ts'
import NodeIcon from './NodeIcon.vue'

const props = defineProps<NodeProps<PortalFlowNode>>()

const portal = computed(() => props.data.portal)
const sides = computed(() => HANDLE_SIDES[props.data.direction] ?? HANDLE_SIDES.right)
const label = computed(() =>
  portal.value.node ? `Back to ${portal.value.universe.name} (${portal.value.node.name})` : `Back to ${portal.value.universe.name}`,
)
const sizes = computed(() => {
  const { tile, icon } = nodeGeometry(props.data.node.size)
  return { '--tile-top': `${TILE_TOP}px`, '--tile-size': `${tile}px`, '--icon-size': `${icon}px`, '--text-gap': `${TEXT_GAP}px` }
})
</script>

<template>
  <button type="button" class="portal" :style="sizes" :aria-label="label" :title="label" :data-level="portal.level">
    <span class="tile">
      <NodeIcon v-if="portal.node" :icon="portal.node.icon" :logo="data.logo" />
      <svg v-else class="icon back" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10 3 5 8l5 5" />
      </svg>
      <Handle type="target" :position="sides.target" :connectable="false" class="anchor" />
      <Handle type="source" :position="sides.source" :connectable="false" class="anchor" />
    </span>
    <span class="name">{{ data.node.name }}</span>
    <span class="where">↩ {{ portal.universe.name }}</span>
  </button>
</template>

<style scoped>
.portal {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--tile-top) 0 0;
  border: 0;
  background: none;
  color: var(--na-muted);
  font: inherit;
  cursor: pointer;
  opacity: 0.85;
  transition: opacity 150ms ease-out;
}
.portal:hover,
.portal:focus-visible {
  opacity: 1;
  color: var(--na-text);
}
.portal:focus-visible .tile {
  outline: 2px solid var(--na-accent);
  outline-offset: 2px;
}
.tile {
  position: relative;
  box-sizing: border-box;
  flex: none;
  width: var(--tile-size);
  height: var(--tile-size);
  display: grid;
  place-items: center;
  /* Frosted glass: what is behind shows through, blurred. */
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.02));
  border: 1px dashed rgba(255, 255, 255, 0.28);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 24px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.tile :deep(.icon) {
  width: var(--icon-size);
  height: var(--icon-size);
  opacity: 0.7;
  transition: opacity 150ms ease-out;
}
.portal:hover .tile :deep(.icon),
.portal:focus-visible .tile :deep(.icon) {
  opacity: 1;
}
.back {
  width: 22px;
  height: 22px;
}
.name {
  flex: none;
  box-sizing: border-box;
  width: 100%;
  margin-top: var(--text-gap);
  padding: 0 4px;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.where {
  flex: none;
  max-width: 100%;
  padding: 0 4px;
  font-size: 11px;
  line-height: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.anchor {
  opacity: 0;
  pointer-events: none;
}
</style>
