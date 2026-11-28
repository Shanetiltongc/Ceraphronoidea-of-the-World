// All biological associations of the project, loaded once and shared by the
// "Hosts & associations" taxon panel and the Interactions page.
// Each row: { id, rel, s: {id,label,order,family,genus}, o: {...}, cit }
import { makeAPIRequest } from '@/utils/request'

export const CERAPHRONOID = ['Ceraphronidae', 'Megaspilidae', 'Stigmaphronidae']
export const isCeraphronoid = (t) => CERAPHRONOID.includes(t?.family)

// Relationship wording, seen from the subject and from the object
export const REL = {
  'parasitoid of': { label: 'Parasitoid of', inverse: 'Parasitoids' },
  'predator of': { label: 'Predator of', inverse: 'Predators' },
  'feeds on': { label: 'Feeds on (plants)', inverse: 'Fed on by' }
}

const CACHE_KEY = 'cow-associations-v1'
const CACHE_MS = 30 * 60 * 1000
let pending = null

const pick = (t) => ({
  id: t?.id,
  label: t?.label || '',
  order: t?.order || '',
  family: t?.family || '',
  genus: t?.genus || ''
})

async function fetchAll() {
  const rows = []
  for (let page = 1; page < 40; page++) {
    const { data } = await makeAPIRequest.get('/biological_associations/basic', {
      params: { per: 250, page }
    })
    const list = Array.isArray(data) ? data : []
    list.forEach((r) =>
      rows.push({
        id: r.id,
        rel: r.relationship || 'associated with',
        s: pick(r.subject),
        o: pick(r.object),
        cit: typeof r.citations === 'string' ? r.citations.trim() : ''
      })
    )
    if (list.length < 250) break
  }
  return rows
}

export function loadAssociations() {
  if (pending) return pending
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
    if (cached && Date.now() - cached.t < CACHE_MS) {
      pending = Promise.resolve(cached.rows)
      return pending
    }
  } catch {
    /* storage blocked */
  }
  pending = fetchAll()
    .then((rows) => {
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), rows }))
      } catch {
        /* storage full or blocked */
      }
      return rows
    })
    .catch((e) => {
      pending = null
      throw e
    })
  return pending
}

// Genus + species in italics, author in roman
export function italicName(label) {
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const m = String(label || '').match(/^([A-Z][a-z-]+(?:\s+\(?[a-z][a-z-]+\)?)*)(.*)$/)
  return m ? `<i>${esc(m[1])}</i>${esc(m[2])}` : esc(label)
}

// Higher ranks are not italic: a lone capitalised word ending like a family/order
export function nameHtml(label) {
  if (/^[A-Z][a-z]+(idae|inae|oidea|ini|ptera)\b/.test(label || '')) {
    return String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  }
  return italicName(label)
}

// Does a row's side belong to the taxon shown on the page?
export function matcher(otuId, taxon) {
  const rank = String(taxon?.rank || taxon?.rank_string || '').toLowerCase().split('::').pop()
  const name = taxon?.name || ''
  const id = Number(otuId)
  if (/genus/.test(rank) && name) return (t) => t.id === id || t.genus === name
  if (/family/.test(rank) && !/super/.test(rank) && name) return (t) => t.id === id || t.family === name
  if (/superfamily|order|class|root/.test(rank)) return (t) => t.id === id || isCeraphronoid(t)
  return (t) => t.id === id
}

export function toCsv(rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Subject', 'Subject family', 'Relationship', 'Object', 'Object order', 'Object family', 'Reference']
  return [head, ...rows.map((r) => [r.s.label, r.s.family, r.rel, r.o.label, r.o.order, r.o.family, r.cit])]
    .map((l) => l.map(q).join(','))
    .join('\n')
}

export function downloadCsv(rows, name) {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
