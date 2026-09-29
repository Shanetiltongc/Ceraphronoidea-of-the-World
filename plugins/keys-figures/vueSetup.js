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

export default function setup() {
  patchFetch()
}
