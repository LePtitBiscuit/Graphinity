<script setup lang="ts">
// Search of the nodes and groups of every universe by name (search.ts). Results of the universe
// shown come first; choosing one goes to it (Explorer.vue opens its universe if needed). A
// combobox: the focus stays in the field, the arrow keys move through the results.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Architecture, ViewerIcon } from '../../../src/core/types.ts'
import { search, searchIndex, type SearchEntry, type SearchResult } from '../search.ts'
import NodeIcon from './NodeIcon.vue'

const props = defineProps<{
  architecture: Architecture
  icons: Record<string, ViewerIcon>
  /** Id of the universe shown. */
  current: string
}>()

const emit = defineEmits<{ pick: [entry: SearchEntry] }>()

const input = ref<HTMLInputElement>()
const query = ref('')
const open = ref(false)
/** Index of the highlighted result (Enter chooses it). */
const active = ref(0)

const index = computed(() => searchIndex(props.architecture))
const found = computed(() => search(index.value, query.value, props.current))

interface Option {
  result: SearchResult
  index: number
  before: string
  matched: string
  after: string
  where: string
}
interface Section {
  id: string
  title: string
  options: Option[]
}

/** Results, in two sections: the universe shown, the others. */
const sections = computed<Section[]>(() => {
  const { results } = found.value
  // Same name, same place: told apart by their id.
  const placeOf = ({ entry }: SearchResult) => `${entry.kind}\n${entry.name}\n${entry.universe}\n${entry.groupName ?? ''}`
  const counts = new Map<string, number>()
  for (const result of results) counts.set(placeOf(result), (counts.get(placeOf(result)) ?? 0) + 1)
  const options = results.map((result, index): Option => {
    const { entry, match, here } = result
    const where = [
      entry.kind === 'node' ? 'Node' : 'Group',
      entry.groupName !== undefined && `in ${entry.groupName}`,
      !here && entry.universeName,
      counts.get(placeOf(result))! > 1 && entry.id,
    ]
    return {
      result,
      index,
      before: entry.name.slice(0, match[0]),
      matched: entry.name.slice(match[0], match[1]),
      after: entry.name.slice(match[1]),
      where: where.filter((part): part is string => typeof part === 'string').join(' · '),
    }
  })
  return [
    { id: 'search-here', title: 'This universe', options: options.filter((o) => o.result.here) },
    { id: 'search-elsewhere', title: 'Other universes', options: options.filter((o) => !o.result.here) },
  ].filter((section) => section.options.length > 0)
})

const count = computed(() => found.value.results.length)
const status = computed(() => {
  const { total } = found.value
  if (!open.value || !query.value.trim()) return ''
  if (total === 0) return 'No results'
  return total > count.value ? `${count.value} of ${total} results shown` : `${total} ${total === 1 ? 'result' : 'results'}`
})

const optionId = (index: number) => `search-option-${index}`

watch(query, () => {
  active.value = 0
  open.value = query.value.trim() !== ''
})
watch(active, async (value) => {
  await nextTick()
  document.getElementById(optionId(value))?.scrollIntoView({ block: 'nearest' })
})

function choose(index: number) {
  const result = found.value.results[index]
  if (!result) return
  active.value = index
  open.value = false
  emit('pick', result.entry)
}

function clear() {
  query.value = ''
  open.value = false
  input.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const n = count.value
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      event.preventDefault()
      if (!open.value) {
        open.value = query.value.trim() !== ''
        return
      }
      if (n > 0) active.value = (active.value + (event.key === 'ArrowDown' ? 1 : n - 1)) % n
      return
    }
    case 'Enter':
      event.preventDefault()
      if (query.value.trim() !== '') choose(active.value)
      return
    case 'Escape':
      // First the search, then (field empty) the rest of the viewer: the details panel closes.
      if (query.value === '') {
        input.value?.blur()
        return
      }
      event.stopPropagation()
      clear()
      return
  }
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !(event.currentTarget as HTMLElement).contains(next)) open.value = false
}

/** `/` or Ctrl+K (⌘K) anywhere focuses the field, unless the user is typing somewhere else. */
function onShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
  const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
  const k = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey
  if (!slash && !k) return
  event.preventDefault()
  input.value?.focus()
  input.value?.select()
  open.value = query.value.trim() !== ''
}

onMounted(() => addEventListener('keydown', onShortcut))
onBeforeUnmount(() => removeEventListener('keydown', onShortcut))

const shortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
const logoOf = (entry: SearchEntry) => (entry.icon?.type === 'name' ? props.icons[entry.icon.name] : undefined)
</script>

<template>
  <div class="search" role="search" @focusout="onFocusOut">
    <div class="field">
      <svg class="glass" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3.5 3.5" />
      </svg>
      <input
        ref="input"
        v-model="query"
        type="text"
        role="combobox"
        aria-label="Search nodes and groups"
        aria-autocomplete="list"
        aria-controls="search-results"
        :aria-expanded="open"
        :aria-activedescendant="open && count > 0 ? optionId(active) : undefined"
        placeholder="Search nodes and groups"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
        @keydown="onKeydown"
        @focus="open = query.trim() !== ''"
      />
      <button v-if="query" type="button" class="clear" aria-label="Clear the search" title="Clear the search (Esc)" @click="clear">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
          <path d="m4.5 4.5 7 7m0-7-7 7" />
        </svg>
      </button>
      <kbd v-else class="hint" :title="`Search: / or ${shortcut}`" aria-hidden="true">/</kbd>
    </div>

    <div v-show="open" class="results">
      <div id="search-results" role="listbox" aria-label="Search results">
        <div v-for="section in sections" :key="section.id" role="group" :aria-labelledby="section.id">
          <div :id="section.id" class="section" role="presentation">{{ section.title }}</div>
          <div
            v-for="option in section.options"
            :id="optionId(option.index)"
            :key="`${option.result.entry.universe}/${option.result.entry.kind}/${option.result.entry.id}`"
            class="option"
            :class="{ active: option.index === active }"
            role="option"
            :aria-selected="option.index === active"
            @mousedown.prevent
            @mousemove="active = option.index"
            @click="choose(option.index)"
          >
            <span class="kind" :class="option.result.entry.kind" aria-hidden="true">
              <NodeIcon v-if="option.result.entry.kind === 'node' || option.result.entry.icon" :icon="option.result.entry.icon" :logo="logoOf(option.result.entry)" />
              <svg v-else class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
                <rect x="2" y="3" width="12" height="10" rx="2" stroke-dasharray="2.5 1.5" />
              </svg>
            </span>
            <span class="text">
              <span class="name">{{ option.before }}<mark>{{ option.matched }}</mark>{{ option.after }}</span>
              <span class="where">{{ option.where }}</span>
            </span>
          </div>
        </div>
      </div>
      <p v-if="found.total === 0" class="note">No node or group matches "{{ query.trim() }}".</p>
      <p v-else-if="found.total > count" class="note">{{ count }} of {{ found.total }} shown: refine the search.</p>
    </div>
    <span class="sr-only" role="status">{{ status }}</span>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  width: 300px;
  max-width: 100%;
  font-size: 12.5px;
}
.field {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 32px;
  padding: 0 6px 0 10px;
  background: var(--na-card);
  border: 1px solid var(--na-card-border);
  border-radius: 8px;
  color: var(--na-muted);
}
.field:focus-within {
  border-color: var(--na-accent);
}
.glass {
  flex: none;
  width: 14px;
  height: 14px;
}
input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  outline: none;
  background: none;
  font: inherit;
  color: var(--na-text);
}
input::placeholder {
  color: var(--na-muted);
}
.clear {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--na-muted);
  cursor: pointer;
}
.clear:hover {
  color: var(--na-text);
  background: var(--na-tag);
}
.clear svg {
  width: 14px;
  height: 14px;
}
.hint {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  box-sizing: border-box;
  border: 1px solid var(--na-card-border);
  border-radius: 4px;
  font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--na-muted);
}
.results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  box-sizing: border-box;
  max-height: min(420px, calc(100vh - 80px));
  overflow-y: auto;
  padding: 4px;
  background: var(--na-card);
  border: 1px solid var(--na-card-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.section {
  padding: 8px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--na-muted);
}
.option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.option.active {
  background: var(--na-tag);
}
.kind {
  flex: none;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  box-sizing: border-box;
  color: var(--na-muted);
}
/* A node as a small tile, a group as a small dashed frame. */
.kind.node {
  background: var(--na-bg);
  border: 1px solid var(--na-card-border);
  border-radius: 6px;
}
.kind.group {
  border: 1px dashed var(--na-edge);
  border-radius: 7px;
}
.kind :deep(.icon) {
  width: 16px;
  height: 16px;
}
.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name,
.where {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.name {
  color: var(--na-text);
}
mark {
  background: none;
  color: var(--na-accent);
  font-weight: 600;
}
.where {
  font-size: 11px;
  color: var(--na-muted);
}
.note {
  margin: 0;
  padding: 8px;
  color: var(--na-muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
