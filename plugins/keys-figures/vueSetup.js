import { makeAPIRequest } from '@/utils/request'

/**
 * Pinpoint gallery tiles use TaxonWorks `medium` (~300px). Rewrite key
 * payloads so tiles load `original_png` (full resolution) instead.
 * Must run before VuePinpoint fetches `/leads/key/:id`.
 */
function projectTokenFromUrl(url) {
  try {
    return new URL(url, window.location.origin).searchParams.get(
      'project_token'
    )
  } catch {
    return null
  }
}

function absoluteOriginalPng(path, requestUrl, token) {
  if (!path) return null
  try {
    const origin = new URL(requestUrl, window.location.origin).origin
    const absolute = new URL(path, origin)
    if (token && !absolute.searchParams.has('project_token')) {
      absolute.searchParams.set('project_token', token)
    }
    return absolute.toString()
  } catch {
    return null
  }
}

/** Couplet crops uploaded 2026-09-29. Genus habitus plates are the earlier ids. */
const COUPLET_CROP_MIN = 1205431
const COUPLET_CROP_MAX = 1205470
const HABITUS_MIN = 1205360
const HABITUS_MAX = 1205383

/** Origin-paper URLs when the key payload has no DOI (Pinpoint used one Moser DOI for every key). */
const PAPER_URL_FALLBACK = {
  34905: 'https://doi.org/10.18476/2025.246600',
  35099: 'https://bionames.org/references/b2c4fa9d710f0bb47cc9fa0298f4cf9f',
  35110: 'https://doi.org/10.7717/peerj.2682',
  35151: 'https://doi.org/10.1093/isd/ixy015',
  35180: 'https://doi.org/10.11646/zootaxa.4792.1.1',
  35227: 'https://mbd-db.osu.edu/hol/publications/d75a13ea-4414-4bbb-9a0d-6d2aa0c0d826'
}

const paperUrlByKeyId = Object.create(null)

function doiUrlFromText(text) {
  const match = String(text || '').match(
    /(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i
  )
  if (!match) return null
  return `https://doi.org/${match[1].replace(/[.,;)\]]+$/, '')}`
}

function paperUrlFromPayload(data) {
  const oc = data?.metadata?.origin_citation
  if (!oc) return null
  if (typeof oc === 'string') return doiUrlFromText(oc)
  const source = oc.source && typeof oc.source === 'object' ? oc.source : oc
  if (source.doi) return doiUrlFromText(String(source.doi))
  const fromCached = doiUrlFromText(
    source.object_tag || source.cached || source.url || ''
  )
  if (fromCached) return fromCached
  if (/^https?:\/\//i.test(source.url || '')) return source.url
  return null
}

function imageIdFromPath(path) {
  const match = String(path || '').match(/images\/(\d+)/)
  return match ? Number(match[1]) : 0
}

function isCoupletCropId(id) {
  return id >= COUPLET_CROP_MIN && id <= COUPLET_CROP_MAX
}

function isHabitusId(id) {
  return id >= HABITUS_MIN && id <= HABITUS_MAX
}

/**
 * Lead 34916 (Megaspilinae) redirects to the winged couplet instead of
 * owning children. Pinpoint ignores redirect_id, so that card had no
 * next step and no taxon. Copy the shared subtree under the redirect
 * lead so This matches continues, Previous step returns here, and the
 * genus leads still open their pages.
 */
function spliceRedirects(payload) {
  const leads = payload?.data?.leads
  const entries = payload?.data?.entries
  if (!leads || !entries) return payload

  let nextId = 880000000

  function cloneLead(sourceId, parentId) {
    const src = leads[String(sourceId)]
    if (!src) return null
    const id = nextId++
    const copy = JSON.parse(JSON.stringify(src))
    copy.parent_id = parentId
    delete copy.redirect_id
    leads[String(id)] = copy

    const srcEntry = entries[String(sourceId)]
    const children = (srcEntry?.children || [])
      .map((childId) => cloneLead(childId, id))
      .filter((childId) => childId != null)
    if (srcEntry || children.length) {
      entries[String(id)] = {
        children,
        parent_id: parentId,
        position: copy.position ?? srcEntry?.position ?? 0,
        couplet_number: srcEntry?.couplet_number ?? '',
        depth: srcEntry?.depth ?? 0
      }
    }
    return id
  }

  for (const [id, lead] of Object.entries({ ...leads })) {
    const redirectId = lead?.redirect_id
    if (!redirectId) continue
    const targetEntry = entries[String(redirectId)]
    const kids = targetEntry?.children || []
    if (!kids.length || entries[id]?.children?.length) continue
    entries[id] = {
      children: kids
        .map((childId) => cloneLead(childId, Number(id)))
        .filter((childId) => childId != null),
      parent_id: lead.parent_id ?? null,
      position: lead.position ?? 0,
      couplet_number: targetEntry.couplet_number || '',
      depth: targetEntry.depth ?? 0
    }
  }
  return payload
}

function rewriteFigures(payload, requestUrl) {
  const leads = payload?.data?.leads
  if (!leads || typeof leads !== 'object') return payload

  const token = projectTokenFromUrl(requestUrl)
  for (const lead of Object.values(leads)) {
    const figures = lead?.figures
    if (!Array.isArray(figures)) continue
    for (const figure of figures) {
      const full =
        absoluteOriginalPng(figure.original_png, requestUrl, token) ||
        figure.original ||
        null
      if (full) figure.medium = full
    }
    figures.sort((a, b) => {
      const aCrop = isCoupletCropId(imageIdFromPath(a.original_png || a.medium))
      const bCrop = isCoupletCropId(imageIdFromPath(b.original_png || b.medium))
      return Number(bCrop) - Number(aCrop)
    })
  }
  return payload
}

function patchFetch() {
  if (typeof window === 'undefined' || window.__cowKeysFiguresFetchPatched) {
    return
  }
  window.__cowKeysFiguresFetchPatched = true

  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init)
    try {
      const url = String(
        typeof input === 'string' ? input : input?.url || ''
      )
      if (!/\/leads\/key\/\d+/i.test(url) || !response.ok) {
        return response
      }
      const data = rewriteFigures(
        spliceRedirects(await response.clone().json()),
        url
      )
      const keyMatch = url.match(/\/leads\/key\/(\d+)/i)
      if (keyMatch) {
        const found = paperUrlFromPayload(data)
        if (found) paperUrlByKeyId[keyMatch[1]] = found
      }
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })
    } catch {
      return response
    }
  }
}

function relabelButton(button, label) {
  if (!button) return
  if (button.textContent.includes(label)) {
    button.setAttribute('data-cow-label', label)
    button.setAttribute('aria-label', label)
    return
  }
  button.setAttribute('data-cow-label', label)
  button.setAttribute('aria-label', label)
  const row = button.querySelector('.flex') || button
  const icons = [...row.querySelectorAll('svg')]
  while (row.firstChild) row.removeChild(row.firstChild)
  if (icons[0]) row.appendChild(icons[0])
  row.appendChild(document.createTextNode(` ${label} `))
  if (icons[1]) row.appendChild(icons[1])
}

function hideRemainingKeyDump(app) {
  app.querySelectorAll('.pinpoint-node-children-container .pinpoint-tree').forEach((tree) => {
    tree.setAttribute('hidden', '')
    tree.setAttribute('aria-hidden', 'true')
    tree.style.setProperty('display', 'none', 'important')
  })
}

function keepNameWithStatement(app) {
  app.querySelectorAll('.pinpoint-node').forEach((node) => {
    const text = node.querySelector('.pinpoint-node-text')
    const target = node.querySelector('.pinpoint-node-target')
    if (!text) return
    let stack = node.querySelector(':scope > .cow-lead-copy')
    if (!stack) {
      stack = document.createElement('div')
      stack.className = 'cow-lead-copy'
      text.before(stack)
    }
    if (text.parentElement !== stack) stack.appendChild(text)
    if (target && target.parentElement !== stack) stack.appendChild(target)
  })
}

const TRIM_PAD = 12
const MARGIN_DELTA = 42

function sampleCorner(data, width, height) {
  const points = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4
  ]
  let r = 0
  let g = 0
  let b = 0
  for (const i of points) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return [r / 4, g / 4, b / 4]
}

function isPageMargin(data, i, corner) {
  const dr = data[i] - corner[0]
  const dg = data[i + 1] - corner[1]
  const db = data[i + 2] - corner[2]
  return dr * dr + dg * dg + db * db <= MARGIN_DELTA * MARGIN_DELTA
}

function contentBox(data, width, height) {
  const corner = sampleCorner(data, width, height)
  const seen = new Uint8Array(width * height)
  const queue = []
  const push = (x, y) => {
    const idx = y * width + x
    if (seen[idx]) return
    if (!isPageMargin(data, idx * 4, corner)) return
    seen[idx] = 1
    queue.push(idx)
  }
  for (let x = 0; x < width; x += 1) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y)
    push(width - 1, y)
  }
  while (queue.length) {
    const idx = queue.pop()
    const x = idx % width
    const y = (idx - x) / width
    if (x > 0) push(x - 1, y)
    if (x + 1 < width) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y + 1 < height) push(x, y + 1)
  }
  let top = height
  let left = width
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (seen[y * width + x]) continue
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }
  if (right < left || bottom < top) return null
  return {
    x: Math.max(0, left - TRIM_PAD),
    y: Math.max(0, top - TRIM_PAD),
    w: Math.min(width, right + TRIM_PAD + 1) - Math.max(0, left - TRIM_PAD),
    h: Math.min(height, bottom + TRIM_PAD + 1) - Math.max(0, top - TRIM_PAD)
  }
}

async function trimmedFigureUrl(src) {
  const response = await fetch(src, { mode: 'cors' })
  if (!response.ok) throw new Error(`trim fetch ${response.status}`)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const box = contentBox(imageData.data, canvas.width, canvas.height)
  if (!box) return null
  const saved = 1 - (box.w * box.h) / (bitmap.width * bitmap.height)
  if (saved < 0.02) return null
  const cropped = document.createElement('canvas')
  cropped.width = box.w
  cropped.height = box.h
  cropped.getContext('2d').drawImage(
    bitmap,
    box.x,
    box.y,
    box.w,
    box.h,
    0,
    0,
    box.w,
    box.h
  )
  return canvasToUrl(cropped)
}

function canvasToUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('trim blob failed'))
          return
        }
        resolve(URL.createObjectURL(blob))
      },
      'image/png'
    )
  })
}

function trimKeyFigure(img) {
  const src = img.currentSrc || img.getAttribute('src')
  if (
    !src ||
    src.startsWith('blob:') ||
    img.dataset.cowTrim === 'done' ||
    img.dataset.cowTrim === 'busy'
  ) {
    return
  }
  img.dataset.cowTrim = 'busy'
  trimmedFigureUrl(src)
    .then((url) => {
      img.dataset.cowTrim = 'done'
      if (url) img.src = url
    })
    .catch(() => {
      img.dataset.cowTrim = 'done'
    })
}

function arrangeFigures(app) {
  keepNameWithStatement(app)
  app.querySelectorAll('.pinpoint-figure').forEach((img) => {
    const id = imageIdFromPath(img.getAttribute('src'))
    if (id) {
      img.classList.toggle('cow-figure-couplet', isCoupletCropId(id))
      img.classList.toggle('cow-figure-habitus', isHabitusId(id))
    }
    img.style.setProperty('width', '100%', 'important')
    img.style.setProperty('height', 'auto', 'important')
    img.style.setProperty('max-height', '32rem', 'important')
    img.style.setProperty('object-fit', 'contain', 'important')
    const list = img.closest('.pinpoint-figure-list')
    if (list) {
      if (list.closest('.pinpoint-couplet-node')) {
        list.style.setProperty('display', 'none', 'important')
      } else {
        list.style.removeProperty('max-height')
        list.style.removeProperty('height')
        list.style.removeProperty('overflow')
        const n = list.querySelectorAll(':scope > .pinpoint-figure-button').length
        if (n >= 2) {
          list.style.setProperty('display', 'flex', 'important')
          list.style.setProperty('flex-direction', 'column', 'important')
          list.style.setProperty('align-items', 'stretch', 'important')
          list.style.removeProperty('grid-template-columns')
        }
      }
    }
    const button = img.closest('.pinpoint-figure-button')
    if (button) {
      button.style.setProperty('height', 'auto', 'important')
      button.style.setProperty('min-height', '0', 'important')
      button.style.setProperty('overflow', 'hidden', 'important')
    }
  })

  app.querySelectorAll('.pinpoint-node').forEach((node) => {
    const list = node.querySelector('.pinpoint-figure-list')
    if (!list) return
    let row = node.querySelector(':scope > .cow-habitus-row')
    if (!row) {
      row = document.createElement('div')
      row.className = 'cow-habitus-row'
      list.after(row)
    }
    const buttons = [
      ...list.querySelectorAll('.pinpoint-figure-button'),
      ...row.querySelectorAll('.pinpoint-figure-button')
    ]
    buttons.forEach((button) => {
      const habitus = button.querySelector('.cow-figure-habitus')
      if (habitus && button.parentElement !== row) row.appendChild(button)
      if (!habitus && button.parentElement !== list) list.appendChild(button)
    })
  })
}

function keyIdFromLocation() {
  const match = String(window.location.hash || '').match(/\/keys\/(\d+)/)
  return match ? match[1] : null
}

function paperUrlForKey(keyId) {
  if (!keyId) return null
  return paperUrlByKeyId[keyId] || PAPER_URL_FALLBACK[keyId] || null
}

function fixCitationLink(app) {
  const keyId = keyIdFromLocation()
  const paperUrl = paperUrlForKey(keyId)
  if (!keyId) return
  app.querySelectorAll('a[href*="otus/"]').forEach((link) => {
    const href = link.getAttribute('href') || ''
    const otuId = (href.match(/otus\/(\d+)/) || [])[1]
    if (otuId !== keyId) return
    if (link.dataset.cowCitation === '1') return
    link.dataset.cowCitation = '1'
    if (!paperUrl) {
      link.removeAttribute('href')
      link.setAttribute('role', 'text')
      return
    }
    link.setAttribute('href', paperUrl)
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener')
    link.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        window.open(paperUrl, '_blank', 'noopener')
      },
      true
    )
  })
}

function taxonPageKind(label) {
  const name = String(label || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  const words = name.split(' ')
  const first = words[0] || ''
  const second = words[1] || ''
  if (/^[a-z]/.test(first)) return 'species'
  if (second && /^[a-z]/.test(second)) return 'species'
  return 'genus'
}

let keyRouter = null

function otuPagePath(otuId) {
  return `/otus/${otuId}/overview`
}

function goToOtu(otuId) {
  if (!otuId) return
  const path = otuPagePath(otuId)
  if (keyRouter) {
    keyRouter.push(path).catch(() => {
      window.location.hash = path
    })
    return
  }
  window.location.hash = path
}

function otuIdFromTarget(node) {
  const link = node.querySelector('.pinpoint-node-target a')
  const href = `${link?.getAttribute('href') || ''} ${link?.href || ''}`
  const fromHref = (href.match(/otus\/(\d+)/) || [])[1]
  if (fromHref) return fromHref
  const slotId = link?.getAttribute('id')
  if (slotId && /^\d+$/.test(slotId)) return slotId
  return null
}

function addTaxonPageLink(app) {
  app.querySelectorAll('.pinpoint-node').forEach((node) => {
    const container = node.parentElement
    if (!container || container.querySelector('.pinpoint-node-next-button')) return

    const link = node.querySelector('.pinpoint-node-target a')
    if (link?.dataset.cowCitation === '1') return
    const otuId = otuIdFromTarget(node)
    if (!otuId) return

    if (link) {
      link.setAttribute('href', `#${otuPagePath(otuId)}`)
    }

    const kind = taxonPageKind(link?.textContent)
    let page = node.querySelector('.cow-taxon-link')
    if (!page) {
      page = document.createElement('a')
      page.className = 'cow-taxon-link'
      node.appendChild(page)
    }
    page.setAttribute('href', `#${otuPagePath(otuId)}`)
    page.textContent =
      kind === 'species' ? 'View species page' : 'View genus page'
    if (page.dataset.cowNav === '1') return
    page.dataset.cowNav = '1'
    page.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        goToOtu(otuId)
      },
      true
    )
  })
}

function enhanceKeyUi() {
  const app = document.querySelector('.pinpoint-app')
  if (!app) return

  hideRemainingKeyDump(app)
  arrangeFigures(app)
  fixCitationLink(app)
  addTaxonPageLink(app)

  const title = app.querySelector('.pinpoint-key-title')
  const helpText =
    'Pick the side that matches your specimen, then click This matches. When a genus or species is named, open its page.'
  if (title) {
    let help = app.querySelector('.cow-key-help')
    if (!help) {
      help = document.createElement('p')
      help.className = 'cow-key-help'
      title.insertAdjacentElement('afterend', help)
    }
    help.textContent = helpText
  }

  app.querySelectorAll('.pinpoint-node-next-button').forEach((button) => {
    relabelButton(button, 'This matches')
  })
  app.querySelectorAll('.pinpoint-button-up').forEach((button) => {
    relabelButton(button, 'Previous step')
  })
}

function watchKeyUi() {
  if (typeof window === 'undefined' || window.__cowKeysHelpWatched) return
  window.__cowKeysHelpWatched = true

  const run = () => enhanceKeyUi()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true })
  } else {
    run()
  }

  let timer = 0
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(run, 40)
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })
}

const sourceUrlById = Object.create(null)

function tidyDoiHref(href) {
  return String(href || '')
    .replace(/^(https?:\/\/doi\.org\/10\.\S+?)[\]\).,;]+$/i, '$1')
    .replace(/^\[(https?:\/\/doi\.org\/10\.\S+)\]$/i, '$1')
}

async function landingUrlForSource(id) {
  if (sourceUrlById[id]) return sourceUrlById[id]
  try {
    const { data } = await makeAPIRequest.get(`/sources/${id}.json`)
    const fromDoi =
      doiUrlFromText(data?.doi) ||
      doiUrlFromText(data?.cached) ||
      doiUrlFromText(data?.object_tag)
    const fromUrl = /^https?:\/\//i.test(data?.url || '') ? data.url : null
    const url = fromDoi || fromUrl
    if (url) {
      sourceUrlById[id] = url
      return url
    }
  } catch {
    /* bibliography is the public catalog of sources */
  }
  const fallback = '#/resources/tw/filter/bibliography'
  sourceUrlById[id] = fallback
  return fallback
}

function sourceIdFromHref(href) {
  const text = String(href || '')
  if (/sfg\.taxonworks\.org/i.test(text)) return null
  const match =
    text.match(/#\/sources\/(\d+)/) ||
    text.match(/(?:^|\/)sources\/(\d+)(?:\/|$|\?)/)
  return match ? match[1] : null
}

function goToUrl(url) {
  if (/^https?:\/\//i.test(url)) {
    window.open(url, '_blank', 'noopener')
    return
  }
  window.location.hash = url.replace(/^#/, '')
}

function rewriteSourceAndDoiLinks() {
  document.querySelectorAll('a[href*="doi.org"]').forEach((link) => {
    const href = link.getAttribute('href')
    const tidy = tidyDoiHref(href)
    if (tidy && tidy !== href) link.setAttribute('href', tidy)
  })
  document.querySelectorAll('a[href*="sources/"]').forEach((link) => {
    if (link.dataset.cowSource === '1') return
    const id = sourceIdFromHref(link.getAttribute('href'))
    if (!id) return
    link.dataset.cowSource = '1'
    landingUrlForSource(id).then((url) => {
      if (/^https?:\/\//i.test(url)) {
        link.setAttribute('href', url)
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener')
      } else {
        link.setAttribute('href', url)
      }
    })
  })
}

function redirectSourceHash() {
  const match = String(window.location.hash || '').match(/#\/sources\/(\d+)/)
  if (!match) return
  landingUrlForSource(match[1]).then((url) => {
    if (/^https?:\/\//i.test(url)) {
      window.location.replace(url)
    } else {
      window.location.hash = url.replace(/^#/, '')
    }
  })
}

function watchSourceLinks() {
  if (typeof window === 'undefined' || window.__cowSourceLinksWatched) return
  window.__cowSourceLinksWatched = true

  document.addEventListener(
    'click',
    (event) => {
      const link = event.target?.closest?.('a')
      if (!link) return
      const id = sourceIdFromHref(link.getAttribute('href') || link.href)
      if (!id) return
      event.preventDefault()
      event.stopPropagation()
      landingUrlForSource(id).then(goToUrl)
    },
    true
  )

  const run = () => {
    rewriteSourceAndDoiLinks()
    redirectSourceHash()
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true })
  } else {
    run()
  }
  window.addEventListener('hashchange', run)
  let timer = 0
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer)
    timer = window.setTimeout(run, 40)
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })
}

export default function setup(app, ctx = {}) {
  keyRouter = ctx.router || null
  patchFetch()
  watchKeyUi()
  watchSourceLinks()
}
