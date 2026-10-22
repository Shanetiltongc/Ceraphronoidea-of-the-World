const PROJECT = 'Ceraphronoidea of the World (TaxonWorks)'
const LICENSE = '(Text: CC BY; Images: CC BY-NC-SA)'
const CANONICAL_ORIGIN =
  'https://shanetiltongc.github.io/Ceraphronoidea-of-the-World'

function accessedDate(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function pageUrl() {
  const hash = window.location.hash || '#/'
  return `${CANONICAL_ORIGIN}/${hash}`
}

function taxonName() {
  if (!/#\/otus\/\d+/.test(window.location.hash)) return ''
  const heading = document.querySelector('#main-content h1')
  const name = heading?.textContent.replace(/\s+/g, ' ').trim()
  return name || ''
}

function fillCitation(el, name, url, accessed) {
  const lead = name ? `${name}. ${PROJECT}` : PROJECT
  el.replaceChildren()
  el.append(`${lead}. Accessed ${accessed}: `)
  const link = document.createElement('a')
  link.href = url
  link.textContent = url
  link.className = 'cow-footer-cite__url'
  el.append(link)
  el.append(`. ${LICENSE}`)
  el.dataset.cowCite = `${url}|${name}|${accessed}`
}

function updateFooter() {
  const citation = document.querySelector('.tp-footer-citation')
  if (!citation) return

  const name = taxonName()
  if (/#\/otus\/\d+/.test(window.location.hash) && !name) return

  const url = pageUrl()
  const accessed = accessedDate()
  const key = `${url}|${name}|${accessed}`
  if (citation.dataset.cowCite === key) return

  fillCitation(citation, name, url, accessed)

  const copyright = document.querySelector('.tp-footer-copyright')
  if (copyright) copyright.setAttribute('hidden', '')
}

function watchFooter() {
  if (typeof window === 'undefined' || window.__cowFooterCiteWatched) return
  window.__cowFooterCiteWatched = true

  const run = () => updateFooter()
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

export default function setup() {
  watchFooter()
}
