import test from 'node:test'
import assert from 'node:assert/strict'
import { applySeriesEdit, projectActivity } from './series.js'
import { activityOccursOn } from './activities.js'

test('a one-day edit leaves the rest of a repeating series alone', () => {
  const series = {
    id: 'serum',
    type: 'protocol',
    title: 'Serum',
    category: 'skincare',
    frequency: 'daily',
    seriesStart: '2026-11-01',
    status: 'active',
    details: { time: '07:00' },
  }
  const [edited] = applySeriesEdit(series, '2026-11-10', { title: 'Oil', notes: 'travel tin', details: { time: '08:00' } }, 'one')
  assert.equal(edited.title, 'Serum')
  assert.equal(edited.id, 'serum')
  assert.equal(projectActivity(edited, '2026-11-10').title, 'Oil')
  assert.equal(projectActivity(edited, '2026-11-10').details.time, '08:00')
  assert.equal(projectActivity(edited, '2026-11-11').title, 'Serum')
  assert.equal(projectActivity(edited, '2026-11-11').details.time, '07:00')
  assert.equal(activityOccursOn(edited, '2026-11-09'), true)
  assert.equal(activityOccursOn(edited, '2026-11-10'), true)
  assert.equal(activityOccursOn(edited, '2026-11-11'), true)
})

test('this and following splits the series at the chosen day', () => {
  const series = {
    id: 'serum',
    type: 'protocol',
    title: 'Serum',
    category: 'skincare',
    frequency: 'daily',
    seriesStart: '2026-11-01',
    status: 'active',
    details: {},
  }
  const [ended, next] = applySeriesEdit(series, '2026-11-10', { title: 'Oil' }, 'following')
  assert.equal(ended.title, 'Serum')
  assert.equal(ended.seriesEnd, '2026-11-09')
  assert.equal(activityOccursOn(ended, '2026-11-09'), true)
  assert.equal(activityOccursOn(ended, '2026-11-10'), false)
  assert.equal(next.title, 'Oil')
  assert.equal(next.seriesStart, '2026-11-10')
  assert.notEqual(next.id, ended.id)
  assert.equal(activityOccursOn(next, '2026-11-10'), true)
  assert.equal(activityOccursOn(next, '2026-11-09'), false)
})
