// File-backed data store.
//
// Source of truth: a real folder you own (pick one inside Obsidian / iCloud /
// Dropbox and it syncs for free). Structured state is written as JSON, and a
// human-readable Markdown mirror is written for notes so the folder is greppable,
// diffable, and editable by hand or by any future tool.
//
// localStorage is ONLY a fast in-browser cache so the first paint isn't blank and
// the app still works on browsers without the File System Access API. Whenever a
// folder is connected, the folder wins on load — there is no localStorage ghost.

import { idbGet, idbSet, idbDel } from './idb'
import { buildMarkdownFiles } from './markdown'

const ROOT_DIR = 'Melissa OS'
const DATA_DIR = 'data'
const HANDLE_KEY = 'planner-dir'

const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

const cache = new Map()
const subscribers = new Map() // key -> Set<cb>
const statusSubs = new Set()
const writeTimers = new Map()
let mdTimer = null

let dirHandle = null
let connected = false
let folderName = ''
let status = supported ? 'local' : 'unsupported' // local | connected | needs-permission | denied | unsupported

// ── localStorage cache helpers ──────────────────────────────────────
function readLS(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}
function writeLS(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / unavailable — folder is the real store anyway */
  }
}

// ── pub/sub ─────────────────────────────────────────────────────────
function notify(key) {
  const subs = subscribers.get(key)
  if (subs) subs.forEach((cb) => cb(cache.get(key)))
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
  return { supported, connected, status, folderName }
}

// ── public read / write ─────────────────────────────────────────────
export function get(key, fallback) {
  if (cache.has(key)) return cache.get(key)
  const ls = readLS(key)
  if (ls !== undefined) {
    cache.set(key, ls)
    return ls
  }
  return fallback
}

export function set(key, value) {
  cache.set(key, value)
  writeLS(key, value)
  notify(key)
  if (connected) {
    scheduleFileWrite(key)
    scheduleMarkdown()
  }
}

// ── filename mapping (reversible) ───────────────────────────────────
const toFile = (key) => key.replace(/:/g, '__') + '.json'
const fromFile = (name) => name.replace(/\.json$/, '').replace(/__/g, ':')

// ── directory helpers ───────────────────────────────────────────────
async function getRoot() {
  return dirHandle.getDirectoryHandle(ROOT_DIR, { create: true })
}
async function getDataDir() {
  const root = await getRoot()
  return root.getDirectoryHandle(DATA_DIR, { create: true })
}
async function writeNestedFile(root, path, content) {
  const parts = path.split('/')
  let dir = root
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true })
  }
  const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true })
  const w = await fh.createWritable()
  await w.write(content)
  await w.close()
}

// ── debounced writers ───────────────────────────────────────────────
function scheduleFileWrite(key) {
  clearTimeout(writeTimers.get(key))
  writeTimers.set(key, setTimeout(() => writeKeyFile(key), 400))
}
async function writeKeyFile(key) {
  try {
    const dir = await getDataDir()
    const fh = await dir.getFileHandle(toFile(key), { create: true })
    const w = await fh.createWritable()
    await w.write(JSON.stringify(cache.get(key), null, 2))
    await w.close()
  } catch (e) {
    console.warn('[mos] file write failed', key, e)
  }
}
function scheduleMarkdown() {
  clearTimeout(mdTimer)
  mdTimer = setTimeout(writeMarkdown, 900)
}
async function writeMarkdown() {
  try {
    const root = await getRoot()
    const files = buildMarkdownFiles(Object.fromEntries(cache))
    for (const f of files) await writeNestedFile(root, f.path, f.content)
  } catch (e) {
    console.warn('[mos] markdown write failed', e)
  }
}

// ── load from folder (folder wins) ──────────────────────────────────
async function loadFromFolder() {
  let count = 0
  try {
    const dir = await getDataDir()
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file' || !name.endsWith('.json')) continue
      try {
        const file = await handle.getFile()
        const value = JSON.parse(await file.text())
        const key = fromFile(name)
        cache.set(key, value)
        writeLS(key, value)
        notify(key)
        count++
      } catch {
        /* skip unreadable file */
      }
    }
  } catch (e) {
    console.warn('[mos] folder load failed', e)
  }
  return count
}

async function migrateToFolder() {
  for (const key of cache.keys()) {
    if (key.startsWith('mos:')) await writeKeyFile(key)
  }
  await writeMarkdown()
}

async function verifyPermission(handle) {
  const opts = { mode: 'readwrite' }
  if ((await handle.queryPermission(opts)) === 'granted') return true
  if ((await handle.requestPermission(opts)) === 'granted') return true
  return false
}

// ── lifecycle ───────────────────────────────────────────────────────
export async function init() {
  // Preload every cached mos:* key for instant first paint + complete migration.
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith('mos:')) {
        const v = readLS(k)
        if (v !== undefined) cache.set(k, v)
      }
    }
  } catch {
    /* ignore */
  }

  if (supported) {
    try {
      const handle = await idbGet(HANDLE_KEY)
      if (handle) {
        dirHandle = handle
        folderName = handle.name
        const perm = await handle.queryPermission({ mode: 'readwrite' })
        if (perm === 'granted') {
          connected = true
          status = 'connected'
          await loadFromFolder()
        } else {
          // Browser needs a fresh user gesture to re-grant access.
          status = 'needs-permission'
        }
      }
    } catch (e) {
      console.warn('[mos] init handle restore failed', e)
    }
  }
  notifyStatus()
}

// Connect (must be called from a user gesture — opens the folder picker).
export async function connect() {
  if (!supported) return false
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'melissa-os' })
    if (!(await verifyPermission(handle))) {
      status = 'denied'
      notifyStatus()
      return false
    }
    dirHandle = handle
    folderName = handle.name
    connected = true
    status = 'connected'
    await idbSet(HANDLE_KEY, handle)
    // If the folder already holds data, it wins; otherwise seed it from cache.
    const loaded = await loadFromFolder()
    if (loaded === 0) await migrateToFolder()
    notifyStatus()
    return true
  } catch {
    // User dismissed the picker.
    return false
  }
}

// Re-grant permission to a previously-chosen folder (user gesture).
export async function requestPermission() {
  if (!dirHandle) return connect()
  try {
    if (!(await verifyPermission(dirHandle))) {
      status = 'denied'
      notifyStatus()
      return false
    }
    connected = true
    status = 'connected'
    const loaded = await loadFromFolder()
    if (loaded === 0) await migrateToFolder()
    notifyStatus()
    return true
  } catch {
    return false
  }
}

export async function disconnect() {
  dirHandle = null
  connected = false
  folderName = ''
  status = supported ? 'local' : 'unsupported'
  try {
    await idbDel(HANDLE_KEY)
  } catch {
    /* ignore */
  }
  notifyStatus()
}

// Force-write everything to the folder right now (used by the "Save now" button).
export async function flush() {
  if (!connected) return false
  await migrateToFolder()
  return true
}
