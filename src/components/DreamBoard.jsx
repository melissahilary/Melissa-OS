import React, { useState, useEffect, useRef } from 'react'
import { Shuffle, Grid3x3, Columns3, LayoutGrid, X, ImagePlus, Loader2, Minus, Plus as PlusIcon } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, parseKey, MONTHS_SHORT } from '../lib/date'
import { useRegisterAdd } from './shared/AddButton'
import * as store from '../lib/dataStore'

// ── The Dream Board — a scrapbook of the life you're building. Photos are real
// files in your private bucket, so the board can grow as large as you like; the
// planner only remembers where each picture sits and which goal it belongs to.
// Four templates read the same pictures four ways: arrange by hand, or let the
// board compose itself.

const fmtArrived = (k) => { const d = parseKey(k); return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : '' }

const uid = () => Math.random().toString(36).slice(2, 10)

const TEMPLATES = [
  { id: 'scrapbook', label: 'Scrapbook', note: 'Scrapbook', icon: Shuffle },
  { id: 'gallery', label: 'Gallery', note: 'Gallery', icon: Grid3x3 },
  { id: 'mosaic', label: 'Mosaic', note: 'Mosaic', icon: Columns3 },
  { id: 'collage', label: 'Collage', note: 'Collage', icon: LayoutGrid },
]

const SIZES = { S: 150, M: 225, L: 330 }
const sizeW = (s) => SIZES[s] || SIZES.M

// Downscale before it ever leaves the browser — a vision board should be quick
// to load, not a gallery of 12-megapixel originals.
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

const normItem = (it) => ({
  id: it.id || uid(),
  path: it.path || '',
  dataUrl: it.dataUrl || '',
  w: it.w || 4,
  h: it.h || 3,
  x: typeof it.x === 'number' ? it.x : 8,
  y: typeof it.y === 'number' ? it.y : 24,
  rot: typeof it.rot === 'number' ? it.rot : 0,
  size: SIZES[it.size] ? it.size : 'M',
  goalId: it.goalId || '',
  caption: it.caption || '',
  // A board of things you actually received is the strongest artefact in the
  // section — so an image can graduate from wanted to got, with the date.
  arrivedOn: it.arrivedOn || '',
})

export default function DreamBoard() {
  const [raw, setRaw] = useLocalStorage('mos:dream:board', { template: 'scrapbook', items: [] })
  const board = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { template: 'scrapbook', items: [] }
  const items = (Array.isArray(board.items) ? board.items : []).map(normItem)
  const template = TEMPLATES.some((t) => t.id === board.template) ? board.template : 'scrapbook'

  const [goalsRaw] = useLocalStorage('mos:dream:goals', [])
  const goals = (Array.isArray(goalsRaw) ? goalsRaw : [])
    .map((g) => ({ id: g.id || '', title: (g.title != null ? g.title : g.text) || '' }))
    .filter((g) => g.id && g.title.trim())

  const [urls, setUrls] = useState({}) // path -> signed url
  const [busy, setBusy] = useState(0)
  const [openId, setOpenId] = useState(null)
  const [filter, setFilter] = useState('')
  const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState(null)
  const [dragPos, setDragPos] = useState(null)
  const fileRef = useRef(null)
  const canvasRef = useRef(null)

  const setBoard = (patch) => setRaw((prev) => {
    const cur = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : { template: 'scrapbook', items: [] }
    return { ...cur, ...patch }
  })
  const setItems = (fn) => setBoard({ items: fn(items) })
  const updateItem = (id, patch) => setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  // Sign whatever we haven't signed yet, so private files can be shown.
  useEffect(() => {
    let alive = true
    const missing = items.filter((it) => it.path && !urls[it.path]).map((it) => it.path)
    if (!missing.length) return
    ;(async () => {
      const pairs = await Promise.all([...new Set(missing)].map(async (p) => [p, await store.signedPhotoUrl(p)]))
      if (!alive) return
      setUrls((u) => { const next = { ...u }; pairs.forEach(([p, url]) => { if (url) next[p] = url }); return next })
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.path).join(',')])

  const srcOf = (it) => it.dataUrl || urls[it.path] || ''

  const pickFiles = () => fileRef.current && fileRef.current.click()
  useRegisterAdd(pickFiles, [])

  const onFiles = (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    setBusy((n) => n + files.length)
    files.forEach((file, i) => {
      processImage(file, 1400, async (out) => {
        if (!out) { setBusy((n) => Math.max(0, n - 1)); return }
        let path = ''
        if (out.blob) path = (await store.uploadPhoto(out.blob)) || ''
        // No session or no bucket? Keep the picture anyway, in the board itself.
        const dataUrl = path ? '' : (out.dataUrl || '')
        setItems((arr) => [...arr, normItem({
          id: uid(), path, dataUrl, w: out.w, h: out.h,
          // Scatter new pictures so a scrapbook never stacks them in a pile.
          x: 6 + ((arr.length + i) % 3) * 30 + Math.round(Math.random() * 6),
          y: 24 + Math.floor((arr.length + i) / 3) * 250,
          rot: Math.round((Math.random() * 7 - 3.5) * 10) / 10,
          size: 'M',
        })])
        setBusy((n) => Math.max(0, n - 1))
      })
    })
  }

  const removeItem = async (it) => {
    setItems((arr) => arr.filter((x) => x.id !== it.id))
    setOpenId(null)
    if (it.path) await store.deletePhoto(it.path)
  }

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
    else if (drag && !drag.moved) setOpenId(it.id)
    setDrag(null); setDragPos(null)
  }

  const [showArrived, setShowArrived] = useState('all') // all | open | arrived
  const byArrival = showArrived === 'all' ? items : items.filter((it) => (showArrived === 'arrived' ? it.arrivedOn : !it.arrivedOn))
  const shown = filter ? byArrival.filter((it) => it.goalId === filter) : byArrival
  const arrivedCount = items.filter((it) => it.arrivedOn).length
  const goalTitle = (id) => (goals.find((g) => g.id === id) || {}).title || ''
  // Only offer filters for goals that actually have pictures pinned to them.
  const taggedGoals = goals.filter((g) => items.some((it) => it.goalId === g.id))

  const estH = (it) => sizeW(it.size) * (it.h / (it.w || 1)) + 52
  const canvasH = template === 'scrapbook'
    ? Math.max(620, ...shown.map((it) => (drag && drag.id === it.id && dragPos ? dragPos.y : it.y) + estH(it) + 120))
    : 0

  const open = items.find((x) => x.id === openId) || null

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />

      {/* The bench — templates, zoom, and the way in */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-full border border-stone-200 bg-cream p-0.5">
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
          {template === 'scrapbook' && items.length > 0 && (
            <div className="flex items-center gap-1 rounded-full border border-stone-200 px-1 py-0.5">
              <button onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} aria-label="Zoom out" className="flex h-6 w-6 items-center justify-center text-stone-400 hover:text-stone-900"><Minus size={13} /></button>
              <span className="w-9 text-center text-[10px] tabular-nums text-stone-400">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.3, Math.round((z + 0.1) * 10) / 10))} aria-label="Zoom in" className="flex h-6 w-6 items-center justify-center text-stone-400 hover:text-stone-900"><PlusIcon size={13} /></button>
            </div>
          )}
          <button onClick={pickFiles} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-colors hover:bg-stone-700">
            <ImagePlus size={15} strokeWidth={1.75} /> Add photos
          </button>
        </div>
      </div>

      {arrivedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="kicker mr-1 text-stone-400">Showing</span>
          {[['all', 'Everything'], ['open', 'Still wanted'], ['arrived', `Arrived · ${arrivedCount}`]].map(([id, label]) => (
            <button key={id} onClick={() => setShowArrived(id)} className={`rounded-full border px-3.5 py-1 text-xs transition-colors ${showArrived === id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{label}</button>
          ))}
        </div>
      )}

      {/* Filter by the goal a picture belongs to */}
      {taggedGoals.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <span className="kicker mr-1 text-stone-400">Pinned to</span>
          <button onClick={() => setFilter('')} className={`rounded-full border px-3.5 py-1 text-xs transition-colors ${!filter ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>Everything</button>
          {taggedGoals.map((g) => (
            <button key={g.id} onClick={() => setFilter(filter === g.id ? '' : g.id)} className={`rounded-full border px-3.5 py-1 text-xs transition-colors ${filter === g.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>
              {g.title} · {items.filter((it) => it.goalId === g.id).length}
            </button>
          ))}
        </div>
      )}

      {busy > 0 && (
        <p className="mb-4 flex items-center justify-center gap-2 text-xs italic text-stone-400">
          <Loader2 size={13} className="animate-spin" /> Pinning {busy} picture{busy > 1 ? 's' : ''}…
        </p>
      )}

      {items.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) onFiles({ target: { files: e.dataTransfer.files } }) }}
          className="rounded-2xl border border-dashed border-stone-300 px-6 py-20 text-center transition-colors hover:border-stone-400"
        >
          <p className="font-serif italic text-xl text-stone-400">Drop pictures here</p>
          <button onClick={pickFiles} className="mt-5 inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm text-cream transition-colors hover:bg-stone-700">
            <ImagePlus size={16} strokeWidth={1.75} /> Choose photos
          </button>
        </div>
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
                  style={{ left: `${pos.x}%`, top: pos.y, width: W, transform: `rotate(${it.rot}deg)`, zIndex: dragging ? 50 : i + 1 }}
                >
                  <div className={`relative bg-white p-2.5 pb-2 shadow-[0_2px_10px_rgba(28,25,23,0.12)] transition-shadow ${dragging ? 'shadow-[0_10px_30px_rgba(28,25,23,0.22)]' : ''}`}>
                    {/* a strip of tape */}
                    <span aria-hidden className="absolute -top-2.5 left-1/2 h-5 w-14 -translate-x-1/2 -rotate-2" style={{ background: 'rgba(221,215,200,0.55)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)' }} />
                    <Picture it={it} src={srcOf(it)} width={W - 20} />
                    <p className="mt-2 min-h-[18px] text-center font-serif italic text-[13px] leading-tight text-stone-600">{it.caption}</p>
                    {it.goalId && <p className="mt-0.5 text-center text-[8.5px] tracking-[0.14em] text-stone-400">{goalTitle(it.goalId).toUpperCase()}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : template === 'gallery' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((it) => (
            <button key={it.id} onClick={() => setOpenId(it.id)} className="group text-left">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/50">
                <div className="aspect-square w-full overflow-hidden">
                  <Picture it={it} src={srcOf(it)} cover />
                </div>
              </div>
              {(it.caption || it.goalId) && (
                <div className="mt-1.5 px-0.5">
                  {it.caption && <p className="truncate font-serif text-[13px] text-stone-700">{it.caption}</p>}
                  {it.goalId && <p className="truncate text-[9px] tracking-[0.14em] text-stone-400">{goalTitle(it.goalId).toUpperCase()}</p>}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : template === 'mosaic' ? (
        <div className="columns-2 gap-3 sm:columns-3 md:columns-4">
          {shown.map((it) => (
            <button key={it.id} onClick={() => setOpenId(it.id)} className="mb-3 block w-full break-inside-avoid text-left">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/50">
                <Picture it={it} src={srcOf(it)} />
              </div>
              {(it.caption || it.goalId) && (
                <div className="mt-1.5 px-0.5">
                  {it.caption && <p className="font-serif text-[13px] leading-tight text-stone-700">{it.caption}</p>}
                  {it.goalId && <p className="truncate text-[9px] tracking-[0.14em] text-stone-400">{goalTitle(it.goalId).toUpperCase()}</p>}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center rounded-2xl border border-stone-200 bg-white/30 p-6">
          {shown.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setOpenId(it.id)}
              className="relative -ml-3 -mt-2 transition-transform hover:z-40 hover:scale-[1.03]"
              style={{ width: sizeW(it.size), transform: `rotate(${it.rot}deg)`, zIndex: i + 1 }}
            >
              <span className="block overflow-hidden rounded-sm border-4 border-white shadow-[0_3px_14px_rgba(28,25,23,0.18)]">
                <Picture it={it} src={srcOf(it)} />
              </span>
              {it.goalId && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-stone-900/70 px-2 py-0.5 text-[8.5px] tracking-[0.12em] text-cream">{goalTitle(it.goalId).toUpperCase()}</span>}
            </button>
          ))}
        </div>
      )}

      {open && (
        <PhotoSheet
          it={open}
          src={srcOf(open)}
          goals={goals}
          scrapbook={template === 'scrapbook'}
          onEdit={(patch) => updateItem(open.id, patch)}
          onRemove={() => removeItem(open)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

// One picture. While a signed URL is still on its way, hold the space with a
// quiet placeholder rather than collapsing the layout.
function Picture({ it, src, width, cover }) {
  const ratio = (it.h || 3) / (it.w || 4)
  if (!src) {
    return <span className="block w-full animate-pulse bg-stone-500/10" style={{ height: width ? width * ratio : undefined, aspectRatio: width ? undefined : `${it.w} / ${it.h}` }} />
  }
  return (
    <img
      src={src}
      alt={it.caption || 'Dream board picture'}
      draggable={false}
      className={`block w-full ${cover ? 'h-full object-cover' : ''}`}
      style={cover ? undefined : { height: width ? width * ratio : undefined }}
    />
  )
}

function PhotoSheet({ it, src, goals, scrapbook, onEdit, onRemove, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pb-1 pt-5">
          <span className="kicker text-stone-400">Picture</span>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>

        <div className="px-6 pt-2">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            {src ? <img src={src} alt={it.caption || 'Dream board picture'} className="block max-h-[38vh] w-full object-contain" /> : <div className="h-40 animate-pulse bg-stone-500/10" />}
          </div>
        </div>

        <div className="space-y-5 px-6 pb-2 pt-5">
          <div>
            <p className="kicker mb-1.5 text-stone-400">What this is</p>
            <input
              autoFocus
              value={it.caption}
              onChange={(e) => onEdit({ caption: e.target.value })}
              placeholder="The kitchen. The shape. The trip."
              className="w-full border-b border-stone-200 bg-transparent pb-1.5 font-serif text-lg outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-900"
            />
          </div>

          <div>
            <p className="kicker mb-2 text-stone-400">Pinned to a goal</p>
            {goals.length === 0 ? (
              <p className="text-xs italic text-stone-400">No goals yet — add one under Goals and you can pin pictures to it.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => onEdit({ goalId: '' })} className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${!it.goalId ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>No goal</button>
                {goals.map((g) => (
                  <button key={g.id} onClick={() => onEdit({ goalId: g.id })} className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${it.goalId === g.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{g.title}</button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="kicker mb-2 text-stone-400">Size</p>
            <div className="flex gap-1.5">
              {['S', 'M', 'L'].map((s) => (
                <button key={s} onClick={() => onEdit({ size: s })} className={`h-8 w-12 rounded-full border text-xs transition-colors ${it.size === s ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{s}</button>
              ))}
            </div>
          </div>

          {scrapbook && (
            <div>
              <p className="kicker mb-2 text-stone-400">Tilt</p>
              <input type="range" min="-12" max="12" step="0.5" value={it.rot} onChange={(e) => onEdit({ rot: Number(e.target.value) })} className="w-full accent-stone-900" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 pb-6 pt-4">
          <button onClick={onRemove} className="text-xs text-stone-400 hover:text-phase-menstrual">Remove</button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit({ arrivedOn: it.arrivedOn ? '' : dateKey(new Date()) })}
              className={`rounded-full border px-4 py-2 text-xs transition-colors ${it.arrivedOn ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-900'}`}
            >
              {it.arrivedOn ? `Arrived ${fmtArrived(it.arrivedOn)}` : 'Mark as arrived'}
            </button>
            <button onClick={onClose} className="rounded-full bg-stone-900 px-8 py-2.5 text-sm text-cream hover:bg-stone-700">Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
