const CARD_TITLE =
  /^(Nomenclature references|Nomenclature|Descendants and synonyms)\b/

function isTargetCard(card) {
  const title = card.querySelector('.tp-card-header h2')
  return Boolean(title && CARD_TITLE.test(title.textContent.trim()))
}

function isClosed(card) {
  return card.classList.contains('cow-taxon-card--closed')
}

function setClosed(card, closed) {
  card.classList.toggle('cow-taxon-card--closed', closed)
  const button = card.querySelector('.cow-taxon-card__toggle')
  if (!button) return
  button.textContent = closed ? '+' : '−'
  button.setAttribute('aria-expanded', closed ? 'false' : 'true')
  button.setAttribute(
    'aria-label',
    closed ? 'Show panel' : 'Hide panel'
  )
}

function toggleCard(card) {
  setClosed(card, !isClosed(card))
}

function enhanceCard(card) {
  if (!isTargetCard(card)) return
  const header = card.querySelector('.tp-card-header')
  if (!header) return
  card.classList.add('cow-taxon-card')

  let button = header.querySelector('.cow-taxon-card__toggle')
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = 'cow-taxon-card__toggle'
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      toggleCard(card)
    })
    header.appendChild(button)
    header.addEventListener('click', (event) => {
      if (event.target.closest('.cow-json-wrap')) return
      if (event.target.closest('.cow-taxon-card__toggle')) return
      toggleCard(card)
    })
    setClosed(card, true)
  }
}

function setJsonLabelOpen(wrap, hamburger, open) {
  wrap.classList.toggle('cow-json-wrap--open', open)
  hamburger.setAttribute('aria-expanded', open ? 'true' : 'false')
  const label = wrap.querySelector('.cow-json-data')
  if (!label) return
  label.setAttribute('aria-hidden', open ? 'false' : 'true')
}

function openJsonModal(hamburger) {
  const wrap = hamburger.closest('.relative')
  if (!wrap) return
  wrap.__cowOpeningJson = true
  const clickJsonItem = () => {
    const items = [...(wrap.querySelectorAll('[role="menuitem"]') || [])]
    const json = items.find((el) => el.textContent.trim() === 'JSON Data')
    items.forEach((el) => {
      if (el !== json) el.remove()
    })
    json?.click()
    wrap.__cowOpeningJson = false
  }
  hamburger.click()
  window.requestAnimationFrame(clickJsonItem)
  window.setTimeout(clickJsonItem, 0)
}

function enhanceJson(container) {
  const hamburger = container.querySelector('[aria-label="Open panel options"]')
  if (!hamburger) return
  const wrap = hamburger.closest('.relative.inline-flex') || hamburger.parentElement
  wrap.classList.add('cow-json-wrap')

  if (wrap.querySelector('.cow-json-data')) return

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'cow-json-data'
  button.textContent = 'JSON Data'
  button.setAttribute('aria-hidden', 'true')
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    openJsonModal(hamburger)
  })
  wrap.appendChild(button)
  setJsonLabelOpen(wrap, hamburger, false)

  hamburger.addEventListener(
    'click',
    (event) => {
      if (wrap.__cowOpeningJson) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setJsonLabelOpen(
        wrap,
        hamburger,
        !wrap.classList.contains('cow-json-wrap--open')
      )
    },
    true
  )
}

function enhanceCards() {
  document.querySelectorAll('.tp-card').forEach(enhanceCard)
  document.querySelectorAll('.tp-card, .cow-bagraph-panel').forEach(enhanceJson)
}

function watchCards() {
  if (typeof window === 'undefined' || window.__cowTaxonCardsWatched) return
  window.__cowTaxonCardsWatched = true

  const run = () => enhanceCards()
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
  watchCards()
}
