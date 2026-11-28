// Outlines of the biogeographic realms, taken from TaxonWorks itself: the
// distribution map of a species recorded from a single realm IS that realm's
// shape. Simplified to a light SVG path and kept in the browser for a week.
import { makeAPIRequest } from '@/utils/request'

const KEY = 'cow-realm-shapes-v1'
const TTL = 7 * 24 * 3600 * 1000

// longitude/latitude → SVG units (equirectangular, 1 unit = 1 degree)
const X = (lon) => +(lon + 180).toFixed(1)
const Y = (lat) => +(90 - lat).toFixed(1)

function ringPath(ring) {
  const kept = []
  let last = null
  for (const [lon, lat] of ring) {
    if (!last || Math.abs(lon - last[0]) + Math.abs(lat - last[1]) >= 0.4) {
      kept.push([lon, lat])
      last = [lon, lat]
    }
  }
  if (kept.length < 4) return ''
  return 'M' + kept.map(([lon, lat]) => `${X(lon)} ${Y(lat)}`).join('L') + 'Z'
}

function toPath(geo) {
  const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.type === 'MultiPolygon' ? geo.coordinates : []
  return polys.map((poly) => poly.map(ringPath).join('')).join('')
}

/** realmOtus: { Afrotropical: otuId, … } → { Afrotropical: 'M…Z', … } */
export async function realmShapes(realmOtus) {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (c && Date.now() - c.t < TTL && Object.keys(realmOtus).every((r) => c.paths[r])) return c.paths
  } catch {
    /* storage blocked */
  }
  const entries = await Promise.all(
    Object.entries(realmOtus).map(async ([realm, otu]) => {
      try {
        const { data } = await makeAPIRequest.get(`/otus/${otu}/inventory/distribution`)
        const geo = JSON.parse(data?.cached_map?.geo_json || 'null')
        return [realm, geo ? toPath(geo) : '']
      } catch {
        return [realm, '']
      }
    })
  )
  const paths = Object.fromEntries(entries.filter(([, p]) => p))
  try {
    localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), paths }))
  } catch {
    /* full or blocked */
  }
  return paths
}

// Same outlines as GeoJSON (lon/lat, simplified) for a Leaflet map
const GEO_KEY = 'cow-realm-geo-v1'

function simplifyRing(ring) {
  const out = []
  let last = null
  for (const [lon, lat] of ring) {
    if (!last || Math.abs(lon - last[0]) + Math.abs(lat - last[1]) >= 0.25) {
      out.push([+lon.toFixed(2), +lat.toFixed(2)])
      last = [lon, lat]
    }
  }
  return out.length >= 4 ? out : null
}

function simplifyGeo(geo) {
  const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.type === 'MultiPolygon' ? geo.coordinates : []
  const kept = polys.map((poly) => poly.map(simplifyRing).filter(Boolean)).filter((p) => p.length)
  return { type: 'MultiPolygon', coordinates: kept }
}

/** realmOtus: { Afrotropical: otuId, … } → { Afrotropical: GeoJSON geometry, … } */
export async function realmGeo(realmOtus) {
  try {
    const c = JSON.parse(localStorage.getItem(GEO_KEY) || 'null')
    if (c && Date.now() - c.t < TTL && Object.keys(realmOtus).every((r) => c.geo[r])) return c.geo
  } catch {
    /* storage blocked */
  }
  const entries = await Promise.all(
    Object.entries(realmOtus).map(async ([realm, otu]) => {
      try {
        const { data } = await makeAPIRequest.get(`/otus/${otu}/inventory/distribution`)
        const geo = JSON.parse(data?.cached_map?.geo_json || 'null')
        return [realm, geo ? simplifyGeo(geo) : null]
      } catch {
        return [realm, null]
      }
    })
  )
  const geo = Object.fromEntries(entries.filter(([, g]) => g))
  try {
    localStorage.setItem(GEO_KEY, JSON.stringify({ t: Date.now(), geo }))
  } catch {
    /* full or blocked */
  }
  return geo
}

// Sequential colour scale (cream → sage → brown), t in 0..1
const STOPS = ['#f4efe4', '#e7dfd0', '#c5cbb8', '#74866a', '#6c5240', '#4a3a2e', '#2c241c']
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export function colorAt(t) {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(x))
  const a = hex(STOPS[i])
  const b = hex(STOPS[i + 1])
  const k = x - i
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`
}
export const RAMP = `linear-gradient(90deg, ${STOPS.join(', ')})`
export const isDark = (t) => t > 0.55
