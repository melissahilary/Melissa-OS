// Supabase-backed data store. Your data lives in Postgres, tied to your account.
//
//   - Open the app  → if signed in, all your rows load into memory; if not, you log in.
//   - Edit anything → it upserts to the planner_state table (debounced).
//   - Any device    → log in with the same email, the same data is there.
//
// No localStorage data store, no folders. (Supabase keeps its own auth session in
// localStorage — that's just the login token, not your planner data.)

import { supabase } from './supabaseClient'

const TABLE = 'planner_state'

const cache = new Map()
const subscribers = new Map() // key -> Set<cb>
const statusSubs = new Set()
const saveSubs = new Set()
const writeTimers = new Map()
const pending = new Set() // keys changed but not yet confirmed saved
const failures = new Map() // key -> the last error, after the retries ran out

let user = null
let phase = 'loading' // loading | signed-out | ready
let started = false

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
function notifySave() {
  const s = getSaveState()
  saveSubs.forEach((cb) => cb(s))
}
export function subscribeSave(cb) {
  saveSubs.add(cb)
  return () => saveSubs.delete(cb)
}
export function getSaveState() {
  if (failures.size) return { state: 'error', keys: [...failures.keys()], message: [...failures.values()][0] }
  if (pending.size) return { state: 'saving', keys: [...pending], message: '' }
  return { state: 'saved', keys: [], message: '' }
}
export function getStatus() {
  return { phase, loaded, email: user ? user.email : '', createdAt: user ? user.created_at || '' : '' }
}
// Did the rows actually come back? Anything that writes a first-run default
// must ask this and not merely whether the app is up.
export function isLoaded() {
  return loaded
}

// ── read / write ────────────────────────────────────────────────────
export function get(key, fallback) {
  return cache.has(key) ? cache.get(key) : fallback
}

// Is there a row for this key at all? Not "is it empty" — a planner she has
// emptied herself is not a planner that was never written.
export function has(key) {
  return cache.has(key)
}

// Write ONLY where nothing has ever been written. The rule this enforces:
// her data does not change unless she changes it. Anything the app writes on
// its own — a first-run default, a starter week — goes through here, so it can
// fill a blank and can never, by construction, land on top of her own work.
// Returns whether it wrote.
export function fill(key, value) {
  if (cache.has(key)) return false
  set(key, value)
  return true
}

export function set(key, value) {
  cache.set(key, value)
  notify(key)
  if (phase === 'ready' && loaded && user) scheduleUpsert(key)
}

function scheduleUpsert(key) {
  pending.add(key)
  notifySave()
  clearTimeout(writeTimers.get(key))
  writeTimers.set(key, setTimeout(() => upsert(key), 400))
}

// A write that hasn't landed yet. The debounce is there so typing doesn't send a
// request per keystroke, but anything still sitting in it when the tab goes away
// is a change she made and will not find again — so leaving the page sends it
// now rather than waiting out the idle.
export function flush(key) {
  const keys = key ? [key] : [...pending]
  keys.forEach((k) => {
    clearTimeout(writeTimers.get(k))
    writeTimers.delete(k)
    upsert(k)
  })
}

// Closing the tab, switching apps, locking the phone — each of these can end the
// page inside the debounce window, and a change still sitting in it is a change
// she made and will not find again. Send what's waiting at the first sign she is
// leaving — which is what makes a photo added and immediately navigated away
// from still be there tomorrow — and push again when a dropped connection comes
// back.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  window.addEventListener('pagehide', () => flush())
  window.addEventListener('online', () => {
    const stuck = [...failures.keys()]
    failures.clear()
    notifySave()
    stuck.forEach((k) => upsert(k))
  })
}

// Saving is otherwise invisible, and invisible is fine until it fails. A dropped
// connection used to lose the change in a console warning nobody reads; now it
// retries, and if it still won't go the app can say so.
const RETRY_MS = [1200, 3500, 9000]
async function upsert(key, attempt = 0) {
  if (!user || !loaded) return
  let failed = null
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: user.id, key, value: cache.get(key), updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' },
      )
    failed = error ? error.message : null
  } catch (e) {
    failed = String((e && e.message) || e)
  }
  if (!failed) {
    pending.delete(key)
    failures.delete(key)
    notifySave()
    return
  }
  console.warn('[mos] save failed', key, failed)
  if (attempt < RETRY_MS.length) {
    writeTimers.set(key, setTimeout(() => upsert(key, attempt + 1), RETRY_MS[attempt]))
  } else {
    failures.set(key, failed)
    notifySave()
  }
}

// Whether the rows in `cache` are the rows in Postgres, or merely the absence
// of an answer. NOTHING may be written until this is true.
//
// It used to not exist, and a load that failed looked exactly like an account
// with nothing in it: the cache was empty, the app was told it was ready, the
// first-run seeding saw no planner and wrote a fresh one — over the top of a
// year of her habits. A failed read must never become a write.
let loaded = false

// One dropped request is not an empty account, so the read is given a few goes
// before the app is told anything at all.
const LOAD_RETRY_MS = [600, 1800, 4000]

async function loadOnce() {
  try {
    const { data, error } = await supabase.from(TABLE).select('key,value')
    if (error) { console.warn('[mos] load failed', error.message); return null }
    return data || []
  } catch (e) {
    console.warn('[mos] load error', e)
    return null
  }
}

async function loadAll() {
  // Whatever was in flight belongs to the state we are about to replace.
  writeTimers.forEach((t) => clearTimeout(t))
  writeTimers.clear()
  pending.clear()
  failures.clear()
  notifySave()
  loaded = false
  cache.clear()

  let rows = await loadOnce()
  for (let i = 0; rows === null && i < LOAD_RETRY_MS.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, LOAD_RETRY_MS[i]))
    // eslint-disable-next-line no-await-in-loop
    rows = await loadOnce()
  }

  if (rows === null) {
    // The cache stays empty and `loaded` stays false, so every write is refused
    // and the app shows that it could not read rather than showing a blank
    // planner that looks like the truth.
    notifyAllKnown()
    return false
  }

  rows.forEach((row) => cache.set(row.key, row.value))
  loaded = true
  notifyAllKnown()
  return true
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
    phase = (await loadAll()) ? 'ready' : 'unread'
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
        phase = (await loadAll()) ? 'ready' : 'unread'
      }
      notifyStatus()
    } else {
      cache.clear()
      loaded = false
      phase = 'signed-out'
      notifyStatus()
      notifyAllKnown()
    }
  })
}

// Another go at reading, for the screen shown when the read failed.
export async function retryLoad() {
  if (!user) return false
  phase = 'loading'
  notifyStatus()
  phase = (await loadAll()) ? 'ready' : 'unread'
  notifyStatus()
  return phase === 'ready'
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
  const keys = [...cache.keys()]
  cache.clear()
  keys.forEach((k) => notify(k))
  notifyAllKnown()
}
