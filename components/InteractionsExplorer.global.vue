<template>
  <div class="cow-ix">
    <p
      v-if="loading"
      class="cow-ix__status"
    >
      Loading host records…
    </p>
    <p
      v-else-if="error"
      class="cow-ix__status"
    >
      Host records could not be loaded.
    </p>

    <template v-else>
      <!-- Explore: numbers, find a taxon, host orders -->
      <section class="cow-ix__top">
        <dl class="cow-ix__stats cow-ix__stats--slim">
          <div>
            <dt>Host &amp; prey records</dt>
            <dd>{{ fmt(attacks.length) }}</dd>
          </div>
          <div>
            <dt>Ceraphronoids with hosts</dt>
            <dd>{{ fmt(count(attacks, (r) => r.s.id)) }}</dd>
          </div>
          <div>
            <dt>Host taxa</dt>
            <dd>{{ fmt(count(attacks, (r) => r.o.id || r.o.label)) }}</dd>
          </div>
          <div>
            <dt>Host families</dt>
            <dd>{{ fmt(count(attacks, (r) => r.o.family)) }}</dd>
          </div>
          <div>
            <dt>Hyperparasitoid records</dt>
            <dd>{{ fmt(attacks.filter((r) => roleOf(r) === 'hyper').length) }}</dd>
          </div>
          <div>
            <dt>References</dt>
            <dd>{{ fmt(refCount) }}</dd>
          </div>
        </dl>

        <div class="cow-ix__finder">
          <label
            class="cow-ix__flabel"
            for="cow-taxon-find"
          >Find a taxon</label>
          <div class="cow-ix__find">
            <input
              id="cow-taxon-find"
              v-model="tq"
              type="search"
              autocomplete="off"
              placeholder="A ceraphronoid, a host, a plant… e.g. Dendrocerus, Aphidius, Aphis"
              role="combobox"
              :aria-expanded="matches.length > 0"
              aria-controls="cow-taxon-list"
              @keydown.down.prevent="cursor = Math.min(cursor + 1, matches.length - 1)"
              @keydown.up.prevent="cursor = Math.max(cursor - 1, 0)"
              @keydown.enter.prevent="matches[cursor] && pickTaxon(matches[cursor])"
              @keydown.esc="tq = ''"
            />
            <ul
              v-if="matches.length"
              id="cow-taxon-list"
              class="cow-ix__suggest"
              role="listbox"
            >
              <li
                v-for="(m, i) in matches"
                :key="m.key"
                role="option"
                :aria-selected="i === cursor"
                :class="{ 'is-cur': i === cursor }"
                @mousedown.prevent="pickTaxon(m)"
                @mouseenter="cursor = i"
              >
                <i>{{ m.label }}</i>
                <span>{{ m.kind }}</span>
                <small>{{ m.n }}</small>
              </li>
            </ul>
          </div>
        </div>

        <div class="cow-ix__orders">
          <span class="cow-ix__flabel">Host order</span>
          <div class="cow-ix__ochips">
            <button
              type="button"
              :class="{ 'is-on': !order }"
              @click="order = ''"
            >
              All<small>{{ fmt(attacks.length) }}</small>
            </button>
            <button
              v-for="o in orderStrip"
              :key="o.order"
              type="button"
              :class="{ 'is-on': order === o.order }"
              @click="order = order === o.order ? '' : o.order"
            >
              <span
                class="cow-ix__sw"
                :style="{ background: colorOf(o.order) }"
              />{{ o.order }}<small>{{ o.n }}</small>
            </button>
          </div>
        </div>
      </section>

      <FoodWeb
        ref="webEl"
        v-model:genus="genus"
        v-model:focus="focus"
        :rows="all"
        :keep="orderOk"
        :role-of="roleOf"
        class="cow-ix__block"
        @records="webSel = $event"
      />

      <!-- Genera: what they attack, and as what -->
      <div class="cow-ix__duo">
        <section class="cow-ix__block">
          <h2 class="cow-ix__h2">What each genus attacks</h2>
          <p class="cow-ix__help">
            Records per genus, split by host order (colours as in the host-order row above). Click a segment to list
            those records.
          </p>
          <div class="cow-ix__bars">
            <div
              v-for="g in heatGenera"
              :key="g.name"
              :class="['cow-ix__brow', { 'is-dim': genus && genus !== g.name }]"
            >
              <button
                type="button"
                class="cow-ix__gname"
                @click="pickCell(g.name, '')"
              >
                <i>{{ g.name }}</i>
                <small>{{ g.family }}</small>
              </button>
              <div class="cow-ix__track">
                <button
                  v-for="seg in segments(g.name)"
                  :key="seg.order"
                  type="button"
                  :class="['cow-ix__seg', { 'is-on': genus === g.name && order === seg.order }]"
                  :style="{ width: `${(seg.n / barMax) * 100}%`, background: colorOf(seg.order) }"
                  :title="`${g.name} on ${seg.order}: ${seg.n} record${seg.n === 1 ? '' : 's'}`"
                  @click="pickCell(g.name, seg.order)"
                >
                  <span v-if="seg.n / barMax > 0.06">{{ seg.n }}</span>
                </button>
              </div>
              <span class="cow-ix__total">{{ g.n }}</span>
            </div>
          </div>
        </section>

        <section class="cow-ix__block">
          <h2 class="cow-ix__h2">Primary or hyperparasitoid?</h2>
          <p class="cow-ix__help">
            Share of each genus' records on non-parasitoid hosts (primary), on other parasitoids (hyper) and as
            predator. Inferred from the host records.
          </p>
          <ul class="cow-ix__rlegend">
            <li
              v-for="(r, k) in ROLES"
              :key="k"
            >
              <span
                class="cow-ix__sw"
                :style="{ background: r.color }"
              />{{ r.label }}
            </li>
          </ul>
          <div class="cow-ix__roles">
            <div
              v-for="g in roleGenera"
              :key="g.name"
              :class="['cow-ix__rrow', { 'is-dim': genus && genus !== g.name }]"
            >
              <button
                type="button"
                class="cow-ix__gname"
                @click="genus = genus === g.name ? '' : g.name"
              >
                <i>{{ g.name }}</i>
              </button>
              <div
                class="cow-ix__rtrack"
                :title="g.title"
              >
                <span
                  v-for="s in g.parts"
                  :key="s.key"
                  :style="{ width: `${s.pct}%`, background: s.color }"
                >{{ s.pct >= 14 ? `${Math.round(s.pct)}%` : '' }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Records -->
      <section
        ref="listEl"
        class="cow-ix__block"
      >
        <h2 class="cow-ix__h2">Host records</h2>
        <div class="cow-ix__tools">
          <input
            v-model="q"
            type="search"
            class="cow-ix__search"
            placeholder="Search a ceraphronoid, a host or a reference"
            aria-label="Search host records"
          />
          <select
            v-model="rel"
            aria-label="Relationship"
          >
            <option value="">All relationships</option>
            <option
              v-for="r in relationships"
              :key="r"
              :value="r"
            >
              {{ r }}
            </option>
          </select>
          <select
            v-model="family"
            aria-label="Ceraphronoid family"
          >
            <option value="">Both families</option>
            <option
              v-for="f in families"
              :key="f"
              :value="f"
            >
              {{ f }}
            </option>
          </select>
          <button
            v-if="webSel"
            type="button"
            class="cow-ix__pill"
            @click="clearWeb"
          >
            Food web: <i>{{ webSel.label }}</i> ✕
          </button>
          <template v-else>
            <button
              v-if="genus"
              type="button"
              class="cow-ix__pill"
              @click="genus = ''"
            >
              <i>{{ genus }}</i> ✕
            </button>
            <button
              v-if="order"
              type="button"
              class="cow-ix__pill"
              @click="order = ''"
            >
              {{ order }} ✕
            </button>
          </template>
          <button
            v-if="filtersOn"
            type="button"
            class="cow-ix__link"
            @click="reset"
          >
            Clear filters
          </button>
        </div>
        <p class="cow-ix__count">
          {{ fmt(shown.length) }} record{{ shown.length === 1 ? '' : 's' }}
          <button
            type="button"
            class="cow-ix__link"
            @click="downloadCsv(shown, 'ceraphronoidea-host-records.csv')"
          >
            Download CSV
          </button>
        </p>

        <div class="cow-ix__table-wrap">
          <table class="cow-ix__table">
            <thead>
              <tr>
                <th>Taxon</th>
                <th>Interaction</th>
                <th>Associated taxon</th>
                <th>Order: family</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in shown.slice(0, limit)"
                :key="r.id"
              >
                <td>
                  <RouterLink
                    v-if="isCeraphronoid(r.s) && r.s.id"
                    :to="{ name: 'otus-id-overview', params: { id: String(r.s.id) } }"
                    v-html="nameHtml(r.s.label)"
                  />
                  <span
                    v-else
                    v-html="nameHtml(r.s.label)"
                  />
                  <small>{{ r.s.family }}</small>
                </td>
                <td>
                  {{ r.rel }}
                  <span
                    v-if="isCeraphronoid(r.s) && ROLES[roleOf(r)]"
                    class="cow-ix__role"
                    :style="{ '--c': ROLES[roleOf(r)].color }"
                  >{{ ROLES[roleOf(r)].short }}</span>
                </td>
                <td>
                  <RouterLink
                    v-if="isCeraphronoid(r.o) && r.o.id"
                    :to="{ name: 'otus-id-overview', params: { id: String(r.o.id) } }"
                    v-html="nameHtml(r.o.label)"
                  />
                  <span
                    v-else
                    v-html="nameHtml(r.o.label)"
                  />
                </td>
                <td class="cow-ix__muted">{{ r.o.order }}<template v-if="r.o.family">: {{ r.o.family }}</template></td>
                <td class="cow-ix__muted">{{ r.cit }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          v-if="shown.length > limit"
          type="button"
          class="cow-ix__more"
          @click="limit += 100"
        >
          Show more ({{ fmt(shown.length - limit) }} left)
        </button>
        <p class="cow-ix__note">
          Records are host associations entered in TaxonWorks from the cited literature. Some names in older papers
          may refer to misidentified hosts; check the reference before reusing a record.
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  loadAssociations,
  isCeraphronoid,
  nameHtml,
  downloadCsv
} from '../panels/PanelHosts/associations.js'
import { ROLES, makeRoleOf } from '../lib/roles.js'
import FoodWeb from './hosts/FoodWeb.vue'

const route = useRoute()
const loading = ref(true)
const error = ref(false)
const all = ref([])
const q = ref(String(route.query.q || ''))
const rel = ref(String(route.query.rel || ''))
const family = ref(String(route.query.family || ''))
const order = ref(String(route.query.order || ''))
const genus = ref(String(route.query.genus || ''))
const focus = ref(String(route.query.taxon || ''))
const webSel = ref(null)
const webEl = ref(null)
const limit = ref(100)
const listEl = ref(null)

const fmt = (n) => Number(n || 0).toLocaleString()
const count = (rows, f) => new Set(rows.map(f).filter(Boolean)).size
const keyOf = (t) => String(t.id || t.label)
const fold = (x) => String(x).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

onMounted(async () => {
  try {
    all.value = await loadAssociations()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

const roleFn = computed(() => makeRoleOf(all.value))
const roleOf = (r) => roleFn.value(r)

// records where a ceraphronoid is the subject (parasitoid, predator…)
const core = computed(() => all.value.filter((r) => isCeraphronoid(r.s)))
// animal hosts and prey vs plants ("feeds on": adults recorded on plants)
const attacks = computed(() => core.value.filter((r) => r.rel !== 'feeds on'))
const refCount = computed(() => count(core.value.flatMap((r) => (r.cit ? r.cit.split(/;\s*/) : [])), (x) => x))
const relationships = computed(() => [...new Set(all.value.map((r) => r.rel))].sort())
const families = computed(() => [...new Set(core.value.map((r) => r.s.family))].filter(Boolean).sort())

// host orders, biggest first
const heatOrders = computed(() => {
  const m = new Map()
  attacks.value.forEach((r) => m.set(r.o.order || 'Order not recorded', (m.get(r.o.order || 'Order not recorded') || 0) + 1))
  return [...m].sort((a, b) => b[1] - a[1]).map(([o]) => o)
})
// the six biggest get their own colour, the rest share grey
const PALETTE = ['#6c5240', '#74866a', '#9a9288', '#2c241c', '#a39b90', '#574030']
const OTHER = 'Other orders'
const mainOrders = computed(() => heatOrders.value.slice(0, PALETTE.length))
const colorOf = (o) => {
  const i = mainOrders.value.indexOf(o)
  return i >= 0 ? PALETTE[i] : '#a39b90'
}
const orderOf = (r) => r.o.order || 'Order not recorded'
const orderOk = (r) =>
  !order.value || (order.value === OTHER ? !mainOrders.value.includes(orderOf(r)) : orderOf(r) === order.value)
const orderStrip = computed(() => {
  const m = new Map()
  attacks.value.forEach((r) => {
    const o = mainOrders.value.includes(orderOf(r)) ? orderOf(r) : OTHER
    m.set(o, (m.get(o) || 0) + 1)
  })
  return [...m].map(([o, n]) => ({ order: o, n })).sort((a, b) => (a.order === OTHER) - (b.order === OTHER) || b.n - a.n)
})

// bars: genera × host orders
const heat = computed(() => {
  const m = new Map()
  attacks.value.forEach((r) => {
    const k = `${r.s.genus || '—'}|${orderOf(r)}`
    m.set(k, (m.get(k) || 0) + 1)
  })
  return m
})
const cell = (g, o) => heat.value.get(`${g}|${o}`) || 0
const heatGenera = computed(() => {
  const m = new Map()
  attacks.value.forEach((r) => {
    const g = r.s.genus || '—'
    if (!m.has(g)) m.set(g, { name: g, family: r.s.family, n: 0 })
    m.get(g).n++
  })
  return [...m.values()].sort((a, b) => b.n - a.n)
})
function segments(g) {
  const out = mainOrders.value.map((o) => ({ order: o, n: cell(g, o) })).filter((x) => x.n)
  const rest = heatOrders.value.slice(PALETTE.length).reduce((n, o) => n + cell(g, o), 0)
  if (rest) out.push({ order: OTHER, n: rest })
  return out
}
const barMax = computed(() => Math.max(1, ...heatGenera.value.map((g) => g.n)))

// roles per genus
const roleGenera = computed(() =>
  heatGenera.value.map((g) => {
    const rows = attacks.value.filter((r) => (r.s.genus || '—') === g.name && orderOk(r))
    const c = {}
    rows.forEach((r) => (c[roleOf(r)] = (c[roleOf(r)] || 0) + 1))
    const n = rows.length || 1
    const parts = Object.keys(ROLES).filter((k) => c[k]).map((k) => ({ key: k, color: ROLES[k].color, pct: (c[k] / n) * 100 }))
    return { name: g.name, parts, title: Object.keys(ROLES).filter((k) => c[k]).map((k) => `${ROLES[k].label}: ${c[k]}`).join(' · ') }
  }).filter((g) => g.parts.length)
)

async function pickCell(g, o) {
  const same = genus.value === g && order.value === o
  focus.value = ''
  genus.value = same ? '' : g
  order.value = same ? '' : o
  await nextTick()
  setTimeout(() => listEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
}

// find a taxon
const tq = ref('')
const cursor = ref(0)
const taxa = computed(() => {
  const m = new Map()
  const add = (key, label, kind, extra = {}) => {
    if (!label) return
    const e = m.get(key) || { key, label, kind, n: 0, ...extra }
    e.n++
    m.set(key, e)
  }
  all.value.forEach((r) => {
    if (isCeraphronoid(r.s)) {
      if (r.s.genus) add(`g:${r.s.genus}`, r.s.genus, 'Ceraphronoid genus', { genus: r.s.genus, isGenus: true })
      add(keyOf(r.s), r.s.label, 'Ceraphronoid', { genus: r.s.genus })
    } else add(keyOf(r.s), r.s.label, r.s.order ? `Host · ${r.s.order}` : 'Host')
    if (isCeraphronoid(r.o)) add(keyOf(r.o), r.o.label, 'Ceraphronoid', { genus: r.o.genus })
    else add(keyOf(r.o), r.o.label, r.rel === 'feeds on' ? 'Plant' : r.o.order ? `Host · ${r.o.order}` : 'Host')
  })
  return [...m.values()]
})
const matches = computed(() => {
  const words = fold(tq.value).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  // the name without author, for ranking
  const bare = (l) => fold(String(l).split(' ').filter((w, i) => i === 0 || /^[a-z(]/.test(w)).join(' '))
  const inName = (t) => words.every((w) => bare(t.label).includes(w))
  return taxa.value
    .filter((t) => words.every((w) => fold(t.label).includes(w)))
    .sort((a, b) => inName(b) - inName(a) || bare(b.label).startsWith(words[0]) - bare(a.label).startsWith(words[0]) || b.isGenus - a.isGenus || b.n - a.n)
    .slice(0, 9)
})
watch(tq, () => (cursor.value = 0))
async function pickTaxon(t) {
  tq.value = ''
  if (t.isGenus) {
    focus.value = ''
    genus.value = t.genus
  } else if (t.kind === 'Ceraphronoid' && t.genus) {
    genus.value = t.genus
    focus.value = t.key
  } else {
    genus.value = ''
    focus.value = t.key
  }
  await nextTick()
  setTimeout(() => webEl.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
}
function clearWeb() {
  focus.value = ''
  webEl.value?.clear()
}

// records table
const shown = computed(() => {
  const words = fold(q.value).split(/\s+/).filter(Boolean)
  const base = webSel.value
    ? all.value.filter((r) => webSel.value.ids.has(r.id))
    : core.value.filter((r) => orderOk(r) && (!genus.value || r.s.genus === genus.value))
  return base
    .filter(
      (r) =>
        (!rel.value || r.rel === rel.value) &&
        (!family.value || r.s.family === family.value || !isCeraphronoid(r.s)) &&
        (!words.length || words.every((w) => fold(`${r.s.label} ${r.o.label} ${r.o.family} ${r.o.order} ${r.cit}`).includes(w)))
    )
    .sort((a, b) => isCeraphronoid(b.s) - isCeraphronoid(a.s) || a.s.label.localeCompare(b.s.label) || a.o.label.localeCompare(b.o.label))
})

const filtersOn = computed(() => Boolean(q.value || rel.value || family.value || order.value || genus.value || focus.value || webSel.value))
function reset() {
  q.value = rel.value = family.value = order.value = genus.value = focus.value = ''
  webEl.value?.clear()
}

// keep the view in the URL so it can be shared
watch([q, rel, family, order, genus, focus], () => {
  limit.value = 100
  const query = Object.fromEntries(
    Object.entries({ genus: genus.value, taxon: focus.value, order: order.value, q: q.value, rel: rel.value, family: family.value }).filter(([, v]) => v)
  )
  // replaceState, not router.replace: the router scrolls to the top on every navigation
  const qs = new URLSearchParams(query).toString()
  window.history.replaceState(window.history.state, '', `${location.pathname}${location.search}#${route.path}${qs ? `?${qs}` : ''}`)
})
</script>
