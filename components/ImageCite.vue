<template>
  <div
    v-if="taxon || citation"
    :class="['cow-cite', cornerClass]"
  >
    <p class="cow-cite__name">
      <i v-if="taxon">{{ taxon }}</i><span
        v-if="citation"
        class="cow-cite__authority"
      >{{ "\u00A0" + citation }}</span>
    </p>
    <p
      v-if="credit"
      class="cow-cite__credit"
    >{{ credit }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

const props = defineProps({
  taxon: { type: String, default: '' },
  citation: { type: String, default: '' },
  credit: { type: String, default: 'Photo by: István Mikó' },
  corner: { type: String, default: 'bottom-left' }
})

const cornerClass = computed(() => {
  const corner = CORNERS.includes(props.corner) ? props.corner : 'bottom-left'
  return `cow-cite--${corner}`
})
</script>
