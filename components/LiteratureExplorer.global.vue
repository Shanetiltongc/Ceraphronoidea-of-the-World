<template>
  <div class="cow-li">
    <p
      v-if="loading"
      class="cow-li__muted"
    >
      Loading the bibliography…
    </p>
    <template v-else>
      <!-- overview: decades, authors, journals -->
      <div class="cow-li__top">
        <section class="cow-li__card cow-li__decades">
          <div class="cow-li__head">
            <p class="cow-home__kicker">Publications per decade</p>
            <p class="cow-li__muted">{{ sources.length }} references · {{ firstYear }}–{{ lastYear }}</p>
          </div>
          <div class="cow-li__dbars">
            <button
              v-for="d in decadeCounts"
              :key="d.decade"
              type="button"
              :class="['cow-li__dbar', { 'is-on': openDecade === `${d.decade}s` }]"
              :title="`${d.decade}s: ${d.n} references, click to jump`"
              @click="jumpDecade(d.decade)"
            >
              <b>{{ d.n }}</b>
              <span :style="{ height: `${Math.max(3, (d.n / decadeMax) * 78)}%` }" />
              <small>{{ d.decade % 40 === 0 ? `${d.decade}s` : '' }}</small>
            </button>
          </div>
        </section>

        <section class="cow-li__card">
          <p class="cow-home__kicker">Most published authors</p>
          <ul class="cow-li__rank">
            <li
              v-for="a in topAuthors"
              :key="a.name"
            >
              <button
                type="button"
                :class="{ 'is-on': author === a.name }"
                @click="author = author === a.name ? '' : a.name"
              >
                <span>{{ a.name }}</span>
                <span class="cow-li__rbar"><span :style="{ width: `${(a.n / topAuthors[0].n) * 100}%` }" /></span>
                <b>{{ a.n }}</b>
              </button>
            </li>
          </ul>
        </section>

        <section class="cow-li__card">
          <p class="cow-home__kicker">Main journals</p>
          <ul class="cow-li__rank">
            <li
              v-for="j in topJournals"
              :key="j.name"
            >
              <button
                type="button"
                :class="{ 'is-on': journal === j.name }"
                :title="j.name"
                @click="journal = journal === j.name ? '' : j.name"
              >
                <span><i>{{ j.name }}</i></span>
                <span class="cow-li__rbar"><span :style="{ width: `${(j.n / topJournals[0].n) * 100}%` }" /></span>
                <b>{{ j.n }}</b>
              </button>
            </li>
          </ul>
        </section>
      </div>

      <!-- tools -->
      <div class="cow-li__tools">
        <input
          v-model="q"
          type="search"
          placeholder="Search author, title, journal or year…"
          aria-label="Search references"
        />
        <label class="cow-at__check"><input
          v-model="withDoi"
          type="checkbox"
        /> With DOI</label>
        <span
          v-for="f in activeFilters"
          :key="f.label"
          class="cow-li__pill"
        >
          {{ f.label }}
          <button
            type="button"
            :aria-label="`Remove ${f.label}`"
            @click="f.clear()"
          >
            ×
          </button>
        </span>
      </div>
      <p class="cow-li__count">
        <span><b>{{ shown.length }}</b> references</span>
        <span
          class="cow-li__sortsw"
          role="group"
          aria-label="Order"
        >
          <button
            v-for="o in ORDERS"
            :key="o.key"
            type="button"
            :class="{ 'is-on': order === o.key }"
            @click="order = o.key"
          >
            {{ o.label }}
          </button>
        </span>
        <button
          type="button"
          class="cow-ty__link"
          @click="downloadCsv"
        >
          CSV
        </button>
        <button
          type="button"
          class="cow-ty__link"
          @click="downloadBib"
        >
          BibTeX (Zotero, Mendeley…)
        </button>
        <RouterLink
          to="/resources/tw/filter/bibliography"
          class="cow-ty__link"
          >Advanced search</RouterLink
        >
      </p>

      <!-- the list, by year -->
      <!-- jump strip: decades (or letters), then the years of the open decade -->
      <div
        v-if="rail.length > 1"
        class="cow-li__jump"
      >
        <span class="cow-li__jumplabel">Jump to</span>
        <div class="cow-li__jumprow">
          <button
            v-for="r in rail"
            :key="r.key"
            type="button"
            :class="{ 'is-on': openDecade === r.key }"
            @click="r.sub.length > 1 ? (openDecade = openDecade === r.key ? '' : r.key) : jump(r.keys[0])"
          >
            {{ r.label }}<small v-if="r.sub.length > 1">{{ r.n }}</small>
          </button>
        </div>
        <div
          v-if="openSub.length"
          class="cow-li__jumpyears"
        >
          <button
            v-for="y in openSub"
            :key="y.key"
            type="button"
            @click="jump(y.key)"
          >
            {{ y.key }}<small>{{ y.n }}</small>
          </button>
        </div>
      </div>
      <div
        v-for="g in groups"
        :id="`lit-${g.key}`"
        :key="g.key"
        :data-key="g.key"
        class="cow-li__year"
      >
        <h3>{{ g.label }}</h3>
        <ul>
          <li
            v-for="s in g.items"
            :key="s.id"
            class="cow-li__ref"
          >
            <p class="cow-li__authors">{{ s.authorsText }}</p>
            <p
              class="cow-li__title"
              v-html="s.titleHtml"
            />
            <p class="cow-li__where">
              <i v-if="s.journal">{{ s.journal }}</i><template v-if="s.volume">, {{ s.volume }}</template
              ><template v-if="s.number">({{ s.number }})</template><template v-if="s.pages">: {{ s.pages }}</template>
              <span
                v-if="s.type && s.type !== 'article'"
                class="cow-li__type"
                >{{ s.type }}</span
              >
            </p>
            <p class="cow-li__links">
              <a
                v-if="s.doi"
                :href="`https://doi.org/${s.doi}`"
                target="_blank"
                rel="noopener"
                class="cow-li__doilink"
                >doi:{{ s.doi }}</a
              >
              <button
                type="button"
                class="cow-li__copy"
                @click="copy(s)"
              >
                {{ copied === s.id ? 'Copied ✓' : 'Copy reference' }}
              </button>
            </p>
          </li>
        </ul>
      </div>
      <p
        v-if="!shown.length"
        class="cow-li__muted"
      >
        Nothing matches.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { makeAPIRequest } from '@/utils/request'
import { csv, download } from '../lib/dwc.js'

const loading = ref(true)
const sources = ref([])
const route = useRoute()
const q = ref(String(route.query.q || ''))
watch(() => route.query.q, (v) => v && (q.value = String(v)))
const ORDERS = [
  { key: 'new', label: 'Newest first' },
  { key: 'old', label: 'Oldest first' },
  { key: 'author', label: 'Author A–Z' }
]
const order = ref('new')
const author = ref('')
const journal = ref('')
const withDoi = ref(false)
const copied = ref(null)

const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
const splitAuthors = (a) =>
  String(a || '')
    .split(/\s+and\s+|\s*;\s*/)
    .map((x) => x.trim())
    .filter(Boolean)
const surname = (a) => a.split(',')[0].trim()

onMounted(async () => {
  try {
    const out = []
    for (let page = 1; page < 10; page++) {
      const { data } = await makeAPIRequest.get('/sources', { params: { in_project: true, per: 250, page } })
      const list = Array.isArray(data) ? data : []
      list.forEach((s) => {
        const authors = splitAuthors(s.author)
        out.push({
          id: s.id,
          year: Number(s.year) || null,
          authors,
          authorsText: authors.length ? (authors.length > 1 ? `${authors.slice(0, -1).join('; ')} & ${authors[authors.length - 1]}` : authors[0]) : strip(s.cached).split('(')[0],
          surnames: authors.map(surname),
          titleHtml: s.title || strip(s.cached),
          title: strip(s.title || s.cached),
          journal: strip(s.journal || s.booktitle || ''),
          volume: s.volume || '',
          number: s.number || '',
          pages: s.pages || '',
          doi: s.doi || '',
          type: s.bibtex_type || '',
          cited: strip(s.cached)
        })
      })
      if (list.length < 250) break
    }
    sources.value = out
  } catch {
    sources.value = []
  } finally {
    loading.value = false
  }
})

const dated = computed(() => sources.value.filter((s) => s.year))
const firstYear = computed(() => Math.min(...dated.value.map((s) => s.year)))
const lastYear = computed(() => Math.max(...dated.value.map((s) => s.year)))
const decadeCounts = computed(() => {
  if (!dated.value.length) return []
  const m = new Map()
  dated.value.forEach((s) => m.set(Math.floor(s.year / 10) * 10, (m.get(Math.floor(s.year / 10) * 10) || 0) + 1))
  const out = []
  for (let d = Math.floor(firstYear.value / 10) * 10; d <= lastYear.value; d += 10) out.push({ decade: d, n: m.get(d) || 0 })
  return out
})
const decadeMax = computed(() => Math.max(1, ...decadeCounts.value.map((d) => d.n)))

const tally = (f) => {
  const m = new Map()
  sources.value.forEach((s) => f(s).forEach((k) => k && m.set(k, (m.get(k) || 0) + 1)))
  return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n)
}
const topAuthors = computed(() => tally((s) => s.surnames).slice(0, 10))
const topJournals = computed(() => tally((s) => [s.journal]).slice(0, 10))

const shown = computed(() => {
  const fold = (x) => x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = fold(q.value).split(/\s+/).filter(Boolean)
  return sources.value.filter(
    (s) =>
      (!author.value || s.surnames.includes(author.value)) &&
      (!journal.value || s.journal === journal.value) &&
      (!withDoi.value || s.doi) &&
      (!words.length || words.every((w) => fold(`${s.cited} ${s.year}`).includes(w)))
  )
})
const activeFilters = computed(() =>
  [
    author.value && { label: author.value, clear: () => (author.value = '') },
    journal.value && { label: journal.value, clear: () => (journal.value = '') }
  ].filter(Boolean)
)
const groups = computed(() => {
  const m = new Map()
  const byAuthor = order.value === 'author'
  shown.value.forEach((s) => {
    const key = byAuthor ? (s.surnames[0] || s.cited || '?').normalize('NFKD').replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '?' : s.year || 'n.d.'
    if (!m.has(key)) m.set(key, [])
    m.get(key).push(s)
  })
  const keys = [...m.keys()].sort((a, b) =>
    byAuthor ? String(a).localeCompare(String(b)) : order.value === 'old' ? (Number(a) || 9999) - (Number(b) || 9999) : (Number(b) || 0) - (Number(a) || 0)
  )
  return keys.map((key) => ({
    key: String(key),
    label: key === 'n.d.' ? 'Year unknown' : key,
    items: m.get(key).sort((a, b) => a.cited.localeCompare(b.cited) || (a.year || 0) - (b.year || 0))
  }))
})

// rail: decades with their years, or letters
const rail = computed(() => {
  if (order.value === 'author') return groups.value.map((g) => ({ key: g.key, label: g.key, keys: [g.key], sub: [] }))
  const m = new Map()
  groups.value.forEach((g) => {
    const d = Number(g.key) ? `${Math.floor(Number(g.key) / 10) * 10}s` : 'n.d.'
    if (!m.has(d)) m.set(d, [])
    m.get(d).push(g.key)
  })
  const size = Object.fromEntries(groups.value.map((g) => [g.key, g.items.length]))
  return [...m].map(([label, keys]) => ({ key: label, label, keys, sub: keys, n: keys.reduce((t, k) => t + size[k], 0) }))
})
const openDecade = ref('')
const openSub = computed(() => {
  const r = rail.value.find((x) => x.key === openDecade.value)
  if (!r) return []
  const size = Object.fromEntries(groups.value.map((g) => [g.key, g.items.length]))
  return r.sub.map((k) => ({ key: k, n: size[k] }))
})
watch(order, () => (openDecade.value = ''))

function jump(key) {
  const el = document.getElementById(`lit-${key}`)
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' })
}
function jumpDecade(d) {
  if (order.value === 'author') order.value = 'new'
  nextTick(() => {
    openDecade.value = `${d}s`
    const keys = groups.value.map((g) => Number(g.key)).filter((y) => y >= d && y < d + 10)
    if (keys.length) jump(order.value === 'old' ? Math.min(...keys) : Math.max(...keys))
  })
}


async function copy(s) {
  try {
    await navigator.clipboard.writeText(s.cited)
    copied.value = s.id
    setTimeout(() => (copied.value = null), 1800)
  } catch {
    /* clipboard blocked */
  }
}

function downloadCsv() {
  download(
    csv(shown.value, [
      ['Year', (s) => s.year],
      ['Authors', (s) => s.authors.join('; ')],
      ['Title', (s) => s.title],
      ['Journal', (s) => s.journal],
      ['Volume', (s) => s.volume],
      ['Pages', (s) => s.pages],
      ['DOI', (s) => s.doi],
      ['Reference', (s) => s.cited]
    ]),
    'ceraphronoidea-literature.csv'
  )
}

function downloadBib() {
  const esc = (v) => String(v || '').replace(/[{}]/g, '')
  const used = new Set()
  const keyOf = (s) => {
    let k = `${(s.surnames[0] || 'anon').normalize('NFKD').replace(/[^A-Za-z]/g, '')}${s.year || ''}`
    let n = 0
    while (used.has(k + (n ? String.fromCharCode(96 + n) : ''))) n++
    k += n ? String.fromCharCode(96 + n) : ''
    used.add(k)
    return k
  }
  const body = shown.value
    .map((s) => {
      const type = s.type || 'misc'
      const fields = [
        ['author', s.authors.join(' and ')],
        ['title', `{${esc(s.title)}}`],
        [type === 'article' ? 'journal' : 'booktitle', s.journal],
        ['year', s.year],
        ['volume', s.volume],
        ['number', s.number],
        ['pages', s.pages],
        ['doi', s.doi]
      ].filter(([, v]) => v)
      return `@${type}{${keyOf(s)},\n${fields.map(([k, v]) => `  ${k} = {${esc(v)}}`).join(',\n')}\n}`
    })
    .join('\n\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'application/x-bibtex;charset=utf-8' }))
  a.download = 'ceraphronoidea-literature.bib'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
</script>
