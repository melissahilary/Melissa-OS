import test from 'node:test'
import assert from 'node:assert/strict'
import { summarize, money, normalizePositions } from './portfolio.js'

test('empty book is a zero', () => {
  const s = summarize(null)
  assert.equal(s.count, 0)
  assert.equal(s.total, 0)
  assert.equal(s.gain, 0)
  assert.deepEqual(s.byClass, [])
})

test('holdings sum, and allocation is a share of value', () => {
  const s = summarize([
    { id: 'a', name: 'Brokerage', assetClass: 'public', value: '12000', cost: 10000 },
    { id: 'b', name: 'House fund', assetClass: 'cash', value: 3000, cost: 3000 },
    { id: 'c', name: '', assetClass: 'cash', value: 999 },
    { id: 'd', name: 'Mystery', assetClass: 'nope', value: 1000, cost: 800 },
  ])
  assert.equal(s.count, 3)
  assert.equal(s.total, 16000)
  assert.equal(s.cost, 13800)
  assert.equal(s.gain, 2200)
  const pub = s.byClass.find((c) => c.id === 'public')
  assert.equal(pub.value, 12000)
  assert.ok(Math.abs(pub.share - 12000 / 16000) < 1e-9)
  assert.equal(s.rows.find((r) => r.name === 'Mystery').assetClass, 'other')
})

test('money prints whole dollars', () => {
  assert.equal(money(12000), '$12,000')
  assert.equal(money('nope'), '$0')
})

test('normalize drops blank names', () => {
  assert.equal(normalizePositions([{ id: 'a', name: '  ' }]).length, 0)
})
