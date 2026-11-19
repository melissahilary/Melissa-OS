export const SHELF_CATEGORIES = [
  { id: 'skin', label: 'Skin' },
  { id: 'hair', label: 'Hair' },
  { id: 'makeup', label: 'Makeup' },
  { id: 'supplements', label: 'Supplements' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'treatments', label: 'Treatments' },
]

const IDS = new Set(SHELF_CATEGORIES.map((c) => c.id))
const STATUSES = new Set(['sealed', 'opened', 'low', 'expiring'])

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function normalizeProduct(p) {
  if (!p || typeof p.id !== 'string' || !p.id) return null
  const name = typeof p.name === 'string' ? p.name.trim() : ''
  if (!name) return null
  return {
    id: p.id,
    name,
    brand: typeof p.brand === 'string' ? p.brand.trim() : '',
    category: IDS.has(p.category) ? p.category : 'skin',
    size: typeof p.size === 'string' ? p.size : '',
    ingredients: typeof p.ingredients === 'string' ? p.ingredients : '',
    price: num(p.price),
    barcode: typeof p.barcode === 'string' ? p.barcode : '',
    status: STATUSES.has(p.status) ? p.status : 'sealed',
    openedOn: typeof p.openedOn === 'string' ? p.openedOn : '',
    expiresOn: typeof p.expiresOn === 'string' ? p.expiresOn : '',
    purchasedOn: typeof p.purchasedOn === 'string' ? p.purchasedOn : '',
    uses: Math.max(0, Math.round(num(p.uses))),
    wishlist: !!p.wishlist,
    restock: !!p.restock,
    dropped: !!p.dropped,
    notes: typeof p.notes === 'string' ? p.notes : '',
  }
}

export function normalizeProducts(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeProduct).filter(Boolean)
}

export function costPerUse(product) {
  const p = normalizeProduct(product)
  if (!p || p.uses <= 0 || p.price <= 0) return null
  return p.price / p.uses
}

export function money(n) {
  const v = num(n)
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: v < 10 && v % 1 ? 2 : 0 })
}

export function monthKey(dateStr) {
  return typeof dateStr === 'string' && dateStr.length >= 7 ? dateStr.slice(0, 7) : ''
}

export function spendReport(raw, month) {
  const rows = normalizeProducts(raw).filter((p) => !p.wishlist)
  const inMonth = month ? rows.filter((p) => monthKey(p.purchasedOn) === month) : rows
  const byCategory = SHELF_CATEGORIES.map((c) => ({
    ...c,
    total: inMonth.filter((p) => p.category === c.id).reduce((s, p) => s + p.price, 0),
  })).filter((c) => c.total > 0)
  const perProduct = inMonth.map((p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, costPerUse: costPerUse(p) }))
  return {
    total: inMonth.reduce((s, p) => s + p.price, 0),
    byCategory,
    perProduct,
  }
}

export function nudges(raw) {
  return normalizeProducts(raw).filter((p) => !p.wishlist && !p.dropped && (p.restock || p.status === 'low' || p.status === 'expiring'))
}

export function categoryLabel(id) {
  return SHELF_CATEGORIES.find((c) => c.id === id)?.label || 'Skin'
}
