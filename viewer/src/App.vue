<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { formatConfigError } from '../../src/core/errors.ts'
import type { ConfigError, ViewerData } from '../../src/core/types.ts'
import ConfigErrors from './components/ConfigErrors.vue'
import Explorer from './components/Explorer.vue'

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: ViewerData }
  | { status: 'failed'; message: string; errors: ConfigError[] }

const state = shallowRef<State>({ status: 'loading' })

const hasRoot = computed(
  () => state.value.status === 'ready' && Object.hasOwn(state.value.data.architecture.universes, state.value.data.architecture.root),
)

async function load(): Promise<void> {
  try {
    // Relative URL: works from any directory of a static host.
    const response = await fetch('architecture.json', { cache: 'no-store' })
    const body: unknown = await response.json().catch(() => undefined)
    if (response.ok && isViewerData(body)) {
      state.value = { status: 'ready', data: body }
    } else {
      const errors = (body as { errors?: ConfigError[] } | undefined)?.errors ?? []
      const message = errors.length ? 'The configuration has errors' : `Cannot load the architecture (HTTP ${response.status})`
      state.value = { status: 'failed', message, errors }
    }
  } catch (error) {
    state.value = { status: 'failed', message: `Cannot load the architecture: ${(error as Error).message}`, errors: [] }
  }
}

// Served by `graphinity dev`: an event stream announces each change of the files.
// Absent from static builds.
const liveEndpoint = document.querySelector<HTMLMetaElement>('meta[name="graphinity:live"]')?.content
let events: EventSource | undefined

onMounted(() => {
  void load()
  if (!liveEndpoint) return
  events = new EventSource(liveEndpoint)
  let disconnected = false
  events.onmessage = () => void load()
  events.onerror = () => (disconnected = true)
  // Files may have changed while the server was unreachable.
  events.onopen = () => {
    if (disconnected) void load()
    disconnected = false
  }
})
onBeforeUnmount(() => events?.close())

function isViewerData(value: unknown): value is ViewerData {
  const data = value as ViewerData | undefined
  return typeof data?.architecture?.root === 'string' && typeof data.architecture.universes === 'object' && typeof data.icons === 'object'
}
</script>

<template>
  <template v-if="hasRoot && state.status === 'ready'">
    <Explorer :data="state.data" />
    <ConfigErrors v-if="state.data.errors?.length" :errors="state.data.errors" />
  </template>
  <div v-else-if="state.status === 'failed'" class="failure">
    <h1>{{ state.message }}</h1>
    <ul v-if="state.errors.length">
      <li v-for="(error, index) in state.errors" :key="index">{{ formatConfigError(error) }}</li>
    </ul>
    <p v-if="liveEndpoint" class="hint">Fix the files and save: this page reloads automatically.</p>
  </div>
  <p v-else-if="state.status === 'ready'" class="failure">Root universe not found.</p>
</template>

<style scoped>
.failure {
  max-width: 880px;
  margin: 0 auto;
  padding: 48px 24px;
  color: var(--na-text);
}
.hint {
  margin-top: 20px;
  font-size: 12.5px;
  color: var(--na-muted);
}
h1 {
  font-size: 15px;
  font-weight: 600;
}
ul {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  font: 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #f2a7a7;
}
</style>
