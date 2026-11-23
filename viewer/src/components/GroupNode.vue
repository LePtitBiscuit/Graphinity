<script setup lang="ts">
// A group: a labelled frame drawn behind its nodes. Dragging it moves them along.
import { Handle, Position, type NodeProps } from '@xyflow/vue'
import { computed, inject } from 'vue'
import { LOCATED, type GroupFlowNode } from '../flow.ts'
import { GROUP_HEADER } from '../layout.ts'
import NodeIcon from './NodeIcon.vue'

const props = defineProps<NodeProps<GroupFlowNode>>()

// Located by the search: a ring around the frame (replayed when found again).
const located = inject(LOCATED, undefined)
const locatedSeq = computed(() => (located?.value?.id === props.id ? located.value.seq : undefined))

// Frame color (border, name and a light tint of the background), border style, fill (`none`:
// transparent), and blur of what is behind the frame (the universe background). A group inside
// another one is drawn over it.
const frame = computed(() => {
  const { color, border, blur, background } = props.data.group
  return {
    '--header': `${GROUP_HEADER}px`,
    ...(background && { '--group-fill': background === 'none' ? 'transparent' : background }),
    ...(color && { '--group-color': color }),
    ...(border === 'none' ? { '--group-border': 'transparent' } : border && { '--group-border-style': border }),
    ...(blur !== undefined && blur > 0 && { backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)` }),
  }
})
</script>

<template>
  <div class="group" :class="{ tinted: data.group.color, filled: data.group.background }" :style="frame">
    <header>
      <NodeIcon v-if="data.group.icon" :icon="data.group.icon" :logo="data.logo" />
      <span class="name" :title="data.group.name">{{ data.group.name }}</span>
    </header>
    <span v-if="locatedSeq !== undefined" :key="locatedSeq" class="locator" aria-hidden="true" />
    <!-- Invisible anchors for the connections to the group (they draw their own route); not connectable. -->
    <Handle type="target" :position="Position.Left" :connectable="false" class="anchor" />
    <Handle type="source" :position="Position.Right" :connectable="false" class="anchor" />
  </div>
</template>

<style scoped>
.group {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border: 1px var(--group-border-style, solid) var(--group-border, var(--group-color, var(--na-card-border)));
  border-radius: 14px;
  background: var(--na-group);
  color: var(--na-text);
  cursor: grab;
}
.tinted {
  background: color-mix(in srgb, var(--group-color) 7%, transparent);
}
.group.filled {
  background: var(--group-fill);
}
:global(.vue-flow__node.dragging) .group {
  cursor: grabbing;
}
header {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--header);
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
}
header :deep(.icon) {
  width: 16px;
  height: 16px;
}
/* Located by the search: a ring that pulses twice, then stays until something else is chosen. */
.locator {
  position: absolute;
  inset: -6px;
  border: 2px solid var(--na-accent);
  border-radius: 19px;
  pointer-events: none;
  animation: locate 1.1s ease-out 2;
}
@keyframes locate {
  from {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--na-accent) 75%, transparent);
  }
  to {
    box-shadow: 0 0 0 26px transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .locator {
    animation: none;
  }
}
.anchor {
  opacity: 0;
  pointer-events: none;
}
.name {
  min-width: 0;
  color: var(--group-color, inherit);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
