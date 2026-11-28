<template>
  <VCard>
    <VCardHeader class="flex justify-between">
      <h2 class="text-md">Other Databases</h2>
    </VCardHeader>
    <VCardContent>
  <section class="cow-px">
    <div
      v-if="gbif"
      class="cow-px__gbif"
    >
      <div class="cow-px__gbifhead">
        <a
          :href="`https://www.gbif.org/species/${gbif.key}`"
          target="_blank"
          rel="noopener"
          class="cow-px__name"
        >GBIF</a>
        <span v-if="gbif.occ !== null"><b>{{ fmt(gbif.occ) }}</b> occurrences</span>
        <a
          v-if="gbif.occ"
          :href="`https://www.gbif.org/occurrence/map?taxon_key=${gbif.key}`"
          target="_blank"
          rel="noopener"
          class="cow-px__small"
        >Open map →</a>
      </div>
      <div
        v-show="gbif.occ"
        ref="mapEl"
        class="cow-px__map"
      />
    </div>
    <ul class="cow-px__list">
      <li
        v-for="l in links"
        :key="l.name"
        :class="{ 'is-missing': l.missing }"
      >
        <a
          :href="l.href"
          target="_blank"
          rel="noopener"
        >
          <b>{{ l.name }}</b>
          <span>{{ l.note }}</span>
        </a>
      </li>
    </ul>
    <p class="cow-px__foot">
      Matched by exact name; a dashed entry means the name was not found there.
    </p>
  </section>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  otuId: { type: [Number, String], default: null },
  taxonId: { type: [Number, String], default: null },
  taxon: { type: Object, default: () => ({}) }
})

const fmt = (n) => Number(n || 0).toLocaleString()
const canonical = computed(() => {
  const words = String(props.taxon?.full_name_tag || props.taxon?.name || '')
    .replace(/<[^>]+>/g, '')
    .replace(/[†]/g, '')
    .trim()
    .split(/\s+/)
  const out = [words[0]]
  for (const w of words.slice(1)) {
    if (/^[a-z][a-z-]+$/.test(w)) out.push(w)
    else break
  }
  return out.filter(Boolean).join(' ')
})

const gbif = ref(null)
const col = ref(null)
const wd = ref(null)
const done = ref(false)
const mapEl = ref(null)
let map = null

async function load(name) {
  gbif.value = col.value = wd.value = null
  done.value = false
  map?.remove()
  map = null
  if (!name) return
  const tasks = [
    (async () => {
      const g = await (await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&kingdom=Animalia&order=Hymenoptera`)).json()
      if (g.usageKey && g.matchType !== 'HIGHERRANK' && String(g.canonicalName || '').toLowerCase() === name.toLowerCase()) {
        const key = g.acceptedUsageKey || g.usageKey
        const c = await (await fetch(`https://api.gbif.org/v1/occurrence/search?taxonKey=${key}&limit=0`)).json()
        if (canonical.value === name) gbif.value = { key, status: String(g.status || '').toLowerCase(), occ: c.count ?? null }
      }
    })(),
    (async () => {
      const j = await (await fetch(`https://api.checklistbank.org/dataset/3LR/nameusage/search?q=${encodeURIComponent(name)}&type=EXACT&limit=5`)).json()
      const hit = (j.result || []).map((x) => x.usage).find((u) => String(u?.name?.scientificName || '').toLowerCase() === name.toLowerCase())
      if (hit && canonical.value === name) col.value = { id: hit.id, status: String(hit.status || '').replace(/_/g, ' ') }
    })(),
    (async () => {
      const w = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&origin=*&limit=5`)).json()
      const hit = (w.search || []).find((x) => String(x.label || '').toLowerCase() === name.toLowerCase() && /taxon|species|genus|family|insect|wasp/i.test(x.description || ''))
      if (hit && canonical.value === name) wd.value = { id: hit.id }
    })()
  ]
  await Promise.allSettled(tasks)
  if (canonical.value === name) done.value = true
  if (gbif.value?.occ) {
    await nextTick()
    drawMap(gbif.value.key)
  }
}
watch(canonical, load, { immediate: true })
onBeforeUnmount(() => map?.remove())

async function drawMap(key) {
  if (!mapEl.value) return
  const L = (await import('leaflet')).default
  // GBIF tiles are 512 px: with zoomOffset -1 the map must stay at zoom 1 or more
  map = L.map(mapEl.value, { center: [20, 10], zoom: 1, minZoom: 1, maxZoom: 9, scrollWheelZoom: false, worldCopyJump: true, attributionControl: true })
  L.tileLayer('https://tile.gbif.org/3857/omt/{z}/{x}/{y}@1x.png?style=gbif-light', { attribution: '© GBIF, OpenStreetMap contributors', tileSize: 512, zoomOffset: -1 }).addTo(map)
  L.tileLayer(`https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&taxonKey=${key}&style=orange.marker`, { tileSize: 512, zoomOffset: -1 }).addTo(map)
  map.setView([20, 10], 1)
  const card = mapEl.value.closest('.tp-card')
  if (card && !card.__cowMapWatch) {
    card.__cowMapWatch = true
    new MutationObserver(() => {
      if (!card.classList.contains('cow-taxon-card--closed')) map?.invalidateSize()
    }).observe(card, { attributes: true, attributeFilter: ['class'] })
  }
}

const links = computed(() => {
  if (!done.value) return []
  const n = encodeURIComponent(canonical.value)
  const u = canonical.value.replace(/\s+/g, '_')
  return [
    !gbif.value && { name: 'GBIF', note: 'not listed', href: `https://www.gbif.org/species/search?q=${n}`, missing: true },
    col.value
      ? { name: 'Catalogue of Life', note: col.value.status, href: `https://www.catalogueoflife.org/data/taxon/${col.value.id}` }
      : { name: 'Catalogue of Life', note: 'not listed', href: `https://www.catalogueoflife.org/data/search?q=${n}`, missing: true },
    wd.value
      ? { name: 'Wikidata', note: wd.value.id, href: `https://www.wikidata.org/wiki/${wd.value.id}` }
      : { name: 'Wikidata', note: 'not listed', href: `https://www.wikidata.org/w/index.php?search=${n}`, missing: true },
    { name: 'BOLD', note: 'DNA barcodes', href: `https://v4.boldsystems.org/index.php/Taxbrowser_Taxonpage?taxon=${n}` },
    { name: 'BHL', note: 'scanned literature', href: `https://www.biodiversitylibrary.org/name/${u}` },
    { name: 'ZooBank', note: 'registered names', href: `https://zoobank.org/Search?search_term=${n}` }
  ].filter(Boolean)
})
</script>
