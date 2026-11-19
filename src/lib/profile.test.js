import test from 'node:test'
import assert from 'node:assert/strict'
import { missingSeeds, needsSetup, resolveProfile, resolveSigns } from './profile.js'
import { MELISSA_USER_ID } from './brand.js'

test('a new account starts empty and is asked to set up', () => {
  const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  assert.equal(needsSetup(null, id), true)
  assert.equal(resolveProfile(null, id).firstName, '')
  assert.equal(resolveSigns(null, id).sun, '')
  assert.deepEqual(missingSeeds(() => false, id), [])
})

test('her missing keys can be filled, and an existing key is left alone', () => {
  const has = (key) => key === 'mos:profile'
  const seeds = missingSeeds(has, MELISSA_USER_ID)
  assert.deepEqual(seeds.map(([k]) => k), ['mos:astro:signs', 'mos:settings:location'])
  const stored = { firstName: 'M', birthday: '1990-01-01', setupComplete: true }
  assert.equal(resolveProfile(stored, MELISSA_USER_ID).birthday, '1990-01-01')
  assert.equal(needsSetup(null, MELISSA_USER_ID), false)
})
