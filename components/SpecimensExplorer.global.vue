<template>
  <div class="cow-sp2">
    <p
      v-if="loading"
      class="cow-ty__muted"
    >
      Loading records…
    </p>
    <template v-else>
      <!-- numbers -->
      <section class="cow-sp2__nums">
        <div>
          <b>{{ specimens.length }}</b>
          <span>specimen records</span>
        </div>
        <div>
          <b>{{ collections.length }}</b>
          <span>collections</span>
        </div>
        <div>
          <b>{{ imaged }}</b>
          <span>imaged specimens</span>
        </div>
        <div>
          <b>{{ typeCount }}</b>
          <span>type specimens</span>
        </div>
        <div>
          <b>{{ speciesWithSpecimens }}<small v-if="validTotal"> / {{ validTotal }}</small></b>
          <span>species with a specimen record{{ validTotal ? ' (of valid species)' : '' }}</span>
        </div>
        <div>
          <b>{{ citations.length }}</b>
          <span>literature records</span>
        </div>
      </section>

      <!-- 1. photo wall -->
      <section class="cow-sp2__block">
        <h2 class="cow-sp2__h2">The specimens</h2>
        <p class="cow-sp2__help">
          One photo per species, specimen views first. Click a photo to see that species' specimens below.
        </p>
        <div class="cow-sp2__wall">
          <button
            v-for="(t, i) in wallShown"
            :key="t.key"
            type="button"
            :class="['cow-sp2__tile', { 'is-big': i % 9 === 0 }]"
            @click="focusSpecies(t)"
          >
            <img
              v-if="thumbs[t.key]"
              :src="thumbs[t.key]"
              alt=""
              loading="lazy"
            />
            <span class="cow-sp2__tilecap">
              <i>{{ t.name }}</i>
              <small>{{ t.repos.join(' · ') }}</small>
            </span>
          </button>
        </div>
        <button
          v-if="wallN < wallReady.length"
          type="button"
          class="cow-ix__more"
          @click="wallN += 24"
        >
          Show more photos ({{ wallReady.length - wallN }} left)
        </button>
      </section>

      <!-- 3. map: realms of the literature records + the collections -->
      <section class="cow-sp2__block">
        <h2 class="cow-sp2__h2">Where</h2>
        <p class="cow-sp2__help">
          Countries coloured by realm and the number of literature records there; the circles are the collections
          holding the specimens, sized by the number of specimen records. Click a realm or a collection to filter the
          records below.
        </p>
        <div class="cow-sp2__mapwrap">
          <div
            ref="mapEl"
            class="cow-sp2__map"
          />
          <aside class="cow-sp2__maplegend">
            <p class="cow-sp2__kicker">Literature records by realm</p>
            <button
              v-for="r in realmCounts"
              :key="r.name"
              type="button"
              :class="['cow-sp2__lrow', { 'is-on': realm === r.name }]"
              @click="pickRealm(r.name)"
            >
              <span
                class="cow-sp2__sw"
                :style="{ background: colorAt(r.n / realmMax) }"
              />
              <span>{{ r.name }}</span>
              <b>{{ r.n }}</b>
            </button>
            <p class="cow-sp2__kicker cow-sp2__kicker--gap">
              Collections
            </p>
            <button
              v-for="c in collections"
              :key="c.code"
              type="button"
              :class="['cow-sp2__lrow', { 'is-on': repo === c.code }]"
              :title="c.name"
              @click="pickRepo(c.code)"
            >
              <span class="cow-sp2__dotk" />
              <span><b class="cow-sp2__code">{{ c.code }}</b> {{ c.short }}</span>
              <b>{{ c.n }}</b>
            </button>
          </aside>
        </div>
      </section>

      <!-- 4. coverage per genus -->
      <section class="cow-sp2__block">
        <h2 class="cow-sp2__h2">Coverage by genus</h2>
        <p class="cow-sp2__help">
          For each genus (largest first), the share of its valid species with a photographed specimen, a specimen
          without photos, literature records only, or nothing yet. The numbers are species with a specimen record /
          valid species.
        </p>
        <ul class="cow-sp2__clegend">
          <li
            v-for="k in COVER"
            :key="k.key"
          >
            <span
              class="cow-sp2__sw"
              :style="{ background: k.color }"
            />{{ k.label }}
          </li>
        </ul>
        <div class="cow-sp2__cover">
          <button
            v-for="g in coverage"
            :key="g.genus"
            type="button"
            :class="['cow-sp2__crow', { 'is-on': genus === g.genus }]"
            :title="g.title"
            @click="pickGenus(g.genus)"
          >
            <i>{{ g.genus }}</i>
            <span class="cow-sp2__ctrack">
              <span
                v-for="k in COVER"
                :key="k.key"
                :style="{ width: `${(g[k.key] / g.valid) * 100}%`, background: k.color }"
              />
            </span>
            <small>{{ g.withSpec }}/{{ g.valid }}</small>
          </button>
        </div>
      </section>

      <!-- 5. collectors -->
      <section
        v-if="collectors.length"
        class="cow-sp2__block"
      >
        <h2 class="cow-sp2__h2">Collectors</h2>
        <p class="cow-sp2__help">
          People named on the labels of the specimen records ({{ withCollector }} of {{ specimens.length }} records
          name a collector).
        </p>
        <div class="cow-sp2__people">
          <button
            v-for="p in collectors"
            :key="p.name"
            type="button"
            :class="['cow-sp2__person', { 'is-on': q && p.name.endsWith(q) }]"
            @click="pickCollector(p.name)"
          >
            <b>{{ p.name }}</b>
            <span>{{ p.n }} specimen{{ p.n === 1 ? '' : 's' }}<template v-if="p.years"> · {{ p.years }}</template></span>
            <small v-if="p.where">{{ p.where }}</small>
          </button>
        </div>
      </section>

      <!-- 2 + 6. records: table and preview panel -->
      <section
        ref="listEl"
        class="cow-sp2__block"
      >
        <h2 class="cow-sp2__h2">Records</h2>
        <div class="cow-sp2__tabs">
          <button
            type="button"
            :class="{ 'is-on': tab === 'spec' }"
            @click="tab = 'spec'"
          >
            Specimen records <small>{{ specimens.length }}</small>
          </button>
          <button
            type="button"
            :class="{ 'is-on': tab === 'lit' }"
            @click="tab = 'lit'"
          >
            Literature records <small>{{ citations.length }}</small>
          </button>
        </div>
        <div class="cow-ty2__tools cow-sp2__tools">
          <input
            v-model="q"
            type="search"
            placeholder="Search a name, catalogue number, collector, place…"
            aria-label="Search records"
          />
          <div
            v-if="tab === 'spec'"
            class="cow-ty2__seg"
          >
            <button
              v-for="o in TYPE_OPTS"
              :key="o.key"
              type="button"
              :class="{ 'is-on': typeFilter === o.key }"
              @click="typeFilter = o.key"
            >
              {{ o.label }}
            </button>
          </div>
          <select
            v-model="family"
            aria-label="Family"
          >
            <option value="">
              All families
            </option>
            <option
              v-for="f in families"
              :key="f"
              :value="f"
            >
              {{ f }}
            </option>
          </select>
          <label
            v-if="tab === 'spec'"
            class="cow-ty2__chk"
          >
            <input
              v-model="withPhotos"
              type="checkbox"
            />
            With photos
          </label>
          <button
            v-for="p in pills"
            :key="p.label"
            type="button"
            class="cow-ix__pill"
            @click="p.clear()"
          >
            <span v-html="p.label" /> ✕
          </button>
        </div>
        <p class="cow-ty__muted">
          {{ shown.length }} record{{ shown.length === 1 ? '' : 's' }} ·
          <button
            type="button"
            class="cow-ix__link"
            @click="downloadShown"
          >
            Download CSV (Darwin Core)
          </button>
          ·
          <a
            :href="fullDwc"
            class="cow-ix__link"
          >Full Darwin Core file (all records, TSV)</a>
        </p>

        <!-- specimen records: table + panel -->
        <div
          v-if="tab === 'spec'"
          ref="splitEl"
          class="cow-ty2__split"
        >
          <div class="cow-ty2__tablewrap">
            <table class="cow-ty2__table">
              <thead>
                <tr>
                  <th
                    v-for="c in COLS"
                    :key="c.key"
                  >
                    <button
                      type="button"
                      :class="{ 'is-on': sortKey === c.key }"
                      @click="sortBy(c.key)"
                    >
                      {{ c.label }}<span v-if="sortKey === c.key">{{ sortDir > 0 ? '▲' : '▼' }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <template
                  v-for="g in groupedSpec"
                  :key="g.genus"
                >
                  <tr class="cow-ty2__genrow">
                    <th :colspan="COLS.length">
                      <i>{{ g.genus }}</i> <small>{{ g.family }} · {{ g.items.length }}</small>
                    </th>
                  </tr>
                  <tr
                    v-for="r in g.items"
                    :key="r.key"
                    :class="['cow-ty2__tr', { 'is-sel': sel === r.key }]"
                    tabindex="0"
                    @click="select(r, $event)"
                    @keydown.enter="select(r, $event)"
                  >
                    <td class="c-name">
                      <span class="cow-ty2__mini">
                        <img
                          v-if="specThumb(r)"
                          :src="specThumb(r)"
                          alt=""
                          loading="lazy"
                        />
                      </span>
                      <span v-html="nameHtml(r)" />
                    </td>
                    <td class="c-type">
                      <span
                        v-if="r.typeStatus"
                        :class="['cow-ty2__kind', `is-${String(r.typeStatus).toLowerCase()}`]"
                      >{{ r.typeStatus }}</span>
                      <span
                        v-else
                        class="cow-ty__muted"
                      >—</span>
                    </td>
                    <td
                      class="c-repo"
                      :title="repoName(r.institutionCode)"
                    >
                      <b>{{ r.institutionCode || '—' }}</b> <span>{{ shortRepo(r.institutionCode) }}</span>
                    </td>
                    <td class="c-cat">
                      {{ String(r.catalogNumber || '—').replace(/^https?:\/\//, '') }}
                    </td>
                    <td class="c-where">
                      {{ placeOf(r) || '—' }}
                    </td>
                    <td class="c-where">
                      {{ [r.recordedBy, r.year].filter(Boolean).join(', ') || '—' }}
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
            <button
              v-if="shown.length > limit"
              type="button"
              class="cow-ix__more"
              @click="limit += 100"
            >
              Show more ({{ shown.length - limit }} left)
            </button>
          </div>

          <aside
            v-if="selected"
            class="cow-ty2__panel"
            :style="{ transform: `translateY(${panelTop}px)` }"
          >
            <button
              type="button"
              class="cow-ty2__pbig"
              :disabled="!panelImages.length"
              @click="openViewer(selected, pi)"
            >
              <img
                v-if="panelImages[pi]"
                :src="panelImages[pi].card"
                alt=""
              />
              <span v-else>{{ selected.associatedMedia ? 'Loading images…' : 'No image' }}</span>
              <small v-if="panelImages[pi]?.view">{{ panelImages[pi].view }}</small>
            </button>
            <div
              v-if="panelImages.length > 1"
              class="cow-ty2__pthumbs"
            >
              <button
                v-for="(im, i) in panelImages.slice(0, 12)"
                :key="im.id"
                type="button"
                :class="{ 'is-on': i === pi }"
                @click="pi = i"
              >
                <img
                  :src="im.thumb"
                  alt=""
                />
              </button>
            </div>
            <p
              class="cow-ty2__pname"
              v-html="nameHtml(selected)"
            />
            <p class="cow-ty2__pfam">
              {{ selected.family }}
            </p>
            <ul class="cow-ty2__plist">
              <li v-if="selected.typeStatus">
                <span :class="['cow-ty2__kind', `is-${String(selected.typeStatus).toLowerCase()}`]">{{ selected.typeStatus }}</span>
                <span>Type specimen</span>
              </li>
              <li>
                <span class="cow-ty2__kind">Collection</span>
                <span>{{ selected.institutionCode || '—' }}<small>{{ repoName(selected.institutionCode) }}</small></span>
              </li>
              <li>
                <span class="cow-ty2__kind">Number</span>
                <span>
                  <a
                    v-if="/^https?:/.test(selected.catalogNumber || '')"
                    :href="selected.catalogNumber"
                    target="_blank"
                    rel="noopener"
                  >{{ selected.catalogNumber.replace(/^https?:\/\//, '') }}</a>
                  <template v-else>{{ selected.catalogNumber || '—' }}</template>
                </span>
              </li>
              <li v-if="placeOf(selected)">
                <span class="cow-ty2__kind">Locality</span>
                <span>{{ placeOf(selected) }}</span>
              </li>
              <li v-if="selected.recordedBy || selected.year">
                <span class="cow-ty2__kind">Collected</span>
                <span>{{ [selected.recordedBy, selected.year].filter(Boolean).join(', ') }}</span>
              </li>
            </ul>
            <RouterLink
              v-if="selected.otu_id"
              class="cow-ty2__popen"
              :to="{ name: 'otus-id-overview', params: { id: String(selected.otu_id) } }"
            >
              Open the species page →
            </RouterLink>
          </aside>
        </div>

        <!-- literature records -->
        <div
          v-else
          class="cow-ty2__tablewrap"
        >
          <table class="cow-ty2__table">
            <thead>
              <tr>
                <th><button type="button">Species</button></th>
                <th><button type="button">Realm</button></th>
                <th><button type="button">Reference</button></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in shown.slice(0, limit)"
                :key="r.key"
                class="cow-ty2__tr"
                @click="r.otu_id && router.push({ name: 'otus-id-overview', params: { id: String(r.otu_id) } })"
              >
                <td v-html="nameHtml(r)" />
                <td>{{ r.locality || '—' }}</td>
                <td
                  class="c-where"
                  v-html="r.associatedReferences || '—'"
                />
              </tr>
            </tbody>
          </table>
          <button
            v-if="shown.length > limit"
            type="button"
            class="cow-ix__more"
            @click="limit += 100"
          >
            Show more ({{ shown.length - limit }} left)
          </button>
        </div>
      </section>
    </template>

    <!-- image viewer -->
    <Teleport to="body">
      <div
        v-if="viewer"
        class="cow-ty2__viewer"
        @click.self="viewer = null"
      >
        <div class="cow-ty2__vbox">
          <button
            type="button"
            class="cow-ty2__vclose"
            aria-label="Close"
            @click="viewer = null"
          >
            ×
          </button>
          <p
            class="cow-ty2__vtitle"
            v-html="nameHtml(viewer.r)"
          />
          <p
            v-if="!viewer.images.length"
            class="cow-ty__muted"
          >
            Loading images…
          </p>
          <template v-else>
            <div class="cow-ty2__vstage">
              <button
                v-if="viewer.images.length > 1"
                type="button"
                class="cow-ty2__vnav"
                aria-label="Previous"
                @click="viewer.i = (viewer.i + viewer.images.length - 1) % viewer.images.length"
              >
                ‹
              </button>
              <img
                :src="viewer.images[viewer.i].big"
                alt=""
              />
              <button
                v-if="viewer.images.length > 1"
                type="button"
                class="cow-ty2__vnav"
                aria-label="Next"
                @click="viewer.i = (viewer.i + 1) % viewer.images.length"
              >
                ›
              </button>
            </div>
            <p class="cow-ty2__vcap">
              <template v-if="viewer.images[viewer.i].view">{{ viewer.images[viewer.i].view }} · </template>
              {{ viewer.i + 1 }} / {{ viewer.images.length }} ·
              <a
                :href="viewer.images[viewer.i].full"
                target="_blank"
                rel="noopener"
              >Full size</a>
            </p>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'
import { resolveAssetUrl } from '@/utils/url'
import { loadDwc, csv, download } from '../lib/dwc.js'
import { colorAt } from '../lib/realms.js'

const router = useRouter()
const { url: API, project_token: TOKEN, base_url } = __APP_ENV__
const fullDwc = `${API}/dwc_occurrences.csv?project_token=${TOKEN}`
const SUPERFAMILY = 1541972
const CER = ['Ceraphronidae', 'Megaspilidae', 'Stigmaphronidae']

// collections: names and (approximate) places, for the map
const REPOS = {
  USNM: ['Smithsonian National Museum of Natural History, Washington DC', 38.891, -77.026],
  NHRS: ['Swedish Museum of Natural History, Stockholm', 59.369, 18.054],
  PSUC_FEM: ['Frost Entomological Museum, Pennsylvania State University', 40.803, -77.862],
  HNHM: ['Hungarian Natural History Museum, Budapest', 47.487, 19.072],
  MNHN: ['Muséum national d’Histoire naturelle, Paris', 48.844, 2.356],
  NHMUK: ['Natural History Museum, London', 51.496, -0.176],
  CNC: ['Canadian National Collection of Insects, Ottawa', 45.387, -75.712],
  MZHF: ['Finnish Museum of Natural History, Helsinki', 60.171, 24.931]
}
const repoName = (c) => REPOS[c]?.[0] || c || 'Collection not recorded'
const shortRepo = (c) => (REPOS[c] ? REPOS[c][0].split(',')[0] : '')
const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
const nameHtml = (r) => {
  const a = r.scientificNameAuthorship
  const n = String(r.scientificName || 'Name not recorded')
  const bare = (a ? n.replace(a, '') : n).trim()
  return `<i>${esc(bare)}</i>${a ? ` ${esc(a)}` : ''}`
}
const binomial = (r) => String(r.scientificName || '').split(' ').slice(0, 2).join(' ')
const placeOf = (r) => [r.country, r.stateProvince, r.verbatimLocality].filter(Boolean).join(', ').slice(0, 160)

const loading = ref(true)
const rows = ref([])
const valid = ref([])
onMounted(async () => {
  try {
    rows.value = (await loadDwc()).map((r, i) => ({ ...r, key: i }))
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
  loadValid()
  nextTick(drawMap)
  loadQueue()
})

const specimens = computed(() => rows.value.filter((r) => r.basisOfRecord === 'PreservedSpecimen' && CER.includes(r.family)))
const citations = computed(() => rows.value.filter((r) => r.basisOfRecord === 'MaterialCitation' && CER.includes(r.family)))
const imaged = computed(() => specimens.value.filter((r) => r.associatedMedia).length)
const typeCount = computed(() => specimens.value.filter((r) => r.typeStatus).length)
const speciesWithSpecimens = computed(() => new Set(specimens.value.map(binomial)).size)
const validTotal = computed(() => valid.value.length)

const tally = (list, f) => {
  const m = new Map()
  list.forEach((r) => {
    const k = f(r)
    if (k) m.set(k, (m.get(k) || 0) + 1)
  })
  return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n)
}
const collections = computed(() => tally(specimens.value, (r) => r.institutionCode).map((x) => ({ code: x.name, n: x.n, name: repoName(x.name), short: shortRepo(x.name) })))
const realmCounts = computed(() => tally(citations.value, (r) => r.locality))
const realmMax = computed(() => Math.max(1, ...realmCounts.value.map((r) => r.n)))

// valid species per genus (for coverage)
async function loadValid() {
  try {
    const out = []
    for (let page = 1; page < 10; page++) {
      const { data } = await makeAPIRequest.get('/taxon_names', {
        params: { 'taxon_name_id[]': SUPERFAMILY, descendants: true, nomenclature_group: 'Species', validity: true, per: 500, page }
      })
      const list = Array.isArray(data) ? data : []
      out.push(...list.filter((t) => String(t.rank_string || '').endsWith('Species') && t.cached_is_valid !== false))
      if (list.length < 500) break
    }
    valid.value = [...new Map(out.map((t) => [t.cached, t])).values()]
  } catch {
    valid.value = []
  }
}

// ---------- images: per species (OTU), ranked, matched to catalogue numbers ----------
function boxed(png, bw, bh) {
  const m = String(png || '').match(/images\/(\d+)\/scale_to_box\/0\/0\/(\d+)\/(\d+)\//)
  if (!m) return ''
  const [id, w, h] = [m[1], Number(m[2]), Number(m[3])]
  const k = Math.min(1, bw / w, bh / h)
  return `${API}/images/${id}/scale_to_box/0/0/${w}/${h}/${Math.round(w * k)}/${Math.round(h * k)}?project_token=${TOKEN}`
}
function isPhoneFrame(png) {
  const m = String(png || '').match(/scale_to_box\/0\/0\/(\d+)\/(\d+)\//)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => y - x)
  return (a === 4032 && b === 3024) || (a === 4000 && b === 3000) || (a === 4624 && b === 3468)
}
function rankOf(text, png) {
  const t = text.toLowerCase()
  if (/\blabels?\b/.test(t)) return 50
  if (isPhoneFrame(png)) return 40
  if (/whole body|habitus/.test(t)) return 0
  if (/\b(dorsal|lateral)\b/.test(t)) return 1
  if (/\b(ventral|anterior|frontal|head|mesosoma|metasoma)\b/.test(t)) return 10
  return 20
}
const viewName = (label) => {
  const m = String(label || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\s*(.*)$/i)
  return m ? m[1].replace(/\s*\(CollectionObject\)\.?\s*$/, '').replace(/\.$/, '').trim() : ''
}
const otuImages = reactive({}) // otu → ranked images (with label text)
const pending = new Map()
function loadOtu(otu) {
  if (!otu) return Promise.resolve([])
  if (otuImages[otu]) return Promise.resolve(otuImages[otu])
  if (pending.has(otu)) return pending.get(otu)
  const p = makeAPIRequest
    .get(`/otus/${otu}/inventory/images.json`, { params: { extend: ['depictions'], otu_scope: ['all', 'coordinate_otus'] } })
    .then(({ data }) => {
      const list = (data?.image_order || []).filter(Boolean).map((id, i) => {
        const im = data.images[id] || {}
        const label = (im.depictions || []).map((d) => d.label || d.caption || '').join(' ')
        return {
          id,
          i,
          label,
          png: im.original_png,
          thumb: boxed(im.original_png, 160, 120) || im.thumb,
          tile: boxed(im.original_png, 520, 520) || im.medium,
          card: boxed(im.original_png, 640, 480) || im.medium,
          big: boxed(im.original_png, 1600, 1200) || im.medium,
          full: im.original_png ? `${API}/${String(im.original_png).replace(/^\/api\/v1\//, '')}?project_token=${TOKEN}` : im.medium,
          view: viewName(label),
          rank: rankOf(label, im.original_png)
        }
      })
      list.sort((a, b) => a.rank - b.rank || a.i - b.i)
      otuImages[otu] = list
      return list
    })
    .catch(() => (otuImages[otu] = []))
  pending.set(otu, p)
  return p
}
// images of one specimen: those whose depiction names its catalogue number
const imagesOf = (r) => {
  const all = otuImages[r.otu_id] || []
  const cat = String(r.catalogNumber || '')
  const mine = cat ? all.filter((im) => im.label.includes(cat)) : []
  return mine.length ? mine : all
}
const specThumb = (r) => (r.associatedMedia && otuImages[r.otu_id] ? imagesOf(r)[0]?.thumb : '')

// load images of all imaged species, a few at a time (wall first)
const thumbs = reactive({})
async function loadQueue() {
  const otus = [...new Set(wall.value.map((t) => t.otu).concat(specimens.value.filter((r) => r.associatedMedia).map((r) => r.otu_id)))].filter(Boolean)
  const worker = async () => {
    while (otus.length) {
      const otu = otus.shift()
      const list = await loadOtu(otu)
      const t = wall.value.find((x) => x.otu === otu)
      if (t && list[0]) thumbs[t.key] = list[0].tile
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
}

// ---------- 1. wall ----------
const wall = computed(() => {
  const m = new Map()
  specimens.value
    .filter((r) => r.associatedMedia && r.otu_id)
    .forEach((r) => {
      const k = String(r.otu_id)
      if (!m.has(k)) m.set(k, { key: k, otu: r.otu_id, name: binomial(r), genus: r.genus, repos: new Set(), types: 0 })
      const t = m.get(k)
      if (r.institutionCode) t.repos.add(r.institutionCode)
      if (r.typeStatus) t.types++
    })
  // a mix: by genus, alternating, so the wall is varied
  const list = [...m.values()].map((t) => ({ ...t, repos: [...t.repos] }))
  const byG = new Map()
  list.sort((a, b) => a.name.localeCompare(b.name)).forEach((t) => (byG.get(t.genus) || byG.set(t.genus, []).get(t.genus)).push(t))
  const out = []
  let added = true
  while (added) {
    added = false
    byG.forEach((l) => {
      if (l.length) {
        out.push(l.shift())
        added = true
      }
    })
  }
  return out
})
const wallN = ref(24)
// only real specimen views on the wall (no label shots), best views first
const wallReady = computed(() =>
  wall.value
    .map((t, i) => ({ t, i, best: (otuImages[t.otu] || [])[0] }))
    .filter((x) => x.best && x.best.rank < 20)
    .sort((a, b) => Math.min(a.best.rank, 2) - Math.min(b.best.rank, 2) || a.i - b.i)
    .map((x) => x.t)
)
const wallShown = computed(() => wallReady.value.slice(0, wallN.value))

// ---------- 3. map ----------
const mapEl = ref(null)
let map = null
async function drawMap() {
  if (!mapEl.value) return
  try {
    const L = (await import('leaflet')).default
    const world = await (await fetch(resolveAssetUrl('/data/world-realms.json', base_url))).json()
    map = L.map(mapEl.value, { center: [25, 0], zoom: 2, minZoom: 1, maxZoom: 6, zoomSnap: 0.25, scrollWheelZoom: false, maxBounds: [[-75, -200], [88, 220]] })
    map.attributionControl.addAttribution('Countries: Natural Earth · realms assigned by country (approximate)')
    const counts = Object.fromEntries(realmCounts.value.map((r) => [r.name, r.n]))
    L.geoJSON(world, {
      style: (f) => ({
        color: '#ffffff',
        weight: 0.6,
        fillColor: counts[f.properties.realm] ? colorAt(counts[f.properties.realm] / realmMax.value) : '#e2ded4',
        fillOpacity: 0.9
      }),
      onEachFeature: (f, layer) => {
        const n = counts[f.properties.realm]
        if (!n) return
        layer.bindTooltip(`${f.properties.realm}: ${n} literature records`, { sticky: true })
        layer.on('click', () => pickRealm(f.properties.realm))
      }
    }).addTo(map)
    const max = Math.max(1, ...collections.value.map((c) => c.n))
    collections.value.forEach((c) => {
      const p = REPOS[c.code]
      if (!p) return
      L.circleMarker([p[1], p[2]], { radius: 6 + 16 * Math.sqrt(c.n / max), color: '#ffffff', weight: 2, fillColor: '#6c5240', fillOpacity: 0.92 })
        .bindTooltip(`<b>${c.code}</b> ${esc(c.name)}<br>${c.n} specimen records`, { direction: 'top' })
        .on('click', () => pickRepo(c.code))
        .addTo(map)
    })
    map.fitBounds([[-50, -150], [72, 165]])
  } catch {
    /* map unavailable */
  }
}
onBeforeUnmount(() => map?.remove())

// ---------- 4. coverage ----------
const COVER = [
  { key: 'photo', label: 'Specimen with photos', color: '#74866a' },
  { key: 'spec', label: 'Specimen, no photos', color: '#9a9288' },
  { key: 'lit', label: 'Literature records only', color: '#6c5240' },
  { key: 'none', label: 'No records yet', color: '#e7e2d8' }
]
const coverage = computed(() => {
  const g = new Map()
  const get = (genus) => g.get(genus) || g.set(genus, { genus, all: new Set(), photo: new Set(), spec: new Set(), lit: new Set() }).get(genus)
  valid.value.forEach((t) => get(String(t.cached).split(' ')[0]).all.add(t.cached))
  specimens.value.forEach((r) => {
    const x = get(r.genus || binomial(r).split(' ')[0])
    ;(r.associatedMedia ? x.photo : x.spec).add(binomial(r))
  })
  citations.value.forEach((r) => get(r.genus || binomial(r).split(' ')[0]).lit.add(binomial(r)))
  return [...g.values()]
    .map((x) => {
      const photo = x.photo.size
      const spec = [...x.spec].filter((s) => !x.photo.has(s)).length
      const lit = [...x.lit].filter((s) => !x.photo.has(s) && !x.spec.has(s)).length
      const validN = Math.max(x.all.size, photo + spec + lit)
      return {
        genus: x.genus,
        valid: validN,
        withSpec: photo + spec,
        photo,
        spec,
        lit,
        none: Math.max(0, validN - photo - spec - lit),
        title: `${x.genus}: ${validN} species · ${photo} with photographed specimens · ${spec} specimen only · ${lit} literature only`
      }
    })
    .filter((x) => x.valid > 0 && /^[A-Z][a-z]+$/.test(x.genus))
    .sort((a, b) => b.valid - a.valid)
})
const coverMax = computed(() => Math.max(1, ...coverage.value.map((g) => g.valid)))

// ---------- 5. collectors ----------
const withCollector = computed(() => specimens.value.filter((r) => r.recordedBy).length)
const collectors = computed(() => {
  const m = new Map()
  specimens.value.filter((r) => r.recordedBy).forEach((r) => {
    // "H. H. Smith" and "H.H. Smith" are the same person
    const label = String(r.recordedBy).trim()
    const k = label.replace(/\.\s+/g, '.').toLowerCase()
    if (!m.has(k)) m.set(k, { name: label.replace(/\.\s+(?=[A-Z]\.)/g, '.'), n: 0, years: new Set(), where: new Set() })
    const p = m.get(k)
    p.n++
    if (r.year) p.years.add(Number(r.year))
    if (r.country || r.stateProvince) p.where.add(r.country || r.stateProvince)
  })
  return [...m.values()]
    .map((p) => {
      const ys = [...p.years].sort()
      return { name: p.name, n: p.n, years: ys.length ? (ys.length > 1 ? `${ys[0]}–${ys[ys.length - 1]}` : String(ys[0])) : '', where: [...p.where].slice(0, 2).join(', ') }
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 12)
})

// ---------- records ----------
const tab = ref('spec')
const q = ref('')
const family = ref('')
const genus = ref('')
const repo = ref('')
const realm = ref('')
const withPhotos = ref(false)
const typeFilter = ref('all')
const TYPE_OPTS = [
  { key: 'all', label: 'All' },
  { key: 'types', label: 'Types only' },
  { key: 'non', label: 'Non-types' }
]
const limit = ref(100)
const listEl = ref(null)
const base = computed(() => (tab.value === 'spec' ? specimens.value : citations.value))
const families = computed(() => [...new Set(base.value.map((r) => r.family).filter(Boolean))].sort())
const shown = computed(() => {
  const words = q.value.toLowerCase().split(/\s+/).filter(Boolean)
  return base.value.filter((r) => {
    if (family.value && r.family !== family.value) return false
    if (genus.value && r.genus !== genus.value) return false
    if (tab.value === 'spec') {
      if (typeFilter.value === 'types' && !r.typeStatus) return false
      if (typeFilter.value === 'non' && r.typeStatus) return false
      if (withPhotos.value && !r.associatedMedia) return false
      if (repo.value && r.institutionCode !== repo.value) return false
    } else if (realm.value && r.locality !== realm.value) return false
    if (!words.length) return true
    const hay = `${r.scientificName} ${r.catalogNumber} ${r.institutionCode} ${r.recordedBy} ${placeOf(r)} ${r.locality} ${String(r.associatedReferences || '').replace(/<[^>]+>/g, '')}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
})
const pills = computed(() =>
  [
    genus.value && { label: `<i>${esc(genus.value)}</i>`, clear: () => (genus.value = '') },
    tab.value === 'spec' && repo.value && { label: esc(repo.value), clear: () => (repo.value = '') },
    tab.value === 'lit' && realm.value && { label: esc(realm.value), clear: () => (realm.value = '') }
  ].filter(Boolean)
)
watch([tab, q, family, genus, repo, realm, withPhotos, typeFilter], () => (limit.value = 100))

const COLS = [
  { key: 'name', label: 'Species' },
  { key: 'type', label: 'Type' },
  { key: 'repo', label: 'Collection' },
  { key: 'cat', label: 'Catalogue no.' },
  { key: 'place', label: 'Locality' },
  { key: 'who', label: 'Collected' }
]
const TYPE_RANK = { holotype: 0, neotype: 1, lectotype: 2, syntype: 3, paralectotype: 4, paratype: 5 }
const typeRank = (r) => (r.typeStatus ? TYPE_RANK[String(r.typeStatus).toLowerCase()] ?? 6 : 9)
const cmp = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true })
const sortKey = ref('name')
const sortDir = ref(1)
function sortBy(k) {
  if (sortKey.value === k) sortDir.value = -sortDir.value
  else {
    sortKey.value = k
    sortDir.value = 1
  }
}
const groupedSpec = computed(() => {
  const d = sortDir.value
  const byName = (a, b) => cmp(a.scientificName, b.scientificName) || typeRank(a) - typeRank(b) || cmp(a.catalogNumber, b.catalogNumber)
  const f = {
    name: byName,
    type: (a, b) => typeRank(a) - typeRank(b) || byName(a, b),
    repo: (a, b) => cmp(a.institutionCode, b.institutionCode) || cmp(a.catalogNumber, b.catalogNumber),
    cat: (a, b) => cmp(a.catalogNumber, b.catalogNumber),
    place: (a, b) => (placeOf(a) ? 0 : 1) - (placeOf(b) ? 0 : 1) || cmp(placeOf(a), placeOf(b)),
    who: (a, b) => (a.year ? 0 : 1) - (b.year ? 0 : 1) || (Number(a.year) || 0) - (Number(b.year) || 0) || cmp(a.recordedBy, b.recordedBy)
  }[sortKey.value]
  const list = [...shown.value].sort((a, b) => cmp(a.genus, b.genus) || d * f(a, b)).slice(0, limit.value)
  const m = new Map()
  list.forEach((r) => (m.get(r.genus) || m.set(r.genus, { genus: r.genus || '—', family: r.family, items: [] }).get(r.genus)).items.push(r))
  return [...m.values()]
})

// panel
const splitEl = ref(null)
const sel = ref(null)
const pi = ref(0)
const panelTop = ref(0)
const selected = computed(() => specimens.value.find((r) => r.key === sel.value) || null)
const panelImages = computed(() => (selected.value && selected.value.associatedMedia ? imagesOf(selected.value) : []))
function select(r, e) {
  if (window.innerWidth < 1100) return openViewer(r, 0)
  sel.value = r.key
  pi.value = 0
  loadOtu(r.otu_id)
  const box = splitEl.value?.getBoundingClientRect()
  const row = e?.currentTarget?.getBoundingClientRect()
  if (box && row) {
    const panelH = splitEl.value.querySelector('.cow-ty2__panel')?.offsetHeight || 520
    let top = row.top - box.top - 40
    top = Math.min(top, -box.top + window.innerHeight - panelH - 16)
    top = Math.max(top, -box.top + 72)
    panelTop.value = Math.max(0, Math.min(top, box.height - panelH))
  }
}
watch(shown, (list) => {
  if (tab.value === 'spec' && list.length && !list.some((r) => r.key === sel.value)) {
    const first = groupedSpec.value[0]?.items[0]
    if (first) {
      sel.value = first.key
      panelTop.value = 0
      loadOtu(first.otu_id)
    }
  }
}, { immediate: true })

// viewer
const viewer = ref(null)
async function openViewer(r, i = 0) {
  if (!r.associatedMedia) return
  viewer.value = { r, i, images: [] }
  await loadOtu(r.otu_id)
  if (viewer.value?.r.key === r.key) viewer.value.images = imagesOf(r)
}
function onKey(e) {
  if (!viewer.value) return
  const n = viewer.value.images.length
  if (e.key === 'Escape') viewer.value = null
  else if (e.key === 'ArrowRight' && n) viewer.value.i = (viewer.value.i + 1) % n
  else if (e.key === 'ArrowLeft' && n) viewer.value.i = (viewer.value.i + n - 1) % n
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// filters from the sections above
async function toList() {
  await nextTick()
  listEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function focusSpecies(t) {
  tab.value = 'spec'
  q.value = t.name
  toList()
}
function pickRealm(name) {
  tab.value = 'lit'
  realm.value = realm.value === name ? '' : name
  toList()
}
function pickRepo(code) {
  tab.value = 'spec'
  repo.value = repo.value === code ? '' : code
  toList()
}
function pickGenus(g) {
  genus.value = genus.value === g ? '' : g
  toList()
}
function pickCollector(name) {
  tab.value = 'spec'
  const key = name.split(/[\s.]+/).filter(Boolean).pop()
  q.value = q.value === key ? '' : key
  toList()
}

function downloadShown() {
  download(
    csv(shown.value, [
      ['basisOfRecord', (r) => r.basisOfRecord],
      ['scientificName', (r) => r.scientificName],
      ['family', (r) => r.family],
      ['genus', (r) => r.genus],
      ['typeStatus', (r) => r.typeStatus],
      ['institutionCode', (r) => r.institutionCode],
      ['catalogNumber', (r) => r.catalogNumber],
      ['country', (r) => r.country],
      ['stateProvince', (r) => r.stateProvince],
      ['verbatimLocality', (r) => r.verbatimLocality],
      ['locality', (r) => r.locality],
      ['recordedBy', (r) => r.recordedBy],
      ['year', (r) => r.year],
      ['associatedReferences', (r) => String(r.associatedReferences || '').replace(/<[^>]+>/g, '')]
    ]),
    `ceraphronoidea-${tab.value === 'spec' ? 'specimen-records' : 'literature-records'}.csv`
  )
}
</script>
