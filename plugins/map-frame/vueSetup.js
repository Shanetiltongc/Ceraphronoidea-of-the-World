import L from 'leaflet'

function worldSize(zoom) {
  return 256 * 2 ** zoom
}

function coverZoom(size) {
  const need = Math.max(size.x, size.y)
  let zoom = 0
  while (worldSize(zoom) < need && zoom < 5) zoom += 1
  // One step closer than a single world tile, so the frame is not
  // split by the four-tile cross of the lowest zoom.
  return Math.min(zoom + 1, 5)
}

function latToY(lat, zoom) {
  const rad = (lat * Math.PI) / 180
  const merc = Math.log(Math.tan(Math.PI / 4 + rad / 2))
  return worldSize(zoom) * (0.5 - merc / (2 * Math.PI))
}

function yToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / worldSize(zoom)
  return (180 / Math.PI) * Math.atan(Math.sinh(n))
}

function lngToX(lng, zoom) {
  return ((lng + 180) / 360) * worldSize(zoom)
}

function xToLng(x, zoom) {
  return (x / worldSize(zoom)) * 360 - 180
}

const LIGHT_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const DARK_TILES =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const OSM_CREDIT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const ESRI_CREDIT =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors'

function isSpeciesMap(map) {
  const el = map.getContainer()
  return (
    el.classList.contains('h-96') &&
    !el.closest('.cow-at, .cow-px, .cow-sp2')
  )
}

function useDarkTiles() {
  return document.documentElement.classList.contains('dark')
}

function applyBasemap(map) {
  if (!isSpeciesMap(map) || !map.attributionControl) return
  const dark = useDarkTiles()
  const url = dark ? DARK_TILES : LIGHT_TILES
  const credit = dark ? ESRI_CREDIT : OSM_CREDIT
  map.eachLayer((layer) => {
    if (!(layer instanceof L.TileLayer)) return
    if (layer.options.attribution !== credit) {
      if (layer.options.attribution) {
        map.attributionControl.removeAttribution(layer.options.attribution)
      }
      layer.options.attribution = credit
      map.attributionControl.addAttribution(credit)
    }
    layer.options.maxNativeZoom = dark ? 16 : 19
    if (layer._url !== url) layer.setUrl(url)
  })
}

function placeInsideWorld(map) {
  if (!isSpeciesMap(map) || map._cowFraming) return
  const size = map.getSize()
  if (!size.x || !size.y) return

  const zoom = Math.max(map.getZoom(), coverZoom(size))
  if (map.getMinZoom() !== coverZoom(size)) {
    map.setMinZoom(coverZoom(size))
  }

  const world = worldSize(zoom)
  let y = latToY(map.getCenter().lat, zoom)
  let x = lngToX(map.getCenter().lng, zoom)
  const halfH = size.y / 2
  const halfW = size.x / 2
  y = Math.min(Math.max(y, halfH), world - halfH)
  x = Math.min(Math.max(x, halfW), world - halfW)

  const lat = yToLat(y, zoom)
  const lng = xToLng(x, zoom)
  const center = map.getCenter()
  const same =
    map.getZoom() === zoom &&
    Math.abs(center.lat - lat) < 0.05 &&
    Math.abs(center.lng - lng) < 0.05
  if (same) return

  map._cowFraming = true
  map.setView([lat, lng], zoom, { animate: false })
  map._cowFraming = false
}

export default function setup() {
  if (L.Map.__cowFrame) return
  L.Map.__cowFrame = true

  const maps = new Set()
  L.Map.addInitHook(function () {
    maps.add(this)
    this.on('unload', () => maps.delete(this))
    this.on('layeradd', () => applyBasemap(this))
    this.on('moveend', () => placeInsideWorld(this))
  })

  new MutationObserver(() => {
    maps.forEach((map) => applyBasemap(map))
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
}
