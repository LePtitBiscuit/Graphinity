<script setup lang="ts">
// Draws the route of a connection: the layout's, until nodes are dragged; then the one computed
// again for the whole universe (routing.ts), so that connections keep making room for each other.
import { BaseEdge, type EdgeProps } from '@xyflow/vue'
import { computed } from 'vue'
import type { RoutedFlowEdge } from '../flow.ts'
import { roundedPath } from '../layout.ts'
import { useRoutes } from '../routing.ts'

const props = defineProps<EdgeProps<RoutedFlowEdge>>()

const routes = useRoutes()

/** Line color and pattern; dots are round caps on zero-length dashes. */
const lineStyle = computed(() => {
  const { color, style } = props.data ?? {}
  return {
    ...(color && { stroke: color }),
    ...(style === 'dashed' && { strokeDasharray: '6 5' }),
    ...(style === 'dotted' && { strokeDasharray: '0 5', strokeLinecap: 'round' as const }),
  }
})

const route = computed(() => {
  const data = props.data
  const label = data?.label
  const rerouted = routes.value?.get(props.id)
  if (rerouted) return { path: roundedPath(rerouted.points), labelX: rerouted.label?.x, labelY: rerouted.label?.y }
  return {
    path: data ? roundedPath(data.points) : '',
    labelX: label ? label.x + label.width / 2 : undefined,
    labelY: label ? label.y + label.height / 2 : undefined,
  }
})
</script>

<template>
  <BaseEdge
    :id="id"
    :path="route.path"
    :marker-end="markerEnd"
    :marker-start="markerStart"
    :style="lineStyle"
    :label="data?.label?.text"
    :label-x="route.labelX"
    :label-y="route.labelY"
    :label-show-bg="true"
    :label-bg-padding="[6, 3]"
    :label-bg-border-radius="4"
  />
</template>
