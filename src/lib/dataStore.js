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
const writeTimers = new Map()

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
export function getStatus() {
  return { phase, email: user ? user.email : '', createdAt: user ? user.created_at || '' : '' }
}

// ── read / write ────────────────────────────────────────────────────
export function get(key, fallback) {
  return cache.has(key) ? cache.get(key) : fallback
}

export function set(key, value) {
  cache.set(key, value)
  notify(key)
  if (phase === 'ready' && user) scheduleUpsert(key)
}

function scheduleUpsert(key) {
  clearTimeout(writeTimers.get(key))
  writeTimers.set(key, setTimeout(() => upsert(key), 400))
}
async function upsert(key) {
  if (!user) return
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

async function loadAll() {
  cache.clear()
  try {
    const { data, error } = await supabase.from(TABLE).select('key,value')
    if (error) console.warn('[mos] load failed', error.message)
    else if (data) data.forEach((row) => cache.set(row.key, row.value))
  } catch (e) {
    console.warn('[mos] load error', e)
  }
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
