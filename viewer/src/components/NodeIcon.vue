<script setup lang="ts">
// Renders an icon without injecting markup: Simple Icons logos are bound as SVG path data; icons of
// other collections (SVG files generated with the site) and local images are loaded through <img>,
// which never runs SVG scripts; anything unresolved falls back to a generic icon.
import { computed, ref, watch } from 'vue'
import type { IconRef, ViewerIcon } from '../../../src/core/types.ts'
import { readableBrandColor } from '../colors.ts'

const props = defineProps<{ icon?: IconRef; logo?: ViewerIcon }>()

const imageFailed = ref(false)
watch(
  () => [props.icon, props.logo],
  () => (imageFailed.value = false),
)

const brand = computed(() => (props.logo?.type === 'brand' ? props.logo : undefined))
const color = computed(() => (brand.value ? readableBrandColor(brand.value.hex) : undefined))
/** Site-relative URL of the image to show, if any. */
const imageUrl = computed(() => {
  if (props.logo?.type === 'image') return props.logo.src
  if (props.icon?.type === 'file') return `files/${props.icon.path.split('/').map(encodeURIComponent).join('/')}`
  return undefined
})
const title = computed(() => props.logo?.title ?? '')
</script>

<template>
  <svg v-if="brand" class="icon" viewBox="0 0 24 24" role="img" :aria-label="brand.title">
    <path :d="brand.path" :fill="color" />
  </svg>
  <img
    v-else-if="imageUrl && !imageFailed"
    class="icon"
    :src="imageUrl"
    :alt="title"
    draggable="false"
    @error="imageFailed = true"
  />
  <svg
    v-else
    class="icon generic"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </svg>
</template>

<style scoped>
.icon {
  width: 24px;
  height: 24px;
  flex: none;
}
img.icon {
  /* Raster images may not be square: fit without distortion. */
  object-fit: contain;
}
.generic {
  color: var(--na-muted);
}
</style>
