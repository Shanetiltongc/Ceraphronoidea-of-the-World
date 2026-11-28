<template>
  <div class="cow-ty2">
    <p
      v-if="loading"
      class="cow-ty__muted"
    >
      Loading type specimens…
    </p>
    <template v-else>
      <!-- overview: numbers + where the types are -->
      <section class="cow-ty2__top">
        <div class="cow-ty2__nums">
          <div>
            <b>{{ species.length }}</b>
            <span>names with types</span>
          </div>
          <div
            v-for="k in kinds"
            :key="k.name"
          >
            <b>{{ k.n }}</b>
            <span>{{ k.name }}{{ k.n === 1 ? '' : 's' }}</span>
          </div>
          <div>
            <b>{{ withImages }}</b>
            <span>imaged</span>
          </div>
        </div>
        <div class="cow-ty2__repos">
          <p class="cow-ty2__kicker">Where the types are</p>
          <button
            v-for="r in repos"
            :key="r.code"
            type="button"
            :class="['cow-ty2__rbar', { 'is-on': repo === r.code, 'is-dim': repo && repo !== r.code }]"
            :title="r.name"
            @click="repo = repo === r.code ? '' : r.code"
          >
            <span class="cow-ty2__rname"><b>{{ r.code }}</b> {{ r.name }}</span>
            <span class="cow-ty2__rtrack"><span :style="{ width: `${(r.n / repoMax) * 100}%` }" /></span>
            <span class="cow-ty2__rn">{{ r.n }}</span>
          </button>
        </div>
      </section>

      <!-- tools -->
      <div class="cow-ty2__tools">
        <div
          class="cow-ty2__seg cow-ty2__viewsw"
          role="group"
          aria-label="View"
        >
          <button
            type="button"
            :class="{ 'is-on': view === 'list' }"
            @click="view = 'list'"
          >
            List
          </button>
          <button
            type="button"
            :class="{ 'is-on': view === 'gallery' }"
            @click="view = 'gallery'"
          >
            Gallery
          </button>
        </div>
        <input
          v-model="q"
          type="search"
          placeholder="Search a name, genus or catalogue number…"
          aria-label="Search types"
        />
        <div class="cow-ty2__seg">
          <button
            v-for="k in [{ name: 'All' }, ...kinds]"
            :key="k.name"
            type="button"
            :class="{ 'is-on': kind === k.name }"
            @click="kind = k.name"
          >
            {{ k.name === 'All' ? 'All types' : `${cap(k.name)}s` }}
          </button>
        </div>
        <label class="cow-ty2__chk">
          <input
            v-model="onlyImaged"
            type="checkbox"
          />
          With images
        </label>
        <button
          v-if="repo"
          type="button"
          class="cow-ix__pill"
          @click="repo = ''"
        >
          {{ repo }} ✕
        </button>
        <button
          type="button"
          class="cow-ix__link"
          @click="downloadTypes"
        >
          Download CSV
        </button>
      </div>
      <p class="cow-ty__muted">
        {{ shownCount.names }} name{{ shownCount.names === 1 ? '' : 's' }} · {{ shownCount.types }} type specimen{{ shownCount.types === 1 ? '' : 's' }}
      </p>

      <!-- catalogue: family → genus → name -->
      <template v-if="view === 'gallery'">
      <div
        v-for="f in grouped"
        :key="f.family"
        class="cow-ty2__family"
      >
        <h2 class="cow-ty2__fam">
          {{ f.family }} <small>{{ f.n }}</small>
        </h2>
        <div
          v-for="g in f.genera"
          :key="g.genus"
          class="cow-ty2__genus"
        >
          <h3><i>{{ g.genus }}</i> <small>{{ g.items.length }}</small></h3>
          <div
            v-if="view === 'gallery'"
            class="cow-ty2__cards"
          >
            <article
              v-for="s in g.items"
              :key="s.key"
              class="cow-ty2__card"
            >
              <button
                type="button"
                class="cow-ty2__cimg"
                :disabled="!s.media.length"
                :aria-label="s.media.length ? `Images of ${s.plain}` : 'No image'"
                @click="openViewer(s)"
              >
                <img
                  v-if="thumbs[s.key]"
                  :src="thumbs[s.key]"
                  alt=""
                  loading="lazy"
                />
                <span v-else>{{ s.media.length ? '…' : 'No image' }}</span>
                <small v-if="(gallery[s.key] || s.media).length > 1">{{ (gallery[s.key] || s.media).length }} images</small>
              </button>
              <div class="cow-ty2__cbody">
                <RouterLink
                  v-if="s.otu"
                  class="cow-ty2__name"
                  :to="{ name: 'otus-id-overview', params: { id: String(s.otu) } }"
                  v-html="s.html"
                />
                <span
                  v-else
                  class="cow-ty2__name"
                  v-html="s.html"
                />
                <p class="cow-ty2__cmeta">
                  <span :class="['cow-ty2__kind', `is-${primaryOf(s)[0].kind}`]">{{ primaryOf(s)[0].kind }}</span>
                  <span
                    class="cow-ty2__repo"
                    :title="repoName(primaryOf(s)[0].repo)"
                  >{{ primaryOf(s)[0].repo || '—' }}</span>
                  <span
                    v-if="s.types.length > 1"
                    class="cow-ty2__plus"
                  >+ {{ s.types.length - 1 }} more</span>
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>
      </template>
      <!-- list: table on the left, preview panel on the right -->
      <div
        v-else
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
                  :class="`c-${c.key}`"
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
            <tbody
              v-for="f in grouped"
              :key="f.family"
            >
              <tr class="cow-ty2__famrow">
                <th :colspan="COLS.length">
                  {{ f.family }} <small>{{ f.n }}</small>
                </th>
              </tr>
              <template
                v-for="g in f.genera"
                :key="g.genus"
              >
                <tr class="cow-ty2__genrow">
                  <th :colspan="COLS.length">
                    <i>{{ g.genus }}</i> <small>{{ g.items.length }}</small>
                  </th>
                </tr>
                <tr
                  v-for="s in sortRows(g.items)"
                  :key="s.key"
                  :class="['cow-ty2__tr', { 'is-sel': sel === s.key }]"
                  tabindex="0"
                  @click="select(s, $event)"
                  @keydown.enter="select(s, $event)"
                >
                  <td class="c-name">
                    <span class="cow-ty2__mini">
                      <img
                        v-if="thumbs[s.key]"
                        :src="thumbs[s.key]"
                        alt=""
                        loading="lazy"
                      />
                    </span>
                    <span v-html="s.html" />
                  </td>
                  <td class="c-type">
                    <span :class="['cow-ty2__kind', `is-${primaryOf(s)[0].kind}`]">{{ primaryOf(s)[0].kind }}</span>
                    <small v-if="s.types.length > 1">+ {{ s.types.length - 1 }}</small>
                  </td>
                  <td
                    class="c-repo"
                    :title="repoName(primaryOf(s)[0].repo)"
                  >
                    <b>{{ primaryOf(s)[0].repo || '—' }}</b> <span>{{ shortRepo(primaryOf(s)[0].repo) }}</span>
                  </td>
                  <td class="c-cat">
                    {{ primaryOf(s)[0].cat.replace(/^https?:\/\//, '') || '—' }}
                  </td>
                  <td class="c-where">
                    {{ s.where || '—' }}
                  </td>
                  <td class="c-img">
                    {{ (gallery[s.key] || s.media).length || '—' }}
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
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
              :alt="selected.plain"
            />
            <span v-else>{{ selected.media.length ? 'Loading images…' : 'No image' }}</span>
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
            <button
              v-if="panelImages.length > 12"
              type="button"
              class="cow-ty2__pall"
              @click="openViewer(selected, 0)"
            >
              all {{ panelImages.length }}
            </button>
          </div>
          <p
            class="cow-ty2__pname"
            v-html="selected.html"
          />
          <p class="cow-ty2__pfam">
            {{ selected.family }}
          </p>
          <ul class="cow-ty2__plist">
            <li
              v-for="t in selected.types"
              :key="t.key"
            >
              <span :class="['cow-ty2__kind', `is-${t.kind}`]">{{ t.kind }}</span>
              <span>
                <a
                  v-if="/^https?:/.test(t.cat)"
                  :href="t.cat"
                  target="_blank"
                  rel="noopener"
                >{{ t.cat.replace(/^https?:\/\//, '') }}</a>
                <template v-else>{{ t.cat || 'no number' }}</template>
                <small>{{ repoName(t.repo) }}</small>
              </span>
            </li>
          </ul>
          <p
            v-if="selected.where"
            class="cow-ty2__pwhere"
          >
            <span>Type locality</span> {{ selected.where }}
          </p>
          <RouterLink
            v-if="selected.otu"
            class="cow-ty2__popen"
            :to="{ name: 'otus-id-overview', params: { id: String(selected.otu) } }"
          >
            Open the species page →
          </RouterLink>
        </aside>
      </div>
      <p
        v-if="!grouped.length"
        class="cow-ty__muted"
      >
        No type specimens match.
      </p>
      <p class="cow-ix__note">
        Type specimens recorded in TaxonWorks with a catalogue number. Hover a repository code for its full name.
      </p>
    </template>

    <!-- image viewer -->
    <Teleport to="body">
      <div
        v-if="viewer"
        class="cow-ty2__viewer"
        @click.self="viewer = null"
        @keydown.esc="viewer = null"
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
            v-html="viewer.s.html"
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
                :alt="viewer.s.plain"
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
              <template v-if="viewer.images[viewer.i].type">
                <b>{{ cap(viewer.images[viewer.i].type.kind) }}</b> {{ viewer.images[viewer.i].type.repo }} {{ viewer.images[viewer.i].type.cat }} ·
              </template>
              <template v-if="viewer.images[viewer.i].view">{{ viewer.images[viewer.i].view }} · </template>
              {{ viewer.i + 1 }} / {{ viewer.images.length }} ·
              <a
                :href="viewer.images[viewer.i].full"
                target="_blank"
                rel="noopener"
              >Full size</a>
            </p>
            <div class="cow-ty2__vthumbs">
              <button
                v-for="(im, i) in viewer.images"
                :key="im.id"
                type="button"
                :class="{ 'is-on': i === viewer.i }"
                @click="viewer.i = i"
              >
                <img
                  :src="im.thumb"
                  alt=""
                />
              </button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import { loadDwc, csv, download } from '../lib/dwc.js'

const KIND_ORDER = ['holotype', 'neotype', 'lectotype', 'syntype', 'paralectotype', 'paratype']
const REPOS = {
  USNM: 'Smithsonian National Museum of Natural History, Washington DC',
  NHRS: 'Swedish Museum of Natural History, Stockholm',
  PSUC_FEM: 'Frost Entomological Museum, Pennsylvania State University',
  HNHM: 'Hungarian Natural History Museum, Budapest',
  MNHN: 'Muséum national d’Histoire naturelle, Paris',
  NHMUK: 'Natural History Museum, London',
  CNC: 'Canadian National Collection of Insects, Ottawa',
  MZHF: 'Finnish Museum of Natural History, Helsinki',
  ZSM: 'Zoologische Staatssammlung München',
  RBINS: 'Royal Belgian Institute of Natural Sciences, Brussels',
  IRSNB: 'Royal Belgian Institute of Natural Sciences, Brussels',
  MCZ: 'Museum of Comparative Zoology, Harvard',
  BMNH: 'Natural History Museum, London',
  ZMUC: 'Natural History Museum of Denmark, Copenhagen',
  NMW: 'Naturhistorisches Museum Wien'
}
const repoName = (c) => REPOS[c] || c || 'Repository not recorded'
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1)
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

const loading = ref(true)
const rows = ref([])
const otuNames = ref({})
const q = ref('')
const kind = ref('All')
const repo = ref('')
const onlyImaged = ref(false)
const thumbs = reactive({})
const viewer = ref(null)

onMounted(async () => {
  try {
    rows.value = await loadDwc()
    // names missing in the DwC export: take them from the OTU
    const missing = [...new Set(rows.value.filter((r) => r.typeStatus && !r.scientificName && r.otu_id).map((r) => r.otu_id))]
    if (missing.length) {
      const { data } = await makeAPIRequest.get('/otus', { params: { otu_id: missing } })
      const names = {}
      ;(data || []).forEach((o) => {
        const tag = String(o.object_tag || '').split(/<em>now<\/em>/)[0]
        names[o.id] = tag.replace(/<(?!\/?i>)[^>]+>/g, '').trim()
      })
      otuNames.value = names
    }
  } catch {
    /* keep what loaded */
  } finally {
    loading.value = false
  }
})

const typeRows = computed(() => rows.value.filter((r) => r.typeStatus))
const kindOf = (r) => String(r.typeStatus).toLowerCase().split(/[\s;|]/)[0]
const mediaOf = (r) => String(r.associatedMedia || '').split('|').map((x) => x.trim()).filter(Boolean)

// one entry per name, with all its types
const species = computed(() => {
  const m = new Map()
  typeRows.value.forEach((r, i) => {
    const key = String(r.otu_id || r.scientificName || `x${i}`)
    if (!m.has(key)) {
      const html = r.scientificName
        ? `<i>${esc((r.scientificNameAuthorship ? r.scientificName.replace(r.scientificNameAuthorship, '') : r.scientificName).trim())}</i>${r.scientificNameAuthorship ? ` ${esc(r.scientificNameAuthorship)}` : ''}`
        : otuNames.value[r.otu_id] || '<i>Name not recorded</i>'
      m.set(key, {
        key,
        otu: r.otu_id,
        html,
        plain: html.replace(/<[^>]+>/g, ''),
        family: r.family || 'Family not recorded',
        genus: r.genus || html.replace(/<[^>]+>/g, '').split(' ')[0],
        types: [],
        media: [],
        where: ''
      })
    }
    const s = m.get(key)
    const t = { key: i, kind: kindOf(r), repo: r.institutionCode || '', cat: r.catalogNumber || '', media: mediaOf(r) }
    s.types.push(t)
    t.media.forEach((u) => s.media.push({ url: u, t }))
    if (!s.where || KIND_ORDER.indexOf(t.kind) === 0) {
      const w = [r.country, r.stateProvince, r.verbatimLocality].filter(Boolean).join(', ')
      if (w) s.where = w.length > 160 ? `${w.slice(0, 157)}…` : w
    }
  })
  return [...m.values()].map((s) => {
    s.types.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.cat.localeCompare(b.cat, undefined, { numeric: true }))
    s.media.sort((a, b) => KIND_ORDER.indexOf(a.t.kind) - KIND_ORDER.indexOf(b.t.kind))
    return s
  })
})

const kinds = computed(() => {
  const m = new Map()
  typeRows.value.forEach((r) => m.set(kindOf(r), (m.get(kindOf(r)) || 0) + 1))
  return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => KIND_ORDER.indexOf(a.name) - KIND_ORDER.indexOf(b.name))
})
const withImages = computed(() => species.value.filter((s) => s.media.length).length)
const repos = computed(() => {
  const m = new Map()
  typeRows.value.forEach((r) => m.set(r.institutionCode || '—', (m.get(r.institutionCode || '—') || 0) + 1))
  return [...m].map(([code, n]) => ({ code, n, name: repoName(code === '—' ? '' : code) })).sort((a, b) => b.n - a.n)
})
const repoMax = computed(() => Math.max(1, ...repos.value.map((r) => r.n)))

// filtered: names keep only the types that match
const shown = computed(() => {
  const words = q.value.toLowerCase().split(/\s+/).filter(Boolean)
  return species.value
    .map((s) => ({ ...s, types: s.types.filter((t) => (kind.value === 'All' || t.kind === kind.value) && (!repo.value || (t.repo || '—') === repo.value)) }))
    .filter(
      (s) =>
        s.types.length &&
        (!onlyImaged.value || s.media.length) &&
        (!words.length || words.every((w) => `${s.plain} ${s.family} ${s.types.map((t) => `${t.repo} ${t.cat}`).join(' ')}`.toLowerCase().includes(w)))
    )
})
const shownCount = computed(() => ({ names: shown.value.length, types: shown.value.reduce((n, s) => n + s.types.length, 0) }))
const grouped = computed(() => {
  const fam = new Map()
  shown.value.forEach((s) => {
    if (!fam.has(s.family)) fam.set(s.family, new Map())
    const gm = fam.get(s.family)
    if (!gm.has(s.genus)) gm.set(s.genus, [])
    gm.get(s.genus).push(s)
  })
  return [...fam]
    .map(([family, gm]) => ({
      family,
      n: [...gm.values()].reduce((t, l) => t + l.length, 0),
      genera: [...gm].map(([genus, items]) => ({ genus, items: items.sort((a, b) => a.plain.localeCompare(b.plain)) })).sort((a, b) => a.genus.localeCompare(b.genus))
    }))
    .sort((a, b) => a.family.localeCompare(b.family))
})

// images: per name, from its OTU, with depictions (to rank them and tell which type)
const { url: API, project_token: TOKEN } = __APP_ENV__
// a scaled copy from TaxonWorks (fast to load)
function boxed(png, bw, bh) {
  const m = String(png || '').match(/images\/(\d+)\/scale_to_box\/0\/0\/(\d+)\/(\d+)\//)
  if (!m) return ''
  const [id, w, h] = [m[1], Number(m[2]), Number(m[3])]
  const k = Math.min(1, bw / w, bh / h)
  return `${API}/images/${id}/scale_to_box/0/0/${w}/${h}/${Math.round(w * k)}/${Math.round(h * k)}?project_token=${TOKEN}`
}
// phone-camera frames are, in this project, snapshots of labels
function isPhoneFrame(png) {
  const m = String(png || '').match(/scale_to_box\/0\/0\/(\d+)\/(\d+)\//)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => y - x)
  return (a === 4032 && b === 3024) || (a === 4000 && b === 3000) || (a === 4624 && b === 3468)
}
// habitus first, details next, labels last
function rankOf(text, png) {
  const t = text.toLowerCase()
  if (/\blabels?\b/.test(t)) return 50
  if (isPhoneFrame(png)) return 40
  if (/whole body|habitus/.test(t)) return 0
  if (/\b(dorsal|lateral)\b/.test(t)) return 1
  if (/\b(ventral|anterior|frontal|head|mesosoma|metasoma)\b/.test(t)) return 10
  return 20
}
// "CollectionObject 1; NHMUK010197852, uuid: Whole Body 10X. (CollectionObject)." → "Whole Body 10X"
const viewName = (label) => {
  const m = String(label || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\s*(.*)$/i)
  return m ? m[1].replace(/\s*\(CollectionObject\)\.?\s*$/, '').replace(/\.$/, '').trim() : ''
}

const gallery = reactive({}) // key → ranked images
const pending = new Map()
function loadImages(s) {
  if (gallery[s.key]) return Promise.resolve(gallery[s.key])
  if (pending.has(s.key)) return pending.get(s.key)
  const p = (async () => {
    if (!s.otu) return []
    try {
      const { data } = await makeAPIRequest.get(`/otus/${s.otu}/inventory/images.json`, {
        params: { extend: ['depictions'], otu_scope: ['all', 'coordinate_otus'] }
      })
      const cats = s.types.filter((t) => t.cat)
      let list = (data?.image_order || []).filter(Boolean).map((id, i) => {
        const im = data.images[id] || {}
        const label = (im.depictions || []).map((d) => d.label || d.caption || '').join(' ')
        const type = cats.find((t) => label.includes(t.cat))
        return {
          id,
          i,
          png: im.original_png,
          thumb: boxed(im.original_png, 160, 120) || im.thumb,
          card: boxed(im.original_png, 640, 480) || im.medium,
          big: boxed(im.original_png, 1600, 1200) || im.medium,
          full: im.original_png ? `${API}/${String(im.original_png).replace(/^\/api\/v1\//, '')}?project_token=${TOKEN}` : im.medium,
          view: viewName(label),
          type,
          rank: rankOf(label, im.original_png)
        }
      })
      // keep the type specimens' images when they can be told apart
      if (list.some((x) => x.type)) list = list.filter((x) => x.type)
      list.sort((a, b) => a.rank - b.rank || KIND_ORDER.indexOf(a.type?.kind) - KIND_ORDER.indexOf(b.type?.kind) || a.i - b.i)
      gallery[s.key] = list
      if (list[0]) thumbs[s.key] = boxed(list[0].png, 640, 480) || list[0].card
      return list
    } catch {
      return []
    }
  })()
  pending.set(s.key, p)
  return p
}
// load in page order, a few at a time
let queued = false
async function loadThumbs() {
  if (queued || !species.value.length) return
  queued = true
  const todo = grouped.value.flatMap((f) => f.genera.flatMap((g) => g.items)).filter((s) => s.media.length)
  const worker = async () => {
    while (todo.length) await loadImages(todo.shift())
  }
  await Promise.all(Array.from({ length: 6 }, worker))
}
watch(loading, (l) => !l && loadThumbs())

async function openViewer(s, i = 0) {
  if (!s.media.length) return
  viewer.value = { s, i, images: [] }
  const list = await loadImages(s)
  if (viewer.value?.s.key === s.key) viewer.value.images = list
}

// list table: columns and sorting (within each genus)
const COLS = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'repo', label: 'Museum' },
  { key: 'cat', label: 'Catalogue no.' },
  { key: 'where', label: 'Type locality' },
  { key: 'img', label: 'Images' }
]
const sortKey = ref('name')
const sortDir = ref(1)
function sortBy(k) {
  if (sortKey.value === k) sortDir.value = -sortDir.value
  else {
    sortKey.value = k
    sortDir.value = k === 'img' ? -1 : 1
  }
}
const SORTS = {
  name: (s) => s.plain,
  type: (s) => KIND_ORDER.indexOf(primaryOf(s)[0].kind),
  repo: (s) => primaryOf(s)[0].repo || '~',
  cat: (s) => primaryOf(s)[0].cat || '~',
  where: (s) => s.where || '~',
  img: (s) => (gallery[s.key] || s.media).length
}
function sortRows(items) {
  const f = SORTS[sortKey.value]
  return [...items].sort((a, b) => {
    const x = f(a)
    const y = f(b)
    const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })
    return c * sortDir.value || a.plain.localeCompare(b.plain)
  })
}
const shortRepo = (c) => (REPOS[c] ? REPOS[c].split(',')[0] : '')

// preview panel: sits next to the clicked row (it does not follow the page)
const splitEl = ref(null)
const sel = ref('')
const pi = ref(0)
const panelTop = ref(0)
const selected = computed(() => shown.value.find((s) => s.key === sel.value) || null)
const panelImages = computed(() => (selected.value ? gallery[selected.value.key] || [] : []))
function select(s, e) {
  // narrow screens have no panel: open the images instead
  if (window.innerWidth < 1100) return openViewer(s)
  sel.value = s.key
  pi.value = 0
  loadImages(s)
  const box = splitEl.value?.getBoundingClientRect()
  const row = e?.currentTarget?.getBoundingClientRect()
  if (box && row) {
    const panelH = splitEl.value.querySelector('.cow-ty2__panel')?.offsetHeight || 520
    // next to the row, but inside the screen (below the header), and inside the table
    let top = row.top - box.top - 40
    top = Math.min(top, -box.top + window.innerHeight - panelH - 16)
    top = Math.max(top, -box.top + 72)
    panelTop.value = Math.max(0, Math.min(top, box.height - panelH))
  }
}
// the first name is shown until something is clicked
watch(shown, (list) => {
  if (list.length && !list.some((s) => s.key === sel.value)) {
    const first = grouped.value[0]?.genera[0]?.items[0]
    if (first) {
      sel.value = first.key
      panelTop.value = 0
      loadImages(first)
    }
  }
})

// paratypes folded: holotype, lectotype, neotype, syntypes first
const SECONDARY = ['paratype', 'paralectotype']
const open = reactive({})
const primaryOf = (s) => {
  const p = s.types.filter((t) => !SECONDARY.includes(t.kind))
  return p.length ? p : s.types.slice(0, 1)
}
const hiddenOf = (s) => (open[s.key] ? [] : s.types.filter((t) => !primaryOf(s).includes(t)))
const visibleTypes = (s) => (open[s.key] ? s.types : primaryOf(s))
const view = ref('list')
function onKey(e) {
  if (!viewer.value) return
  const n = viewer.value.images.length
  if (e.key === 'Escape') viewer.value = null
  else if (e.key === 'ArrowRight' && n) viewer.value.i = (viewer.value.i + 1) % n
  else if (e.key === 'ArrowLeft' && n) viewer.value.i = (viewer.value.i + n - 1) % n
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function downloadTypes() {
  const flat = shown.value.flatMap((s) => s.types.map((t) => ({ s, t })))
  download(
    csv(flat, [
      ['Name', (x) => x.s.plain],
      ['Family', (x) => x.s.family],
      ['Type', (x) => x.t.kind],
      ['Repository', (x) => x.t.repo],
      ['Repository name', (x) => repoName(x.t.repo)],
      ['Catalogue number', (x) => x.t.cat],
      ['Images', (x) => x.t.media.length],
      ['Locality', (x) => x.s.where]
    ]),
    'ceraphronoidea-types.csv'
  )
}
</script>
