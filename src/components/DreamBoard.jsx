import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Shuffle, Grid3x3, Columns3, ImagePlus, Minus, Link2, Search } from 'lucide-react'
import { AddIcon, CloseIcon, AestheticsMark } from './shared/marks'
import { useLocalStorage } from '../hooks/useLocalStorage'
import EmptyState from './shared/EmptyState'
import { dateKey, parseKey, MONTHS, MONTHS_SHORT } from '../lib/date'
import { useRegisterAdd } from './shared/AddButton'
import { averageHash, duplicatesOf, clusters, matches } from '../lib/imageFacts'
import * as store from '../lib/dataStore'

// ── The Mood Board.
//
// The principle: the machine does the labour, she does the meaning.
//
// She drops photographs and they land already described — dated, named from what
// is actually visible, with the source kept. She never sees a tag field, never
// picks a category, never files anything. Nothing on the card interprets her:
// no life areas, no themes, no reading of her taste back at her. What the
// picture is for is the one thing a machine has no business deciding.
//
// Two states only. Want — still reaching for it. Have — it's hers now. That is
// broad enough to cover a bag, a body, a kitchen, a feeling, or a way of moving
// through a room, and it imposes no mechanism she didn't choose.

const uid = () => Math.random().toString(36).slice(2, 10)
const MS_DAY = 86400000

const TEMPLATES = [
  { id: 'scrapbook', label: 'Scrapbook', icon: Shuffle },
  { id: 'grid', label: 'Grid', icon: Grid3x3 },
  { id: 'column', label: 'Column', icon: Columns3 },
]
const SIZES = { S: 150, M: 225, L: 330 }
const sizeW = (s) => SIZES[s] || SIZES.M

// Signatures last eight hours; the board re-signs itself every seven, so a page
// left open overnight still has its pictures in the morning.
const SIGN_SECONDS = 28800
const SIGN_REFRESH_MS = 7 * 60 * 60 * 1000

const KEY = 'mos:dream:board'

const fmtDay = (k) => { const d = parseKey(k); return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '' }
const elapsed = (a, b) => {
  const x = parseKey(a)
  const y = parseKey(b)
  if (!x || !y) return null
  return Math.max(0, Math.round((y.getTime() - x.getTime()) / MS_DAY))
}

// Downscale twice: once for the board, once small enough to send for reading.
function processImage(file, maxPx, cb) {
  const img = new Image()
  img.onload = () => {
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.width * scale))
    c.height = Math.max(1, Math.round(img.height * scale))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const hash = averageHash(img)
    const thumb = (() => {
      const t = document.createElement('canvas')
      const s2 = Math.min(1, 640 / Math.max(img.width, img.height))
      t.width = Math.max(1, Math.round(img.width * s2))
      t.height = Math.max(1, Math.round(img.height * s2))
      t.getContext('2d').drawImage(img, 0, 0, t.width, t.height)
      try { return t.toDataURL('image/jpeg', 0.7) } catch { return '' }
    })()
    const done = (blob) => cb({ blob, w: c.width, h: c.height, hash, thumb, dataUrl: blob ? null : c.toDataURL('image/jpeg', 0.82) })
    if (c.toBlob) c.toBlob(done, 'image/jpeg', 0.82)
    else done(null)
    URL.revokeObjectURL(img.src)
  }
  img.onerror = () => cb(null)
  img.src = URL.createObjectURL(file)
}

const normVision = (it) => ({
  id: it.id || uid(),
  path: it.path || '',
  dataUrl: it.dataUrl || '',
  remote: it.remote || '',
  w: it.w || 4,
  h: it.h || 3,
  x: typeof it.x === 'number' ? it.x : 8,
  y: typeof it.y === 'number' ? it.y : 24,
  rot: typeof it.rot === 'number' ? it.rot : 0,
  size: SIZES[it.size] ? it.size : 'M',
  savedOn: it.savedOn || dateKey(new Date()),
  // Have replaces the old "got"/"arrived" — it claims nothing about how.
  haveOn: it.haveOn || it.gotOn || it.arrivedOn || '',
  // Written by the reader, not by her. All observable, none of it interpretive.
  title: it.title || '',
  kind: it.kind || '',
  colors: Array.isArray(it.colors) ? it.colors : [],
  material: it.material || '',
  brand: it.brand || '',
  room: it.room || '',
  search: it.search || '',
  source: it.source || '',
  sourceUrl: it.sourceUrl || '',
  hash: it.hash || '',
  read: !!it.read,
  // The one line she may write, if she wants to. Never required.
  caption: it.caption || '',
})

export default function DreamBoard() {
  const [raw, setRaw] = useLocalStorage(KEY, { template: 'scrapbook', items: [] })
  const board = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { template: 'scrapbook', items: [] }
  const all = useMemo(() => (Array.isArray(board.items) ? board.items : []).map(normVision), [board.items])
  const template = TEMPLATES.some((t) => t.id === board.template) ? board.template : 'scrapbook'

  const [urls, setUrls] = useState({})
  const [busy, setBusy] = useState(0)
  const [flipped, setFlipped] = useState(() => new Set())
  const [state, setState] = useState('all') // all | want | have
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState(null)
  const [dragPos, setDragPos] = useState(null)
  const [adding, setAdding] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [rejected, setRejected] = useState([]) // files the browser could not read
  const [saveState, setSaveState] = useState(() => store.getSaveState())
  const fileRef = useRef(null)
  const canvasRef = useRef(null)
  const reading = useRef(new Set())

  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)

  const setBoard = (patch) => setRaw((prev) => {
    const cur = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : { template: 'scrapbook', items: [] }
    return { ...cur, ...patch }
  })
  // Always against the newest stored items, never the render-time copy. Adds and
  // reads land out of order — a picture is on the board before it has been read,
  // and several files arrive at once — so a writer holding the array from its
  // own render would put back a board that predates them and drop the lot.
  const setItems = (fn) => setRaw((prev) => {
    const cur = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : { template: 'scrapbook', items: [] }
    const items = (Array.isArray(cur.items) ? cur.items : []).map(normVision)
    return { ...cur, items: fn(items) }
  })
  const updateItem = (id, patch) => setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  // The bucket is private, so every picture needs a signed URL, and a signature
  // expires. Asking once was enough to draw the board and not enough to keep it:
  // a request that failed was never retried, so the square stayed empty as
  // though the photograph had gone, and a board left open past the expiry went
  // blank the same way. Ask again for anything still missing, and re-sign the
  // whole board well before the signatures run out.
  const [signTick, setSignTick] = useState(0)
  useEffect(() => {
    const retry = setInterval(() => setSignTick((n) => n + 1), 20000)
    const refresh = setInterval(() => { setUrls({}); setSignTick((n) => n + 1) }, SIGN_REFRESH_MS)
    return () => { clearInterval(retry); clearInterval(refresh) }
  }, [])

  useEffect(() => {
    let alive = true
    const missing = [...new Set(all.filter((it) => it.path && !urls[it.path]).map((it) => it.path))]
    if (!missing.length) return undefined
    ;(async () => {
      const pairs = await Promise.all(missing.map(async (p) => [p, await store.signedPhotoUrl(p, SIGN_SECONDS)]))
      if (!alive) return
      setUrls((u) => { const next = { ...u }; pairs.forEach(([p, url]) => { if (url) next[p] = url }); return next })
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.map((i) => i.path).join(','), signTick])

  const srcOf = (it) => it.dataUrl || it.remote || urls[it.path] || ''
  const pickFiles = () => fileRef.current && fileRef.current.click()
  useRegisterAdd(pickFiles, [])

  // Reading happens quietly in the background. A picture is on the board the
  // instant she drops it; the words arrive a moment later, and if they never
  // arrive the board is exactly what it was before.
  const readImage = async (id, thumb) => {
    if (!thumb || reading.current.has(id)) return
    reading.current.add(id)
    try {
      const data = thumb.split(',')[1]
      const r = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: data, mediaType: 'image/jpeg' }),
      })
      const d = await r.json()
      if (d && !d.error) {
        updateItem(id, {
          title: d.title || '', kind: d.kind || '', colors: d.colors || [],
          material: d.material || '', brand: d.brand || '', room: d.room || '',
          search: d.search || '', read: true,
        })
      }
    } catch { /* unread is a fine state for a picture to be in */ }
    reading.current.delete(id)
  }

  const onFiles = (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'))
    if (e.target && 'value' in e.target) e.target.value = ''
    if (!files.length) return
    setRejected([])
    setBusy((n) => n + files.length)
    files.forEach((file, i) => {
      processImage(file, 1400, async (out) => {
        // A file the browser cannot decode — most often an iPhone HEIC opened
        // on a desktop browser — used to disappear without a word, which looks
        // exactly like a photo that was added and didn't stay. Say so instead.
        if (!out) {
          setRejected((r) => [...r, file.name || 'that photo'])
          setBusy((n) => Math.max(0, n - 1))
          return
        }
        let path = ''
        if (out.blob) path = (await store.uploadPhoto(out.blob)) || ''
        const id = uid()
        setItems((arr) => [...arr, normVision({
          id, path, dataUrl: path ? '' : (out.dataUrl || ''), w: out.w, h: out.h, hash: out.hash,
          x: 6 + ((arr.length + i) % 3) * 30 + Math.round(Math.random() * 6),
          y: 24 + Math.floor((arr.length + i) / 3) * 250,
          rot: Math.round((Math.random() * 7 - 3.5) * 10) / 10,
        })])
        // A photograph is not a keystroke. The file is already in the bucket, so
        // anything that ends the page before the debounce fires would leave an
        // uploaded picture with nothing on the board pointing at it.
        store.flush(KEY)
        setBusy((n) => Math.max(0, n - 1))
        setAdding(false)
        readImage(id, out.thumb)
      })
    })
  }

  // A link brings the picture and where it came from — which paper cannot do
  // and no board bothers to keep.
  useEffect(() => store.subscribeSave(setSaveState), [])

  const addFromUrl = async () => {
    const u = linkDraft.trim()
    if (!u) return
    setLinkDraft('')
    setAdding(false)
    setBusy((n) => n + 1)
    try {
      const r = await fetch('/api/unfurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) })
      const d = await r.json()
      if (d && d.image) {
        const id = uid()
        setItems((arr) => [...arr, normVision({
          id, remote: d.image, title: d.title || '', source: d.site || '', sourceUrl: d.url || u, w: 4, h: 3,
          x: 6 + (arr.length % 3) * 30, y: 24 + Math.floor(arr.length / 3) * 250,
          rot: Math.round((Math.random() * 7 - 3.5) * 10) / 10,
        })])
        store.flush(KEY)
      } else {
        setRejected((r) => [...r, u])
      }
    } catch { setRejected((r) => [...r, u]) }
    setBusy((n) => Math.max(0, n - 1))
  }

  const removeItem = async (it) => {
    setItems((arr) => arr.filter((x) => x.id !== it.id))
    if (it.path) await store.deletePhoto(it.path)
  }

  const years = useMemo(() => {
    const set = new Set(all.map((it) => Number(String(it.savedOn).slice(0, 4))).filter(Boolean))
    set.add(thisYear)
    return [...set].sort((a, b) => b - a)
  }, [all, thisYear])

  const inYear = all.filter((it) => Number(String(it.savedOn).slice(0, 4)) === year)
  const shown = inYear
    .filter((it) => (state === 'all' ? true : state === 'have' ? !!it.haveOn : !it.haveOn))
    .filter((it) => matches(it, query))

  // Saved on this day, some year before now. The same reciprocity as gratitude,
  // and the reason an old board stays alive.
  const today = new Date()
  const anniversaries = all.filter((it) => {
    const d = parseKey(it.savedOn)
    return d && d.getFullYear() < today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  })

  // Gathered by what they look like — a shared palette, shape or light. Never
  // by what they are supposed to mean.
  const alike = useMemo(() => (query ? [] : clusters(inYear)), [inYear, query])

  const toggleFlip = (id) => setFlipped((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const onPointerDown = (e, it) => {
    if (template !== 'scrapbook' || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* older browsers */ }
    setDrag({ id: it.id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, cw: rect.width || 1, moved: false })
  }
  const onPointerMove = (e) => {
    if (!drag) return
    const dx = ((e.clientX - drag.sx) / zoom / drag.cw) * 100
    const dy = (e.clientY - drag.sy) / zoom
    if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) setDrag((d) => ({ ...d, moved: true }))
    setDragPos({ x: Math.max(0, Math.min(88, drag.ox + dx)), y: Math.max(0, drag.oy + dy) })
  }
  const onPointerUp = (it) => {
    if (drag && dragPos && drag.moved) updateItem(drag.id, dragPos)
    else if (drag && !drag.moved) toggleFlip(it.id)
    setDrag(null); setDragPos(null)
  }

  const estH = (it) => sizeW(it.size) * (it.h / (it.w || 1)) + 52
  const canvasH = template === 'scrapbook'
    ? Math.max(620, ...shown.map((it) => (drag && drag.id === it.id && dragPos ? dragPos.y : it.y) + estH(it) + 120))
    : 0

  const cardProps = (it) => ({
    it,
    src: srcOf(it),
    dupes: duplicatesOf(it, all),
    flipped: flipped.has(it.id),
    onFlip: () => toggleFlip(it.id),
    onEdit: (patch) => updateItem(it.id, patch),
    onRemove: () => removeItem(it),
  })

  if (all.length === 0) {
    return (
      <div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) onFiles({ target: { files: e.dataTransfer.files } }) }}
        >
          <EmptyState mark={AestheticsMark} line="Nothing here yet." action="Choose photos" onAction={pickFiles} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-stone-200 bg-cream p-0.5">
          {TEMPLATES.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setBoard({ template: t.id })}
                title={t.label}
                aria-label={t.label}
                className={`flex h-8 w-9 items-center justify-center rounded-full transition-colors ${template === t.id ? 'bg-stone-900 text-cream' : 'text-stone-400 hover:text-stone-800'}`}
              ><Icon size={14} strokeWidth={1.7} /></button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          {template === 'scrapbook' && (
            <div className="flex items-center gap-1 rounded-full border border-stone-200 px-1 py-0.5">
              <button onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} aria-label="Zoom out" className="flex h-6 w-6 items-center justify-center text-stone-400 hover:text-stone-900"><Minus size={13} /></button>
              <span className="w-9 text-center text-[10px] tabular-nums text-stone-400">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.3, Math.round((z + 0.1) * 10) / 10))} aria-label="Zoom in" className="flex h-6 w-6 items-center justify-center text-stone-400 hover:text-stone-900"><AddIcon size={13} /></button>
            </div>
          )}
          {/* One way in. Both routes live inside it, so she never has to choose
              between two buttons before she has added anything. */}
          <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-opacity hover:opacity-90">
            <ImagePlus size={15} strokeWidth={1.75} /> Add photos
          </button>
        </div>
      </div>

      {adding && (
        <AddPanel
          draft={linkDraft}
          setDraft={setLinkDraft}
          onPick={pickFiles}
          onDropFiles={(files) => onFiles({ target: { files } })}
          onAddUrl={addFromUrl}
        />
      )}

      {/* Finding it again, from memory. She never labelled any of this — the
          words being searched are the ones the picture gave up by itself. */}
      <div className="mb-4 flex items-center gap-2.5 border-b border-stone-200 pb-1.5 transition-colors focus-within:border-stone-900">
        <Search size={14} className="shrink-0 text-stone-300" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="The green kitchen. The one with the arched doorway."
          className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-300"
          aria-label="Search the board"
        />
        {query && <button onClick={() => setQuery('')} aria-label="Clear" className="shrink-0 text-stone-300 hover:text-stone-700"><CloseIcon size={13} /></button>}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {[['all', 'All'], ['want', 'Want'], ['have', 'Have']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setState(id)}
            className={`rounded-full border px-3.5 py-1 text-xs transition-colors ${state === id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}
          >{label}</button>
        ))}
        {years.length > 1 && (
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="ml-auto bg-transparent text-[11px] tracking-[0.18em] text-stone-400 outline-none"
            aria-label="Board year"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {busy > 0 && (
        <p className="mb-4 flex items-center justify-center gap-2 text-xs italic text-stone-400">
          Adding {busy} picture{busy > 1 ? 's' : ''}…
        </p>
      )}

      {/* The two ways a picture fails to arrive, both of which used to be
          silent, and both of which look identical to her: it didn't stay. */}
      {rejected.length > 0 && (
        <p className="mb-4 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-stone-500">
          <span>
            {rejected.length} {rejected.length === 1 ? 'photo' : 'photos'} couldn’t be read — HEIC photos from an
            iPhone often need to be saved as JPEG first.
          </span>
          <button onClick={() => setRejected([])} className="underline underline-offset-4 hover:text-stone-900">Dismiss</button>
        </p>
      )}
      {saveState.state === 'error' && (
        <p className="mb-4 text-center text-xs text-stone-500">
          The board hasn’t saved yet — still trying. Keep this page open.
        </p>
      )}

      {/* You saved this a year ago today. */}
      {!query && anniversaries.length > 0 && (
        <div className="mb-5 flex items-center gap-3 border-y border-stone-200 py-2.5">
          <span className="shrink-0 text-[10px] tracking-[0.16em] text-stone-400">
            SAVED THIS DAY, {today.getFullYear() - parseKey(anniversaries[0].savedOn).getFullYear()} YEAR{today.getFullYear() - parseKey(anniversaries[0].savedOn).getFullYear() === 1 ? '' : 'S'} AGO
          </span>
          <div className="flex gap-1.5 overflow-x-auto">
            {anniversaries.slice(0, 6).map((it) => (
              <button key={it.id} onClick={() => { setYear(parseKey(it.savedOn).getFullYear()); toggleFlip(it.id) }} className="h-10 w-10 shrink-0 overflow-hidden rounded bg-stone-100">
                {srcOf(it) && <img src={srcOf(it)} alt="" className="h-full w-full object-cover" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState mark={AestheticsMark} line="Nothing here yet." />
      ) : template === 'scrapbook' ? (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white/30" style={{ height: canvasH * zoom + 2 }}>
          <div
            ref={canvasRef}
            className="relative select-none"
            style={{ height: canvasH, transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%` }}
          >
            {shown.map((it, i) => {
              const dragging = drag && drag.id === it.id
              const pos = dragging && dragPos ? dragPos : { x: it.x, y: it.y }
              const W = sizeW(it.size)
              return (
                <div
                  key={it.id}
                  onPointerDown={(e) => onPointerDown(e, it)}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => onPointerUp(it)}
                  className={`absolute touch-none ${dragging ? 'z-50 cursor-grabbing' : 'cursor-grab'}`}
                  style={{ left: `${pos.x}%`, top: pos.y, width: W, transform: `rotate(${it.rot}deg)`, zIndex: flipped.has(it.id) ? 60 : dragging ? 50 : i + 1 }}
                >
                  <span aria-hidden className="absolute -top-2.5 left-1/2 z-10 h-5 w-14 -translate-x-1/2 -rotate-2" style={{ background: 'rgba(221,215,200,0.55)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)' }} />
                  <Vision {...cardProps(it)} width={W} taped />
                </div>
              )
            })}
          </div>
        </div>
      ) : template === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((it) => <Vision key={it.id} {...cardProps(it)} square />)}
        </div>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 md:columns-4">
          {shown.map((it) => (
            <div key={it.id} className="mb-3 break-inside-avoid"><Vision {...cardProps(it)} /></div>
          ))}
        </div>
      )}

      {/* Quietly gathered by how they look. No name, because naming the group
          would be the machine deciding what it means. */}
      {alike.length > 0 && state === 'all' && (
        <div className="mt-8 border-t border-stone-200 pt-5">
          <p className="mb-3 text-[10px] tracking-[0.16em] text-stone-400">THESE LOOK ALIKE</p>
          <div className="space-y-2.5">
            {alike.slice(0, 3).map((group, i) => (
              <div key={i} className="flex gap-1.5 overflow-x-auto">
                {group.slice(0, 12).map((it) => (
                  <button key={it.id} onClick={() => toggleFlip(it.id)} className="h-14 w-14 shrink-0 overflow-hidden rounded bg-stone-100">
                    {srcOf(it) && <img src={srcOf(it)} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
                <span className="shrink-0 self-center pl-1 text-[10px] tracking-[0.14em] text-stone-400">{group.length}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── One way in ──────────────────────────────────────────────────────
// Three entry points for one job is three decisions before anything has been
// added. So: one button, and both routes live inside it. The drop zone takes
// the weight; the link sits underneath. She sees both without having to choose
// between them first, and nothing here explains the mechanism — she needs to
// know that it works, not how.
function AddPanel({ draft, setDraft, onPick, onDropFiles, onAddUrl }) {
  const [over, setOver] = useState(false)
  return (
    <div className="mb-5 rounded-2xl border border-stone-900 bg-white/60 p-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) onDropFiles(e.dataTransfer.files)
        }}
        className={`rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${over ? 'border-stone-900 bg-stone-500/5' : 'border-stone-300'}`}
      >
        <p className="font-serif text-lg text-stone-500">Drop photos here</p>
        <button onClick={onPick} className="mt-1.5 text-sm text-stone-400 underline underline-offset-4 transition-colors hover:text-stone-900">
          or browse
        </button>
      </div>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-stone-200" />
        <span className="text-[10px] tracking-[0.16em] text-stone-400">OR</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 border-b border-stone-200 pb-1.5 transition-colors focus-within:border-stone-900">
            <Link2 size={14} className="shrink-0 text-stone-300" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAddUrl()}
              placeholder="Paste a link"
              className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-300"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-stone-400">From a shop, Pinterest, anywhere</p>
        </div>
        <button
          onClick={onAddUrl}
          disabled={!draft.trim()}
          className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-30"
        >Add</button>
      </div>
    </div>
  )
}

// ── One vision, front and back ──────────────────────────────────────
function Vision({ it, src, dupes, flipped, onFlip, onEdit, onRemove, width, square, taped }) {
  const ratio = (it.h || 3) / (it.w || 4)
  const height = square ? undefined : (width ? Math.round(width * ratio) : undefined)

  return (
    <div className={`mos-flip ${flipped ? 'is-back' : ''}`} style={{ width: width || '100%' }}>
      <div
        className="mos-flip-inner"
        style={{ aspectRatio: square ? '1 / 1' : (width ? undefined : `${it.w} / ${it.h}`), height }}
      >
        <button
          onClick={onFlip}
          aria-label={it.title || it.caption || 'Turn the card'}
          className={`mos-face block h-full w-full overflow-hidden text-left ${taped ? 'bg-white shadow-[0_2px_10px_rgba(28,25,23,0.12)]' : 'rounded-xl border border-stone-200 bg-white/50'}`}
        >
          {src
            ? <img src={src} alt={it.title || ''} draggable={false} className="block h-full w-full object-cover" />
            : <span className="block h-full w-full animate-pulse bg-stone-500/10" />}
        </button>

        <div className={`mos-face mos-face-back ${taped ? 'bg-cream shadow-[0_2px_10px_rgba(28,25,23,0.12)]' : 'rounded-xl border border-stone-200 bg-cream'}`}>
          <Back it={it} dupes={dupes} onFlip={onFlip} onEdit={onEdit} onRemove={onRemove} />
        </div>
      </div>
    </div>
  )
}

// The back holds facts and dates. Nothing here interprets the picture, decides
// what it is for, or tells her anything about herself.
function Back({ it, dupes, onFlip, onEdit, onRemove }) {
  const took = elapsed(it.savedOn, it.haveOn)
  const facts = [it.brand, it.material, (it.colors || [])[0], it.room].filter(Boolean)

  const Row = ({ label, children }) => (
    <div className="flex items-baseline gap-2.5">
      <span className="w-[4.3rem] shrink-0 text-[8.5px] tracking-[0.16em] text-stone-400">{label}</span>
      <span className="min-w-0 flex-1 text-[12px] leading-snug text-stone-700">{children}</span>
    </div>
  )

  return (
    <div className="flex h-full flex-col p-3.5">
      <button onClick={onFlip} aria-label="Turn back" className="absolute right-2 top-2 text-stone-300 hover:text-stone-900"><CloseIcon size={13} /></button>

      {/* Named from what is visible, so the card has a title she never wrote. */}
      <input
        value={it.caption || it.title}
        onChange={(e) => onEdit({ caption: e.target.value })}
        placeholder={it.read ? 'Untitled' : 'Reading…'}
        className="mb-2.5 w-full shrink-0 bg-transparent pr-5 font-serif text-[15px] leading-tight text-stone-900 outline-none placeholder:italic placeholder:text-stone-300"
      />

      {/* The facts give up the room, never the actions. A wide picture makes a
          short card, and on a short card this is the part that has to yield. */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        <Row label="SAVED">{fmtDay(it.savedOn)}</Row>
        {it.haveOn && (
          <Row label="ACHIEVED">
            {fmtDay(it.haveOn)}{took != null ? ` · ${took} day${took === 1 ? '' : 's'}` : ''}
          </Row>
        )}
        {facts.length > 0 && <Row label="DETAIL">{facts.join(' · ')}</Row>}
        {it.source && (
          <Row label="SOURCE">
            {it.sourceUrl
              ? <a href={it.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-stone-300 underline-offset-2 hover:decoration-stone-900">{it.source}</a>
              : it.source}
          </Row>
        )}
      </div>

      {/* Repetition is her telling herself something. A fact, never a warning. */}
      {dupes.length > 0 && (
        <p className="mt-2 text-[11px] text-stone-400">Saved {dupes.length + 1} times.</p>
      )}

      <div className="mt-auto shrink-0 pt-2">
        <div className="mb-2 h-px bg-stone-200" />
        <div className="flex items-center gap-1.5">
          {/* Everything lands in Want. Nothing becomes Have unless she says so,
              so this reads as the action she is taking rather than the state the
              card is already in — a dark button labelled "Have" on a card that
              isn't hers yet says the opposite of the truth. */}
          <button
            onClick={() => onEdit({ haveOn: it.haveOn ? '' : dateKey(new Date()) })}
            className={`rounded-full px-3.5 py-1.5 text-[11px] transition-colors ${it.haveOn ? 'border border-stone-300 text-stone-500 hover:border-stone-900' : 'bg-stone-900 text-cream hover:opacity-90'}`}
          >
            {it.haveOn ? 'Move to want' : 'Mark as have'}
          </button>
          <button onClick={onRemove} className="ml-auto text-[10px] text-stone-400 transition-colors hover:text-phase-menstrual">Delete</button>
        </div>
      </div>
    </div>
  )
}
