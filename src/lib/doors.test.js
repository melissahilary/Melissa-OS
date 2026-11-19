import test from 'node:test'
import assert from 'node:assert/strict'
import { doorsFor, termMatches } from './doors.js'

test('a word matches on its own, not inside another word', () => {
  assert.equal(termMatches('weight training today', 'train'), false)
  assert.equal(termMatches('I will train', 'train'), true)
  assert.equal(termMatches('straining the tea', 'train'), false)
  assert.equal(termMatches('start over', 'art'), false)
})

test('a stem matches the front of a word only', () => {
  assert.equal(termMatches('ovulation is tomorrow', 'ovulat*'), true)
  assert.equal(termMatches('preovulation note', 'ovulat*'), false)
  const doors = doorsFor({ q: 'When is ovulation?', a: '' })
  assert.equal(doors.some((d) => d.label === 'My body'), true)
})

test('skincare is not mistaken for a bare skin mention, and skin still matches', () => {
  assert.equal(doorsFor({ q: 'My skincare shelf', a: '' }).some((d) => d.label === 'Skincare'), true)
  assert.equal(doorsFor({ q: 'dry skin', a: '' }).some((d) => d.label === 'Skincare'), true)
})
