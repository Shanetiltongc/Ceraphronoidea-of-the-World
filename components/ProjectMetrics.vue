<template>
  <section
    class="cow-metrics"
    aria-label="Database counts from this TaxonWorks project"
  >
    <div class="cow-metrics__row">
      <div
        v-for="item in items"
        :key="item.key"
        class="cow-metrics__item"
      >
        <p class="cow-metrics__value">{{ item.value }}</p>
        <p class="cow-metrics__label">{{ item.label }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { makeAPIRequest } from '@/utils'

const items = ref([
  { key: 'valid-species', label: 'Valid species', value: '—' },
  { key: 'described-names', label: 'Described names', value: '—' },
  { key: 'genera', label: 'Genera', value: '—' },
  { key: 'fossil-species', label: 'Fossil species', value: '—' },
  { key: 'references', label: 'References', value: '—' },
  { key: 'citations', label: 'Citations', value: '—' },
  { key: 'images', label: 'Images', value: '—' },
  { key: 'specimens', label: 'Specimen records', value: '—' }
])

function formatCount(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString() : '—'
}

function headerTotal(response) {
  const raw =
    response.headers['pagination-total'] ||
    response.headers['Pagination-Total']
  return raw == null ? null : Number(raw)
}

async function countNames(params) {
  const response = await makeAPIRequest.get('/taxon_names', {
    params: { per: 1, ...params }
  })
  return headerTotal(response)
}

function setValue(key, value) {
  const row = items.value.find((item) => item.key === key)
  if (row) row.value = formatCount(value)
}

onMounted(async () => {
  const names = Promise.allSettled([
    countNames({ nomenclature_group: 'Species', otus: true }),
    countNames({ nomenclature_group: 'Species' }),
    countNames({ nomenclature_group: 'Genus' }),
    countNames({
      nomenclature_group: 'Species',
      'taxon_name_classification[]':
        'TaxonNameClassification::Iczn::Fossil'
    })
  ])

  const stats = makeAPIRequest.get('/stats').catch(() => null)

  const [nameResults, statsResponse] = await Promise.all([names, stats])

  const [validSpecies, described, genera, fossils] = nameResults.map(
    (result) => (result.status === 'fulfilled' ? result.value : null)
  )

  if (validSpecies != null) setValue('valid-species', validSpecies)
  if (described != null) setValue('described-names', described)
  if (genera != null) setValue('genera', genera)
  if (fossils != null) setValue('fossil-species', fossils)

  const data = statsResponse?.data?.data
  if (!data) return

  setValue('references', data['Project sources'])
  setValue('citations', data.Citations)
  setValue('images', data.Images)
  setValue(
    'specimens',
    data['Collection objects'] ?? data['Dwc occurrences']
  )
})
</script>
