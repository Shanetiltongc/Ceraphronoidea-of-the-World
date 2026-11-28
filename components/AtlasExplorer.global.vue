<template>
  <div class="cow-at">
    <p
      v-if="loading"
      class="cow-at__muted"
    >
      Loading distribution records…
    </p>
    <template v-else>
      <p class="cow-at__intro">
        Realms are shaded by the number of species recorded there in the literature. Hover for numbers; click a
        realm to list its species.
      </p>

      <!-- the world map of realms -->
      <div class="cow-at__world">
        <div
          ref="mapEl"
          class="cow-at__leaflet"
          role="img"
          aria-label="World map of the biogeographic realms, shaded by number of species"
        />
        <div
          class="cow-at__legend"
          aria-hidden="true"
        >
          <span>Species per realm</span>
          <span
            class="cow-at__ramp"
            :style="{ background: RAMP }"
          />
          <span class="cow-at__ends"><b>{{ minSpecies }}</b><b>{{ maxSpecies }}</b></span>
        </div>
        <p
          v-if="shapesLoading"
          class="cow-at__maploading"
        >
          Drawing the realms…
        </p>
        <div
          v-if="hoverInfo"
          class="cow-at__tip"
        >
          <b>{{ hoverInfo.name }}</b>
          {{ hoverInfo.species }} species · {{ hoverInfo.endemic }} only here · {{ hoverInfo.genera.length }} genera
        </div>
      </div>

      <!-- the same numbers as buttons (also the fallback without a map) -->
      <div class="cow-at__map">
        <button
          v-for="r in realms"
          :key="r.name"
          type="button"
          :class="['cow-at__tile', `cow-at__tile--${r.key}`, { 'is-on': realm === r.name, 'is-deep': (r.species - minSpecies) / Math.max(1, maxSpecies - minSpecies) > 0.45 }]"
          :style="{ background: colorAt(tOf(r)), color: isDark(tOf(r)) ? '#fff' : '#15191d' }"
          :aria-pressed="realm === r.name"
          @click="pick(r.name)"
        >
          <span class="cow-at__tname">{{ r.name }}</span>
          <span class="cow-at__tnum">{{ r.species }}</span>
          <span class="cow-at__tsub">species · {{ r.endemic }} only here</span>
        </button>
      </div>

      <!-- the chosen realm -->
      <section
        v-if="current"
        ref="listEl"
        class="cow-at__realm"
      >
        <header class="cow-at__rhead">
          <div>
            <p class="cow-at__kicker">Realm</p>
            <h2 class="cow-at__h2">{{ current.name }}</h2>
            <p class="cow-at__muted">
              {{ current.species }} species in {{ current.genera.length }} genera · {{ current.endemic }} recorded only here ·
              {{ current.records }} records
            </p>
          </div>
          <div class="cow-at__tools">
            <input
              v-model="q"
              type="search"
              placeholder="Find a species…"
              aria-label="Find a species"
            />
            <label class="cow-at__check"><input
              v-model="onlyHere"
              type="checkbox"
            /> Only here</label>
            <button
              type="button"
              class="cow-at__link"
              @click="downloadRealm"
            >
              Download CSV
            </button>
          </div>
        </header>
        <div class="cow-at__genera">
          <button
            v-for="g in ['All', ...current.genera.slice(0, 14).map((x) => x.name)]"
            :key="g"
            type="button"
            :class="{ 'is-on': genus === g }"
            @click="genus = g"
          >
            <i v-if="g !== 'All'">{{ g }}</i><template v-else>All genera</template>
            <span v-if="g !== 'All'">{{ current.genera.find((x) => x.name === g)?.n }}</span>
          </button>
        </div>
        <ul class="cow-at__list">
          <li
            v-for="s in shownSpecies"
            :key="s.name"
          >
            <RouterLink
              v-if="s.otu"
              :to="{ name: 'otus-id-overview', params: { id: String(s.otu) } }"
              v-html="italic(s.name)"
            />
            <span
              v-else
              v-html="italic(s.name)"
            />
            <span class="cow-at__realms">
              <span
                v-for="x in s.realms"
                :key="x"
                :class="['cow-at__dot', `cow-at__dot--${keyOf(x)}`, { 'is-here': x === current.name }]"
                :title="x"
              />
            </span>
          </li>
        </ul>
        <p
          v-if="!shownSpecies.length"
          class="cow-at__muted"
        >
          Nothing matches.
        </p>
      </section>

      <p class="cow-at__note">
        Realm records come from the literature (for example Johnson &amp; Musetti 2004), entered in
        TaxonWorks as asserted distributions. {{ specimensWithCountry }} specimen records also carry a country.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadDwc, csv, download, italic } from '../lib/dwc.js'
import { colorAt, RAMP, isDark } from '../lib/realms.js'
import { resolveAssetUrl } from '@/utils/url'

const { base_url } = __APP_ENV__

// where to write each realm's number on the map (longitude, latitude)
const LABEL = {
  Nearctic: [-102, 48],
  Palearctic: [70, 56],
  Neotropical: [-60, -12],
  Afrotropical: [22, -4],
  Oriental: [92, 18],
  Australasian: [135, -26]
}

const ORDER = ['Nearctic', 'Palearctic', 'Neotropical', 'Afrotropical', 'Oriental', 'Australasian']
const keyOf = (n) => String(n).toLowerCase()

const loading = ref(true)
const rows = ref([])
const realm = ref('')
const genus = ref('All')
const q = ref('')
const onlyHere = ref(false)
const listEl = ref(null)
const mapEl = ref(null)
let map = null
let layers = {}
const shapesLoading = ref(false)
const hoverRealm = ref('')
const hoverInfo = computed(() => realms.value.find((r) => r.name === hoverRealm.value))

onMounted(async () => {
  try {
    rows.value = await loadDwc()
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
  realm.value = realms.value.slice().sort((a, b) => b.species - a.species)[0]?.name || ''

  // one world map of countries, each coloured by its realm (public/data/world-realms.json)
  shapesLoading.value = true
  try {
    const res = await fetch(resolveAssetUrl('/data/world-realms.json', base_url))
    await drawMap(await res.json())
  } catch {
    /* map unavailable: the realm buttons below still work */
  }
  shapesLoading.value = false
})

const tOf = (r) => (r.species - minSpecies.value) / Math.max(1, maxSpecies.value - minSpecies.value)
const styleOf = (r) => ({
  color: isDark(tOf(r)) ? '#f4efe4' : '#2c241c',
  weight: 0.8,
  fillColor: colorAt(tOf(r)),
  fillOpacity: !realm.value || realm.value === r.name ? 1 : 0.55
})

async function drawMap(world) {
  if (!mapEl.value) return
  const L = (await import('leaflet')).default
  map = L.map(mapEl.value, {
    center: [22, 15],
    zoom: 2,
    minZoom: 1,
    maxZoom: 6,
    zoomSnap: 0.25,
    scrollWheelZoom: false,
    worldCopyJump: false,
    maxBounds: [[-75, -200], [88, 220]],
    attributionControl: true
  })
  map.attributionControl.addAttribution('Countries: Natural Earth · realms assigned by country (approximate)')
  // countries outside any realm with records stay neutral
  const known = new Set(realms.value.map((r) => r.name))
  L.geoJSON(
    { type: 'FeatureCollection', features: world.features.filter((f) => !known.has(f.properties.realm)) },
    { style: { color: '#2c241c', weight: 0.7, fillColor: '#d9d6cc', fillOpacity: 1 }, interactive: false }
  ).addTo(map)
  realms.value.forEach((r) => {
    const feats = world.features.filter((f) => f.properties.realm === r.name)
    if (!feats.length) return
    const layer = L.geoJSON({ type: 'FeatureCollection', features: feats }, { style: () => styleOf(r) })
    layer.on('mouseover', () => {
      hoverRealm.value = r.name
      layer.setStyle({ fillOpacity: 1, color: '#15191d', weight: 1 })
    })
    layer.on('mouseout', () => {
      hoverRealm.value = ''
      layer.setStyle(styleOf(r))
    })
    layer.on('click', () => pick(r.name))
    layer.addTo(map)
    layers[r.name] = layer
    if (LABEL[r.name]) {
      L.marker([LABEL[r.name][1], LABEL[r.name][0]], {
        interactive: false,
        icon: L.divIcon({
          className: `cow-at__pin${isDark(tOf(r)) ? ' is-deep' : ''}`,
          html: `<b>${r.species}</b><span>${r.name}</span>`,
          iconSize: [110, 40],
          iconAnchor: [55, 20]
        })
      }).addTo(map)
    }
  })
  map.fitBounds([[-52, -160], [78, 185]])
}

watch(realm, () => realms.value.forEach((r) => layers[r.name]?.setStyle(styleOf(r))))
onBeforeUnmount(() => map?.remove())

const cites = computed(() => rows.value.filter((r) => r.basisOfRecord === 'MaterialCitation' && r.locality))
// species → the realms it is recorded from
const bySpecies = computed(() => {
  const m = new Map()
  cites.value.forEach((r) => {
    const k = r.scientificName
    if (!m.has(k)) m.set(k, { name: k, otu: r.otu_id, genus: r.genus, realms: new Set() })
    m.get(k).realms.add(r.locality)
  })
  m.forEach((v) => (v.realms = ORDER.filter((x) => v.realms.has(x)).concat([...v.realms].filter((x) => !ORDER.includes(x)))))
  return m
})

const realms = computed(() => {
  const names = [...new Set([...ORDER, ...cites.value.map((r) => r.locality)])].filter((n) => cites.value.some((r) => r.locality === n))
  return names.map((name) => {
    const sp = [...bySpecies.value.values()].filter((s) => s.realms.includes(name))
    const g = new Map()
    sp.forEach((s) => g.set(s.genus, (g.get(s.genus) || 0) + 1))
    return {
      name,
      key: keyOf(name),
      species: sp.length,
      endemic: sp.filter((s) => s.realms.length === 1).length,
      records: cites.value.filter((r) => r.locality === name).length,
      list: sp.sort((a, b) => a.name.localeCompare(b.name)),
      genera: [...g].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n)
    }
  })
})
const maxSpecies = computed(() => Math.max(1, ...realms.value.map((r) => r.species)))
const minSpecies = computed(() => Math.min(...realms.value.map((r) => r.species)))
const current = computed(() => realms.value.find((r) => r.name === realm.value))

const shownSpecies = computed(() => {
  const term = q.value.trim().toLowerCase()
  return (current.value?.list || []).filter(
    (s) =>
      (genus.value === 'All' || s.genus === genus.value) &&
      (!onlyHere.value || s.realms.length === 1) &&
      (!term || s.name.toLowerCase().includes(term))
  )
})

const specimensWithCountry = computed(() => rows.value.filter((r) => r.basisOfRecord === 'PreservedSpecimen' && r.country).length)

async function pick(name) {
  realm.value = name
  genus.value = 'All'
  q.value = ''
  await nextTick()
  listEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function downloadRealm() {
  download(
    csv(shownSpecies.value, [
      ['Species', (s) => s.name],
      ['Genus', (s) => s.genus],
      ['Realms', (s) => s.realms.join('; ')]
    ]),
    `ceraphronoidea-${keyOf(realm.value)}.csv`
  )
}
</script>
