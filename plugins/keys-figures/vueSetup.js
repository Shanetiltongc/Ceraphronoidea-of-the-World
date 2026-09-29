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
      const data = rewriteFigures(await response.clone().json(), url)
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

function enhanceKeyUi() {
  const app = document.querySelector('.pinpoint-app')
  if (!app) return

  const title = app.querySelector('.pinpoint-key-title')
  if (title && !app.querySelector('.cow-key-help')) {
    const help = document.createElement('p')
    help.className = 'cow-key-help'
    help.innerHTML =
      'This is a <strong>dichotomous key</strong>: one question at a time, with two choices. Compare your specimen to the statements and figures. Click a figure to enlarge it. Choose the side that matches, then click <strong>This matches</strong>. A genus name is the identification. Use <strong>Previous step</strong> to undo.'
    title.insertAdjacentElement('afterend', help)
  }

  const pair = app.querySelector('.pinpoint-couplet-children-container')
  if (pair && !app.querySelector('.cow-key-prompt')) {
    const prompt = document.createElement('p')
    prompt.className = 'cow-key-prompt'
    prompt.textContent = 'Which statement matches your specimen?'
    pair.insertAdjacentElement('beforebegin', prompt)
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
