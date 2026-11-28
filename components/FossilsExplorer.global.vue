<template>
  <div class="cow-fo2">
    <p
      v-if="loading"
      class="cow-ty__muted"
    >
      Loading fossil species…
    </p>
    <template v-else>
      <!-- numbers -->
      <section class="cow-fo2__nums">
        <div>
          <b>{{ rows.length }}</b>
          <span>fossil species</span>
        </div>
        <div>
          <b>{{ genera }}</b>
          <span>genera</span>
        </div>
        <div>
          <b>{{ usedDeposits.length }}</b>
          <span>deposits</span>
        </div>
        <div>
          <b>~{{ oldest }} Ma</b>
          <span>oldest record</span>
        </div>
        <div class="cow-fo2__extinct">
          <b>†</b>
          <span>
            <RouterLink :to="{ name: 'otus-id-overview', params: { id: String(STIGMA_OTU) } }">Stigmaphronidae</RouterLink>,
            an extinct family known only from Cretaceous amber and rock
          </span>
        </div>
      </section>

      <!-- timeline -->
      <section class="cow-fo2__block">
        <h2 class="cow-fo2__h2">Through time</h2>
        <p class="cow-fo2__help">
          Each dot is a species, placed at the age of the deposit it was found in. Hover for details, click to open the
          species; click a deposit name to list its species below.
        </p>
        <div
          ref="stage"
          class="cow-fo2__stage"
        >
          <svg
            :viewBox="`0 0 ${W} ${H}`"
            class="cow-fo2__svg"
            role="img"
            aria-label="Timeline of fossil Ceraphronoidea"
          >
            <!-- geological periods: a coloured strip on top, faint bands below -->
            <g
              v-for="p in PERIODS_C"
              :key="p.name"
            >
              <rect
                :x="x(Math.min(p.from, MAX))"
                :y="STRIP_Y"
                :width="x(p.to) - x(Math.min(p.from, MAX))"
                :height="STRIP_H"
                :fill="p.color"
                class="cow-fo2__strip"
              />
              <text
                :x="(x(Math.min(p.from, MAX)) + x(p.to)) / 2"
                :y="STRIP_Y + STRIP_H / 2 + 4"
                text-anchor="middle"
                class="cow-fo2__stripname"
              >
                {{ x(p.to) - x(Math.min(p.from, MAX)) > 110 ? p.name : x(p.to) - x(Math.min(p.from, MAX)) > 40 ? p.abbr : '' }}
              </text>
              <rect
                :x="x(Math.min(p.from, MAX))"
                :y="LANES_Y"
                :width="x(p.to) - x(Math.min(p.from, MAX))"
                :height="FAMILIES.length * LANE"
                :fill="p.color"
                class="cow-fo2__band"
              />
            </g>

            <!-- family lanes -->
            <g
              v-for="(l, li) in lanes"
              :key="l.family"
              :class="`f-${l.family}`"
            >
              <rect
                :x="0"
                :y="LANES_Y + li * LANE"
                :width="LEFT - 16"
                :height="LANE"
                class="cow-fo2__lanebg"
              />
              <line
                :x1="0"
                :x2="W"
                :y1="LANES_Y + (li + 1) * LANE"
                :y2="LANES_Y + (li + 1) * LANE"
                class="cow-fo2__lanesep"
              />
              <text
                :x="18"
                :y="laneY(li) - 4"
                class="cow-fo2__lane"
              >
                {{ l.family }}
              </text>
              <text
                :x="18"
                :y="laneY(li) + 14"
                class="cow-fo2__lanesub"
              >
                {{ l.n }} fossil species{{ l.extinct ? ' · extinct' : ' · living' }}
              </text>
              <rect
                :x="10"
                :y="LANES_Y + li * LANE + 18"
                width="3"
                :height="LANE - 36"
                rx="1.5"
                class="cow-fo2__lanemark"
              />
              <!-- known range -->
              <line
                v-if="l.from !== null"
                :x1="x(l.from)"
                :x2="x(l.to)"
                :y1="laneY(li)"
                :y2="laneY(li)"
                :class="['cow-fo2__range', { 'is-extinct': l.extinct }]"
              />
              <text
                v-if="l.extinct && l.from !== null"
                :x="x(l.to) + 14"
                :y="laneY(li) + 5"
                class="cow-fo2__dagger2"
              >
                †
              </text>
              <g
                v-if="!l.extinct"
                :transform="`translate(${x(0)},${laneY(li)})`"
              >
                <path
                  d="M -2 -6 L 8 0 L -2 6 Z"
                  class="cow-fo2__arrow"
                />
              </g>
            </g>

            <!-- K–Pg boundary -->
            <line
              :x1="x(66)"
              :x2="x(66)"
              :y1="STRIP_Y"
              :y2="LANES_Y + FAMILIES.length * LANE"
              class="cow-fo2__kpg"
            />
            <text
              :x="x(66) + 6"
              :y="LANES_Y + FAMILIES.length * LANE - 8"
              class="cow-fo2__kpglabel"
            >
              K–Pg extinction · 66 Ma
            </text>

            <!-- deposits: pills on top, a thin line down -->
            <g
              v-for="d in usedDeposits"
              :key="d.key"
              :class="['cow-fo2__dep', { 'is-on': deposit === d.key, 'is-hot': hoverDep === d.key }]"
              @click="pickDeposit(d.key)"
              @mouseenter="hoverDep = d.key"
              @mouseleave="hoverDep = ''"
            >
              <line
                :x1="x(d.age)"
                :x2="x(d.age)"
                :y1="d.pillY + 22"
                :y2="LANES_Y + FAMILIES.length * LANE"
                class="cow-fo2__depline"
              />
              <rect
                :x="d.px - d.pw / 2"
                :y="d.pillY"
                :width="d.pw"
                height="22"
                rx="11"
                class="cow-fo2__pill"
              />
              <text
                :x="d.px"
                :y="d.pillY + 15"
                text-anchor="middle"
                class="cow-fo2__pilltext"
              >
                {{ d.short }} <tspan class="cow-fo2__pillage">{{ d.age ? `${d.age}` : '<0.1' }}</tspan>
              </text>
              <title>{{ d.name }}, {{ d.place }} · {{ d.epoch }} · ~{{ d.age }} Ma ({{ d.min }}–{{ d.max }})</title>
            </g>

            <!-- species -->
            <g
              v-for="s in dots"
              :key="s.id"
              :class="['cow-fo2__dot', `f-${s.family}`, { 'is-dim': (deposit && deposit !== s.deposit) || (hoverDep && hoverDep !== s.deposit) }]"
              :transform="`translate(${s.x},${s.y})`"
              @mouseenter="tipAt($event, s)"
              @mousemove="tipAt($event, s)"
              @mouseleave="tip = null"
              @click="s.otu && router.push({ name: 'otus-id-overview', params: { id: String(s.otu) } })"
            >
              <circle
                r="11"
                class="cow-fo2__hit"
              />
              <circle r="7" />
            </g>

            <!-- axis -->
            <line
              :x1="x(MAX)"
              :x2="x(0)"
              :y1="AXIS_Y"
              :y2="AXIS_Y"
              class="cow-fo2__axis"
            />
            <line
              v-for="t in minorTicks"
              :key="`m${t}`"
              :x1="x(t)"
              :x2="x(t)"
              :y1="AXIS_Y"
              :y2="AXIS_Y + (t % 20 === 0 ? 7 : 4)"
              class="cow-fo2__axis"
            />
            <text
              v-for="t in ticks"
              :key="t"
              :x="x(t)"
              :y="AXIS_Y + 22"
              text-anchor="middle"
              class="cow-fo2__tick"
            >
              {{ t === 0 ? 'today' : t }}
            </text>
            <text
              :x="x(MAX) - 28"
              :y="AXIS_Y + 22"
              text-anchor="end"
              class="cow-fo2__tick"
            >
              Ma
            </text>
          </svg>
          <div
            v-if="tip"
            class="cow-fw__tip"
            :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
          >
            <p v-html="tip.s.html" />
            <small>{{ tip.s.family }} · {{ tip.s.dep.name }} · ~{{ tip.s.dep.age }} Ma</small>
          </div>
        </div>
        <p
          v-if="unplaced.length"
          class="cow-ix__note"
        >
          Not on the timeline (deposit to confirm):
          <span
            v-for="(s, i) in unplaced"
            :key="s.id"
          ><span v-html="s.html" />{{ i < unplaced.length - 1 ? '; ' : '.' }}</span>
          Deposits and ages are compiled from the original descriptions and are approximate.
        </p>
      </section>

      <!-- table -->
      <section class="cow-fo2__block">
        <h2 class="cow-fo2__h2">All fossil species</h2>
        <div class="cow-fo2__tools">
          <div class="cow-ty2__seg">
            <button
              v-for="f in ['All', ...FAMILIES]"
              :key="f"
              type="button"
              :class="{ 'is-on': family === f }"
              @click="family = f"
            >
              {{ f === 'All' ? 'All families' : f }}
            </button>
          </div>
          <div class="cow-ty2__seg">
            <button
              v-for="p in ['All', ...periodsUsed]"
              :key="p"
              type="button"
              :class="{ 'is-on': period === p }"
              @click="period = p"
            >
              {{ p === 'All' ? 'All ages' : p }}
            </button>
          </div>
          <button
            v-if="deposit"
            type="button"
            class="cow-ix__pill"
            @click="deposit = ''"
          >
            {{ DEPOSITS[deposit].name }} ✕
          </button>
          <button
            type="button"
            class="cow-ix__link"
            @click="downloadCsv"
          >
            Download CSV
          </button>
        </div>
        <div class="cow-ty2__tablewrap">
          <table class="cow-ty2__table cow-fo2__table">
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
              <tr
                v-for="s in tableRows"
                :key="s.id"
                class="cow-ty2__tr"
                @click="s.otu && router.push({ name: 'otus-id-overview', params: { id: String(s.otu) } })"
              >
                <td>
                  <span class="cow-fo2__dagger">†</span><span v-html="s.html" />
                </td>
                <td>
                  <span :class="['cow-fo2__fam', `f-${s.family}`]">{{ s.family }}</span>
                </td>
                <td>
                  <template v-if="s.dep">
                    {{ s.dep.name }} <small>{{ s.dep.place }}</small>
                  </template>
                  <span
                    v-else
                    class="cow-fo2__muted"
                  >to confirm</span>
                </td>
                <td class="cow-fo2__num">
                  {{ s.dep ? (s.dep.age ? `~${s.dep.age}` : '<0.1') : '—' }}
                </td>
                <td>{{ s.dep ? s.dep.epoch : '—' }}</td>
                <td class="cow-fo2__muted">
                  {{ s.author }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- literature -->
      <section class="cow-fo2__block">
        <h2 class="cow-fo2__h2">Literature on fossil ceraphronoids <small v-if="refs.length">{{ refs.length }}</small></h2>
        <p
          v-if="refsLoading"
          class="cow-ty__muted"
        >
          Loading references…
        </p>
        <ol
          v-else
          class="cow-fo2__refs"
        >
          <li
            v-for="r in refs"
            :key="r.id"
          >
            <span class="cow-fo2__year">{{ r.year || 'n.d.' }}</span>
            <span>
              <span v-html="r.html" />
              <a
                v-if="r.doi"
                :href="`https://doi.org/${r.doi}`"
                target="_blank"
                rel="noopener"
                class="cow-fo2__doi"
              >doi:{{ r.doi }}</a>
            </span>
          </li>
        </ol>
        <p class="cow-ix__note">
          Papers that describe a fossil species listed here, and papers whose title mentions amber, fossils or a
          geological period.
          <RouterLink to="/literature">All literature →</RouterLink>
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'
import { csv, download } from '../lib/dwc.js'

// Deposits and ages of fossil Ceraphronoidea, compiled from the original
// descriptions (not stored in TaxonWorks). Ages in million years (Ma), a
// midpoint and a range. `check: true` marks entries to confirm.
// lat/lon are approximate, for a future map of the deposits.

const DEPOSITS = {
  lebanese: { name: 'Lebanese amber', place: 'Lebanon', age: 127, min: 125, max: 130, epoch: 'Early Cretaceous (Barremian)', lat: 33.9, lon: 35.7 },
  baissa: { name: 'Baissa', place: 'Transbaikalia, Russia', age: 130, min: 125, max: 135, epoch: 'Early Cretaceous', lat: 52.6, lon: 115.0, check: true },
  bontsagan: { name: 'Bon-Tsagan', place: 'Mongolia', age: 120, min: 113, max: 125, epoch: 'Early Cretaceous (Aptian)', lat: 45.6, lon: 99.0, check: true },
  spanish: { name: 'Spanish amber (Álava)', place: 'Basque Country, Spain', age: 105, min: 100, max: 110, epoch: 'Early Cretaceous (Albian)', lat: 42.7, lon: -2.7 },
  burmese: { name: 'Burmese (Kachin) amber', place: 'Myanmar', age: 99, min: 98, max: 100, epoch: 'Late Cretaceous (Cenomanian)', lat: 26.2, lon: 96.6 },
  taimyr: { name: 'Taimyr amber (Yantardakh)', place: 'Taimyr, Russia', age: 85, min: 83, max: 87, epoch: 'Late Cretaceous (Santonian)', lat: 71.5, lon: 104.0 },
  canadian: { name: 'Canadian amber', place: 'Alberta & Manitoba, Canada', age: 78, min: 76, max: 80, epoch: 'Late Cretaceous (Campanian)', lat: 49.8, lon: -111.6 },
  baltic: { name: 'Baltic amber', place: 'Baltic region', age: 42, min: 34, max: 48, epoch: 'Eocene', lat: 54.9, lon: 20.4 },
  copal: { name: 'East African copal', place: 'Zanzibar, Tanzania', age: 0, min: 0, max: 0.1, epoch: 'Subfossil (Holocene)', lat: -6.2, lon: 39.3, check: true }
}

// species → deposit (by name, so it survives id changes)
const FOSSIL_DEPOSIT = {
  'Allocotidus bruesi': 'canadian',
  'Aphrostigmon bontsaganicum': 'bontsagan',
  'Aphrostigmon priapulus': 'bontsagan',
  'Aphrostigmon vitimense': 'baissa',
  'Burmaphron iratxoak': 'burmese',
  'Burmaphron jentilak': 'burmese',
  'Burmaphron sorginak': 'burmese',
  'Elasmomorpha melpomene': 'taimyr',
  'Hippocoon evadne': 'taimyr',
  'Hippocoon basajauni': 'spanish',
  'Libanophron sugaar': 'lebanese',
  'Stigmaphron orphne': 'taimyr',
  'Tagsmiphron exitorum': 'canadian',
  'Tagsmiphron leucki': 'canadian',
  'Tagsmiphron spiculum': 'canadian',
  'Tagsmiphron olentzero': 'spanish',
  'Prolagynodes penniger': 'taimyr',
  'Conostigmus dolicharthrus': 'taimyr',
  'Dendrocerus dubitatus': 'canadian',
  'Lagynodes electriphilus': 'baltic',
  'Lagynodes primordialis': 'baltic',
  'Lagynodes pseudocarinatus': 'baltic',
  'Conostigmus juvenilis': 'baltic',
  'Conostigmus resinae': 'baltic',
  'Conostigmus succinalis': 'baltic',
  'Ceraphron fasciatus': 'copal',
  'Aphanogmus serrulatus': 'copal'
}

const FAMILY_OF_GENUS = {
  Allocotidus: 'Stigmaphronidae',
  Aphrostigmon: 'Stigmaphronidae',
  Burmaphron: 'Stigmaphronidae',
  Elasmomorpha: 'Stigmaphronidae',
  Hippocoon: 'Stigmaphronidae',
  Libanophron: 'Stigmaphronidae',
  Stigmaphron: 'Stigmaphronidae',
  Tagsmiphron: 'Stigmaphronidae',
  Lagynodes: 'Megaspilidae',
  Prolagynodes: 'Megaspilidae',
  Conostigmus: 'Megaspilidae',
  Dendrocerus: 'Megaspilidae',
  Megaspilus: 'Megaspilidae',
  Trichosteresis: 'Megaspilidae',
  Ceraphron: 'Ceraphronidae',
  Aphanogmus: 'Ceraphronidae'
}

// geological periods for the timeline background (Ma)
const PERIODS = [
  { name: 'Early Cretaceous', from: 145, to: 100.5 },
  { name: 'Late Cretaceous', from: 100.5, to: 66 },
  { name: 'Paleogene', from: 66, to: 23 },
  { name: 'Neogene', from: 23, to: 2.6 },
  { name: 'Quaternary', from: 2.6, to: 0 }
]
const periodOf = (ma) => (PERIODS.find((p) => ma <= p.from && ma >= p.to) || {}).name || ''

const STIGMA_OTU = 1373001
const STIGMA_TN = 1542779
const SUPERFAMILY = 1541972
const FAMILIES = ['Stigmaphronidae', 'Megaspilidae', 'Ceraphronidae']
const router = useRouter()

const loading = ref(true)
const rows = ref([])
const refs = ref([])
const refsLoading = ref(true)
const family = ref('All')
const period = ref('All')
const deposit = ref('')

const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

onMounted(async () => {
  try {
    const params = { per: 500 }
    const [fos, st] = await Promise.all([
      makeAPIRequest.get('/taxon_names', { params: { ...params, 'taxon_name_id[]': SUPERFAMILY, descendants: true, 'taxon_name_classification[]': 'TaxonNameClassification::Iczn::Fossil' } }),
      makeAPIRequest.get('/taxon_names', { params: { ...params, 'taxon_name_id[]': STIGMA_TN, descendants: true } })
    ])
    const m = new Map()
    ;[...(fos.data || []), ...(st.data || [])]
      .filter((t) => String(t.rank_string || '').endsWith('Species'))
      .forEach((t) => {
        if (m.has(t.id)) return
        const genus = String(t.cached).split(' ')[0]
        const dep = DEPOSITS[FOSSIL_DEPOSIT[t.cached]] ? { key: FOSSIL_DEPOSIT[t.cached], ...DEPOSITS[FOSSIL_DEPOSIT[t.cached]] } : null
        m.set(t.id, {
          id: t.id,
          name: t.cached,
          author: t.cached_author_year || '',
          html: `<i>${esc(t.cached)}</i> ${esc(t.cached_author_year || '')}`,
          genus,
          family: FAMILY_OF_GENUS[genus] || 'Ceraphronoidea',
          valid: t.cached_is_valid !== false,
          deposit: dep?.key || '',
          dep
        })
      })
    const list = [...m.values()]
    // OTUs, for links
    const otus = new Map()
    const ids = list.map((x) => x.id)
    for (let i = 0; i < ids.length; i += 80) {
      const { data } = await makeAPIRequest.get('/otus', { params: { 'taxon_name_id[]': ids.slice(i, i + 80), per: 500 } })
      ;(data || []).forEach((o) => !otus.has(o.taxon_name_id) && otus.set(o.taxon_name_id, o.id))
    }
    rows.value = list.map((x) => ({ ...x, otu: otus.get(x.id) }))
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
  loadRefs()
})

// numbers
const genera = computed(() => new Set(rows.value.map((r) => r.genus)).size)
const placed = computed(() => rows.value.filter((r) => r.dep))
const unplaced = computed(() => rows.value.filter((r) => !r.dep))
const oldest = computed(() => Math.max(0, ...placed.value.map((r) => r.dep.age)))

// timeline geometry
const W = 1200
const MAX = 140
const LEFT = 190
const RIGHT = 40
const STRIP_Y = 0
const STRIP_H = 28
const PILLS_Y = 40
const LANES_Y = 128
const LANE = 110
const AXIS_Y = LANES_Y + FAMILIES.length * LANE + 10
const H = AXIS_Y + 34
const x = (ma) => LEFT + ((MAX - ma) / MAX) * (W - LEFT - RIGHT)
const laneY = (i) => LANES_Y + LANE * (i + 0.5)
const ticks = [140, 120, 100, 80, 60, 40, 20, 0]
const minorTicks = Array.from({ length: 15 }, (_, i) => i * 10)
const hoverDep = ref('')

// ICS chart colours, used faintly
const PCOLOR = {
  'Early Cretaceous': '#74866a',
  'Late Cretaceous': '#8a9a7c',
  Paleogene: '#6c5240',
  Neogene: '#9a9288',
  Quaternary: '#c4b8a8'
}
const PABBR = { 'Early Cretaceous': 'Early K', 'Late Cretaceous': 'Late K', Paleogene: 'Pg', Neogene: 'N', Quaternary: 'Q' }
const PERIODS_C = PERIODS.map((p) => ({ ...p, color: PCOLOR[p.name] || '#ddd', abbr: PABBR[p.name] || '' }))

const SHORT = { copal: 'Copal', lebanese: 'Lebanon', baissa: 'Baissa', bontsagan: 'Bon-Tsagan', spanish: 'Spain', burmese: 'Myanmar', taimyr: 'Taimyr', canadian: 'Canada', baltic: 'Baltic' }
const usedDeposits = computed(() => {
  const keys = [...new Set(placed.value.map((r) => r.deposit))]
  const list = keys.map((k) => ({ key: k, ...DEPOSITS[k], short: SHORT[k] || DEPOSITS[k].name })).sort((a, b) => b.age - a.age)
  // pill width from the text; two rows so neighbours do not overlap
  const rowsEnd = [-1e9, -1e9, -1e9]
  list.forEach((d) => {
    d.pw = 22 + (d.short.length + String(d.age || '<0.1').length + 1) * 6.6
    d.px = Math.min(Math.max(x(d.age), LEFT + d.pw / 2), W - d.pw / 2 - 6)
    const left = d.px - d.pw / 2
    let row = rowsEnd.findIndex((end) => left > end + 6)
    if (row < 0) row = rowsEnd.indexOf(Math.min(...rowsEnd))
    rowsEnd[row] = left + d.pw
    d.pillY = PILLS_Y + row * 27
  })
  return list
})

const lanes = computed(() =>
  FAMILIES.map((f) => {
    const mine = placed.value.filter((r) => r.family === f)
    const ages = mine.map((r) => r.dep.age)
    const extinct = f === 'Stigmaphronidae'
    return {
      family: f,
      extinct,
      n: rows.value.filter((r) => r.family === f).length,
      from: ages.length ? Math.max(...ages) : null,
      to: extinct ? Math.min(...ages) : 0
    }
  })
)

const dots = computed(() => {
  const out = []
  FAMILIES.forEach((f, li) => {
    const byDep = new Map()
    placed.value.filter((r) => r.family === f).forEach((r) => (byDep.get(r.deposit) || byDep.set(r.deposit, []).get(r.deposit)).push(r))
    byDep.forEach((list) => {
      list.sort((a, b) => a.name.localeCompare(b.name))
      const n = list.length
      // up to 4 in a column; more go side by side
      const cols = Math.ceil(n / 4)
      const per = Math.ceil(n / cols)
      list.forEach((r, i) => {
        const c = Math.floor(i / per)
        const k = i % per
        const inCol = Math.min(per, n - c * per)
        out.push({ ...r, x: x(r.dep.age) + (c - (cols - 1) / 2) * 17, y: laneY(li) + (k - (inCol - 1) / 2) * 17 })
      })
    })
  })
  return out
})

const stage = ref(null)
const tip = ref(null)
function tipAt(e, s) {
  const r = stage.value.getBoundingClientRect()
  tip.value = { s, x: Math.max(0, Math.min(e.clientX - r.left + 14, r.width - 290)), y: e.clientY - r.top + 14 }
}
function pickDeposit(k) {
  deposit.value = deposit.value === k ? '' : k
}

// table
const COLS = [
  { key: 'name', label: 'Species' },
  { key: 'family', label: 'Family' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'age', label: 'Age (Ma)' },
  { key: 'epoch', label: 'Period' },
  { key: 'author', label: 'Described' }
]
const sortKey = ref('age')
const sortDir = ref(-1)
function sortBy(k) {
  if (sortKey.value === k) sortDir.value = -sortDir.value
  else {
    sortKey.value = k
    sortDir.value = k === 'age' ? -1 : 1
  }
}
const SORTS = {
  name: (s) => s.name,
  family: (s) => s.family,
  deposit: (s) => s.dep?.name || '~',
  age: (s) => s.dep?.age ?? -1,
  epoch: (s) => s.dep?.epoch || '~',
  author: (s) => Number((s.author.match(/\d{4}/) || [])[0]) || 0
}
const periodsUsed = computed(() => PERIODS.map((p) => p.name).filter((n) => placed.value.some((r) => r.dep.age <= PERIODS.find((p) => p.name === n).from && r.dep.age >= PERIODS.find((p) => p.name === n).to)))
const inPeriod = (r) => {
  if (period.value === 'All') return true
  const p = PERIODS.find((x) => x.name === period.value)
  return r.dep && r.dep.age <= p.from && r.dep.age >= p.to
}
const tableRows = computed(() => {
  const f = SORTS[sortKey.value]
  return rows.value
    .filter((r) => (family.value === 'All' || r.family === family.value) && inPeriod(r) && (!deposit.value || r.deposit === deposit.value))
    .sort((a, b) => {
      const p = f(a)
      const q = f(b)
      const c = typeof p === 'number' ? p - q : String(p).localeCompare(String(q))
      return c * sortDir.value || a.name.localeCompare(b.name)
    })
})
function downloadCsv() {
  download(
    csv(tableRows.value, [
      ['Species', (s) => s.name],
      ['Author', (s) => s.author],
      ['Family', (s) => s.family],
      ['Deposit', (s) => s.dep?.name || ''],
      ['Place', (s) => s.dep?.place || ''],
      ['Age (Ma)', (s) => s.dep?.age ?? ''],
      ['Age range (Ma)', (s) => (s.dep ? `${s.dep.min}–${s.dep.max}` : '')],
      ['Period', (s) => s.dep?.epoch || '']
    ]),
    'ceraphronoidea-fossils.csv'
  )
}

// literature: original descriptions of the fossil species + titles about fossils
const FOSSIL_WORDS = /\b(amber|fossil|fossils|cretaceous|jurassic|eocene|oligocene|miocene|mesozoic|cenozoic|palaeo|paleo|baltic|burmese|kachin|lebanese|copal|resin|bernstein|succin)/i
async function loadRefs() {
  try {
    const out = []
    for (let page = 1; page < 10; page++) {
      const { data } = await makeAPIRequest.get('/sources', { params: { in_project: true, per: 250, page } })
      const list = Array.isArray(data) ? data : []
      out.push(...list)
      if (list.length < 250) break
    }
    const authorYears = new Set(
      rows.value.map((r) => {
        const m = r.author.replace(/[()]/g, '').match(/^(.+?),\s*(\d{4})$/)
        return m ? `${m[1].split(/\s*(?:&|et al\.?|,)\s*/)[0].trim().toLowerCase()}|${m[2]}` : ''
      })
    )
    const firstSurname = (s) => String(s.author || '').split(/,|\s+and\s+/)[0].trim().toLowerCase()
    refs.value = out
      .filter((s) => FOSSIL_WORDS.test(`${s.title || ''} ${s.journal || ''}`) || authorYears.has(`${firstSurname(s)}|${s.year}`))
      .map((s) => ({
        id: s.id,
        year: Number(s.year) || 0,
        doi: String(s.doi || '').replace(/^https?:\/\/(dx\.)?doi\.org\//, ''),
        html: String(s.cached || '')
          .replace(/\\textit\s*/g, '')
          .replace(/\s*\[in [^\]]*\]/g, '')
          .replace(/\s*https?:\/\/(dx\.)?doi\.org\/\S+\s*$/, '')
      }))
      .sort((a, b) => b.year - a.year)
  } catch {
    refs.value = []
  } finally {
    refsLoading.value = false
  }
}
</script>

