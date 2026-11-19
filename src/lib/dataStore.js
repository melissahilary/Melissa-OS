// Supabase-backed data store. Your data lives in Postgres, tied to your account.
//
//   - Open the app  → if signed in, all your rows load into memory; if not, you log in.
//   - Edit anything → it upserts to the planner_state table (debounced).
//   - Any device    → log in with the same email, the same data is there.
//
// No localStorage data store, no folders. (Supabase keeps its own auth session in
// localStorage — that's just the login token, not your planner data.)

import { supabase } from './supabaseClient'
import { missingSeeds } from './profile'
import { listenForAuthLinks, redirectTo, sessionFromUrl } from './nativeAuth'

const TABLE = 'planner_state'

const cache = new Map()
const subscribers = new Map() // key -> Set<cb>
const statusSubs = new Set()
const writeTimers = new Map()

let user = null
let phase = 'loading' // loading | signed-out | ready | read-error
let started = false
// Writes wait until a read of this account has succeeded. A failed read must
// not look like an empty book, and must not be saved over.
let readOk = false

// ── pub/sub ─────────────────────────────────────────────────────────
function notify(key) {
  const subs = subscribers.get(key)
  if (subs) subs.forEach((cb) => cb(cache.get(key)))
}
function notifyAllKnown() {
  subscribers.forEach((set, key) => set.forEach((cb) => cb(cache.get(key))))
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
  return { phase, email: user ? user.email : '', createdAt: user ? user.created_at || '' : '', userId: user ? user.id : '' }
}

// ── read / write ────────────────────────────────────────────────────
export function get(key, fallback) {
  return cache.has(key) ? cache.get(key) : fallback
}

function canPersist() {
  return readOk && user && user.id && user.id !== 'preview-user'
}

export function set(key, value) {
  if (!readOk) return
  cache.set(key, value)
  notify(key)
  if (canPersist()) scheduleUpsert(key)
}

// An automatic write may create a missing key. It never replaces one.
export function fillBlank(key, value) {
  if (!readOk || cache.has(key)) return false
  set(key, value)
  return true
}

function scheduleUpsert(key) {
  clearTimeout(writeTimers.get(key))
  writeTimers.set(key, setTimeout(() => upsert(key), 400))
}
async function upsert(key) {
  if (!canPersist()) return
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: user.id, key, value: cache.get(key), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' },
      )
    if (error) console.warn('[mos] save failed', key, error.message)
  } catch (e) {
    console.warn('[mos] save error', key, e)
  }
}

function applyMissingSeeds() {
  if (!user) return
  missingSeeds((key) => cache.has(key), user.id).forEach(([key, value]) => fillBlank(key, value))
}

async function loadAll() {
  try {
    const { data, error } = await supabase.from(TABLE).select('key,value')
    if (error || !Array.isArray(data)) {
      console.warn('[mos] load failed', error && error.message)
      readOk = false
      return false
    }
    cache.clear()
    data.forEach((row) => cache.set(row.key, row.value))
    readOk = true
    applyMissingSeeds()
    notifyAllKnown()
    return true
  } catch (e) {
    console.warn('[mos] load error', e)
    readOk = false
    return false
  }
}

async function acceptLink(url) {
  const found = sessionFromUrl(url)
  if (!found) return
  if (found.type === 'code') await supabase.auth.exchangeCodeForSession(found.code)
  else await supabase.auth.setSession({ access_token: found.access_token, refresh_token: found.refresh_token })
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
    const ok = await loadAll()
    phase = ok ? 'ready' : 'read-error'
  } else {
    phase = 'signed-out'
  }
  notifyStatus()
  listenForAuthLinks(acceptLink)

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const next = session ? session.user : null
    const changed = (next ? next.id : null) !== (user ? user.id : null)
    user = next
    if (user) {
      if (changed || phase !== 'ready') {
        phase = 'loading'
        notifyStatus()
        const ok = await loadAll()
        phase = ok ? 'ready' : 'read-error'
      }
      notifyStatus()
    } else {
      readOk = false
      cache.clear()
      phase = 'signed-out'
      notifyStatus()
      notifyAllKnown()
    }
  })
}

// Dev-only in-memory book. Vite removes this branch from production builds,
// and it never calls the hosted database.
export function enablePreview(mode) {
  if (!import.meta.env.DEV) return
  started = true
  user = { id: 'preview-user', email: 'preview@example.com' }
  readOk = true
  if (mode === 'app') cache.set('mos:profile', { firstName: 'Ada', setupComplete: true, cycleOptIn: true })
  phase = 'ready'
  notifyStatus()
}

// ── auth ────────────────────────────────────────────────────────────
export async function signIn(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo() },
  })
}
export async function signOut() {
  return supabase.auth.signOut()
}
// Change the account email — Supabase emails a confirmation to the new address.
export async function updateEmail(email) {
  return supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo() })
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
export async function uploadResultPhoto(blob) {
  if (!canPersist()) return null
  const path = `${user.id}/results/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
  if (error) { console.warn('[mos] result upload failed', error.message); return null }
  return path
}

export async function uploadPhoto(blob, ext = 'jpg') {
  if (!canPersist()) return null
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
  if (!readOk) return
  if (user) {
    try { await supabase.from(TABLE).delete().eq('user_id', user.id) } catch (e) { console.warn('[mos] wipe error', e) }
  }
  const keys = [...cache.keys()]
  cache.clear()
  keys.forEach((k) => notify(k))
  notifyAllKnown()
}
