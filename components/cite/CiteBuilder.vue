<template>
  <div class="cow-ci">
    <!-- the builder -->
    <section class="cow-ci__builder">
      <div class="cow-ci__what">
        <p class="cow-ci__kicker">What are you citing?</p>
        <div
          class="cow-ci__tabs"
          role="tablist"
        >
          <button
            v-for="t in TABS"
            :key="t.key"
            type="button"
            role="tab"
            :aria-selected="kind === t.key"
            :class="{ 'is-on': kind === t.key }"
            @click="kind = t.key"
          >
            <b>{{ t.label }}</b>
            <small>{{ t.help }}</small>
          </button>
        </div>
      </div>

      <div class="cow-ci__form">
        <!-- taxon -->
        <div
          v-if="kind === 'taxon'"
          class="cow-ci__field"
        >
          <label for="cow-ci-taxon">Taxon</label>
          <div class="cow-ci__find">
            <input
              id="cow-ci-taxon"
              v-model="tq"
              type="search"
              autocomplete="off"
              placeholder="Start typing a name, e.g. Dendrocerus carpenteri"
              @keydown.down.prevent="cur = Math.min(cur + 1, hits.length - 1)"
              @keydown.up.prevent="cur = Math.max(cur - 1, 0)"
              @keydown.enter.prevent="hits[cur] && pickTaxon(hits[cur])"
            />
            <ul
              v-if="hits.length && tq !== taxon?.plain"
              class="cow-ix__suggest"
            >
              <li
                v-for="(h, i) in hits"
                :key="h.id"
                :class="{ 'is-cur': i === cur }"
                @mousedown.prevent="pickTaxon(h)"
                @mouseenter="cur = i"
                v-html="h.html"
              />
            </ul>
          </div>
        </div>

        <!-- data -->
        <template v-if="kind === 'data'">
          <div class="cow-ci__field">
            <label for="cow-ci-ds">Dataset</label>
            <select
              id="cow-ci-ds"
              v-model="dataset"
            >
              <option
                v-for="d in DATASETS"
                :key="d.key"
                :value="d.key"
              >
                {{ d.label }}
              </option>
            </select>
          </div>
          <div class="cow-ci__field">
            <label for="cow-ci-filter">Filter used (optional)</label>
            <input
              id="cow-ci-filter"
              v-model="filter"
              type="text"
              placeholder="e.g. genus Dendrocerus; host order Hemiptera"
            />
          </div>
          <div class="cow-ci__field">
            <label for="cow-ci-link">Link to the view (optional)</label>
            <input
              id="cow-ci-link"
              v-model="viewLink"
              type="url"
              :placeholder="`${SITE.url}#${currentDataset.path}`"
            />
          </div>
        </template>

        <!-- image -->
        <template v-if="kind === 'image'">
          <div class="cow-ci__field">
            <label for="cow-ci-subj">Subject</label>
            <input
              id="cow-ci-subj"
              v-model="imgSubject"
              type="text"
              placeholder="e.g. Conostigmus tubifer, holotype, lateral habitus"
            />
          </div>
          <div class="cow-ci__field">
            <label for="cow-ci-by">Photographer</label>
            <input
              id="cow-ci-by"
              v-model="imgBy"
              type="text"
            />
          </div>
        </template>

        <div class="cow-ci__row">
          <div class="cow-ci__field">
            <label for="cow-ci-date">Accessed</label>
            <input
              id="cow-ci-date"
              v-model="date"
              type="date"
            />
          </div>
          <div class="cow-ci__field">
            <span class="cow-ci__label">Style</span>
            <div class="cow-ty2__seg">
              <button
                v-for="s in STYLES"
                :key="s.key"
                type="button"
                :class="{ 'is-on': style === s.key }"
                @click="style = s.key"
              >
                {{ s.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- the result -->
      <div class="cow-ci__out">
        <div class="cow-ci__fmts">
          <button
            v-for="f in FORMATS"
            :key="f.key"
            type="button"
            :class="{ 'is-on': fmt === f.key }"
            @click="fmt = f.key"
          >
            {{ f.label }}
          </button>
        </div>
        <p
          v-if="kind === 'taxon' && !taxon"
          class="cow-ci__hint"
        >
          Pick a taxon above to build its citation.
        </p>
        <template v-else>
          <p
            v-if="fmt === 'text'"
            class="cow-ci__text"
            v-html="textHtml"
          />
          <pre
            v-else
            class="cow-ci__code"
          >{{ output }}</pre>
          <div class="cow-ci__actions">
            <button
              type="button"
              class="cow-ci__copy"
              @click="copy"
            >
              {{ copied ? 'Copied ✓' : 'Copy' }}
            </button>
            <button
              v-if="fmt !== 'text'"
              type="button"
              class="cow-ix__link"
              @click="save"
            >
              Download .{{ currentFormat.ext }}
            </button>
            <span class="cow-ci__note">{{ currentFormat.note }}</span>
          </div>
        </template>
      </div>
    </section>

    <!-- also cite -->
    <section class="cow-ci__grid">
      <div class="cow-ci__card">
        <p class="cow-ci__kicker">Also cite: nomenclature</p>
        <p>
          Names follow Johnson, N.F. &amp; Musetti, L. (2004) Catalog of the systematic literature of the superfamily
          Ceraphronoidea (Hymenoptera). <i>Contributions of the American Entomological Institute</i>, 33, 1–149. Cite the
          original descriptions too: each taxon page lists them under <b>Nomenclature → References</b>.
        </p>
      </div>
      <div class="cow-ci__card">
        <p class="cow-ci__kicker">Images</p>
        <p>
          Images are open access under <b>{{ SITE.imageLicence }}</b> unless stated otherwise. Credit the photographer
          (most specimen photographs are by István Mikó) and this website.
        </p>
      </div>
      <div class="cow-ci__card">
        <p class="cow-ci__kicker">Data releases</p>
        <p>
          Versioned data releases with a DOI on Zenodo are planned. Until then, cite the website with the date of your
          download and, if you can, the link to the filtered view, so the same records can be found again.
        </p>
      </div>
    </section>

    <!-- people -->
    <section class="cow-ci__block">
      <h2 class="cow-ci__h2">
        Who makes this
      </h2>
      <div class="cow-ci__people">
        <div
          v-for="p in PEOPLE"
          :key="p.name"
          class="cow-ci__person"
        >
          <span class="cow-ci__avatar">{{ p.name.split(' ').map((x) => x[0]).slice(0, 2).join('') }}</span>
          <div>
            <b>{{ p.name }}</b>
            <span>{{ p.role }}</span>
            <small>{{ p.place }}</small>
            <a
              v-if="p.orcid"
              :href="`https://orcid.org/${p.orcid}`"
              target="_blank"
              rel="noopener"
              class="cow-ci__orcid"
            >ORCID {{ p.orcid }}</a>
          </div>
        </div>
      </div>
      <p class="cow-ix__note">
        Data are curated in <a href="https://taxonworks.org">TaxonWorks</a> (Species File Group); the site is built with
        <a href="https://github.com/SpeciesFileGroup/taxonpages">TaxonPages</a>. Funding and acknowledgements: to be added.
      </p>
    </section>

    <!-- cited by -->
    <section class="cow-ci__block">
      <h2 class="cow-ci__h2">
        Cited by <small v-if="CITED_BY.length">{{ CITED_BY.length }}</small>
      </h2>
      <ol
        v-if="CITED_BY.length"
        class="cow-fo2__refs"
      >
        <li
          v-for="c in CITED_BY"
          :key="c.text"
        >
          <span class="cow-fo2__year">{{ c.year }}</span>
          <span v-html="c.text" />
        </li>
      </ol>
      <p
        v-else
        class="cow-ci__empty"
      >
        No publications listed yet. Used the site in a paper?
        <a
          :href="`${SITE.repo}/issues/new?title=${encodeURIComponent('Cited by: ')}`"
          target="_blank"
          rel="noopener"
        >Tell us on GitHub</a>
        and we will add it here.
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils/request'

// ---- edit here ----
const SITE = {
  title: 'Ceraphronoidea of the World',
  authors: [
    { family: 'Mikó', given: 'István', initials: 'I.' },
    { family: 'Tilton', given: 'Shane', initials: 'S.' }
  ],
  year: 2026,
  url: 'https://shanetiltongc.github.io/Ceraphronoidea-of-the-World/',
  repo: 'https://github.com/Shanetiltongc/Ceraphronoidea-of-the-World',
  imageLicence: 'CC BY-NC-SA 4.0'
}
const PEOPLE = [
  { name: 'István Mikó', role: 'Taxonomy, data curation, imaging', place: 'University of New Hampshire', orcid: '' },
  { name: 'Shane Tilton', role: 'Database and website', place: '', orcid: '' }
]
// papers that cite the site: { year: 2026, text: 'Author (2026) Title. <i>Journal</i>…' }
const CITED_BY = []
// -------------------

const TABS = [
  { key: 'site', label: 'The website', help: 'the whole resource' },
  { key: 'taxon', label: 'A taxon page', help: 'one genus or species' },
  { key: 'data', label: 'Data', help: 'records you downloaded' },
  { key: 'image', label: 'An image', help: 'a specimen photograph' },
  { key: 'software', label: 'Software', help: 'the code behind the site' }
]
const DATASETS = [
  { key: 'hosts', label: 'Host and interaction records', path: '/interactions' },
  { key: 'specimens', label: 'Specimen records', path: '/specimens' },
  { key: 'types', label: 'Type specimens', path: '/types' },
  { key: 'distribution', label: 'Distribution (literature records)', path: '/atlas' },
  { key: 'fossils', label: 'Fossil species', path: '/fossils' },
  { key: 'literature', label: 'Literature', path: '/literature' }
]
const STYLES = [
  { key: 'zootaxa', label: 'Zootaxa' },
  { key: 'pensoft', label: 'Pensoft' },
  { key: 'apa', label: 'APA' }
]
const FORMATS = [
  { key: 'text', label: 'Text', ext: 'txt', note: 'Paste into your reference list.' },
  { key: 'bibtex', label: 'BibTeX', ext: 'bib', note: 'For LaTeX, Zotero, JabRef.' },
  { key: 'ris', label: 'RIS', ext: 'ris', note: 'For EndNote, Zotero, Mendeley.' },
  { key: 'csl', label: 'CSL-JSON', ext: 'json', note: 'For Zotero and citation processors.' }
]

const kind = ref('site')
const style = ref('zootaxa')
const fmt = ref('text')
const date = ref(new Date().toISOString().slice(0, 10))
const dataset = ref('hosts')
const filter = ref('')
const viewLink = ref('')
const imgSubject = ref('')
const imgBy = ref('István Mikó')
const copied = ref(false)

const currentDataset = computed(() => DATASETS.find((d) => d.key === dataset.value))
const currentFormat = computed(() => FORMATS.find((f) => f.key === fmt.value))

// taxon search
const tq = ref('')
const hits = ref([])
const cur = ref(0)
const taxon = ref(null)
let timer = null
watch(tq, (v) => {
  clearTimeout(timer)
  cur.value = 0
  if (!v || v.length < 3 || v === taxon.value?.plain) return (hits.value = [])
  timer = setTimeout(async () => {
    try {
      const { data } = await makeAPIRequest.get('/taxon_names', { params: { name: v, name_exact: false, 'taxon_name_id[]': 1541972, descendants: true, per: 10 } })
      hits.value = (data || []).slice(0, 10).map((t) => ({
        id: t.id,
        plain: `${t.cached} ${t.cached_author_year || ''}`.trim(),
        name: t.cached,
        author: t.cached_author_year || '',
        html: t.cached_html ? `${t.cached_html} ${t.cached_author_year || ''}` : `<i>${t.cached}</i> ${t.cached_author_year || ''}`
      }))
    } catch {
      hits.value = []
    }
  }, 250)
})
async function pickTaxon(h) {
  tq.value = h.plain
  hits.value = []
  taxon.value = { ...h, otu: null }
  try {
    const { data } = await makeAPIRequest.get('/otus', { params: { 'taxon_name_id[]': h.id, per: 5 } })
    if (taxon.value?.id === h.id) taxon.value = { ...taxon.value, otu: data?.[0]?.id || null }
  } catch {
    /* no OTU: link to the site */
  }
}

// ---- building blocks ----
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const d = computed(() => {
  const [y, m, dd] = date.value.split('-').map(Number)
  return { y, m, d: dd }
})
const dateLong = computed(() => `${d.value.d} ${MONTHS[d.value.m - 1]} ${d.value.y}`)
const dateApa = computed(() => `${MONTHS[d.value.m - 1]} ${d.value.d}, ${d.value.y}`)
const dateDot = computed(() => `${String(d.value.d).padStart(2, '0')}.${String(d.value.m).padStart(2, '0')}.${d.value.y}`)

function authorsText(st) {
  const a = SITE.authors
  if (st === 'pensoft') return a.map((x) => `${x.family} ${x.initials.replace(/\./g, '')}`).join(', ')
  if (st === 'apa') return a.length > 1 ? `${a.slice(0, -1).map((x) => `${x.family}, ${x.initials}`).join(', ')}, & ${a[a.length - 1].family}, ${a[a.length - 1].initials}` : `${a[0].family}, ${a[0].initials}`
  return a.length > 1 ? `${a.slice(0, -1).map((x) => `${x.family}, ${x.initials}`).join(', ')} & ${a[a.length - 1].family}, ${a[a.length - 1].initials}` : `${a[0].family}, ${a[0].initials}`
}

// the item being cited: title (html + plain), container, url, type
const item = computed(() => {
  const site = SITE.title
  if (kind.value === 'taxon' && taxon.value) {
    const url = taxon.value.otu ? `${SITE.url}#/otus/${taxon.value.otu}/overview` : SITE.url
    return {
      titleHtml: `<i>${taxon.value.name}</i>${taxon.value.author ? ` ${taxon.value.author}` : ''}`,
      title: taxon.value.plain,
      container: site,
      url,
      type: 'webpage',
      id: `cow_${taxon.value.name.replace(/\W+/g, '_').toLowerCase()}`
    }
  }
  if (kind.value === 'data') {
    const ds = currentDataset.value
    const f = filter.value.trim()
    const t = `${ds.label} of Ceraphronoidea${f ? ` (${f})` : ''}`
    return { titleHtml: t, title: t, container: site, url: viewLink.value.trim() || `${SITE.url}#${ds.path}`, type: 'dataset', id: `cow_data_${ds.key}`, verb: 'downloaded' }
  }
  if (kind.value === 'image') {
    const t = `${imgSubject.value.trim() || '[subject]'}. Photograph by ${imgBy.value.trim() || '[photographer]'}, ${SITE.imageLicence}`
    return { titleHtml: t, title: t, container: site, url: SITE.url, type: 'graphic', id: 'cow_image' }
  }
  if (kind.value === 'software') {
    return { titleHtml: `${site}: source code (TaxonPages site)`, title: `${site}: source code (TaxonPages site)`, container: 'GitHub', url: SITE.repo, type: 'software', id: 'cow_software' }
  }
  return { titleHtml: `<i>${site}</i>`, title: site, container: '', url: SITE.url, type: 'webpage', id: 'cow_website' }
})

const textHtml = computed(() => {
  const it = item.value
  const au = authorsText(style.value)
  const y = SITE.year
  const verb = it.verb === 'downloaded' ? 'downloaded' : 'accessed'
  const inSite = it.container && it.container !== 'GitHub' ? (style.value === 'apa' ? ` In <i>${it.container}</i>.` : ` In: <i>${it.container}</i>.`) : it.container === 'GitHub' ? ' GitHub.' : ''
  if (style.value === 'pensoft') return `${au} (${y}) ${it.titleHtml.replace(/<\/?i>/g, (m) => m)}.${inSite} ${link(it.url)} [${verb} ${dateDot.value}]`
  if (style.value === 'apa') return `${au} (${y}). ${it.container ? it.titleHtml : `<i>${it.title}</i>`}.${inSite} ${verb === 'downloaded' ? `Downloaded ${dateApa.value}` : `Retrieved ${dateApa.value}`}, from ${link(it.url)}`
  return `${au} (${y}) ${it.titleHtml}.${inSite} Available from: ${link(it.url)} (${verb} ${dateLong.value})`
})
const link = (u) => `<a href="${u}">${u}</a>`
const plain = (h) => h.replace(/<[^>]+>/g, '')

const output = computed(() => {
  const it = item.value
  const a = SITE.authors
  if (fmt.value === 'bibtex') {
    const type = it.type === 'software' ? '@software' : '@misc'
    return `${type}{${it.id}_${SITE.year},
  author       = {${a.map((x) => `${x.family}, ${x.given}`).join(' and ')}},
  title        = {${plain(it.titleHtml).replace(/([A-Z][a-z]+ [a-z]+)/, '{$1}')}},
  ${it.container ? `howpublished = {${it.container}},\n  ` : ''}year         = {${SITE.year}},
  url          = {${it.url}},
  urldate      = {${date.value}},
  note         = {${it.verb === 'downloaded' ? 'Downloaded' : 'Accessed'} ${dateLong.value}}
}`
  }
  if (fmt.value === 'ris') {
    const ty = { webpage: 'ELEC', dataset: 'DATA', graphic: 'FIGURE', software: 'COMP' }[it.type] || 'ELEC'
    return [`TY  - ${ty}`, ...a.map((x) => `AU  - ${x.family}, ${x.given}`), `TI  - ${plain(it.titleHtml)}`, it.container ? `T2  - ${it.container}` : '', `PY  - ${SITE.year}`, `UR  - ${it.url}`, `Y2  - ${date.value}`, 'ER  - ']
      .filter(Boolean)
      .join('\n')
  }
  if (fmt.value === 'csl') {
    return JSON.stringify(
      [
        {
          id: it.id,
          type: it.type === 'software' ? 'software' : it.type === 'dataset' ? 'dataset' : it.type === 'graphic' ? 'graphic' : 'webpage',
          title: plain(it.titleHtml),
          'container-title': it.container || undefined,
          author: a.map((x) => ({ family: x.family, given: x.given })),
          issued: { 'date-parts': [[SITE.year]] },
          accessed: { 'date-parts': [[d.value.y, d.value.m, d.value.d]] },
          URL: it.url
        }
      ],
      null,
      2
    )
  }
  return plain(textHtml.value)
})

async function copy() {
  try {
    await navigator.clipboard.writeText(output.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* clipboard blocked */
  }
}
function save() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([output.value], { type: 'text/plain;charset=utf-8' }))
  a.download = `ceraphronoidea-citation.${currentFormat.value.ext}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
</script>
