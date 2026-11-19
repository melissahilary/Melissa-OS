import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BUNDLE_ID, APP_NAME } from './brand.js'

test('the bundle id is one string, repeated where the native project reads it', () => {
  const config = JSON.parse(readFileSync(new URL('../../capacitor.config.json', import.meta.url), 'utf8'))
  assert.equal(config.appId, BUNDLE_ID)
  assert.equal(config.appName, APP_NAME)
  assert.equal(BUNDLE_ID, 'com.theglowbook.app')
})
