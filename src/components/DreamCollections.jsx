import React, { useMemo, useState } from 'react'
import { ExternalLink, Share2, GripVertical } from 'lucide-react'
import { AddIcon, CloseIcon, LoggedIcon, AestheticsMark } from './shared/marks'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PILLAR_TAGS } from './DreamProjects'
import EmptyState from './shared/EmptyState'
import {
  ASSET_GROUPS, ASSET_CLASSES, classMeta, hasSizes, CURRENCIES,
  parseMoney, fmtMoney, parseTyped,
} from '../lib/assetClasses'
import { renderPages, downloadCanvas, asText, FORMATS, paginate } from '../lib/wishlistCard'
import { dateKey, parseKey, MONTHS_SHORT } from '../lib/date'

const uid = () => Math.random().toString(36).slice(2, 10)
const tagMeta = (id) => PILLAR_TAGS.find((p) => p.id === id) || null
const fmtDay = (k) => { const d = parseKey(k); return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : '' }

// ── Wishlist.
//
// Adding an item sets a wanted state and a price. Checking it off flips it to
// owned, stamps the date, and moves three numbers at once — owned up, spent up,
// remaining down. That is the whole loop, and it is the thing no wishlist
// product does: Amazon shows you what you want and never what you accumulated
// or what it cost you.

const isUrl = (s) => /^(https?:\/\/|www\.)\S+$/i.test(String(s).trim()) || /^[\w-]+\.[a-z]{2,}(\/\S*)?$/i.test(String(s).trim())

const STATUS = [
  { id: 'wanted', label: 'Wanted', tint: '#A3A093' },
  { id: 'owned', label: 'Owned', tint: '#7C8B6B' },
  { id: 'passed', label: 'Passed', tint: '#C4BFB6' },
]

const normItem = (it, i = 0) => ({
  id: it.id || uid(),
  title: it.title != null ? it.title : (it.text || ''),
  brand: it.brand || '',
  url: it.url || '',
  image: it.image || '',
  price: it.price || '',
  size: it.size || '',
  site: it.site || '',
  status: ['wanted', 'owned', 'passed'].includes(it.status) ? it.status : (it.done ? 'owned' : 'wanted'),
  ownedOn: it.ownedOn || '',
  pillar: it.pillar || '',
  goalId: it.goalId || '',
  projectId: it.projectId || '',
  note: it.note || '',
  fields: it.fields && typeof it.fields === 'object' ? it.fields : {},
  // Her order, not the app's. Priority is the point of a list.
  rank: typeof it.rank === 'number' ? it.rank : i,
})

const normList = (c) => ({
  id: c.id || uid(),
  label: c.label || 'Untitled',
  cls: c.cls || (c.type === 'practitioners' ? 'practitioners' : c.type === 'places' ? 'places' : 'wardrobe'),
  currency: CURRENCIES.some((x) => x.id === c.currency) ? c.currency : 'USD',
  items: (Array.isArray(c.items) ? c.items : []).map(normItem).sort((a, b) => a.rank - b.rank),
})

export default function DreamCollections({ goals = [], projects = [] }) {
  const [stored, setStore] = useLocalStorage('mos:dream:collections', [])
  const lists = useMemo(() => (Array.isArray(stored) ? stored : []).map(normList), [stored])
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)

  const commit = (fn) => setStore((prev) => fn((Array.isArray(prev) ? prev : []).map(normList)))
  const create = (label, cls, currency) => {
    const c = normList({ label, cls, currency })
    commit((arr) => [...arr, c])
    setCreating(false)
    setOpenId(c.id)
  }
  const update = (id, patch) => commit((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const remove = (id) => { commit((arr) => arr.filter((c) => c.id !== id)); setOpenId(null) }

  const open = lists.find((c) => c.id === openId) || null
  if (open) {
    return (
      <ListView
        list={open}
        goals={goals}
        projects={projects}
        onUpdate={(patch) => update(open.id, patch)}
        onRemove={() => remove(open.id)}
        onBack={() => setOpenId(null)}
      />
    )
  }

  if (creating) return <ChooseClass onCreate={create} onCancel={() => setCreating(false)} />

  if (!lists.length) {
    return <EmptyState mark={AestheticsMark} line="Nothing here yet." action="Add a list" onAction={() => setCreating(true)} />
  }

  return (
    <div>
      <button onClick={() => setCreating(true)} className="mb-5 flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-stone-900">
        <AddIcon size={14} strokeWidth={1.8} /> New list
      </button>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((c) => {
          const t = tally(c)
          const covers = c.items.filter((i) => i.image).slice(0, 3)
          return (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="overflow-hidden rounded-2xl border border-stone-200 bg-white/50 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-24 gap-px bg-stone-100">
                {covers.length
                  ? covers.map((i) => <img key={i.id} src={i.image} alt="" className="h-full flex-1 object-cover" />)
                  : <span className="flex h-full w-full items-center justify-center text-[10px] tracking-[0.2em] text-stone-400">{classMeta(c.cls).label.toUpperCase()}</span>}
              </div>
              <div className="p-4">
                <p className="font-serif text-lg text-stone-900">{c.label}</p>
                <p className="mt-0.5 text-[10px] tracking-[0.16em] text-stone-400">{classMeta(c.cls).label.toUpperCase()}</p>
                <p className="mt-2 text-[11px] tabular-nums text-stone-500">{t.owned} of {t.total} owned</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The three numbers that move on one tap.
function tally(list) {
  const live = list.items.filter((i) => i.status !== 'passed')
  const owned = live.filter((i) => i.status === 'owned')
  const spent = owned.reduce((n, i) => n + (parseMoney(i.price) || 0), 0)
  const remaining = live.filter((i) => i.status === 'wanted').reduce((n, i) => n + (parseMoney(i.price) || 0), 0)
  return { total: live.length, owned: owned.length, spent, remaining }
}

// ── 1 — Choose a class ──────────────────────────────────────────────
function ChooseClass({ onCreate, onCancel }) {
  const [cls, setCls] = useState(null)
  const [label, setLabel] = useState('')
  const [currency, setCurrency] = useState('USD')

  // 2 — Name it. The class is fixed; the name is hers.
  if (cls) {
    return (
      <div className="rounded-2xl border border-stone-900 bg-white/60 p-5">
        <p className="text-[10px] tracking-[0.16em] text-stone-400">{classMeta(cls).label.toUpperCase()}</p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && label.trim() && onCreate(label.trim(), cls, currency)}
          placeholder="Winter · The house · Skin"
          className="mt-1 w-full border-b border-stone-300 bg-transparent pb-1.5 font-serif text-2xl outline-none placeholder:text-stone-300 focus:border-stone-900"
        />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900">
            {CURRENCIES.map((c) => <option key={c.id} value={c.id}>{c.sym} {c.id}</option>)}
          </select>
          <button onClick={() => label.trim() && onCreate(label.trim(), cls, currency)} disabled={!label.trim()} className="rounded-full bg-stone-900 px-5 py-2 text-sm text-cream disabled:opacity-30">Create the list</button>
          <button onClick={() => setCls(null)} className="text-xs text-stone-400 hover:text-stone-700">Back</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-baseline gap-3">
        <p className="font-serif text-xl text-stone-900">What kind of thing?</p>
        <button onClick={onCancel} className="ml-auto text-xs text-stone-400 hover:text-stone-900">Cancel</button>
      </div>
      <div className="space-y-6">
        {ASSET_GROUPS.map((g) => (
          <div key={g.id}>
            <p className="mb-2 border-b border-stone-200 pb-1.5 text-[10px] tracking-[0.16em] text-stone-400">{g.label.toUpperCase()}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.classes.map((c) => (
                <button key={c.id} onClick={() => setCls(c.id)} className="rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── The list ────────────────────────────────────────────────────────
function ListView({ list, goals, projects, onUpdate, onRemove, onBack }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [dragId, setDragId] = useState(null)
  const [sharing, setSharing] = useState(false)

  const cls = classMeta(list.cls)
  const t = tally(list)

  const setItems = (fn) => onUpdate({ items: fn(list.items).map((it, i) => ({ ...it, rank: i })) })
  const patch = (id, p) => onUpdate({ items: list.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })
  const drop = (id) => setItems((arr) => arr.filter((i) => i.id !== id))

  // 3 — Add items. One input, three ways in.
  const addFromDraft = async () => {
    const raw = draft.trim()
    if (!raw) return
    setDraft('')

    if (!isUrl(raw)) {
      // "Toteme wool coat 480" → name and price. A bare name is fine too.
      const { title, price } = parseTyped(raw, list.currency)
      setItems((arr) => [...arr, normItem({ title, price }, arr.length)])
      return
    }

    const id = uid()
    const host = raw.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0]
    setItems((arr) => [...arr, normItem({ id, title: host, url: /^https?:\/\//i.test(raw) ? raw : `https://${raw}`, site: host }, arr.length)])
    setBusy(true)
    try {
      const r = await fetch('/api/unfurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: raw }) })
      const d = await r.json()
      if (d && !d.error) patch(id, { title: d.title || host, brand: d.site || '', image: d.image || '', price: d.price || '', site: d.site || host, url: d.url || raw })
    } catch { /* the item is already there, named by its host */ }
    setBusy(false)
  }

  // 5 — The checkbox is the arrival moment, not a completion tick.
  const acquire = (it) => patch(it.id, it.status === 'owned'
    ? { status: 'wanted', ownedOn: '' }
    : { status: 'owned', ownedOn: dateKey(new Date()) })

  const reorder = (overId) => {
    if (!dragId || dragId === overId) return
    setItems((arr) => {
      const from = arr.findIndex((x) => x.id === dragId)
      const to = arr.findIndex((x) => x.id === overId)
      if (from < 0 || to < 0) return arr
      const next = [...arr]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const shown = filter === 'all' ? list.items : list.items.filter((i) => i.status === filter)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <button onClick={onBack} className="text-xs tracking-[0.14em] text-stone-400 hover:text-stone-900">← ALL LISTS</button>
        <h2 className="font-serif text-2xl text-stone-900">{list.label}</h2>
        <span className="text-[10px] tracking-[0.16em] text-stone-400">{cls.label.toUpperCase()}</span>
        <button onClick={() => setSharing(true)} className="ml-auto flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">
          <Share2 size={12} strokeWidth={1.7} /> Share
        </button>
      </div>

      {/* The three numbers. Owned up, spent up, remaining down — on one tap. */}
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1.5 border-y border-stone-200 py-3">
        <span className="text-[11px] tracking-[0.18em] text-stone-500 tabular-nums">{t.owned} OF {t.total} OWNED</span>
        <span className="text-[11px] tracking-[0.18em] text-stone-400 tabular-nums">
          {fmtMoney(t.spent, list.currency) || fmtMoney(0, list.currency)} SPENT · {fmtMoney(t.remaining, list.currency) || fmtMoney(0, list.currency)} REMAINING
        </span>
      </div>

      <div className="mb-5 flex items-center gap-2.5 border-b border-stone-200 pb-1.5 focus-within:border-stone-900">
        <AddIcon size={14} className="shrink-0 text-stone-300" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFromDraft()}
          placeholder="Paste a link, or type a name and a price"
          className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-300"
        />
        {busy > 0 && <span className="shrink-0 text-[10px] tracking-[0.16em] text-stone-500">READING</span>}
      </div>

      {list.items.length === 0 ? (
        <EmptyState line="Nothing here yet." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {[{ id: 'all', label: 'All' }, ...STATUS].map((s) => (
              <button key={s.id} onClick={() => setFilter(s.id)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${filter === s.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>{s.label}</button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                cls={cls}
                currency={list.currency}
                goals={goals}
                projects={projects}
                onPatch={(p) => patch(it.id, p)}
                onAcquire={() => acquire(it)}
                onDrop={() => drop(it.id)}
                onDragStart={() => setDragId(it.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={() => reorder(it.id)}
              />
            ))}
          </div>
        </>
      )}

      <button onClick={onRemove} className="mt-8 text-xs text-stone-400 hover:text-phase-menstrual">Delete this list</button>

      {sharing && <ShareSheet list={list} onClose={() => setSharing(false)} />}
    </div>
  )
}

// ── An item ─────────────────────────────────────────────────────────
function ItemCard({ item: it, cls, currency, goals, projects, onPatch, onAcquire, onDrop, onDragStart, onDragEnd, onDragOver }) {
  const [open, setOpen] = useState(false)
  const owned = it.status === 'owned'

  // Cost per wear only means anything once you own it and have worn it.
  const worn = parseFloat(it.fields.worn)
  const cpw = owned && Number.isFinite(worn) && worn > 0 && parseMoney(it.price)
    ? fmtMoney(parseMoney(it.price) / worn, currency)
    : ''

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      className={`group overflow-hidden rounded-2xl border bg-white/50 transition-opacity ${it.status === 'passed' ? 'border-stone-200 opacity-50' : 'border-stone-200'}`}
    >
      {it.image && (
        <a href={it.url || undefined} target="_blank" rel="noreferrer" className="block h-36 w-full overflow-hidden bg-stone-100">
          <img src={it.image} alt="" className="h-full w-full object-cover" />
        </a>
      )}
      <div className="p-3.5">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 cursor-grab text-stone-200 opacity-0 transition-opacity group-hover:opacity-100"><GripVertical size={13} /></span>
          {/* The checkbox is the arrival. */}
          <button
            onClick={onAcquire}
            aria-label={owned ? 'Owned' : 'Mark as owned'}
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${owned ? 'border-stone-900 bg-stone-900' : 'border-stone-300 hover:border-stone-900'}`}
          >
            {owned && <LoggedIcon size={10} className="text-cream" />}
          </button>
          <p className="min-w-0 flex-1 text-sm leading-snug text-stone-800">
            {it.brand && <span className="text-stone-500">{it.brand} </span>}
            {it.title || 'Untitled'}
          </p>
          <button onClick={onDrop} className="shrink-0 text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><CloseIcon size={13} /></button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[1.55rem]">
          {it.price && <span className="font-serif text-base text-stone-900">{fmtMoney(it.price, currency)}</span>}
          {cpw && <span className="text-[10px] text-stone-400">{cpw}/wear</span>}
          {owned && it.ownedOn && <span className="text-[10px] tracking-[0.1em] text-stone-400">GOT {fmtDay(it.ownedOn).toUpperCase()}</span>}
          {it.site && (
            <a href={it.url || undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700">
              {it.site}<ExternalLink size={9} />
            </a>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-1 pl-[1.55rem]">
          {STATUS.map((s) => (
            <button
              key={s.id}
              onClick={() => onPatch(s.id === 'owned' ? { status: 'owned', ownedOn: it.ownedOn || dateKey(new Date()) } : { status: s.id, ownedOn: '' })}
              className={`rounded-full px-2.5 py-1 text-[10px] tracking-[0.1em] transition-colors ${it.status === s.id ? 'text-cream' : 'text-stone-400 hover:text-stone-700'}`}
              style={it.status === s.id ? { background: s.tint } : undefined}
            >
              {s.label.toUpperCase()}
            </button>
          ))}
          <button onClick={() => setOpen((o) => !o)} className="ml-auto text-[10px] tracking-[0.1em] text-stone-300 hover:text-stone-700">{open ? 'LESS' : 'MORE'}</button>
        </div>

        {/* 4 — The class's own fields, specific to what this is. */}
        {open && (
          <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <Field label="Brand" value={it.brand} onChange={(v) => onPatch({ brand: v })} />
              <Field label="Price" value={it.price} onChange={(v) => onPatch({ price: v })} />
              {hasSizes(cls.id) && <Field label="Size" value={it.size} onChange={(v) => onPatch({ size: v })} />}
              {cls.fields.filter((fd) => fd.k !== 'brand' && fd.k !== 'size').map((fd) => (
                <Field
                  key={fd.k}
                  label={fd.l}
                  type={fd.t}
                  value={it.fields[fd.k] || ''}
                  onChange={(v) => onPatch({ fields: { ...it.fields, [fd.k]: v } })}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-1 pt-1">
              {PILLAR_TAGS.map((tg) => (
                <button key={tg.id} onClick={() => onPatch({ pillar: it.pillar === tg.id ? '' : tg.id })} className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${it.pillar === tg.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500'}`}>{tg.label}</button>
              ))}
            </div>

            <label className="block">
              <span className="kicker mb-1 block text-stone-400">Move to</span>
              <select
                value={it.projectId || it.goalId || ''}
                onChange={(e) => {
                  const v = e.target.value
                  const isProject = projects.some((p) => p.id === v)
                  onPatch({ projectId: isProject ? v : '', goalId: isProject ? '' : v })
                }}
                className="w-full border-b border-stone-200 bg-transparent pb-1 text-xs outline-none focus:border-stone-900"
              >
                <option value="">—</option>
                {projects.length > 0 && <optgroup label="Projects">{projects.map((p) => <option key={p.id} value={p.id}>{p.name || 'Untitled'}</option>)}</optgroup>}
                {goals.length > 0 && <optgroup label="Goals">{goals.map((g) => <option key={g.id} value={g.id}>{g.title || 'Untitled'}</option>)}</optgroup>}
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  if (type === 'bool') {
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-stone-900" />
        <span className="text-[11px] text-stone-500">{label}</span>
      </label>
    )
  }
  return (
    <label className="block">
      <span className="mb-0.5 block text-[9.5px] tracking-[0.12em] text-stone-400">{label.toUpperCase()}</span>
      <input
        type={type === 'date' ? 'date' : 'text'}
        inputMode={type === 'num' || type === 'count' || type === 'money' ? 'decimal' : undefined}
        value={value == null ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-b border-stone-200 bg-transparent pb-0.5 text-xs outline-none focus:border-stone-900"
      />
    </label>
  )
}

// ── Share ───────────────────────────────────────────────────────────
// A wishlist you cannot send is half a product.
function ShareSheet({ list, onClose }) {
  const [format, setFormat] = useState('story')
  const [prices, setPrices] = useState(true)
  const [links, setLinks] = useState(true)
  const [sizes, setSizes] = useState(hasSizes(list.cls))
  const [ownedMode, setOwnedMode] = useState('marked') // hide | show | marked
  const [withImages, setWithImages] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')

  const cls = classMeta(list.cls)
  const items = list.items.filter((i) => {
    if (i.status === 'passed') return false
    if (i.status === 'owned' && ownedMode === 'hide') return false
    return true
  })
  const total = items.reduce((n, i) => n + (parseMoney(i.price) || 0), 0)
  const pages = format === 'text' ? 1 : paginate(items, format).length

  const text = asText({ listName: list.label, classId: list.cls, items, showPrices: prices, showLinks: links, showSizes: sizes, currency: list.currency })

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied('text'); setTimeout(() => setCopied(''), 1600) } catch { /* clipboard refused */ }
  }

  const download = async () => {
    setBusy(true)
    try {
      const canvases = await renderPages({
        listName: list.label, classId: list.cls, items, format,
        showPrices: prices, showSizes: sizes, currency: list.currency,
        totalCount: items.length, totalSpend: total, withImages,
      })
      for (let i = 0; i < canvases.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await downloadCanvas(canvases[i], `${list.label.toLowerCase().replace(/\s+/g, '-')}-${format}${canvases.length > 1 ? `-${i + 1}` : ''}.png`)
      }
    } finally { setBusy(false) }
  }

  const Toggle = ({ on, onClick, children }) => (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>{children}</button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/25 sm:items-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-cream p-6 sm:rounded-3xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-2xl text-stone-900">Send {list.label}</h3>
            <p className="mt-0.5 text-[10px] tracking-[0.16em] text-stone-400">{cls.label.toUpperCase()}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
        </div>

        <div className="mb-5 inline-flex rounded-full border border-stone-200 bg-white/60 p-0.5">
          {[['story', 'Story'], ['feed', 'Feed'], ['text', 'Text']].map(([id, label]) => (
            <button key={id} onClick={() => setFormat(id)} className={`rounded-full px-4 py-1.5 text-xs transition-colors ${format === id ? 'bg-stone-900 text-cream' : 'text-stone-500 hover:text-stone-800'}`}>{label}</button>
          ))}
        </div>

        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] tracking-[0.14em] text-stone-400">SHOW</span>
            <Toggle on={prices} onClick={() => setPrices((v) => !v)}>Prices</Toggle>
            {format === 'text' && <Toggle on={links} onClick={() => setLinks((v) => !v)}>Links</Toggle>}
            {hasSizes(list.cls) && <Toggle on={sizes} onClick={() => setSizes((v) => !v)}>Sizes</Toggle>}
            {format !== 'text' && <Toggle on={withImages} onClick={() => setWithImages((v) => !v)}>Images</Toggle>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] tracking-[0.14em] text-stone-400">OWNED</span>
            {[['hide', 'Hide'], ['show', 'Show'], ['marked', 'Show as marked']].map(([id, label]) => (
              <Toggle key={id} on={ownedMode === id} onClick={() => setOwnedMode(id)}>{label}</Toggle>
            ))}
          </div>
        </div>

        {!prices && (
          <p className="mb-4 text-[11px] leading-relaxed text-stone-400">
            Without prices, this is the version you send to someone buying for you.
          </p>
        )}

        {format === 'text' ? (
          <>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-200 bg-white/50 p-3.5 font-mono text-[11px] leading-relaxed text-stone-700">{text}</pre>
            <button onClick={copy} className="mt-4 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream hover:opacity-90">
              {copied === 'text' ? 'Copied' : 'Copy text'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-stone-500">
              {items.length} {items.length === 1 ? 'piece' : 'pieces'} across {pages} card{pages === 1 ? '' : 's'} · {FORMATS[format].w}×{FORMATS[format].h}
            </p>
            <button onClick={download} disabled={busy || !items.length} className="mt-4 flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-30">
              {busy > 0 && <span className="shrink-0 text-[10px] tracking-[0.16em] text-stone-500">READING</span>}
              Download {pages === 1 ? 'the card' : `${pages} cards`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
