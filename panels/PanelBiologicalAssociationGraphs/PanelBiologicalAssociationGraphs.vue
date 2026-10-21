<template>
  <section
    v-if="isLoading || errorMessage || graphs.length || leftover.length"
    class="cow-bagraph-panel"
  >
    <h2 class="cow-bagraph-panel__heading">Biological associations</h2>
    <p v-if="isLoading" class="cow-bagraph__status">Loading associations…</p>
    <p v-else-if="errorMessage" class="cow-bagraph__status">{{ errorMessage }}</p>
    <p v-else class="cow-bagraph__help">
      Host chains from the cited paper. Linked names open that taxon page.
    </p>

    <div
      v-for="graph in graphs"
      :key="graph.id"
      class="cow-bagraph"
    >
      <h3 v-if="graph.citation" class="cow-bagraph__title">{{ graph.citation }}</h3>
      <div class="cow-bagraph__layers">
        <template
          v-for="(layer, index) in graph.layout.layers"
          :key="`${graph.id}-layer-${index}`"
        >
          <div class="cow-bagraph__layer">
            <component
              :is="node.hasPage ? 'RouterLink' : 'span'"
              v-for="node in layer"
              :key="`${graph.id}-n-${node.id}`"
              class="cow-bagraph__node"
              :class="{
                'cow-bagraph__node--current': node.id === Number(otuId),
                'cow-bagraph__node--plain': !node.hasPage
              }"
              v-bind="
                node.hasPage
                  ? { to: { name: 'otus-id-overview', params: { id: String(node.id) } } }
                  : {}
              "
            >
              <span v-html="formatTaxonLabel(node.label)" />
            </component>
          </div>
          <div
            v-if="graph.layout.layers[index + 1]"
            class="cow-bagraph__rels"
          >
            <span
              v-for="(link, linkIndex) in linksBetween(
                graph.layout.links,
                layer,
                graph.layout.layers[index + 1]
              )"
              :key="`${graph.id}-r-${index}-${linkIndex}`"
              class="cow-bagraph__rel"
            >
              {{ link.relationship || 'associated with' }}
            </span>
          </div>
        </template>
      </div>
    </div>

    <div v-if="leftover.length" class="cow-bagraph-fallback">
      <table class="cow-bagraph-fallback__table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Relationship</th>
            <th>Object</th>
            <th>Citation</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in leftover" :key="row.id">
            <td v-html="formatTaxonLabel(row.subject)" />
            <td>{{ row.relationship }}</td>
            <td v-html="formatTaxonLabel(row.object)" />
            <td>{{ row.citation }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { makeAPIRequest } from '@/utils'
import {
  citationFromGraphName,
  formatTaxonLabel,
  layoutAssociationGraph,
  linksBetween,
  uniqueCitations
} from './graphLayout.js'

const props = defineProps({
  otuId: {
    type: [Number, String],
    default: null
  }
})

const graphs = ref([])
const leftover = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
let controller = null

const associationParams = {
  per: 200,
  page: 1,
  extend: [
    'object',
    'subject',
    'biological_relationship',
    'taxonomy',
    'origin_citation',
    'citations'
  ]
}

function labelOf(payload) {
  return payload?.label || payload?.object_tag || ''
}

function citationOf(edge) {
  if (typeof edge?.citations === 'string' && edge.citations.trim()) {
    return edge.citations.trim()
  }
  const origin = edge?.origin_citation?.source || edge?.source
  return origin?.cached || origin?.object_label || ''
}

async function loadGraphs(otuId) {
  controller?.abort()
  if (!otuId) {
    graphs.value = []
    leftover.value = []
    isLoading.value = false
    errorMessage.value = ''
    return
  }

  controller = new AbortController()
  isLoading.value = true
  errorMessage.value = ''
  graphs.value = []
  leftover.value = []

  try {
    const { data: associations } = await makeAPIRequest.get(
      '/biological_associations/basic',
      {
        signal: controller.signal,
        params: {
          ...associationParams,
          'otu_query[coordinatify]': true,
          'otu_query[otu_id][]': otuId
        }
      }
    )

    const baIds = [
      ...new Set((associations || []).map((row) => row.id).filter(Boolean))
    ]
    if (!baIds.length) {
      graphs.value = []
      leftover.value = []
      return
    }

    const { data: graphRows } = await makeAPIRequest.get(
      '/biological_associations_graphs',
      {
        signal: controller.signal,
        params: {
          'biological_association_id[]': baIds,
          per: 200
        }
      }
    )

    const uniqueGraphs = []
    const seen = new Set()
    for (const graph of graphRows || []) {
      if (!graph?.id || seen.has(graph.id)) continue
      seen.add(graph.id)
      uniqueGraphs.push(graph)
    }

    const usedIds = new Set()
    const detailed = await Promise.all(
      uniqueGraphs.map(async (graph) => {
        const { data: edges } = await makeAPIRequest.get(
          '/biological_associations/basic',
          {
            signal: controller.signal,
            params: {
              ...associationParams,
              'biological_associations_graph_id[]': graph.id
            }
          }
        )
        ;(edges || []).forEach((edge) => {
          if (edge?.id) usedIds.add(edge.id)
        })
        const layout = layoutAssociationGraph(edges)
        const otuIds = [...new Set(layout.nodes.map((node) => node.id))]
        const pages = await Promise.all(
          otuIds.map(async (id) => {
            try {
              const { data } = await makeAPIRequest.get(`/otus/${id}.json`, {
                signal: controller.signal
              })
              return [id, Boolean(data?.taxon_name_id) || id === Number(otuId)]
            } catch {
              return [id, id === Number(otuId)]
            }
          })
        )
        const hasPage = Object.fromEntries(pages)
        layout.nodes.forEach((node) => {
          node.hasPage = Boolean(hasPage[node.id])
        })
        layout.layers.forEach((layer) => {
          layer.forEach((node) => {
            node.hasPage = Boolean(hasPage[node.id])
          })
        })
        const fromName = citationFromGraphName(graph.name)
        const fromEdges = uniqueCitations(layout.links)
        return {
          id: graph.id,
          citation: fromName || fromEdges[0] || '',
          layout
        }
      })
    )

    graphs.value = detailed.filter((graph) => graph.layout.nodes.length)
    leftover.value = (associations || [])
      .filter((row) => row?.id && !usedIds.has(row.id))
      .map((row) => ({
        id: row.id,
        subject: labelOf(row.subject),
        object: labelOf(row.object),
        relationship: row.relationship || '',
        citation: citationOf(row)
      }))
  } catch (error) {
    if (error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
      graphs.value = []
      leftover.value = []
      errorMessage.value = 'Biological associations could not be loaded.'
    }
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.otuId,
  () => loadGraphs(props.otuId),
  { immediate: true }
)

onBeforeUnmount(() => {
  controller?.abort()
})
</script>
