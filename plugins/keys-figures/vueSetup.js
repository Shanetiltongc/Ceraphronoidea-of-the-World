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
const PAPER_URL = 'https://doi.org/10.18476/2025.246600'

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

function arrangeFigures(app) {
  keepNameWithStatement(app)
  app.querySelectorAll('.pinpoint-figure').forEach((img) => {
    const id = imageIdFromPath(img.getAttribute('src'))
    img.classList.toggle('cow-figure-couplet', isCoupletCropId(id))
    img.classList.toggle('cow-figure-habitus', isHabitusId(id))
    img.style.removeProperty('width')
    img.style.removeProperty('height')
    img.style.removeProperty('max-height')
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

function fixCitationLink(app) {
  const keyId = keyIdFromLocation()
  app.querySelectorAll('.pinpoint-node-target a').forEach((link) => {
    const href = link.getAttribute('href') || ''
    const otuId = (href.match(/otus\/(\d+)/) || [])[1]
    if (!keyId || otuId !== keyId) return
    if (link.dataset.cowCitation === '1') return
    link.dataset.cowCitation = '1'
    link.setAttribute('href', PAPER_URL)
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener')
    link.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        window.open(PAPER_URL, '_blank', 'noopener')
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

function addTaxonPageLink(app) {
  app.querySelectorAll('.pinpoint-node').forEach((node) => {
    const container = node.parentElement
    if (!container || container.querySelector('.pinpoint-node-next-button')) return
    if (node.querySelector('.cow-taxon-link')) return

    const link = node.querySelector('.pinpoint-node-target a')
    if (!link || link.dataset.cowCitation === '1') return
    const otuId = ((link.getAttribute('href') || '').match(/otus\/(\d+)/) || [])[1]
    if (!otuId) return

    const kind = taxonPageKind(link.textContent)
    const page = document.createElement('a')
    page.className = 'cow-taxon-link'
    page.href = `#/otus/${otuId}`
    page.textContent =
      kind === 'species' ? 'View species page' : 'View genus page'
    node.appendChild(page)
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

export default function setup() {
  patchFetch()
  watchKeyUi()
}
