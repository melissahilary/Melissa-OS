import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Shuffle, Grid3x3, Columns3, X, ImagePlus, Loader2, Minus, Plus as PlusIcon, Link2, Share2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import EmptyState from './shared/EmptyState'
import { dateKey, parseKey, MONTHS, MONTHS_SHORT } from '../lib/date'
import { useRegisterAdd } from './shared/AddButton'
import { PILLAR_TAGS } from './DreamProjects'
import * as store from '../lib/dataStore'

// ── The Mood Board — a wall of visions, each one dated at both ends.
//
// Pinterest is a wall of wanting with no date, no outcome and no memory of what
// came true. It remembers what you liked. This one remembers what you got, and
// how long it took — which is why every vision carries a goal, a deadline and an
// ending, and why the most satisfying line in the product is "took 253 days".
//
// Photographs are real files in her private bucket, so the board can grow as
// large as she likes; the planner only remembers where each one sits.

const uid = () => Math.random().toString(36).slice(2, 10)
const MS_DAY = 86400000

const TEMPLATES = [
  { id: 'scrapbook', label: 'Scrapbook', icon: Shuffle },
  { id: 'grid', label: 'Grid', icon: Grid3x3 },
  { id: 'column', label: 'Column', icon: Columns3 },
]
const SIZES = { S: 150, M: 225, L: 330 }
const sizeW = (s) => SIZES[s] || SIZES.M

const pillarMeta = (id) => PILLAR_TAGS.find((p) => p.id === id) || null

// By when is a month, and a season is a month with a nicer name.
const SEASONS = [
  { id: 'spring', label: 'Spring', month: 4 },
  { id: 'summer', label: 'Summer', month: 7 },
  { id: 'autumn', label: 'Autumn', month: 10 },
  { id: 'winter', label: 'Winter', month: 1, nextYear: true },
]
// The deadline is the last day of the month named, not the first.
const byWhenDate = (ym) => {
  if (!ym) return null
  const [y, m] = String(ym).split('-').map(Number)
  if (!y || !m) return null
  return new Date(y, m, 0)
}
const byWhenLabel = (ym, label) => {
  if (label) return label
  const d = byWhenDate(ym)
  return d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ''
}
const daysOut = (ym) => {
  const d = byWhenDate(ym)
  if (!d) return null
  const today = new Date()
  return Math.round((d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / MS_DAY)
}
const fmtDay = (k) => { const d = parseKey(k); return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '' }
const tookDays = (savedOn, gotOn) => {
  const a = parseKey(savedOn)
  const b = parseKey(gotOn)
  if (!a || !b) return null
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MS_DAY))
}

function processImage(file, maxPx, cb) {
  const img = new Image()
  img.onload = () => {
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.width * scale))
    c.height = Math.max(1, Math.round(img.height * scale))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const done = (blob) => cb({ blob, w: c.width, h: c.height, dataUrl: blob ? null : c.toDataURL('image/jpeg', 0.82) })
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
  caption: it.caption || '',
  goalId: it.goalId || '',
  pillar: it.pillar || '',
  byWhen: it.byWhen || '',
  byWhenLabel: it.byWhenLabel || '',
  savedOn: it.savedOn || dateKey(new Date()),
  // The old board called this "arrived", which nobody says.
  gotOn: it.gotOn || it.arrivedOn || '',
})

export default function DreamBoard({ goals = [], activities = [], onCreateGoal }) {
  const [raw, setRaw] = useLocalStorage('mos:dream:board', { template: 'scrapbook', items: [] })
  const board = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { template: 'scrapbook', items: [] }
  const all = useMemo(() => (Array.isArray(board.items) ? board.items : []).map(normVision), [board.items])
  const template = TEMPLATES.some((t) => t.id === board.template) ? board.template : 'scrapbook'

  const [urls, setUrls] = useState({})
  const [busy, setBusy] = useState(0)
  const [flipped, setFlipped] = useState(() => new Set())
  const [filter, setFilter] = useState('all')
  const [pillarFilter, setPillarFilter] = useState('')
  const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState(null)
  const [dragPos, setDragPos] = useState(null)
  const [linking, setLinking] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const fileRef = useRef(null)
  const canvasRef = useRef(null)

  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)

  const setBoard = (patch) => setRaw((prev) => {
    const cur = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : { template: 'scrapbook', items: [] }
    return { ...cur, ...patch }
  })
  const setItems = (fn) => setBoard({ items: fn(all) })
  const updateItem = (id, patch) => setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  useEffect(() => {
    let alive = true
    const missing = all.filter((it) => it.path && !urls[it.path]).map((it) => it.path)
    if (!missing.length) return undefined
    ;(async () => {
      const pairs = await Promise.all([...new Set(missing)].map(async (p) => [p, await store.signedPhotoUrl(p)]))
      if (!alive) return
      setUrls((u) => { const next = { ...u }; pairs.forEach(([p, url]) => { if (url) next[p] = url }); return next })
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.map((i) => i.path).join(',')])

  const srcOf = (it) => it.dataUrl || it.remote || urls[it.path] || ''
  const pickFiles = () => fileRef.current && fileRef.current.click()
  useRegisterAdd(pickFiles, [])

  // The camera roll is the real mood board — `multiple` opens it directly.
  const onFiles = (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'))
    if (e.target && 'value' in e.target) e.target.value = ''
    if (!files.length) return
    setBusy((n) => n + files.length)
    files.forEach((file, i) => {
      processImage(file, 1400, async (out) => {
        if (!out) { setBusy((n) => Math.max(0, n - 1)); return }
        let path = ''
        if (out.blob) path = (await store.uploadPhoto(out.blob)) || ''
        setItems((arr) => [...arr, normVision({
          id: uid(), path, dataUrl: path ? '' : (out.dataUrl || ''), w: out.w, h: out.h,
          x: 6 + ((arr.length + i) % 3) * 30 + Math.round(Math.random() * 6),
          y: 24 + Math.floor((arr.length + i) / 3) * 250,
          rot: Math.round((Math.random() * 7 - 3.5) * 10) / 10,
        })])
        setBusy((n) => Math.max(0, n - 1))
      })
    })
  }

  // Paste a URL and the picture comes off the page, the way she actually collects.
  const addFromUrl = async () => {
    const u = linkDraft.trim()
    if (!u) return
    setLinkDraft('')
    setLinking(false)
    setBusy((n) => n + 1)
    try {
      const r = await fetch('/api/unfurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) })
      const d = await r.json()
      if (d && d.image) {
        setItems((arr) => [...arr, normVision({
          id: uid(), remote: d.image, caption: d.title || '', w: 4, h: 3,
          x: 6 + (arr.length % 3) * 30, y: 24 + Math.floor(arr.length / 3) * 250,
          rot: Math.round((Math.random() * 7 - 3.5) * 10) / 10,
        })])
      }
    } catch { /* nothing arrived; the board is unchanged */ }
    setBusy((n) => Math.max(0, n - 1))
  }

  const removeItem = async (it) => {
    setItems((arr) => arr.filter((x) => x.id !== it.id))
    if (it.path) await store.deletePhoto(it.path)
  }

  // ── The three states, and the year ──
  const goalHasProtocols = (gid) => !!gid && activities.some((a) => a.details && a.details.goalId === gid && a.status !== 'archived')
  const stateOf = (it) => {
    if (it.gotOn) return 'got'
    if (goalHasProtocols(it.goalId)) return 'motion'
    return 'someday'
  }

  const years = useMemo(() => {
    const set = new Set(all.map((it) => Number(String(it.savedOn).slice(0, 4))).filter(Boolean))
    set.add(thisYear)
    return [...set].sort((a, b) => b - a)
  }, [all, thisYear])

  // A board carries a year. Past years are archived, not deleted.
  const inYear = all.filter((it) => Number(String(it.savedOn).slice(0, 4)) === year)
  const counts = {
    total: inYear.length,
    motion: inYear.filter((it) => stateOf(it) === 'motion').length,
    someday: inYear.filter((it) => stateOf(it) === 'someday').length,
    got: inYear.filter((it) => stateOf(it) === 'got').length,
  }

  const shown = inYear
    .filter((it) => (filter === 'all' ? true : stateOf(it) === filter))
    .filter((it) => (pillarFilter ? it.pillar === pillarFilter : true))

  const toggleFlip = (id) => setFlipped((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── dragging (scrapbook only) ──
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
    goals,
    state: stateOf(it),
    flipped: flipped.has(it.id),
    onFlip: () => toggleFlip(it.id),
    onEdit: (patch) => updateItem(it.id, patch),
    onRemove: () => removeItem(it),
    onCreateGoal,
  })

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />

      {/* Nothing yet: a drop zone and one button. Not two. */}
      {all.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) onFiles({ target: { files: e.dataTransfer.files } }) }}
        >
          <EmptyState glyph="❖" line="Nothing here yet." action="Choose photos" onAction={pickFiles} />
        </div>
      ) : (
        <>
          {/* The bench. Add photos appears only once there are photos. */}
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
                  <button onClick={() => setZoom((z) => Math.min(1.3, Math.round((z + 0.1) * 10) / 10))} aria-label="Zoom in" className="flex h-6 w-6 items-center justify-center text-stone-400 hover:text-stone-900"><PlusIcon size={13} /></button>
                </div>
              )}
              <button onClick={() => setLinking((v) => !v)} aria-label="Paste a link" title="Paste a link" className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-400 transition-colors hover:border-stone-400 hover:text-stone-800">
                <Link2 size={14} strokeWidth={1.7} />
              </button>
              <button onClick={pickFiles} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-opacity hover:opacity-90">
                <ImagePlus size={15} strokeWidth={1.75} /> Add photos
              </button>
            </div>
          </div>

          {linking && (
            <div className="mb-5 flex items-center gap-2.5 border-b border-stone-200 pb-1.5 focus-within:border-stone-900">
              <Link2 size={14} className="shrink-0 text-stone-300" />
              <input
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFromUrl()}
                autoFocus
                placeholder="Paste a link and the picture comes off the page"
                className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-300"
              />
            </div>
          )}

          {/* The snapshot — how much of the board is actually moving. */}
          <div className="mb-4 flex flex-wrap items-baseline gap-x-7 gap-y-1 border-y border-stone-200 py-3 text-[11px] tracking-[0.18em] tabular-nums">
            <span className="text-stone-500">{counts.total} VISION{counts.total === 1 ? '' : 'S'}</span>
            <span className="text-stone-400">{counts.motion} IN MOTION</span>
            <span className="text-stone-400">{counts.someday} SOMEDAY</span>
            <span className="text-stone-400">{counts.got} GOT</span>
            {years.length > 1 && (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="ml-auto bg-transparent text-[11px] tracking-[0.18em] text-stone-400 outline-none"
                aria-label="Board year"
              >
                {years.map((y) => <option key={y} value={y}>{y}{y === thisYear ? '' : ' · ARCHIVE'}</option>)}
              </select>
            )}
          </div>

          {/* Three states plus all. Not folders. */}
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            {[['all', 'All'], ['motion', 'In motion'], ['someday', 'Someday'], ['got', 'Got']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`rounded-full border px-3.5 py-1 text-xs transition-colors ${filter === id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}
              >{label}</button>
            ))}
            <select
              value={pillarFilter}
              onChange={(e) => setPillarFilter(e.target.value)}
              className="ml-auto border-b border-stone-200 bg-transparent pb-0.5 text-xs text-stone-500 outline-none focus:border-stone-900"
              aria-label="Filter by pillar"
            >
              <option value="">All pillars</option>
              {PILLAR_TAGS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          {busy > 0 && (
            <p className="mb-4 flex items-center justify-center gap-2 text-xs italic text-stone-400">
              <Loader2 size={13} className="animate-spin" /> Adding {busy} picture{busy > 1 ? 's' : ''}…
            </p>
          )}

          {shown.length === 0 ? (
            <EmptyState glyph="❖" line="Nothing here yet." />
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
        </>
      )}
    </div>
  )
}

// ── One vision, front and back ──────────────────────────────────────
// The whole card turns. No modal — a vision and what it means are two sides of
// the same object, and the turn is the one interaction on this page.
function Vision({ it, src, goals, state, flipped, onFlip, onEdit, onRemove, onCreateGoal, width, square, taped }) {
  const ratio = (it.h || 3) / (it.w || 4)
  const height = square ? undefined : (width ? Math.round(width * ratio) : undefined)

  return (
    <div className={`mos-flip ${flipped ? 'is-back' : ''}`} style={{ width: width || '100%' }}>
      <div
        className="mos-flip-inner"
        style={{ aspectRatio: square ? '1 / 1' : (width ? undefined : `${it.w} / ${it.h}`), height }}
      >
        {/* Front — the image, edge to edge. Nothing else. */}
        <button
          onClick={onFlip}
          aria-label={it.caption || 'Turn the card'}
          className={`mos-face block h-full w-full overflow-hidden text-left ${taped ? 'bg-white p-0 shadow-[0_2px_10px_rgba(28,25,23,0.12)]' : 'rounded-xl border border-stone-200 bg-white/50'}`}
        >
          {src
            ? <img src={src} alt={it.caption || ''} draggable={false} className="block h-full w-full object-cover" />
            : <span className="block h-full w-full animate-pulse bg-stone-500/10" />}
        </button>

        {/* Back — where it is going, and where it went. */}
        <div className={`mos-face mos-face-back ${taped ? 'bg-cream shadow-[0_2px_10px_rgba(28,25,23,0.12)]' : 'rounded-xl border border-stone-200 bg-cream'}`}>
          <Back it={it} goals={goals} state={state} onFlip={onFlip} onEdit={onEdit} onRemove={onRemove} onCreateGoal={onCreateGoal} />
        </div>
      </div>
    </div>
  )
}

function Back({ it, goals, state, onFlip, onEdit, onRemove, onCreateGoal }) {
  const [editing, setEditing] = useState(!it.goalId)
  const [draft, setDraft] = useState('')
  const goal = goals.find((g) => g.id === it.goalId)
  const pillar = pillarMeta(it.pillar)
  const out = daysOut(it.byWhen)
  const took = tookDays(it.savedOn, it.gotOn)

  // A goal is required, so linking one is what the back opens on. The pillar is
  // suggested from the goal — she confirms rather than categorises.
  const link = (g) => onEdit({ goalId: g.id, pillar: it.pillar || g.pillar || '' })
  const createAndLink = () => {
    const t = draft.trim()
    if (!t || !onCreateGoal) return
    const g = onCreateGoal(t)
    if (g) { link(g); setDraft(''); setEditing(false) }
  }

  const Row = ({ label, children }) => (
    <div className="flex items-baseline gap-3">
      <span className="w-[4.6rem] shrink-0 text-[8.5px] tracking-[0.16em] text-stone-400">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-stone-700">{children}</span>
    </div>
  )

  return (
    <div className="flex h-full flex-col p-3.5">
      <button onClick={onFlip} aria-label="Turn back" className="absolute right-2 top-2 text-stone-300 hover:text-stone-900"><X size={13} /></button>

      <input
        value={it.caption}
        onChange={(e) => onEdit({ caption: e.target.value })}
        placeholder="What this is"
        className="mb-2.5 w-full bg-transparent pr-5 font-serif text-[15px] leading-tight text-stone-900 outline-none placeholder:italic placeholder:text-stone-300"
      />

      <div className="space-y-1.5">
        <Row label="SAVED">{fmtDay(it.savedOn)}</Row>

        {editing || !goal ? (
          <div>
            <span className="mb-1 block text-[8.5px] tracking-[0.16em] text-stone-400">
              {goal ? 'GOAL' : 'NOT LINKED YET'}
            </span>
            <div className="max-h-[4.6rem] space-y-0.5 overflow-y-auto">
              {goals.map((g) => (
                <button key={g.id} onClick={() => { link(g); setEditing(false) }} className="block w-full truncate rounded px-1 py-0.5 text-left text-[12px] text-stone-700 hover:bg-stone-500/5">{g.title || 'Untitled'}</button>
              ))}
            </div>
            {onCreateGoal && (
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createAndLink()}
                placeholder="or name a new goal"
                className="mt-1 w-full border-b border-stone-200 bg-transparent pb-0.5 text-[11px] outline-none placeholder:text-stone-300 focus:border-stone-900"
              />
            )}
          </div>
        ) : (
          <Row label="GOAL">
            <button onClick={() => setEditing(true)} className="truncate text-left hover:underline">{goal.title || 'Untitled'}</button>
          </Row>
        )}

        {goal && (
          <div className="flex items-baseline gap-3">
            <span className="w-[4.6rem] shrink-0 text-[8.5px] tracking-[0.16em] text-stone-400">PILLAR</span>
            <select
              value={it.pillar}
              onChange={(e) => onEdit({ pillar: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-stone-700 outline-none"
            >
              <option value="">—</option>
              {PILLAR_TAGS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        )}

        {!it.gotOn && (
          <div className="flex items-baseline gap-3">
            <span className="w-[4.6rem] shrink-0 text-[8.5px] tracking-[0.16em] text-stone-400">BY WHEN</span>
            <input
              type="month"
              value={it.byWhen}
              onChange={(e) => onEdit({ byWhen: e.target.value, byWhenLabel: '' })}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-stone-700 outline-none"
            />
          </div>
        )}
        {it.gotOn && <Row label="GOT">{fmtDay(it.gotOn)}</Row>}
        {it.gotOn && took != null && <Row label="TOOK">{took} day{took === 1 ? '' : 's'}</Row>}
      </div>

      {!it.gotOn && !it.byWhen && (
        <div className="mt-2 flex flex-wrap gap-1">
          {SEASONS.map((s) => {
            const y = new Date().getFullYear() + (s.nextYear ? 1 : 0)
            const ym = `${y}-${String(s.month).padStart(2, '0')}`
            return (
              <button key={s.id} onClick={() => onEdit({ byWhen: ym, byWhenLabel: `${s.label} ${y}` })} className="rounded-full border border-stone-200 px-2 py-0.5 text-[9.5px] text-stone-500 hover:border-stone-900">{s.label}</button>
            )
          })}
        </div>
      )}

      <div className="mt-auto pt-2">
        <div className="mb-2 h-px bg-stone-200" />
        {/* A vision without a date is a daydream. With one, it is moving. Once
            it is got, the elapsed days are already in the rows above — saying it
            twice on one card is one time too many. */}
        {it.gotOn ? null : out != null ? (
          <p className="mb-2 font-serif text-[15px] text-stone-800">
            {out >= 0 ? `${out} day${out === 1 ? '' : 's'} out` : `${Math.abs(out)} day${Math.abs(out) === 1 ? '' : 's'} past`}
            {it.byWhenLabel ? <span className="ml-1.5 text-[10px] tracking-[0.14em] text-stone-400">{it.byWhenLabel.toUpperCase()}</span> : null}
          </p>
        ) : (
          <p className="mb-2 text-[11px] italic text-stone-400">No date yet</p>
        )}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit({ gotOn: it.gotOn ? '' : dateKey(new Date()) })}
            className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${it.gotOn ? 'border border-stone-300 text-stone-500 hover:border-stone-900' : 'bg-stone-900 text-cream hover:opacity-90'}`}
          >
            {it.gotOn ? 'Undo' : 'Got it'}
          </button>
          <button onClick={() => setEditing(true)} className="rounded-full border border-stone-300 px-3 py-1.5 text-[11px] text-stone-600 hover:border-stone-900">Edit</button>
          <button onClick={onRemove} className="ml-auto text-[10px] text-stone-300 hover:text-stone-700">Remove</button>
        </div>
      </div>
    </div>
  )
}
