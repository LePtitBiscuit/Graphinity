<script setup lang="ts">
// A node: a square tile with the logo and up to 4 corner tags, the name below it, then the
// description. Sizes must match the geometry of layout.ts.
import { Handle, Position, type NodeProps } from '@xyflow/vue'
import { computed, inject } from 'vue'
import { GESTURE, HANDLE_SIDES, SELECTED_NODE, type ServiceFlowNode } from '../flow.ts'
import { BEHIND_OFFSET, DESCRIPTION_LINE_HEIGHT, NAME_HEIGHT, nodeGeometry, TEXT_GAP, TILE_TOP } from '../layout.ts'
import NodeIcon from './NodeIcon.vue'

const props = defineProps<NodeProps<ServiceFlowNode>>()

const selectedId = inject(SELECTED_NODE, undefined)
const selected = computed(() => selectedId?.value === props.id)
const nested = computed(() => props.data.node.universe !== undefined)
// Entering this node's universe with the scroll wheel: the bar under the tile.
const gesture = inject(GESTURE, undefined)
const entering = computed(() => {
  const hold = gesture?.value
  return hold?.kind === 'enter' && hold.target === props.id ? hold.progress : undefined
})

// Connections attach to the tile, except below the text for vertical flows (layout.ts `ports`).
const handles = computed(() => {
  const { source, target } = HANDLE_SIDES[props.data.direction] ?? HANDLE_SIDES.right
  const onBox = (position: Position) => position === Position.Bottom
  return {
    tile: [
      ...(onBox(target) ? [] : [{ type: 'target' as const, position: target }]),
      ...(onBox(source) ? [] : [{ type: 'source' as const, position: source }]),
    ],
    box: [
      ...(onBox(target) ? [{ type: 'target' as const, position: target }] : []),
      ...(onBox(source) ? [{ type: 'source' as const, position: source }] : []),
    ],
  }
})

// Border color and style, and fill, of the tile, from the configuration.
const border = computed(() => ({
  ...(props.data.node.color && { '--tile-border': props.data.node.color }),
  ...(props.data.node.background && { '--tile-bg': props.data.node.background }),
  ...(props.data.node.border === 'none'
    ? { '--tile-border': 'transparent' }
    : props.data.node.border && { '--tile-border-style': props.data.node.border }),
}))

const sizes = computed(() => {
  const { tile, icon } = nodeGeometry(props.data.node.size)
  return {
    '--tile-top': `${TILE_TOP}px`,
    '--behind': `${BEHIND_OFFSET}px`,
    '--tile-size': `${tile}px`,
    '--icon-size': `${icon}px`,
    '--text-gap': `${TEXT_GAP}px`,
    '--name-height': `${NAME_HEIGHT}px`,
    '--description-line': `${DESCRIPTION_LINE_HEIGHT}px`,
  }
})
</script>

<template>
  <div class="node" :style="sizes" :data-nested="nested || undefined" :data-size="data.node.size ?? 'medium'">
    <div class="tile" :class="{ nested, selected }" :style="border">
      <NodeIcon :icon="data.node.icon" :logo="data.logo" />
      <span
        v-for="tag in data.node.tags ?? []"
        :key="tag.corner"
        class="tag"
        :class="tag.corner"
        :title="tag.text"
        :data-corner="tag.corner"
      >
        {{ tag.text }}
      </span>
      <!-- Invisible anchors for the connections; not connectable. -->
      <Handle v-for="handle in handles.tile" :key="handle.type" :type="handle.type" :position="handle.position" :connectable="false" class="anchor" />
      <!-- This node opens a sub-universe (double-click): a copy of the tile behind it (CSS). -->
      <span v-if="nested" class="sr-only">Contains a sub-universe</span>
      <span v-if="entering !== undefined" class="entering" aria-hidden="true">
        <span class="fill" :style="{ transform: `scaleX(${entering})` }" />
      </span>
    </div>
    <div class="name" :title="data.node.name">{{ data.node.name }}</div>
    <div v-if="data.node.description" class="description">{{ data.node.description }}</div>
    <Handle v-for="handle in handles.box" :key="handle.type" :type="handle.type" :position="handle.position" :connectable="false" class="anchor" />
  </div>
</template>

<style scoped>
.node {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: var(--tile-top);
  color: var(--na-text);
  cursor: pointer;
}
:global(.vue-flow__node.dragging) .node {
  cursor: grabbing;
}
.tile {
  position: relative;
  box-sizing: border-box;
  flex: none;
  width: var(--tile-size);
  height: var(--tile-size);
  display: grid;
  place-items: center;
  background: var(--tile-bg, var(--na-card));
  border: 1px var(--tile-border-style, solid) var(--tile-border, var(--na-card-border));
  border-radius: 12px;
}
.tile :deep(.icon) {
  width: var(--icon-size);
  height: var(--icon-size);
}
.selected {
  border-color: var(--na-accent);
}
/* This node opens a universe: a copy of the tile behind it, shifted down and to the right, like a
   doubled node. Both are opaque (a fill color is laid over the card color) so that the one behind
   never shows through. */
.nested {
  background:
    linear-gradient(var(--tile-bg, transparent), var(--tile-bg, transparent)),
    var(--na-card);
}
.nested::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: calc(var(--behind) - 2px) calc(-1 * var(--behind)) calc(-1 * var(--behind)) calc(var(--behind) - 2px);
  box-sizing: border-box;
  background:
    linear-gradient(var(--tile-bg, transparent), var(--tile-bg, transparent)),
    var(--na-card);
  border: 1px var(--tile-border-style, solid) color-mix(in srgb, var(--tile-border, var(--na-card-border)) 65%, var(--na-text) 35%);
  border-radius: 12px;
  filter: brightness(0.8);
  pointer-events: none;
}
.nested.selected::before {
  border-color: var(--na-accent);
}
.tag {
  position: absolute;
  z-index: 1;
  box-sizing: border-box;
  max-width: 96px;
  padding: 1px 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  color: var(--na-text);
  background: var(--na-tag);
  border: 1px solid var(--na-card-border);
  border-radius: 999px;
}
.top-right {
  top: 0;
  right: 0;
  transform: translate(50%, -50%);
}
.top-left {
  top: 0;
  left: 0;
  transform: translate(-50%, -50%);
}
.bottom-right {
  bottom: 0;
  right: 0;
  transform: translate(50%, 50%);
}
.bottom-left {
  bottom: 0;
  left: 0;
  transform: translate(-50%, 50%);
}
.name {
  box-sizing: border-box;
  width: 100%;
  margin-top: var(--text-gap);
  padding: 0 4px;
  font-size: 12.5px;
  font-weight: 600;
  line-height: var(--name-height);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Must match the "description" font measured in UniverseView.vue. */
.description {
  box-sizing: border-box;
  width: 100%;
  padding: 0 4px;
  font: 11px/var(--description-line) ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--na-muted);
  text-align: center;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}
.entering {
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 5px;
  z-index: 2;
  height: 3px;
  overflow: hidden;
  background: color-mix(in srgb, var(--na-card-border) 80%, transparent);
  border-radius: 2px;
}
.entering .fill {
  display: block;
  height: 100%;
  background: var(--na-accent);
  transform-origin: left;
  transition: transform 160ms ease-out;
}
.anchor {
  opacity: 0;
  pointer-events: none;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
