import test from 'node:test'
import assert from 'node:assert/strict'
import { physicalKey, resolveActive, normalizeMembers, OWNER_ID, newMemberId, isMemberId } from './scope.js'

test('the owner keeps the original keys', () => {
  assert.equal(physicalKey('mos:meals', OWNER_ID), 'mos:meals')
  assert.equal(physicalKey('mos:meals', ''), 'mos:meals')
  assert.equal(physicalKey('mos:meals', 'nope'), 'mos:meals')
  assert.equal(physicalKey('mos:meals', '../x'), 'mos:meals')
})

test('another person gets a prefixed row, and the account keys stay shared', () => {
  assert.equal(physicalKey('mos:meals', 'abc123'), 'p:abc123:mos:meals')
  assert.equal(physicalKey('mos:household', 'abc123'), 'mos:household')
  assert.equal(physicalKey('mos:active-profile', 'abc123'), 'mos:active-profile')
})

test('a missing or unknown person resolves back to the owner', () => {
  const members = normalizeMembers([
    { id: 'abc123', name: '  Tariq ', note: ' partner ' },
    { id: 'bad id', name: 'Skip' },
    { id: 'abc123', name: 'Duplicate' },
    { name: 'No id' },
  ])
  assert.deepEqual(members, [{ id: 'abc123', name: 'Tariq', note: 'partner' }])
  assert.equal(resolveActive('abc123', members), 'abc123')
  assert.equal(resolveActive('missing1', members), OWNER_ID)
  assert.equal(resolveActive(null, members), OWNER_ID)
})

test('new member ids are safe to put in a key', () => {
  const id = newMemberId()
  assert.equal(isMemberId(id), true)
  assert.equal(physicalKey('mos:profile', id).startsWith(`p:${id}:`), true)
})
