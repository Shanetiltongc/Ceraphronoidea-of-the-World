<template>
  <div class="cow-keys">
    <h1 class="cow-keys__heading">Keys</h1>
    <p class="cow-keys__intro">
      Illustrated identification keys. Open a key, then work one couplet at a
      time: two statements, pick the one that matches your specimen.
    </p>

    <div class="cow-keys-search">
      <input
        v-model="query"
        type="search"
        placeholder="Search keys by taxon name…"
        aria-label="Search keys by taxon name"
      />
      <button
        v-if="query"
        type="button"
        class="cow-keys-search__clear"
        title="Clear search"
        @click="query = ''"
      >
        ✕
      </button>
    </div>

    <p v-if="loading" class="cow-keys__status">Loading keys…</p>
    <p v-else-if="errorMessage" class="cow-keys__status">{{ errorMessage }}</p>
    <p v-else-if="!keys.length" class="cow-keys__status">
      No public keys in this project.
    </p>
    <p v-else-if="!filtered.length" class="cow-keys__status">
      No keys match “{{ query }}”.
    </p>
    <ul v-else class="cow-keys-list">
      <li
        v-for="key in filtered"
        :key="key.id"
        class="cow-keys-card"
      >
        <RouterLink
          class="cow-keys-card__title"
          :to="`/keys/${key.id}`"
          v-html="key.titleHtml"
        />
        <p v-if="key.scope" class="cow-keys-card__meta">
          <span class="cow-keys-card__label">Scope</span>
          <RouterLink
            v-if="key.otuId"
            class="cow-keys-card__scope"
            :to="{ name: 'otus-id', params: { id: key.otuId } }"
            target="_blank"
            rel="noopener"
          >
            <span v-if="key.scopeHtml" v-html="key.scopeHtml" />
            <span v-else>{{ key.scope }}</span>
          </RouterLink>
          <span v-else-if="key.scopeHtml" v-html="key.scopeHtml" />
          <span v-else>{{ key.scope }}</span>
        </p>
        <p v-if="key.sourceLabel || key.doiUrl" class="cow-keys-card__meta">
          <span class="cow-keys-card__label">Source</span>
          <span class="cow-keys-card__source">
            <span v-if="key.sourceLabel">{{ key.sourceLabel }}</span>
            <a
              v-if="key.doiUrl"
              class="cow-keys-card__doi"
              :href="key.doiUrl"
              target="_blank"
              rel="noopener"
            >{{ key.doiDisplay }}</a>
          </span>
        </p>
        <p v-if="key.description" class="cow-keys-card__desc">
          {{ key.description }}
        </p>
        <div class="cow-keys-card__chips">
          <span v-if="key.coupletsCount" class="cow-keys-chip">
            {{ key.coupletsCount }} couplets
          </span>
          <span v-if="key.taxaCount" class="cow-keys-chip">
            {{ key.taxaCount }} taxa
          </span>
          <span v-if="key.updatedInWords" class="cow-keys-chip">
            updated {{ key.updatedInWords }} ago
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { makeAPIRequest } from '@/utils'

const loading = ref(true)
const keys = ref([])
const query = ref('')
const errorMessage = ref('')

const RANK_ORDER = [
  'superfamily',
  'family',
  'subfamily',
  'tribe',
  'genus',
  'subgenus',
  'species',
  'subspecies'
]

function stripTags(value) {
  return String(value || '').replace(/<[^>]*>/g, '')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function italicizeTaxon(title, scopeHtml) {
  const safe = escapeHtml(title || '')
  const first = stripTags(scopeHtml).trim().split(/\s+/)[0]
  if (!first) return safe
  const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return safe.replace(new RegExp(`\\b(${escaped})\\b`), '<i>$1</i>')
}

function otuNameFromTag(tag) {
  if (!tag) return null
  const match = String(tag).match(
    /otu_tag_(?:taxon_name|otu_name)[^>]*>([\s\S]*?)<\/span>/
  )
  return match && match[1].trim() ? match[1].trim() : null
}

function rankIndex(rank) {
  const name = String(rank || '')
    .toLowerCase()
    .replace(/^rank::/i, '')
  const idx = RANK_ORDER.indexOf(name)
  return idx < 0 ? Number.POSITIVE_INFINITY : idx
}

function citationPlain(citation) {
  if (!citation) return ''
  if (typeof citation === 'string') return stripTags(citation)
  return stripTags(
    citation.object_tag ||
      citation.cached ||
      citation.full_citation ||
      ''
  )
}

/** Short index label: "Author, Year" — full citation lives in key Metadata. */
function shortSourceLabel(plain) {
  const text = String(plain || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  const match = text.match(
    /^(.+?)\s*\((\d{4}[a-z]?)\)/
  )
  if (match) {
    let authors = match[1].trim().replace(/\s*,\s*$/, '')
    authors = authors.replace(/\s+&\s+/g, ' & ')
    return `${authors}, ${match[2]}`
  }
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}

function extractDoi(plain) {
  const text = String(plain || '')
  const match = text.match(
    /(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)(\S+)/i
  )
  if (!match) return { doiUrl: null, doiDisplay: null }
  const doi = match[1].replace(/[.,;)\]]+$/, '')
  return {
    doiUrl: `https://doi.org/${doi}`,
    doiDisplay: `doi:${doi}`
  }
}

/** Keep only short, public blurbs — drop draft / license / attach notes. */
function publicDescription(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (/to be attached|confirm on PDF|CC BY-NC|draft|TODO/i.test(text)) {
    return null
  }
  if (text.length > 160) return `${text.slice(0, 157)}…`
  return text
}

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return keys.value
  return keys.value.filter((key) =>
    [
      stripTags(key.titleHtml || key.title),
      stripTags(key.scopeHtml || key.scope),
      key.sourceLabel || '',
      key.description || ''
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  )
})

onMounted(async () => {
  errorMessage.value = ''
  try {
    const { data } = await makeAPIRequest.get('/leads', { params: { per: 1000 } })
    const leads = Array.isArray(data) ? data : []

    const metadata = await Promise.all(
      leads.map((lead) =>
        makeAPIRequest
          .get(`/leads/key/${lead.id}`)
          .then((response) => response.data?.metadata || {})
          .catch(() => ({}))
      )
    )

    const otuIds = [...new Set(leads.map((lead) => lead.otu_id).filter(Boolean))]
    const otuNames = new Map()
    const otuRanks = new Map()

    if (otuIds.length) {
      try {
        const params = new URLSearchParams()
        otuIds.forEach((id) => params.append('otu_id[]', id))
        params.set('per', '1000')
        const { data: otus } = await makeAPIRequest.get(`/otus?${params.toString()}`)
        const taxonByOtu = new Map()
        for (const otu of Array.isArray(otus) ? otus : []) {
          otuNames.set(otu.id, otuNameFromTag(otu.object_tag))
          if (otu.taxon_name_id != null) taxonByOtu.set(otu.id, otu.taxon_name_id)
        }
        const taxonIds = [...new Set(taxonByOtu.values())]
        if (taxonIds.length) {
          const nameParams = new URLSearchParams()
          taxonIds.forEach((id) => nameParams.append('taxon_name_id[]', id))
          nameParams.set('per', '1000')
          const { data: names } = await makeAPIRequest.get(
            `/taxon_names?${nameParams.toString()}`
          )
          const ranks = new Map(
            (Array.isArray(names) ? names : []).map((name) => [
              name.id,
              name.rank || name.rank_string
            ])
          )
          for (const [otuId, taxonId] of taxonByOtu) {
            otuRanks.set(otuId, rankIndex(ranks.get(taxonId)))
          }
        }
      } catch {
        /* scope labels are optional */
      }
    }

    keys.value = leads
      .map((lead, index) => {
        const meta = metadata[index]
        const scopeHtml = otuNames.get(lead.otu_id) || null
        const title = meta.title || lead.text || `Key ${lead.id}`
        const citation = citationPlain(meta.origin_citation)
        const { doiUrl, doiDisplay } = extractDoi(citation)
        return {
          id: lead.id,
          title,
          titleHtml: italicizeTaxon(title, scopeHtml),
          scope: meta.taxonomic_scope || null,
          otuId: lead.otu_id || null,
          scopeHtml,
          scopeRankIdx: otuRanks.get(lead.otu_id) ?? Number.POSITIVE_INFINITY,
          sourceLabel: shortSourceLabel(citation),
          doiUrl,
          doiDisplay,
          description: publicDescription(lead.description),
          coupletsCount: lead.couplets_count || null,
          taxaCount: lead.otus_count
            ? Math.max(0, lead.otus_count - (lead.otu_id ? 1 : 0))
            : null,
          updatedInWords: lead.key_updated_at_in_words || null
        }
      })
      .sort((a, b) => {
        if (a.scopeRankIdx !== b.scopeRankIdx) return a.scopeRankIdx - b.scopeRankIdx
        if ((a.coupletsCount || 0) !== (b.coupletsCount || 0)) {
          return (b.coupletsCount || 0) - (a.coupletsCount || 0)
        }
        return String(a.title).localeCompare(String(b.title))
      })
  } catch (err) {
    keys.value = []
    errorMessage.value =
      err?.response?.status
        ? `Could not load keys from TaxonWorks (HTTP ${err.response.status}).`
        : 'Could not load keys from TaxonWorks.'
    console.error('KeysList failed to load /leads', err)
  } finally {
    loading.value = false
  }
})
</script>
