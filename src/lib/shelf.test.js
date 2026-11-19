import test from 'node:test'
import assert from 'node:assert/strict'
import { spendReport, costPerUse, nudges, normalizeProducts } from './shelf.js'

test('spend is per product, month and category, with cost per use', () => {
  const products = [
    { id: 'a', name: 'Serum', category: 'skin', price: 48, uses: 24, purchasedOn: '2026-11-02', status: 'opened' },
    { id: 'b', name: 'Oil', category: 'hair', price: 20, uses: 0, purchasedOn: '2026-11-18', status: 'sealed' },
    { id: 'c', name: 'Old cream', category: 'skin', price: 30, uses: 10, purchasedOn: '2026-10-01', status: 'opened' },
    { id: 'd', name: 'Wish', category: 'makeup', price: 12, wishlist: true, purchasedOn: '2026-11-01' },
  ]
  const nov = spendReport(products, '2026-11')
  assert.equal(nov.total, 68)
  assert.equal(nov.perProduct.length, 2)
  assert.equal(nov.byCategory.find((c) => c.id === 'skin').total, 48)
  assert.equal(costPerUse(products[0]), 2)
  assert.equal(costPerUse(products[1]), null)
  assert.equal(spendReport(products, '2026-10').total, 30)
})

test('low and expiring products nudge a restock, wishes do not', () => {
  const rows = nudges([
    { id: 'a', name: 'SPF', status: 'low', price: 10 },
    { id: 'b', name: 'Mask', status: 'expiring', price: 8 },
    { id: 'c', name: 'Dream oil', status: 'low', wishlist: true, price: 40 },
    { id: 'd', name: 'Sealed', status: 'sealed', price: 5 },
  ])
  assert.deepEqual(rows.map((r) => r.name), ['SPF', 'Mask'])
  assert.equal(normalizeProducts([{ id: 'x', name: '  ' }]).length, 0)
})
