import { requireUser } from './_guard.js'

// Public product databases. No account data is sent. Price is included only
// when the record actually carries one.
const SOURCES = [
  (code) => `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
  (code) => `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
]

function fromRecord(p) {
  if (!p || typeof p !== 'object') return null
  const name = p.product_name || p.product_name_en || ''
  if (!String(name).trim()) return null
  const price = p.price || (p.nutriments && p.nutriments.price) || ''
  return {
    name: String(name).trim(),
    brand: String(p.brands || '').split(',')[0].trim(),
    size: String(p.quantity || p.product_quantity || '').trim(),
    ingredients: String(p.ingredients_text || p.ingredients_text_en || '').trim(),
    price: price === '' || price == null ? '' : String(price),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const user = await requireUser(req, res)
  if (!user) return
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const code = String((req.query && req.query.code) || body.code || '').replace(/\s+/g, '')
  if (!/^\d{8,14}$/.test(code)) {
    res.status(200).json({ found: false, product: null })
    return
  }
  for (const url of SOURCES) {
    try {
      const r = await fetch(url(code), { headers: { 'User-Agent': 'TheGlowBook/1.0 (personal planner)' } })
      if (!r.ok) continue
      const json = await r.json()
      const product = json && json.status === 1 ? fromRecord(json.product) : null
      if (product) {
        res.status(200).json({ found: true, product })
        return
      }
    } catch {
      /* try the next public database */
    }
  }
  res.status(200).json({ found: false, product: null })
}
