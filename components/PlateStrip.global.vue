<template>
  <section class="cow-strip">
    <img
      class="cow-strip__img"
      :src="resolvedSrc"
      :alt="alt"
    />
    <div class="cow-strip__overlay">
      <slot />
    </div>
    <ImageCite
      :taxon="taxon"
      :citation="citation"
      :credit="credit"
      :corner="corner"
    />
  </section>
  <ProjectMetrics v-if="metrics" />
</template>

<script setup>
import { computed } from 'vue'
import { resolveAssetUrl } from '@/utils/url'
import ImageCite from './ImageCite.vue'
import ProjectMetrics from './ProjectMetrics.vue'

const { base_url } = __APP_ENV__

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
  taxon: { type: String, default: '' },
  citation: { type: String, default: '' },
  credit: { type: String, default: 'Photo by: István Mikó' },
  corner: { type: String, default: 'bottom-left' },
  metrics: { type: Boolean, default: false }
})

const resolvedSrc = computed(() => resolveAssetUrl(props.src, base_url))
</script>
