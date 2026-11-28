// Role of a ceraphronoid in one record, inferred from its host:
// a host that is itself a parasitoid makes the record hyperparasitism.
import { isCeraphronoid } from '../panels/PanelHosts/associations.js'

const PARASITOID_FAMILIES = new Set([
  'Braconidae', 'Ichneumonidae', 'Aphelinidae', 'Encyrtidae', 'Pteromalidae', 'Eulophidae', 'Platygastridae',
  'Scelionidae', 'Mymaridae', 'Trichogrammatidae', 'Figitidae', 'Chalcididae', 'Eupelmidae', 'Signiphoridae',
  'Dryinidae', 'Bethylidae', 'Eurytomidae', 'Torymidae', 'Tachinidae', 'Cryptochetidae', 'Pipunculidae'
])

export const ROLES = {
  primary: { label: 'Primary parasitoid', short: 'primary', color: '#74866a' },
  hyper: { label: 'Hyperparasitoid', short: 'hyper', color: '#6c5240' },
  predator: { label: 'Predator', short: 'predator', color: '#b0562b' }
}

export function makeRoleOf(rows) {
  const parasites = new Set()
  const genera = new Set()
  rows.forEach((r) => {
    if (r.rel !== 'parasitoid of') return
    parasites.add(String(r.s.id || r.s.label))
    if (r.s.genus) genera.add(r.s.genus)
  })
  return (r) => {
    if (r.rel === 'feeds on') return 'plant'
    if (r.rel === 'predator of') return 'predator'
    const o = r.o || {}
    const g = o.genus || String(o.label || '').split(' ')[0]
    if (isCeraphronoid(o) || parasites.has(String(o.id || o.label)) || genera.has(g) || PARASITOID_FAMILIES.has(o.family) || PARASITOID_FAMILIES.has(o.label)) return 'hyper'
    return 'primary'
  }
}
