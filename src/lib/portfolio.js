// A holdings book. Values are what the house last wrote down — nothing here
// fetches a market price.

export const CLASSES = [
  { id: 'cash', label: 'Cash' },
  { id: 'public', label: 'Public markets' },
  { id: 'private', label: 'Private' },
  { id: 'property', label: 'Real estate' },
  { id: 'retirement', label: 'Retirement' },
  { id: 'other', label: 'Other' },
]

const CLASS_IDS = new Set(CLASSES.map((c) => c.id))

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function normalizePositions(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p) => p && typeof p.id === 'string' && p.id && typeof p.name === 'string' && p.name.trim())
    .map((p) => ({
      id: p.id,
      name: p.name.trim(),
      assetClass: CLASS_IDS.has(p.assetClass) ? p.assetClass : 'other',
      value: num(p.value),
      cost: num(p.cost),
      notes: typeof p.notes === 'string' ? p.notes : '',
    }))
}

export function classLabel(id) {
  return CLASSES.find((c) => c.id === id)?.label || 'Other'
}

export function summarize(raw) {
  const rows = normalizePositions(raw)
  const total = rows.reduce((s, p) => s + p.value, 0)
  const cost = rows.reduce((s, p) => s + p.cost, 0)
  const byClass = CLASSES.map((c) => {
    const value = rows.filter((p) => p.assetClass === c.id).reduce((s, p) => s + p.value, 0)
    return { ...c, value, share: total > 0 ? value / total : 0 }
  }).filter((c) => c.value > 0)
  return { rows, total, cost, gain: total - cost, byClass, count: rows.length }
}

export function money(n) {
  const v = num(n)
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
