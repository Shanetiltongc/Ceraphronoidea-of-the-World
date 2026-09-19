import { makeAPIRequest } from '@/utils/request'

/**
 * Core TaxonPages search sends having_taxon_name_only=true, which TaxonWorks
 * treats as "OTU.name must be blank". Ceraphronoidea catalog OTUs were created
 * with names filled in, so genera/species were excluded. Drop that filter and
 * keep with_taxon_name so results still require a linked taxon name.
 */
export default function setup() {
  makeAPIRequest.interceptors.request.use((config) => {
    const url = String(config.url || '')
    if (!url.includes('/otus/autocomplete') || !config.params) {
      return config
    }

    if (config.params.having_taxon_name_only) {
      delete config.params.having_taxon_name_only
      config.params.with_taxon_name = true
    }

    return config
  })
}
