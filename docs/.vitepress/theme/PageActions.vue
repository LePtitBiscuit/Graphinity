<script setup lang="ts">
// Actions for LLMs at the top of each documentation page: copy or view the page as Markdown, copy
// or download the whole documentation (files written by docs/scripts/llms.ts). Text only: the
// Markdown is fetched and copied as text, never rendered.
import { useData, withBase } from 'vitepress'
import { computed, onBeforeUnmount, ref } from 'vue'

const { page } = useData()

/** The Markdown version of this page, next to its HTML page (`/config/node` -> `/config/node.md`). */
const pageMarkdown = computed(() => withBase(`/${page.value.relativePath}`))
const fullMarkdown = withBase('/llms-full.txt')

const status = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

function say(message: string) {
  status.value = message
  clearTimeout(timer)
  timer = setTimeout(() => (status.value = ''), 2500)
}

async function copy(url: string, done: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await navigator.clipboard.writeText(await response.text())
    say(done)
  } catch {
    say('Copy failed: open the Markdown and copy it from there.')
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="page-actions" role="group" aria-label="Documentation for LLMs">
    <button type="button" class="action" @click="copy(pageMarkdown, 'Page copied as Markdown')">Copy page</button>
    <a class="action" :href="pageMarkdown" target="_blank" rel="noopener">View as Markdown</a>
    <button type="button" class="action" @click="copy(fullMarkdown, 'All documentation copied')">Copy all documentation</button>
    <a class="action" :href="fullMarkdown" download="graphinity-documentation.md">Download documentation</a>
    <span class="status" role="status" aria-live="polite">{{ status }}</span>
  </div>
</template>

<style scoped>
.page-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}
.action {
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-default-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.2s, border-color 0.2s;
}
.action:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}
.action:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.status {
  font-size: 12px;
  color: var(--vp-c-brand-1);
}
</style>
