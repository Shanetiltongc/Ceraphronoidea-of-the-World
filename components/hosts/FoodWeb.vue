<template>
  <section class="cow-fw">
    <header class="cow-fw__head">
      <div>
        <h2 class="cow-ix__h2">Food web</h2>
        <p class="cow-ix__help">
          From ceraphronoids to their hosts, the hosts' own hosts, and the plants at the base. Hover a name to follow
          its chains; click a name to keep only its chains; click a line for the interaction and its references.
        </p>
      </div>
      <div class="cow-fw__dl">
        <button
          type="button"
          class="cow-ix__link"
          @click="downloadEdges"
        >
          CSV
        </button>
        <button
          type="button"
          class="cow-ix__link"
          @click="downloadPng"
        >
          PNG
        </button>
      </div>
    </header>

    <div
      v-if="chips"
      class="cow-fw__genera"
    >
      <div class="cow-fw__fam">
        <span class="cow-fw__famname">Overview</span>
        <div class="cow-fw__chips">
          <button
            type="button"
            :class="{ 'is-on': allMode }"
            :aria-pressed="allMode"
            @click="setGenus('')"
          >
            All genera<small>{{ total }}</small>
          </button>
        </div>
      </div>
      <div
        v-for="f in byFamily"
        :key="f.family"
        class="cow-fw__fam"
      >
        <span class="cow-fw__famname">{{ f.family }}</span>
        <div class="cow-fw__chips">
          <button
            v-for="g in f.genera"
            :key="g.name"
            type="button"
            :class="{ 'is-on': genus === g.name }"
            :aria-pressed="genus === g.name"
            @click="setGenus(g.name)"
          >
            <i>{{ g.name }}</i><small>{{ g.n }}</small>
          </button>
        </div>
      </div>
    </div>

    <ul class="cow-fw__legend">
      <li
        v-for="t in TYPES"
        :key="t.rel"
        :class="`r-${t.cls}`"
      >
        <svg
          width="34"
          height="10"
        ><line
          x1="1"
          y1="5"
          x2="33"
          y2="5"
        /></svg>
        {{ t.label }}
      </li>
      <li class="cow-fw__lw">
        <svg
          width="34"
          height="12"
        ><line
          x1="1"
          y1="6"
          x2="15"
          y2="6"
          stroke-width="1.2"
        /><line
          x1="19"
          y1="6"
          x2="33"
          y2="6"
          stroke-width="4.5"
        /></svg>
        Thicker = more references
      </li>
      <li class="cow-fw__lring">
        <svg
          width="16"
          height="16"
        ><circle
          cx="8"
          cy="8"
          r="3.5"
        /><circle
          cx="8"
          cy="8"
          r="6.5"
          class="ring"
        /></svg>
        Mostly as hyperparasitoid
      </li>
    </ul>

    <p
      v-if="focus"
      class="cow-fw__focusbar"
    >
      <span>Only the chains through <i>{{ focusLabel }}</i></span>
      <button
        type="button"
        class="cow-ix__link"
        @click="setFocus('')"
      >
        Show everything
      </button>
    </p>

    <div
      ref="stage"
      class="cow-fw__stage"
    >
      <div class="cow-fw__wrap">
        <svg
          ref="svgEl"
          :viewBox="`0 0 ${W} ${H}`"
          class="cow-fw__svg"
          role="img"
          :aria-label="`Food web of ${allMode ? 'Ceraphronoidea' : genus}`"
        >
          <text
            v-for="(c, i) in columns"
            :key="c"
            :x="colX(i)"
            y="16"
            :text-anchor="i === 3 ? 'end' : 'start'"
            class="cow-fw__colhead"
          >
            {{ c }}
          </text>
          <g
            v-for="l in layout.links"
            :key="l.id"
            :class="['cow-fw__edge', { 'is-sel': pinned === l.id }]"
            @mouseenter="tipAt($event, l)"
            @mousemove="tipAt($event, l)"
            @mouseleave="tip = null"
            @click="pinned = pinned === l.id ? '' : l.id"
          >
            <path
              :d="l.d"
              :style="{ '--w': `${l.w}px` }"
              :class="['cow-fw__link', `r-${l.cls}`, { 'is-dim': (hover && !l.on) || (lineOn && lineOn !== l.id), 'is-on': (hover && l.on) || lineOn === l.id }]"
            />
            <path
              :d="l.d"
              class="cow-fw__hit"
            />
          </g>
          <g
            v-for="n in layout.nodes"
            :key="n.key"
            :class="['cow-fw__node', `k${n.layer}`, { 'is-dim': hover && !n.on, 'is-more': n.more, 'is-focus': n.focus }]"
            :transform="`translate(${n.x},${n.y})`"
            @mouseenter="!n.more && (hover = n.key)"
            @mouseleave="hover = ''"
            @click="clickNode(n)"
          >
            <circle
              v-if="!n.more"
              :r="n.r"
            />
            <circle
              v-if="n.hyper"
              :r="n.r + 3.5"
              class="cow-fw__ring"
            />
            <text
              :x="n.layer === 3 ? -14 : 14"
              dy="0.35em"
              :text-anchor="n.layer === 3 ? 'end' : 'start'"
            >
              {{ n.label }}
            </text>
            <title>{{ n.title }}</title>
          </g>
        </svg>
      </div>
      <div
        v-if="tip"
        class="cow-fw__tip"
        :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
      >
        <p>
          <i>{{ tip.l.from }}</i> <b :class="`r-${tip.l.cls}`">{{ tip.l.relText }}</b> <i>{{ tip.l.to }}</i>
        </p>
        <small>{{ tip.l.n }} record{{ tip.l.n > 1 ? 's' : '' }} · {{ tip.l.refs.length || 'no' }} reference{{ tip.l.refs.length === 1 ? '' : 's' }} · click for details</small>
      </div>
    </div>
    <p
      v-if="!layout.nodes.length"
      class="cow-ix__status"
    >
      No food-web links for this selection; the records are listed below.
    </p>

    <!-- details: a line, or the focused taxon -->
    <div
      v-if="pinnedLink"
      class="cow-fw__card"
    >
      <button
        type="button"
        class="cow-fw__close"
        aria-label="Close"
        @click="pinned = ''"
      >
        ×
      </button>
      <p class="cow-fw__cardtitle">
        <i>{{ pinnedLink.fromFull }}</i>
        <b :class="`r-${pinnedLink.cls}`">{{ pinnedLink.relText }}</b>
        <i>{{ pinnedLink.toFull }}</i>
      </p>
      <p class="cow-fw__cardmeta">
        {{ pinnedLink.n }} record{{ pinnedLink.n > 1 ? 's' : '' }} ·
        {{ pinnedLink.refs.length || 'no' }} reference{{ pinnedLink.refs.length === 1 ? '' : 's' }} · listed in the
        records below
      </p>
      <p
        v-if="refsLoading"
        class="cow-fw__loading"
      >
        Loading references…
      </p>
      <ol
        v-else-if="fullRefs.length"
        class="cow-fw__refs"
      >
        <li
          v-for="r in fullRefs"
          :key="r.id"
        >
          <span v-html="r.html" />
          <span
            v-if="r.pages"
            class="cow-fw__pp"
          > Cited on p. {{ r.pages }}.</span>
          <span class="cow-fw__reflinks">
            <a
              v-if="r.doi"
              :href="`https://doi.org/${r.doi}`"
              target="_blank"
              rel="noopener"
            >doi:{{ r.doi }}</a>
            <router-link :to="{ path: '/literature', query: { q: refQuery(r.short) } }">In Literature</router-link>
          </span>
        </li>
      </ol>
      <ul
        v-else-if="pinnedLink.refs.length"
        class="cow-fw__short"
      >
        <li
          v-for="r in pinnedLink.refs"
          :key="r"
        >
          <router-link :to="{ path: '/literature', query: { q: refQuery(r) } }">
            {{ r }}
          </router-link>
        </li>
      </ul>
    </div>
    <div
      v-else-if="focusInfo"
      class="cow-fw__card"
    >
      <button
        type="button"
        class="cow-fw__close"
        aria-label="Show everything"
        @click="setFocus('')"
      >
        ×
      </button>
      <p class="cow-fw__cardtitle">
        <i>{{ focusInfo.label }}</i>
        <span
          v-if="focusInfo.family"
          class="cow-fw__fam2"
        >{{ focusInfo.family }}</span>
      </p>
      <p class="cow-fw__cardmeta">
        {{ focusInfo.where }} · {{ focusInfo.links }} link{{ focusInfo.links === 1 ? '' : 's' }} in this web ·
        records listed below
      </p>
      <p
        v-if="focusInfo.roles"
        class="cow-fw__roles"
      >
        <span
          v-for="r in focusInfo.roles"
          :key="r.key"
          :style="{ '--c': r.color }"
        >{{ r.label }} <b>{{ r.n }}</b></span>
      </p>
      <router-link
        v-if="focusInfo.link"
        :to="focusInfo.link"
        class="cow-fw__open"
      >
        Open the species page →
      </router-link>
    </div>

    <p class="cow-ix__note">
      Each link is a published record. Links two or more steps apart can come from different papers, so they show
      possible chains, not one observed chain; the curated chains from single papers are on each species' Hosts tab.
      Hyperparasitoid means the recorded host is itself a parasitoid (inferred from the host records).
    </p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'
import { isCeraphronoid } from '../../panels/PanelHosts/associations.js'
import { ROLES } from '../../lib/roles.js'
import { csv, download } from '../../lib/dwc.js'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  genus: { type: String, default: '' },
  focus: { type: String, default: '' },
  keep: { type: Function, default: () => true },
  roleOf: { type: Function, default: () => 'primary' },
  chips: { type: Boolean, default: true }
})
const emit = defineEmits(['update:genus', 'update:focus', 'records'])

// interaction types: wording and line style
const TYPES = [
  { rel: 'parasitoid of', label: 'Parasitoid of', cls: 'par' },
  { rel: 'predator of', label: 'Predator of', cls: 'pred' },
  { rel: 'feeds on', label: 'Feeds on (plant)', cls: 'feed' }
]
const typeOf = (rel) => TYPES.find((t) => t.rel === rel) || { label: rel, cls: 'other' }

const W = 1200
const PER = 28 // nodes per column before "+ more"
const ROW = 27
const TOP = 30
const hover = ref('')
const stage = ref(null)
const svgEl = ref(null)
const tip = ref(null)
const pinned = ref('')
const expanded = ref([false, false, false, false])
const lineOn = computed(() => tip.value?.l.id || pinned.value)
const allMode = computed(() => !props.genus)
const columns = computed(() => [allMode.value ? 'Ceraphronoid genus' : 'Ceraphronoid', 'Host', "Host's host", 'Plant'])

function tipAt(e, l) {
  const r = stage.value.getBoundingClientRect()
  const x = Math.min(e.clientX - r.left + 14, r.width - 300)
  tip.value = { l, x: Math.max(0, x), y: e.clientY - r.top + 14 }
}
const setGenus = (g) => {
  emit('update:focus', '')
  emit('update:genus', g)
}
const setFocus = (k) => emit('update:focus', k)

// genus chips
const genera = computed(() => {
  const m = new Map()
  props.rows.forEach((r) => {
    if (isCeraphronoid(r.s) && r.rel !== 'feeds on' && r.s.genus && props.keep(r)) {
      const g = m.get(r.s.genus) || { name: r.s.genus, family: r.s.family, n: 0 }
      g.n++
      m.set(r.s.genus, g)
    }
  })
  return [...m.values()].sort((a, b) => b.n - a.n)
})
const total = computed(() => genera.value.reduce((t, g) => t + g.n, 0))
const byFamily = computed(() => {
  const m = new Map()
  genera.value.forEach((g) => (m.get(g.family) || m.set(g.family, []).get(g.family)).push(g))
  return [...m].map(([family, list]) => ({ family, genera: list, n: list.reduce((t, g) => t + g.n, 0) })).sort((a, b) => b.n - a.n)
})

const short = (l) => {
  // full binomial (subgenus dropped), no author
  const m = String(l).match(/^([A-Z][a-z]+)\s+(?:\([A-Za-z]+\)\s+)?([a-z][a-z-]+)/)
  if (m) return `${m[1]} ${m[2]}`
  return String(l).split(/\s+/)[0]
}
const plantName = (l) => String(l).split(' ').slice(0, 2).join(' ')
const keyOf = (t) => String(t.id || t.label)
const refQuery = (r) => r.replace(/et al\.?|[,&]/g, ' ').replace(/\s+/g, ' ').trim()

// the whole web for the chosen genus (or all genera)
const graph = computed(() => {
  const animal = props.rows.filter((r) => r.rel !== 'feeds on')
  const plants = props.rows.filter((r) => r.rel === 'feeds on')
  const L = [new Map(), new Map(), new Map(), new Map()]
  const edges = []
  const add = (layer, t) => {
    const k = keyOf(t)
    if (!L[layer].has(k)) L[layer].set(k, { key: `${layer}:${k}`, id: k, layer, t, deg: 0, roles: {} })
    return L[layer].get(k)
  }
  animal
    .filter((r) => isCeraphronoid(r.s) && props.keep(r) && (allMode.value || r.s.genus === props.genus))
    .forEach((r) => {
      const s = allMode.value ? { id: `g:${r.s.genus || '?'}`, label: r.s.genus || 'Genus unknown', family: r.s.family, genus: r.s.genus, isGenus: true } : r.s
      const a = add(0, s)
      const role = props.roleOf(r)
      a.roles[role] = (a.roles[role] || 0) + 1
      edges.push([a, add(1, r.o), r])
    })
  const l1 = new Set(L[1].keys())
  animal.filter((r) => l1.has(keyOf(r.s)) && !isCeraphronoid(r.o)).forEach((r) => {
    edges.push([L[1].get(keyOf(r.s)), add(2, r.o), r])
  })
  const l12 = new Set([...L[1].keys(), ...L[2].keys()])
  plants.filter((r) => l12.has(keyOf(r.s))).forEach((r) => {
    const from = L[2].get(keyOf(r.s)) || L[1].get(keyOf(r.s))
    edges.push([from, add(3, r.o), r])
  })
  // merge records of the same pair: interaction types, references, record ids
  const merged = new Map()
  edges.forEach(([a, b, r]) => {
    const k = `${a.key}>${b.key}`
    if (!merged.has(k)) {
      merged.set(k, [a, b, { id: k, rels: new Set(), refs: new Set(), ids: [] }])
      a.deg++
      b.deg++
    }
    const m = merged.get(k)[2]
    m.rels.add(r.rel)
    m.ids.push(r.id)
    String(r.cit || '').split(/;\s*/).map((x) => x.trim()).filter(Boolean).forEach((x) => m.refs.add(x))
  })
  return { layers: L.map((m) => [...m.values()].sort((a, b) => b.deg - a.deg)), edges: [...merged.values()] }
})

// everything upstream and downstream of some nodes
function connected(edges, start) {
  const out = new Map()
  const inn = new Map()
  edges.forEach(([a, b]) => {
    ;(out.get(a.key) || out.set(a.key, []).get(a.key)).push(b.key)
    ;(inn.get(b.key) || inn.set(b.key, []).get(b.key)).push(a.key)
  })
  const on = new Set(start)
  const walk = (map) => {
    const stack = [...start]
    const seen = new Set(start)
    while (stack.length) {
      ;(map.get(stack.pop()) || []).forEach((n) => {
        if (seen.has(n)) return
        seen.add(n)
        on.add(n)
        stack.push(n)
      })
    }
  }
  walk(out)
  walk(inn)
  return on
}

// the part shown: everything, or only the chains through the focused taxon
const view = computed(() => {
  const g = graph.value
  if (!props.focus) return { ...g, start: [] }
  const start = g.layers.flat().filter((n) => n.id === props.focus).map((n) => n.key)
  const on = connected(g.edges, start)
  return {
    layers: g.layers.map((l) => l.filter((n) => on.has(n.key))),
    edges: g.edges.filter(([a, b]) => on.has(a.key) && on.has(b.key)),
    start
  }
})

const colX = (i) => [24, 380, 736, 1176][i]
const shownLayers = computed(() =>
  view.value.layers.map((list, li) => {
    const open = props.focus || expanded.value[li] || list.length <= PER + 1
    return { list: open ? list : list.slice(0, PER), extra: open ? 0 : list.length - PER, canFold: !props.focus && expanded.value[li] && list.length > PER + 1 }
  })
)
const H = computed(() => Math.max(220, Math.max(...shownLayers.value.map((l) => l.list.length + (l.extra || l.canFold ? 1 : 0))) * ROW + TOP + 10))

const layout = computed(() => {
  const nodes = []
  const pos = new Map()
  const start = new Set(view.value.start)
  shownLayers.value.forEach(({ list, extra, canFold }, li) => {
    const count = list.length + (extra || canFold ? 1 : 0)
    const gap = (H.value - TOP - 10) / Math.max(1, count)
    list.forEach((n, i) => {
      const t = n.t
      const roles = Object.entries(n.roles)
      const nRec = roles.reduce((s, [, v]) => s + v, 0)
      const hyper = li === 0 && nRec > 0 && (n.roles.hyper || 0) / nRec > 0.5
      const label = t.isGenus ? t.label : li === 3 ? plantName(t.label) : short(t.label)
      const roleText = roles.length ? ` · ${roles.map(([k, v]) => `${ROLES[k]?.short || k} ${v}`).join(', ')}` : ''
      const node = {
        key: n.key,
        id: n.id,
        layer: li,
        x: colX(li),
        y: TOP + gap * (i + 0.5),
        r: Math.min(9, 3.5 + Math.sqrt(n.deg) * 1.4),
        label,
        title: `${t.label}${t.family && !t.isGenus ? ` (${t.family})` : ''}${roleText}`,
        hyper,
        focus: start.has(n.key),
        isGenus: t.isGenus,
        genus: t.genus
      }
      nodes.push(node)
      pos.set(n.key, node)
    })
    if (extra || canFold) {
      nodes.push({
        key: `more${li}`,
        layer: li,
        x: colX(li),
        y: TOP + gap * (count - 0.5),
        r: 0,
        label: extra ? `+ ${extra} more` : 'Show fewer',
        title: extra ? `Show all ${extra + PER}` : 'Show fewer',
        more: true,
        li
      })
    }
  })
  // what is connected to the hovered node (whole paths)
  const on = hover.value ? connected(view.value.edges, [hover.value]) : new Set()
  nodes.forEach((n) => (n.on = on.has(n.key)))
  const links = view.value.edges
    .filter(([a, b]) => pos.has(a.key) && pos.has(b.key))
    .map(([a, b, m]) => {
      const p = pos.get(a.key)
      const q = pos.get(b.key)
      // start after the label, end just before the next dot
      const x0 = p.x + 18 + String(p.label).length * 6.9
      const x1 = q.layer === 3 ? q.x - 18 - String(q.label).length * 6.9 : q.x - 10
      const mx = (x0 + x1) / 2
      return {
        ...info(a, b, m),
        d: `M${x0},${p.y} C${mx},${p.y} ${mx},${q.y} ${x1},${q.y}`,
        w: +(1.2 + Math.min(3.6, Math.log2(1 + m.refs.size) * 1.1)).toFixed(2),
        on: on.has(a.key) && on.has(b.key)
      }
    })
  return { nodes, links }
})

function clickNode(n) {
  if (n.more) {
    const e = [...expanded.value]
    e[n.li] = !e[n.li]
    expanded.value = e
  } else if (n.isGenus) setGenus(n.genus || '')
  else setFocus(props.focus === n.id ? '' : n.id)
}

function info(a, b, m) {
  const rels = [...m.rels]
  const t = typeOf(rels[0])
  const year = (x) => Number((x.match(/(\d{4})[a-z]?$/) || [])[1]) || 0
  const nm = (n) => (n.t.isGenus ? n.t.label : n.layer === 3 ? plantName(n.t.label) : short(n.t.label))
  return {
    id: m.id,
    cls: rels.length > 1 ? 'mix' : t.cls,
    relText: rels.map((r) => typeOf(r).label.replace(' (plant)', '').toLowerCase()).join(' / '),
    from: nm(a),
    to: nm(b),
    fromFull: a.t.label,
    toFull: b.t.label,
    refs: [...m.refs].sort((x, y) => year(x) - year(y) || x.localeCompare(y)),
    n: m.ids.length,
    ids: m.ids
  }
}
const pinnedLink = computed(() => {
  if (!pinned.value) return null
  const e = graph.value.edges.find(([, , m]) => m.id === pinned.value)
  return e ? info(...e) : null
})

// full references of the clicked line, from its records' citations
const fullRefs = ref([])
const refsLoading = ref(false)
const cache = new Map()
const cleanRef = (s) =>
  String(s || '')
    .replace(/\\textit\s*/g, '')
    .replace(/\s*\[in [^\]]*\]/g, '')
    .replace(/\s*https?:\/\/(dx\.)?doi\.org\/\S+\s*$/, '')
    .trim()
watch(
  () => pinnedLink.value?.id,
  async (id) => {
    fullRefs.value = []
    if (!id) return
    if (cache.has(id)) return (fullRefs.value = cache.get(id))
    refsLoading.value = true
    try {
      const { data } = await makeAPIRequest.get('/citations', {
        params: { citation_object_type: 'BiologicalAssociation', citation_object_id: pinnedLink.value.ids.slice(0, 200), extend: ['source'], per: 500 }
      })
      const m = new Map()
      ;(Array.isArray(data) ? data : []).forEach((c) => {
        const src = c.source || {}
        const e = m.get(c.source_id) || { id: c.source_id, html: cleanRef(src.label || c.citation_source_body), short: src.author_year || c.citation_source_body || '', doi: String(src.doi || '').replace(/^https?:\/\/(dx\.)?doi\.org\//, ''), year: Number(src.year) || 0, pages: new Set() }
        if (c.pages) e.pages.add(c.pages)
        m.set(c.source_id, e)
      })
      const list = [...m.values()].map((e) => ({ ...e, pages: [...e.pages].join(', ') })).sort((a, b) => a.year - b.year || a.short.localeCompare(b.short))
      cache.set(id, list)
      if (pinnedLink.value?.id === id) fullRefs.value = list
    } catch {
      fullRefs.value = []
    } finally {
      refsLoading.value = false
    }
  }
)

// the focused taxon
const focusNodes = computed(() => graph.value.layers.flat().filter((n) => n.id === props.focus))
const focusLabel = computed(() => {
  if (focusNodes.value[0]) return focusNodes.value[0].t.label
  const r = props.rows.find((x) => keyOf(x.s) === props.focus || keyOf(x.o) === props.focus)
  return r ? (keyOf(r.s) === props.focus ? r.s.label : r.o.label) : props.focus
})
const focusInfo = computed(() => {
  if (!props.focus) return null
  const n = focusNodes.value
  const t = n[0]?.t || {}
  const where = n.length ? n.map((x) => columns.value[x.layer].toLowerCase()).join(' and ') : 'not in this web'
  const roles = n.length && n[0].layer === 0
    ? Object.entries(n[0].roles).map(([k, v]) => ({ key: k, label: ROLES[k]?.label || k, color: ROLES[k]?.color || '#999', n: v }))
    : null
  const link = isCeraphronoid(t) && t.id && !t.isGenus ? { name: 'otus-id-overview', params: { id: String(t.id) } } : null
  return { label: focusLabel.value, family: t.family, where, links: view.value.edges.length, roles, link }
})

// tell the page which records are selected
watch(
  [pinnedLink, () => props.focus, view],
  () => {
    if (pinnedLink.value) emit('records', { ids: new Set(pinnedLink.value.ids), label: `${pinnedLink.value.from} → ${pinnedLink.value.to}` })
    else if (props.focus) emit('records', { ids: new Set(view.value.edges.flatMap(([, , m]) => m.ids)), label: focusLabel.value })
    else emit('records', null)
  },
  { immediate: true }
)
watch(
  () => [props.genus, props.focus],
  () => {
    pinned.value = ''
    tip.value = null
    expanded.value = [false, false, false, false]
  }
)
defineExpose({ clear: () => (pinned.value = '') })

// downloads
function downloadEdges() {
  const rows = view.value.edges.map((e) => info(...e))
  const text = csv(rows, [
    ['from', (r) => r.fromFull],
    ['interaction', (r) => r.relText],
    ['to', (r) => r.toFull],
    ['records', (r) => r.n],
    ['references', (r) => r.refs.join('; ')]
  ])
  download(text, `ceraphronoidea-food-web-${props.genus || 'all'}${props.focus ? '-focus' : ''}.csv`)
}
function downloadPng() {
  const svg = svgEl.value
  const clone = svg.cloneNode(true)
  const src = svg.querySelectorAll('*')
  const dst = clone.querySelectorAll('*')
  const P = ['fill', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'opacity', 'font-size', 'font-style', 'font-family', 'font-weight', 'letter-spacing']
  src.forEach((el, i) => {
    const cs = getComputedStyle(el)
    dst[i].setAttribute('style', P.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'))
  })
  clone.querySelectorAll('.cow-fw__hit, title').forEach((e) => e.remove())
  const w = W * 2
  const h = H.value * 2
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', w)
  clone.setAttribute('height', h)
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('width', '100%')
  bg.setAttribute('height', '100%')
  bg.setAttribute('fill', '#ffffff')
  clone.insertBefore(bg, clone.firstChild)
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    c.toBlob((b) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `ceraphronoidea-food-web-${props.genus || 'all'}.png`
      a.click()
    })
  }
  img.src = url
}
</script>
