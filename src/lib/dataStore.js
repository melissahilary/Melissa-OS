// Supabase-backed data store. Your data lives in Postgres, tied to your account.
//
//   - Open the app  → if signed in, all your rows load into memory; if not, you log in.
//   - Edit anything → it upserts to the planner_state table (debounced).
//   - Any device    → log in with the same email, the same data is there.
//
// No localStorage data store, no folders. (Supabase keeps its own auth session in
// localStorage — that's just the login token, not your planner data.)

import { supabase } from './supabaseClient'
import { OWNER_ID, physicalKey, isMemberId } from './scope'

const TABLE = 'planner_state'

const cache = new Map()
const subscribers = new Map() // logical key -> Set<cb>
const statusSubs = new Set()
const writeTimers = new Map()

let user = null
let phase = 'loading' // loading | signed-out | ready
let started = false
// '' means the account holder, whose rows keep their original keys.
let scopeId = ''

function readLogical(key) {
  const sk = physicalKey(key, scopeId)
  return cache.has(sk) ? cache.get(sk) : undefined
}

// ── pub/sub ─────────────────────────────────────────────────────────
function notify(key) {
  const subs = subscribers.get(key)
  if (subs) subs.forEach((cb) => cb(readLogical(key)))
}
function notifyAllKnown() {
  subscribers.forEach((set, key) => {
    const v = readLogical(key)
    set.forEach((cb) => cb(v))
  })
}
function notifyStatus() {
  const s = getStatus()
  statusSubs.forEach((cb) => cb(s))
}

export function subscribe(key, cb) {
  if (!subscribers.has(key)) subscribers.set(key, new Set())
  subscribers.get(key).add(cb)
  return () => subscribers.get(key)?.delete(cb)
}
export function subscribeStatus(cb) {
  statusSubs.add(cb)
  return () => statusSubs.delete(cb)
}
export function getStatus() {
  return { phase, email: user ? user.email : '', createdAt: user ? user.created_at || '' : '', profileId: scopeId || OWNER_ID }
}

export function getActiveProfile() {
  return scopeId || OWNER_ID
}

// Open another person's planner. Their rows live beside the owner's, prefixed,
// in the same table. Passing the owner id restores the original keys.
export function setActiveProfile(id) {
  const next = isMemberId(id) ? id : ''
  scopeId = next
  cache.set('mos:active-profile', next || OWNER_ID)
  if (phase === 'ready' && user) scheduleUpsert('mos:active-profile')
  notifyAllKnown()
}

// Drop one person's rows. The owner's book cannot be removed this way.
export async function forgetProfile(id) {
  if (!isMemberId(id)) return
  const prefix = `p:${id}:`
  const keys = [...cache.keys()].filter((k) => k.startsWith(prefix))
  keys.forEach((k) => cache.delete(k))
  if (scopeId === id) {
    scopeId = ''
    cache.set('mos:active-profile', OWNER_ID)
    if (phase === 'ready' && user) scheduleUpsert('mos:active-profile')
  }
  notifyAllKnown()
  if (user && keys.length) {
    try {
      const { error } = await supabase.from(TABLE).delete().eq('user_id', user.id).in('key', keys)
      if (error) console.warn('[mos] forget failed', error.message)
    } catch (e) {
      console.warn('[mos] forget error', e)
    }
  }
}

// Dev-only in-memory session, so the house can be reviewed without a login
// and without touching the hosted database. Vite strips this from production.
export function enablePreview() {
  if (!import.meta.env.DEV) return
  started = true
  user = null
  scopeId = ''
  phase = 'ready'
  notifyStatus()
}

// ── read / write ────────────────────────────────────────────────────
export function get(key, fallback) {
  const sk = physicalKey(key, scopeId)
  return cache.has(sk) ? cache.get(sk) : fallback
}

export function set(key, value) {
  const sk = physicalKey(key, scopeId)
  cache.set(sk, value)
  notify(key)
  if (phase === 'ready' && user) scheduleUpsert(sk)
}

function scheduleUpsert(sk) {
  clearTimeout(writeTimers.get(sk))
  writeTimers.set(sk, setTimeout(() => upsert(sk), 400))
}
async function upsert(sk) {
  if (!user) return
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: user.id, key: sk, value: cache.get(sk), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' },
      )
    if (error) console.warn('[mos] save failed', sk, error.message)
  } catch (e) {
    console.warn('[mos] save error', sk, e)
  }
}

function applyStoredScope() {
  const id = cache.get('mos:active-profile')
  scopeId = isMemberId(id) ? id : ''
}

async function loadAll() {
  cache.clear()
  try {
    const { data, error } = await supabase.from(TABLE).select('key,value')
    if (error) console.warn('[mos] load failed', error.message)
    else if (data) data.forEach((row) => cache.set(row.key, row.value))
  } catch (e) {
    console.warn('[mos] load error', e)
  }
  applyStoredScope()
  notifyAllKnown()
}

// ── lifecycle ───────────────────────────────────────────────────────
export async function init() {
  if (started) return
  started = true

  const {
    data: { session },
  } = await supabase.auth.getSession()
  user = session ? session.user : null
  if (user) {
    await loadAll()
    phase = 'ready'
  } else {
    phase = 'signed-out'
  }
  notifyStatus()

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const next = session ? session.user : null
    const changed = (next ? next.id : null) !== (user ? user.id : null)
    user = next
    if (user) {
      if (changed || phase !== 'ready') {
        phase = 'loading'
        notifyStatus()
        await loadAll()
      }
      phase = 'ready'
      notifyStatus()
    } else {
      cache.clear()
      phase = 'signed-out'
      notifyStatus()
      notifyAllKnown()
    }
  })
}

// ── auth ────────────────────────────────────────────────────────────
export async function signIn(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
}
export async function signOut() {
  return supabase.auth.signOut()
}
// Change the account email — Supabase emails a confirmation to the new address.
export async function updateEmail(email) {
  return supabase.auth.updateUser({ email }, { emailRedirectTo: window.location.origin })
}

// ── files ───────────────────────────────────────────────────────────
// Photos are real files in the private `board` bucket, not JSON. Each user's
// images live under a folder named for their auth id, and RLS makes that folder
// theirs alone — so a board can hold as many photos as she likes without ever
// bloating the state rows that load at sign-in.
const BUCKET = 'board'

export function currentUserId() {
  return user ? user.id : null
}

// Returns the stored path, or null when there's no session to own the file.
export async function uploadPhoto(blob, ext = 'jpg') {
  if (!user) return null
  const path = `${user.id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
  if (error) { console.warn('[mos] upload failed', error.message); return null }
  return path
}

// The bucket is private, so viewing needs a signed URL. Signed generously (8h)
// so a board left open all day keeps its pictures.
export async function signedPhotoUrl(path, seconds = 28800) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds)
  if (error) { console.warn('[mos] sign failed', error.message); return null }
  return data ? data.signedUrl : null
}

export async function deletePhoto(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('[mos] delete failed', error.message)
}

// Every stored key/value — used for the full data export.
export function all() {
  const out = {}
  cache.forEach((v, k) => { out[k] = v })
  return out
}

// Permanently delete all planner data for the account (irreversible).
export async function wipeAll() {
  if (user) {
    try { await supabase.from(TABLE).delete().eq('user_id', user.id) } catch (e) { console.warn('[mos] wipe error', e) }
  }
  scopeId = ''
  cache.clear()
  notifyAllKnown()
}
