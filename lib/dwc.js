// All Darwin Core rows of the project (specimens + literature distribution
// records), loaded once per visit and shared by the Atlas and Types pages.
import { makeAPIRequest } from '@/utils/request'

const KEY = 'cow-dwc-v2'
const TTL = 30 * 60 * 1000
let pending = null

const FIELDS = [
  'basisOfRecord', 'scientificName', 'scientificNameAuthorship', 'family', 'genus', 'otu_id', 'locality',
  'typeStatus', 'institutionCode', 'catalogNumber', 'country', 'stateProvince', 'verbatimLocality',
  'decimalLatitude', 'decimalLongitude', 'year', 'recordedBy', 'associatedReferences', 'taxonRank', 'created_at', 'associatedMedia'
]

async function fetchAll() {
  const rows = []
  for (let page = 1; page < 40; page++) {
    const { data } = await makeAPIRequest.get('/dwc_occurrences', { params: { per: 250, page } })
    const list = Array.isArray(data) ? data : []
    list.forEach((r) => rows.push(Object.fromEntries(FIELDS.map((f) => [f, r[f] ?? null]))))
    if (list.length < 250) break
  }
  return rows
}

export function loadDwc() {
  if (pending) return pending
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    if (c && Date.now() - c.t < TTL) return (pending = Promise.resolve(c.rows))
  } catch {
    /* storage blocked */
  }
  pending = fetchAll()
    .then((rows) => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), rows }))
      } catch {
        /* full or blocked */
      }
      return rows
    })
    .catch((e) => {
      pending = null
      throw e
    })
  return pending
}

export function csv(rows, cols) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.map((c) => q(c[0])).join(','), ...rows.map((r) => cols.map((c) => q(c[1](r))).join(','))].join('\n')
}

export function download(text, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const italic = (name) => {
  const esc = String(name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const m = esc.match(/^([A-Z][a-z-]+(?:\s+\(?[a-z][a-z-]+\)?)*)(.*)$/)
  return m ? `<i>${m[1]}</i>${m[2]}` : esc
}
