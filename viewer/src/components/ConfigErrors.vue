<script setup lang="ts">
// Configuration errors shown over a diagram that is still displayed (dev server): each error
// only left out the element it concerns.
import { ref } from 'vue'
import { formatConfigError } from '../../../src/core/errors.ts'
import type { ConfigError } from '../../../src/core/types.ts'

defineProps<{ errors: ConfigError[] }>()

const open = ref(false)
</script>

<template>
  <section class="errors" :class="{ open }" aria-label="Configuration errors">
    <button type="button" class="toggle" :aria-expanded="open" @click="open = !open">
      <span class="dot" aria-hidden="true">!</span>
      {{ errors.length === 1 ? '1 configuration error' : `${errors.length} configuration errors` }}
      <span class="hint">{{ open ? 'hide' : 'the elements concerned are not shown' }}</span>
    </button>
    <ul v-if="open">
      <li v-for="(error, index) in errors" :key="index">{{ formatConfigError(error) }}</li>
    </ul>
  </section>
</template>

<style scoped>
.errors {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 10;
  transform: translateX(-50%);
  box-sizing: border-box;
  max-width: min(880px, calc(100% - 120px));
  max-height: 50%;
  display: flex;
  flex-direction: column;
  background: var(--na-card);
  border: 1px solid #6b2c2c;
  border-radius: 10px;
  color: var(--na-text);
  font-size: 12.5px;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.dot {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f85149;
  color: #0e1015;
  font-size: 11px;
  font-weight: 700;
}
.hint {
  font-weight: 400;
  color: var(--na-muted);
}
ul {
  margin: 0;
  padding: 0 14px 12px;
  overflow-y: auto;
  list-style: none;
  font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #f2a7a7;
}
</style>
