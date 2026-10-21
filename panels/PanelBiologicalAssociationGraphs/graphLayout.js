export function citationFromGraphName(name) {
  const match = String(name || '').match(/\s\/\s([^:]+)(?::|$)/)
  return match ? match[1].trim() : ''
}

function citationText(edge) {
  if (typeof edge?.citations === 'string' && edge.citations.trim()) {
    return edge.citations.trim()
  }
  const origin = edge?.origin_citation?.source || edge?.source
  if (origin?.cached) return String(origin.cached)
  if (origin?.object_label) return String(origin.object_label)
  return ''
}

export function uniqueCitations(links) {
  const seen = new Set()
  const out = []
  for (const link of links || []) {
    const text = (link.citations || '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

export function formatTaxonLabel(label) {
  if (!label) return ''
  const match = String(label).match(/^(\S+(?:\s+[a-z]\S+)*)(.*)$/)
  if (!match) return escapeHtml(label)
  return `<i>${escapeHtml(match[1])}</i>${escapeHtml(match[2])}`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function layoutAssociationGraph(edges) {
  const nodes = new Map()
  const links = []

  for (const edge of edges || []) {
    const fromId = Number(edge.subject_otu_id || edge.subject?.id)
    const toId = Number(edge.object_otu_id || edge.object?.id)
    if (!fromId || !toId) continue

    addNode(nodes, fromId, edge.subject)
    addNode(nodes, toId, edge.object)
    links.push({
      from: fromId,
      to: toId,
      relationship: edge.relationship || '',
      citations: citationText(edge)
    })
  }

  const layers = assignLayers(nodes, links)

  return {
    nodes: [...nodes.values()],
    links,
    layers
  }
}

function addNode(nodes, id, payload) {
  if (nodes.has(id)) return
  nodes.set(id, {
    id,
    label: payload?.label || String(id),
    type: payload?.type || 'Otu'
  })
}

function assignLayers(nodes, links) {
  const indegree = new Map()
  const outgoing = new Map()

  for (const id of nodes.keys()) {
    indegree.set(id, 0)
    outgoing.set(id, [])
  }

  for (const link of links) {
    outgoing.get(link.from)?.push(link.to)
    if (indegree.has(link.to)) {
      indegree.set(link.to, indegree.get(link.to) + 1)
    }
  }

  const layer = new Map()
  const queue = [...nodes.keys()].filter((id) => indegree.get(id) === 0)
  queue.forEach((id) => layer.set(id, 0))

  while (queue.length) {
    const current = queue.shift()
    for (const next of outgoing.get(current) || []) {
      layer.set(
        next,
        Math.max(layer.get(next) || 0, (layer.get(current) || 0) + 1)
      )
      indegree.set(next, indegree.get(next) - 1)
      if (indegree.get(next) === 0) queue.push(next)
    }
  }

  for (const id of nodes.keys()) {
    if (!layer.has(id)) layer.set(id, 0)
  }

  const maxLayer = Math.max(0, ...layer.values())
  const layers = Array.from({ length: maxLayer + 1 }, () => [])
  for (const [id, index] of layer) {
    layers[index].push(nodes.get(id))
  }
  return layers.filter((column) => column.length)
}

export function linksBetween(links, fromLayer, toLayer) {
  const fromIds = new Set(fromLayer.map((node) => node.id))
  const toIds = new Set(toLayer.map((node) => node.id))
  const seen = new Set()
  const out = []
  for (const link of links) {
    if (!fromIds.has(link.from) || !toIds.has(link.to)) continue
    const key = `${link.from}-${link.relationship}-${link.to}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(link)
  }
  return out
}
