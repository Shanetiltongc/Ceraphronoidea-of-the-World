<template>
  <VCard>
    <VCardHeader class="flex justify-between">
      <h2 class="text-md">Nomenclature</h2>
    </VCardHeader>
    <VCardContent>
  <section class="cow-nm">
    <header class="cow-nm__head">
      <div>
        <p
          v-if="!loading && entries.length"
          class="cow-nm__sum"
        >
          {{ entries.length }} {{ entries.length === 1 ? 'entry' : 'entries' }} · {{ names.length }}
          {{ names.length === 1 ? 'name' : 'names' }} · {{ refs.length }} {{ refs.length === 1 ? 'reference' : 'references' }}
          <template v-if="firstYear"> · since {{ firstYear }}</template>
        </p>
      </div>
      <div
        v-if="refs.length"
        class="cow-nm__switch"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="view === 'timeline'"
          :class="{ 'is-on': view === 'timeline' }"
          @click="view = 'timeline'"
        >
          Timeline
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="view === 'refs'"
          :class="{ 'is-on': view === 'refs' }"
          @click="view = 'refs'"
        >
          References {{ refs.length }}
        </button>
      </div>
    </header>

    <p
      v-if="loading"
      class="cow-nm__muted"
    >
      Loading nomenclature…
    </p>
    <p
      v-else-if="!entries.length"
      class="cow-nm__muted"
    >
      No nomenclatural record yet.
    </p>

    <template v-else-if="view === 'timeline'">
      <!-- the names involved: click one to follow it -->
      <div
        v-if="names.length > 1"
        class="cow-nm__names"
      >
        <button
          v-for="n in moreNames ? names : names.slice(0, 4)"
          :key="n.id"
          type="button"
          :class="['cow-nm__name', { 'is-on': nameFilter === n.id, 'is-valid': n.valid }]"
          :title="n.valid ? 'Valid name' : 'Other name'"
          @click="nameFilter = nameFilter === n.id ? null : n.id"
        >
          <span v-html="n.html" />
          <small>{{ n.count }}</small>
        </button>
        <button
          v-if="names.length > 4"
          type="button"
          class="cow-nm__name cow-nm__name--more"
          @click="moreNames = !moreNames"
        >
          {{ moreNames ? 'Fewer names' : `+${names.length - 4} more names` }}
        </button>
      </div>

      <ol class="cow-nm__tl">
        <li
          v-for="(e, i) in shown"
          :key="i"
          :class="['cow-nm__ev', { 'is-orig': e.original }]"
        >
          <span class="cow-nm__year">{{ e.year || '—' }}</span>
          <div class="cow-nm__card">
            <p class="cow-nm__label">
              <span v-html="e.name" />
              <span
                v-if="e.original"
                class="cow-nm__tag is-orig"
                >Original description</span
              >
              <span
                v-if="e.status"
                :class="['cow-nm__tag', { 'is-valid': /valid/i.test(e.status) && !/invalid/i.test(e.status) }]"
                v-html="e.status"
              />
            </p>
            <p
              v-if="e.type"
              class="cow-nm__type"
              v-html="e.type"
            />
            <p
              v-if="e.ref"
              class="cow-nm__ref"
              v-html="e.ref"
            />
          </div>
        </li>
      </ol>
      <button
        v-if="filtered.length > LIMIT"
        type="button"
        class="cow-nm__more"
        @click="all = !all"
      >
        {{ all ? 'Show fewer' : `Show all ${filtered.length} entries` }}
      </button>
    </template>

    <template v-else>
      <ol class="cow-nm__refs">
        <li
          v-for="r in refs"
          :key="r.id"
        >
          <span class="cow-nm__ryear">{{ r.year || '' }}</span>
          <span v-html="r.html" />
        </li>
      </ol>
      <button
        type="button"
        class="cow-nm__more"
        @click="copyRefs"
      >
        {{ copied ? 'Copied ✓' : 'Copy reference list' }}
      </button>
    </template>
  </section>
    </VCardContent>
  </VCard>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils'

const props = defineProps({
  taxonId: { type: [Number, String], default: null },
  taxon: { type: Object, default: () => ({}) }
})

const LIMIT = 10
const loading = ref(true)
const catalog = ref(null)
const view = ref('timeline')
const nameFilter = ref(null)
const all = ref(false)
const copied = ref(false)
const moreNames = ref(false)

const texToHtml = (html) =>
  String(html || '')
    .replace(/\\textit\{([^}]+)\}/g, '<i>$1</i>')
    .replace(/\\emph\{([^}]+)\}/g, '<i>$1</i>')
    .replace(/\\textbf\{([^}]+)\}/g, '<b>$1</b>')
    .replace(/\\textit\s*([A-Za-z]+)/g, '<i>$1</i>')
    .replace(/\\emph\s*([A-Za-z]+)/g, '<i>$1</i>')
const linkify = (html) =>
  texToHtml(html).replace(/(^|[\s(])((?:https?:\/\/|doi:\s?)[^\s<)]+[^\s<).,;])/g, (m, pre, url) => {
    const href = url.startsWith('doi:') ? `https://doi.org/${url.replace(/^doi:\s?/, '')}` : url
    return `${pre}<a href="${href}" target="_blank" rel="noopener">${url}</a>`
  })
const strip = (h) =>
  texToHtml(h)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

async function load() {
  loading.value = true
  catalog.value = null
  nameFilter.value = null
  all.value = false
  view.value = 'timeline'
  if (!props.taxonId) return
  try {
    const { data } = await makeAPIRequest.get(`/taxon_names/${props.taxonId}/inventory/catalog`)
    catalog.value = data
  } catch {
    catalog.value = null
  } finally {
    loading.value = false
  }
}
watch(() => props.taxonId, load, { immediate: true })

const sourceById = computed(() => Object.fromEntries((catalog.value?.sources || []).map((s) => [s.id, s])))

// "<i>X y</i> Author, 1858: 12. (junior synonym of …) " → name part + status
function split(label) {
  const l = String(label || '').trim()
  const m = l.match(/^(.*?)\s*\(((?:[^()]|\([^()]*\))*)\)\s*$/)
  // "(Szelényi, 1938)" is the author of a combination, not a status
  const isAuthor = m && /^[^,()<]{1,60},\s*\d{4}[a-z]?$/.test(m[2].trim()) && !/\b(of|synonym|valid|homonym|nomen|combination|status)\b/i.test(m[2])
  if (!m || isAuthor) return { name: l.replace(/\.\s*$/, ''), status: '' }
  return { name: m[1].replace(/\.\s*$/, ''), status: m[2] }
}

const entries = computed(() => {
  const seen = new Set()
  return (catalog.value?.timeline || []).map((t) => {
    const { name, status } = split(t.label)
    const proto = (t.protonym_ids || [])[0] || t.taxon_name_id
    const original = !seen.has(proto) && !/\sin\s/.test(strip(name))
    seen.add(proto)
    const src = sourceById.value[t.source_id]
    return {
      year: t.year,
      proto,
      name,
      status,
      original,
      type: t.type_label || '',
      ref: src ? linkify(src.cached) + (src.url && !String(src.cached).includes(src.url) ? ` <a href="${src.url}" target="_blank" rel="noopener">link</a>` : '') : ''
    }
  })
})

const names = computed(() => {
  const m = new Map()
  const validId = Number(props.taxon?.id)
  // genus + species of the name shown on the page
  const current = strip(props.taxon?.full_name_tag).replace(/\s*\(.*$/, '').split(/\s+/).slice(0, 2).join(' ')
  entries.value.forEach((e) => {
    if (!m.has(e.proto)) {
      const html = e.name.replace(/\s+in\s+.*$/, '').replace(/:\s*[\d,\s–-]+$/, '')
      m.set(e.proto, { id: e.proto, html, count: 0, valid: e.proto === validId || (current && strip(html).startsWith(current)) })
    }
    m.get(e.proto).count++
  })
  const list = [...m.values()]
  // only one name is the current one
  let found = false
  list.forEach((n) => {
    n.valid = n.valid && !found
    if (n.valid) found = true
  })
  return list.sort((a, b) => Number(b.valid) - Number(a.valid))
})

const filtered = computed(() => entries.value.filter((e) => !nameFilter.value || e.proto === nameFilter.value))
const shown = computed(() => (all.value ? filtered.value : filtered.value.slice(0, LIMIT)))
const firstYear = computed(() => Math.min(...entries.value.map((e) => e.year).filter(Boolean)) || '')

const refs = computed(() =>
  (catalog.value?.sources || [])
    .map((s) => ({ id: s.id, year: Number((strip(s.cached).match(/\((\d{4})/) || [])[1]) || null, html: linkify(s.cached), text: strip(s.cached) }))
    .sort((a, b) => (a.year || 9999) - (b.year || 9999) || a.text.localeCompare(b.text))
)

async function copyRefs() {
  try {
    await navigator.clipboard.writeText(refs.value.map((r) => r.text).join('\n'))
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* clipboard blocked */
  }
}
</script>
