import { makeAPIRequest } from '@/utils/request'

function srcMap() {
  if (typeof window === 'undefined') return {}
  if (!window.__cowGallerySrcMap) window.__cowGallerySrcMap = {}
  return window.__cowGallerySrcMap
}

function rememberSrcMap(data) {
  if (!data?.images) return
  const map = srcMap()
  for (const [id, image] of Object.entries(data.images)) {
    map[String(id)] = String(id)
    const blob = JSON.stringify(image)
    for (const match of blob.matchAll(/\/s\/([a-z0-9]+)/gi)) {
      map[match[1]] = String(id)
    }
  }
}

function otuIdFromLocation() {
  const match = String(window.location.hash || '').match(/\/otus\/(\d+)/)
  return match ? match[1] : null
}

function isTaxonPage() {
  return Boolean(otuIdFromLocation())
}

function depictionText(image) {
  return (image?.depictions || [])
    .map((row) => `${row.label || ''} ${row.caption || ''} ${row.figure_label || ''}`)
    .join(' ')
    .toLowerCase()
}

function imageRank(image) {
  const text = depictionText(image)
  if (/\blabels?\b/.test(text)) return 50
  if (/dorsal\s*4x/.test(text) || /lateral\s*4x/.test(text)) return 0
  if (/\bdorsal\b/.test(text) || /\blateral\b/.test(text) || /\bhabitus\b/.test(text)) {
    return 1
  }
  return 20
}

function sortGalleryImages(data) {
  if (!data?.image_order || !data.images) return data
  const order = data.image_order.filter(Boolean)
  const original = new Map(order.map((id, index) => [id, index]))
  order.sort((a, b) => {
    const rankA = imageRank(data.images[a] || data.images[String(a)])
    const rankB = imageRank(data.images[b] || data.images[String(b)])
    if (rankA !== rankB) return rankA - rankB
    return original.get(a) - original.get(b)
  })
  data.image_order = order
  return data
}

const PORTRAIT_RATIO = 32 / 57
const PORTRAIT_RATIO_SLACK = 0.08

function isTallPortrait(width, height) {
  if (!width || !height) return false
  const ratio = width / height
  return Math.abs(ratio - PORTRAIT_RATIO) / PORTRAIT_RATIO <= PORTRAIT_RATIO_SLACK
}

function layoutFill(img) {
  const wrap = img.parentElement
  const stage = wrap?.parentElement
  const natW = img.naturalWidth
  const natH = img.naturalHeight
  if (!wrap || !stage || !natW || !natH) return

  const padX = Math.min(20, natW / 2 - 1)
  const padY = Math.min(20 + (isTallPortrait(natW, natH) ? 50 : 0), natH / 2 - 1)
  const visW = Math.max(1, natW - padX * 2)
  const visH = Math.max(1, natH - padY * 2)

  const stageStyle = window.getComputedStyle(stage)
  const maxW = Math.max(
    80,
    stage.clientWidth -
      parseFloat(stageStyle.paddingLeft) -
      parseFloat(stageStyle.paddingRight)
  )
  const maxH = 400
  const scaleFit = Math.min(1, maxW / visW, maxH / visH)
  const zoom = natH >= 400 ? 1.2 : 1
  const scale = Math.min(1, scaleFit * zoom)
  const boxW = Math.round(visW * scaleFit)
  const boxH = Math.round(visH * scaleFit)
  const extraX = visW * scale - boxW
  const extraY = visH * scale - boxH
  const key = `${boxW}x${boxH}:${scale.toFixed(4)}:${img.currentSrc || img.src}`
  if (wrap.dataset.cowBox === key) return
  wrap.dataset.cowBox = key

  wrap.style.width = `${boxW}px`
  wrap.style.height = `${boxH}px`
  wrap.style.maxWidth = '100%'
  wrap.style.maxHeight = '400px'
  wrap.style.background = 'transparent'
  img.style.clipPath = 'none'
  img.style.width = `${natW * scale}px`
  img.style.height = `${natH * scale}px`
  img.style.maxWidth = 'none'
  img.style.maxHeight = 'none'
  img.style.position = 'absolute'
  img.style.left = `${-padX * scale - extraX / 2}px`
  img.style.top = `${-padY * scale - extraY / 2}px`
  img.style.margin = '0'
  img.style.objectFit = 'fill'
}

function applyMainImage(img) {
  if (img.closest('[role="dialog"]')) return
  const wrap = img.parentElement
  if (!wrap) return
  wrap.classList.add('cow-gallery-crop', 'cow-gallery-crop--main')
  const run = () => layoutFill(img)
  if (img.complete && img.naturalWidth) run()
  else img.addEventListener('load', run, { once: true })
  ensureNav(wrap)
}

function overviewThumbButtons() {
  const lists = [...document.querySelectorAll('.cow-taxon-gallery .flex.flex-row.overflow-x-auto')]
  const list = lists.find((row) => !row.closest('[role="dialog"]'))
  if (!list) return []
  return [...list.querySelectorAll('.cow-gallery-num.cursor-pointer')]
}

function currentThumbIndex(thumbs) {
  const marked = thumbs.findIndex((thumb) =>
    thumb.classList.contains('cow-gallery-num--current')
  )
  if (marked >= 0) return marked
  const stored = Number(window.__cowGalleryIndex)
  if (Number.isInteger(stored) && stored >= 0 && stored < thumbs.length) {
    return stored
  }
  return 0
}

function go(delta) {
  const thumbs = overviewThumbButtons()
  if (!thumbs.length) return
  const index = (currentThumbIndex(thumbs) + delta + thumbs.length) % thumbs.length
  window.__cowGalleryIndex = index
  thumbs[index]?.click()
}

function ensureNav(mainWrap) {
  const stage = mainWrap.parentElement
  if (!stage) return
  stage.classList.add('cow-gallery-stage')

  let prev = stage.querySelector('.cow-gallery-nav--prev')
  let next = stage.querySelector('.cow-gallery-nav--next')
  if (prev && next) {
    prev.textContent = '‹'
    next.textContent = '›'
    return
  }

  prev = document.createElement('button')
  prev.type = 'button'
  prev.className = 'cow-gallery-nav cow-gallery-nav--prev'
  prev.setAttribute('aria-label', 'Previous photo')
  prev.textContent = '‹'
  prev.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    go(-1)
  })

  next = document.createElement('button')
  next.type = 'button'
  next.className = 'cow-gallery-nav cow-gallery-nav--next'
  next.setAttribute('aria-label', 'Next photo')
  next.textContent = '›'
  next.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    go(1)
  })

  stage.insertBefore(prev, mainWrap)
  stage.appendChild(next)
}

function mappedId(token) {
  return srcMap()[token] || null
}

function srcTokens(src) {
  const value = String(src || '')
  const tokens = new Set()
  const imageId = (value.match(/\/images\/(\d+)/) || [])[1]
  if (imageId) {
    tokens.add(imageId)
    const mapped = mappedId(imageId)
    if (mapped) tokens.add(String(mapped))
  }
  const short = (value.match(/\/s\/([a-z0-9]+)/i) || [])[1]
  if (short) {
    tokens.add(short)
    const mapped = mappedId(short)
    if (mapped) tokens.add(String(mapped))
  }
  return tokens
}

function srcsMatch(a, b) {
  const left = srcTokens(a)
  const right = srcTokens(b)
  for (const token of left) {
    if (right.has(token)) return true
  }
  return false
}

function bindThumbIndex(box, index) {
  if (box.dataset.cowNavBound === '1') return
  box.dataset.cowNavBound = '1'
  box.addEventListener(
    'click',
    () => {
      window.__cowGalleryIndex = index
    },
    true
  )
}

function numberThumbs() {
  const main = document.querySelector('.cow-gallery-crop--main img')
  const mainSrc = main?.currentSrc || main?.getAttribute('src')
  const lists = document.querySelectorAll('.cow-taxon-gallery .flex.flex-row.overflow-x-auto')
  lists.forEach((list) => {
    if (list.closest('[role="dialog"]')) return
    let matched = -1
    const boxes = [...list.children]
      .map((item, index) => {
        const box = item.querySelector('.w-24')
        if (!box) return null
        box.classList.add('cow-gallery-num')
        box.dataset.cowIndex = String(index)
        bindThumbIndex(box, index)
        let label = box.querySelector('.cow-gallery-num__label')
        if (!label) {
          label = document.createElement('span')
          label.className = 'cow-gallery-num__label'
          box.appendChild(label)
        }
        if (label.textContent !== String(index + 1)) {
          label.textContent = String(index + 1)
        }
        const img = box.querySelector('img')
        const thumbSrc = img?.currentSrc || img?.getAttribute('src')
        if (mainSrc && thumbSrc && srcsMatch(mainSrc, thumbSrc)) matched = index
        return box
      })
      .filter(Boolean)
    const current = matched >= 0 ? matched : currentThumbIndex(boxes)
    const previous = Number(window.__cowGalleryIndex)
    window.__cowGalleryIndex = current
    boxes.forEach((box, index) => {
      box.classList.toggle('cow-gallery-num--current', index === current)
    })
    if (current !== previous) {
      boxes[current]?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }
  })
}

function enhanceGallery() {
  if (window.__cowGalleryBusy) return
  window.__cowGalleryBusy = true
  try {
    const onPage = isTaxonPage()
    const otu = otuIdFromLocation()
    if (otu !== window.__cowGalleryOtu) {
      window.__cowGalleryOtu = otu
      window.__cowGalleryIndex = 0
    }
    document.documentElement.classList.toggle('cow-taxon-gallery', onPage)
    if (!onPage) return
    document.querySelectorAll('img.cursor-zoom-in').forEach(applyMainImage)
    numberThumbs()
  } finally {
    window.__cowGalleryBusy = false
  }
}

function patchImageOrder() {
  if (typeof window !== 'undefined' && window.__cowGalleryOrderPatched) return
  if (typeof window !== 'undefined') window.__cowGalleryOrderPatched = true
  makeAPIRequest.interceptors.response.use((response) => {
    const path = String(response.config?.url || '')
    if (!/\/otus\/\d+\/inventory\/images\.json/.test(path)) {
      return response
    }
    if (response.data) {
      rememberSrcMap(response.data)
      sortGalleryImages(response.data)
    }
    return response
  })
}

function watchGallery() {
  if (typeof window === 'undefined') return
  if (window.__cowGalleryObserver) {
    window.__cowGalleryObserver.disconnect()
  }

  const run = () => enhanceGallery()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true })
  } else {
    run()
  }
  window.addEventListener('hashchange', run)
  if (!window.__cowGalleryResizeBound) {
    window.__cowGalleryResizeBound = true
    window.addEventListener('resize', () => {
      window.clearTimeout(window.__cowGalleryResizeTimer)
      window.__cowGalleryResizeTimer = window.setTimeout(run, 120)
    })
  }

  let timer = 0
  const observer = new MutationObserver(() => {
    if (window.__cowGalleryBusy) return
    window.clearTimeout(timer)
    timer = window.setTimeout(run, 120)
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })
  window.__cowGalleryObserver = observer
}

export default function setup() {
  patchImageOrder()
  watchGallery()
}
