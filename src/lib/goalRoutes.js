// ── The routing registry — the single source of truth for where a goal step
// LANDS. A step routed to "Aesthetics · Appointments" must actually appear on
// that page, so alongside its planner activity we write a record into the
// section's own store (tagged goalId, so the thread back to the goal is kept).

import * as store from './dataStore'
import { dateKey } from './date'

const uid = () => Math.random().toString(36).slice(2, 10)

// kind × pillar → the section store that should also hold the record.
// shape 'log' = dated record {title,date,place,notes}; 'shelf' = kept thing {name,note}.
const ROUTES = {
  appointment: {
    aesthetics: { key: 'mos:aesthetics:appointments', shape: 'log' },
    fitness: { key: 'mos:fitness:appointments', shape: 'log' },
    hormones: { key: 'mos:hormones:appointments', shape: 'log' },
    haircare: { key: 'mos:haircare:appointments', shape: 'log' },
  },
  lab: {
    hormones: { key: 'mos:hormones:labs', shape: 'log' },
    diagnostics: { key: 'mos:testing:bloodwork', shape: 'log' },
    brainhealth: { key: 'mos:brainhealth:scans', shape: 'log' },
  },
  treatment: {
    aesthetics: { key: 'mos:aesthetics:treatments', shape: 'log' },
    bodycare: { key: 'mos:bodycare:therapies', shape: 'log' },
  },
  product: {
    skincare: { key: 'mos:skincare:products', shape: 'shelf' },
    haircare: { key: 'mos:haircare:products', shape: 'shelf' },
    bodycare: { key: 'mos:bodycare:products', shape: 'shelf' },
    fitness: { key: 'mos:fitness:devices', shape: 'shelf' },
    hormones: { key: 'mos:hormones:wearables', shape: 'shelf' },
    brainhealth: { key: 'mos:brainhealth:wearables', shape: 'shelf' },
    aesthetics: { key: 'mos:aesthetics:prescribed', shape: 'shelf' },
  },
}

// Write the section-store record for a routed step. Returns true if a section
// held it (so callers can say where it landed). Dedupes shelves by name.
export function routeStepToSection({ pillar, kind, title, goalId }) {
  const route = ROUTES[kind] && ROUTES[kind][pillar]
  if (!route || !(title || '').trim()) return false
  const cur = store.get(route.key, [])
  const arr = Array.isArray(cur) ? cur : []
  if (route.shape === 'shelf') {
    const exists = arr.some((x) => ((x.name || '').trim().toLowerCase() === title.trim().toLowerCase()))
    if (exists) return true
    store.set(route.key, [{ id: uid(), name: title.trim(), note: '', goalId: goalId || '' }, ...arr])
  } else {
    store.set(route.key, [{ id: uid(), title: title.trim(), date: dateKey(new Date()), place: '', notes: '', goalId: goalId || '' }, ...arr])
  }
  return true
}

// Upsert a product name into a pillar's shelf (used by routine steps so the
// product you type on a step also lives on the Products page).
export function upsertShelfItem(shelfKey, name, note = '') {
  const t = (name || '').trim()
  if (!t || !shelfKey) return false
  const cur = store.get(shelfKey, [])
  const arr = Array.isArray(cur) ? cur : []
  if (arr.some((x) => (x.name || '').trim().toLowerCase() === t.toLowerCase())) return false
  store.set(shelfKey, [{ id: uid(), name: t, note }, ...arr])
  return true
}
