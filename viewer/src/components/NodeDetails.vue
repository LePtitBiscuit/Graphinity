<script setup lang="ts">
import { computed } from 'vue'
import type { Architecture, ArchitectureNode, Universe, ViewerIcon } from '../../../src/core/types.ts'
import type { UniverseContext } from '../context.ts'
import { connectionsOf, universeAt } from '../navigation.ts'
import NodeIcon from './NodeIcon.vue'

const props = defineProps<{
  node: ArchitectureNode
  universe: Universe
  architecture: Architecture
  icons: Record<string, ViewerIcon>
  context?: UniverseContext
}>()

defineEmits<{ open: []; close: []; select: [nodeId: string]; exitTo: [level: number] }>()

const logo = computed(() => (props.node.icon?.type === 'name' ? props.icons[props.node.icon.name] : undefined))
const target = computed(() =>
  props.node.universe === undefined ? undefined : universeAt(props.architecture, props.node.universe),
)
const connections = computed(() => connectionsOf(props.universe, props.node.id, props.context, props.architecture))
const group = computed(() => props.universe.groups.find((g) => g.id === props.node.group))
const iconText = computed(() => {
  const { icon } = props.node
  if (!icon) return 'invalid in the configuration, generic icon'
  if (icon.type === 'file') return icon.path
  return logo.value ? `${icon.name} (${logo.value.title})` : `${icon.name} (not found, generic icon)`
})
</script>

<template>
  <aside class="details" aria-label="Node details">
    <header>
      <NodeIcon :icon="node.icon" :logo="logo" />
      <h2>{{ node.name }}</h2>
      <button type="button" class="close" aria-label="Close" @click="$emit('close')">×</button>
    </header>

    <p v-if="node.description" class="description">{{ node.description }}</p>

    <ul v-if="node.tags?.length" class="tags" aria-label="Tags">
      <li v-for="tag in node.tags" :key="tag.corner">{{ tag.text }}</li>
    </ul>

    <section v-if="node.universe !== undefined">
      <h3>Sub-universe</h3>
      <div v-if="target" class="open-row">
        <span>{{ target.name }} · {{ target.nodes.length }} {{ target.nodes.length === 1 ? 'node' : 'nodes' }}</span>
        <button type="button" class="open" @click="$emit('open')">Open</button>
      </div>
      <p v-else class="error">Universe "{{ node.universe }}" is not available.</p>
    </section>

    <section v-if="connections.length">
      <h3>Connections</h3>
      <ul>
        <li v-for="connection in connections" :key="connection.edgeId + connection.direction">
          <span class="direction" :aria-label="connection.direction === 'out' ? 'to' : 'from'">
            {{ connection.direction === 'out' ? '→' : '←' }}
          </span>
          <button
            v-if="connection.external"
            type="button"
            class="link"
            :title="`Back to ${connection.external.universe}`"
            @click="$emit('exitTo', connection.external.level)"
          >
            {{ connection.node.name }} <span class="label">({{ connection.external.universe }})</span>
          </button>
          <span v-else-if="connection.group" class="group-end">{{ connection.node.name }} <span class="label">(group)</span></span>
          <button v-else type="button" class="link" @click="$emit('select', connection.node.id)">
            {{ connection.node.name }}<span v-for="(name, index) in connection.inside" :key="index" class="inside"> › {{ name }}</span>
          </button>
          <span v-if="connection.label" class="label">{{ connection.label }}</span>
        </li>
      </ul>
    </section>

    <section>
      <h3>Details</h3>
      <dl>
        <dt>ID</dt>
        <dd>{{ node.id }}</dd>
        <template v-if="group">
          <dt>Group</dt>
          <dd>{{ group.name }}</dd>
        </template>
        <dt>Icon</dt>
        <dd>{{ iconText }}</dd>
        <dt>Defined in</dt>
        <dd>{{ universe.source }}</dd>
      </dl>
    </section>
  </aside>
</template>

<style scoped>
.details {
  position: absolute;
  /* Below the search field (Explorer.vue). */
  top: 52px;
  right: 12px;
  z-index: 10;
  box-sizing: border-box;
  width: 300px;
  max-width: calc(100% - 24px);
  max-height: calc(100% - 64px);
  overflow-y: auto;
  padding: 14px 16px;
  background: var(--na-card);
  border: 1px solid var(--na-card-border);
  border-radius: 8px;
  font-size: 12.5px;
}
header {
  display: flex;
  align-items: center;
  gap: 10px;
}
h2 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
h3 {
  margin: 16px 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--na-muted);
}
.description {
  margin: 10px 0 0;
  line-height: 1.5;
  color: var(--na-text);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.close {
  padding: 0 4px;
  border: 0;
  background: none;
  font-size: 18px;
  line-height: 1;
  color: var(--na-muted);
}
.close:hover {
  color: var(--na-text);
}
.open-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.open {
  padding: 3px 10px;
  border: 1px solid var(--na-card-border);
  border-radius: 6px;
  background: var(--na-bg);
}
.open:hover {
  border-color: var(--na-accent);
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 0;
}
.direction {
  color: var(--na-muted);
}
.link {
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
}
.link:hover {
  text-decoration: underline;
}
.label {
  margin-left: auto;
  color: var(--na-muted);
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  margin: 0;
}
dt {
  color: var(--na-muted);
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.error {
  margin: 0;
  color: #f2a7a7;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.tags li {
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 600;
  background: var(--na-tag);
  border: 1px solid var(--na-card-border);
  border-radius: 999px;
}
</style>
