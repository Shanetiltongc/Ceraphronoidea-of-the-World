<template>
  <figure :class="['cow-figure', variantClass]">
    <div class="cow-figure__frame">
      <img
        :src="resolvedSrc"
        :alt="alt"
        :loading="eager ? 'eager' : 'lazy'"
      />
      <ImageCite
        :taxon="taxon"
        :citation="citation"
        :credit="credit"
        :corner="corner"
      />
    </div>
  </figure>
</template>

<script setup>
import { computed } from 'vue'
import { resolveAssetUrl } from '@/utils/url'
import ImageCite from './ImageCite.vue'

const { base_url } = __APP_ENV__

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
  taxon: { type: String, default: '' },
  citation: { type: String, default: '' },
  credit: { type: String, default: 'Photo by: István Mikó' },
  corner: { type: String, default: 'bottom-left' },
  variant: { type: String, default: 'plain' },
  eager: { type: Boolean, default: false }
})

const resolvedSrc = computed(() => resolveAssetUrl(props.src, base_url))
const variantClass = computed(() => `cow-figure--${props.variant}`)
</script>
