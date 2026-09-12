import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Share2, GripVertical, ImagePlus } from 'lucide-react'
import { AddIcon, CloseIcon, LoggedIcon } from './shared/marks'
import { processImage } from './DreamBoard'
import * as store from '../lib/dataStore'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PILLAR_TAGS } from './DreamProjects'
import EmptyState from './shared/EmptyState'
import { useSignedUrls } from '../hooks/useSignedUrls'
import PolaroidRail from './shared/PolaroidRail'
import { assetMarkFor } from './shared/assetMarks'
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

const COVERS_KEY = 'mos:dream:covers'

export default function DreamCollections({ goals = [], projects = [] }) {
  const [stored, setStore] = useLocalStorage('mos:dream:collections', [])
  const lists = useMemo(() => (Array.isArray(stored) ? stored : []).map(normList), [stored])
  const [coversRaw, setCovers] = useLocalStorage(COVERS_KEY, {})
  const covers = coversRaw && typeof coversRaw === 'object' ? coversRaw : {}
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [choosing, setChoosing] = useState(null) // a topic she has more than one list in
  const [draftCls, setDraftCls] = useState(null) // a topic opened before it holds anything
  const draftRef = useRef(null)
  const [coverNote, setCoverNote] = useState('') // what the cover is doing, when it isn't just there

  // Covers are real files in the private bucket like every other photograph
  // here, so the wall holds as many as she likes without bloating the row that
  // loads at sign-in. Viewing one needs a signed link, and getting that link is
  // its own small saga — see the hook.
  const paths = useMemo(() => Object.values(covers).map((c) => (c && c.path) || '').filter(Boolean), [covers])
  const urls = useSignedUrls(paths)

  const coverSrc = (clsId) => {
    const c = covers[clsId]
    if (!c) return ''
    return c.dataUrl || urls[c.path] || ''
  }

  const setCover = (clsId, file) => {
    if (!file) return
    setCoverNote('SAVING')
    processImage(file, 900, async (out) => {
      // A file the browser cannot decode — most often an iPhone HEIC opened on
      // a desktop browser — used to vanish without a word, which looks exactly
      // like a cover that was added and didn't stay. Say so instead.
      if (!out) { setCoverNote("THAT FILE COULDN'T BE READ"); return }
      let path = ''
      if (out.blob) path = (await store.uploadPhoto(out.blob)) || ''
      // If the upload could not land — offline, or signed out — keep the small
      // copy so the cover is at least there now rather than silently nothing.
      setCovers((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [clsId]: { path, dataUrl: path ? '' : (out.dataUrl || out.thumb || '') } }))
      // The file is already in the bucket; anything that ends the page inside
      // the debounce would leave an uploaded cover with nothing pointing at it.
      store.flush(COVERS_KEY)
      setCoverNote('')
    })
  }
  const clearCover = (clsId) => {
    setCovers((prev) => { const next = { ...(prev && typeof prev === 'object' ? prev : {}) }; delete next[clsId]; return next })
    store.flush(COVERS_KEY)
    setCoverNote('')
  }

  const commit = (fn) => setStore((prev) => fn((Array.isArray(prev) ? prev : []).map(normList)))
  const create = (label, cls, currency) => {
    const c = normList({ label, cls, currency })
    commit((arr) => [...arr, c])
    setCreating(false)
    setChoosing(null)
    setOpenId(c.id)
  }
  const update = (id, patch) => commit((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const remove = (id) => { commit((arr) => arr.filter((c) => c.id !== id)); setOpenId(null) }

  // What a topic card says under its name. Nothing at all where there is
  // nothing, so the wall stays a wall and the ones she has stand out.
  const noteFor = (clsId) => {
    const mine = lists.filter((l) => l.cls === clsId)
    if (!mine.length) return ''
    const t = mine.reduce((a, l) => { const x = tally(l); return { owned: a.owned + x.owned, total: a.total + x.total } }, { owned: 0, total: 0 })
    if (!t.total) return mine.length > 1 ? `${mine.length} LISTS` : 'EMPTY'
    return `${t.owned} OF ${t.total} OWNED`
  }

  // A topic card is a door, not a form. One list of that kind and it opens;
  // several and it asks which; none and it opens an empty one that does not
  // exist yet — looking at a topic must not leave anything behind, and tapping
  // through the wall used to litter it with lists she never asked for.
  const openTopic = (clsId) => {
    const mine = lists.filter((l) => l.cls === clsId)
    if (mine.length === 1) { setOpenId(mine[0].id); return }
    if (mine.length > 1) { setChoosing(clsId); return }
    draftRef.current = null
    setDraftCls(clsId)
  }

  // The draft becomes real the moment she puts something in it, and everything
  // after that goes to the list it became.
  const materialise = (patch) => {
    if (draftRef.current) { update(draftRef.current, patch); return }
    const c = normList({ label: classMeta(draftCls).label, cls: draftCls, currency: 'USD', ...patch })
    draftRef.current = c.id
    commit((arr) => [...arr, c])
    setDraftCls(null)
    setOpenId(c.id)
  }

  if (draftCls) {
    return (
      <ListView
        list={normList({ id: 'draft', label: classMeta(draftCls).label, cls: draftCls, currency: 'USD' })}
        goals={goals}
        projects={projects}
        cover={coverSrc(draftCls)}
        onCover={(file) => setCover(draftCls, file)}
        onClearCover={() => clearCover(draftCls)}
        coverNote={coverNote}
        onUpdate={materialise}
        onRemove={() => setDraftCls(null)}
        onBack={() => setDraftCls(null)}
      />
    )
  }

  const open = lists.find((c) => c.id === openId) || null
  if (open) {
    return (
      <ListView
        list={open}
        goals={goals}
        projects={projects}
        cover={coverSrc(open.cls)}
        onCover={(file) => setCover(open.cls, file)}
        onClearCover={() => clearCover(open.cls)}
        coverNote={coverNote}
        onUpdate={(patch) => update(open.id, patch)}
        onRemove={() => remove(open.id)}
        onBack={() => setOpenId(null)}
      />
    )
  }

  if (creating) return <NewWishlist onCreate={create} onCancel={() => setCreating(false)} />

  if (choosing) {
    const mine = lists.filter((l) => l.cls === choosing)
    return (
      <div className="border border-stone-900 bg-white/60 p-5">
        <p className="kicker">{classMeta(choosing).label.toUpperCase()}</p>
        <p className="mt-1 font-serif text-2xl text-stone-900">Which one?</p>
        <div className="mt-4 divide-y divide-stone-100 border-y border-stone-200">
          {mine.map((l) => {
            const t = tally(l)
            return (
              <button key={l.id} onClick={() => { setChoosing(null); setOpenId(l.id) }} className="flex w-full items-baseline gap-3 py-3 text-left">
                <span className="font-serif text-lg text-stone-900">{l.label}</span>
                <span className="ml-auto text-[11px] tabular-nums text-stone-500">{t.owned} of {t.total} owned</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => create(classMeta(choosing).label, choosing, 'USD')} className="rounded-full bg-stone-900 px-5 py-2 text-sm text-cream">Another one</button>
          <button onClick={() => setChoosing(null)} className="text-xs text-stone-500 hover:text-stone-900">Back</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* The same toolbar the board has: whatever lives on the left, and the one
          cobalt action on the right, at the size Add photos is. */}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-opacity hover:opacity-90">
          <ImagePlus size={15} strokeWidth={1.75} /> Add wishlist
        </button>
      </div>

      {/* The topics are the wishlists. There is no separate shelf of boxes above
          them — a topic she has something in says so under its name, and opening
          it is the same tap as opening an empty one. */}
      <div className="space-y-7">
        {ASSET_GROUPS.map((g, gi) => (
          <div key={g.id}>
            <p className="mb-3 border-b border-stone-200 pb-1.5 text-[10px] tracking-[0.16em] text-stone-400">{g.label.toUpperCase()}</p>
            <PolaroidRail
              items={g.classes.map((c) => ({ id: c.id, label: c.label, Icon: assetMarkFor(c), cover: coverSrc(c.id), note: noteFor(c.id) }))}
              reverse={gi % 2 === 1}
              onPick={openTopic}
            />
          </div>
        ))}
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

// ── Add a wishlist ──────────────────────────────────────────────────
// The topics on the landing page are the fast way in — one tap and you are in
// the Bags wishlist. This is the deliberate way: name it whatever you like, say
// what kind of thing it holds, and it exists.
function NewWishlist({ onCreate, onCancel }) {
  const [label, setLabel] = useState('')
  const [cls, setCls] = useState('wardrobe')
  const [currency, setCurrency] = useState('USD')
  const go = () => label.trim() && onCreate(label.trim(), cls, currency)

  return (
    <div className="mx-auto max-w-xl border border-stone-900 bg-white/60 p-5">
      <p className="kicker">NEW WISHLIST</p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && go()}
        placeholder="Winter · The house · Skin"
        className="mt-1 w-full border-b border-stone-300 bg-transparent pb-1.5 font-serif text-2xl outline-none placeholder:text-stone-300 focus:border-stone-900"
      />
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-stone-500">
          Holds
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="border-b border-stone-300 bg-transparent pb-1 text-sm text-stone-900 outline-none focus:border-stone-900">
            {ASSET_GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {g.classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900">
          {CURRENCIES.map((c) => <option key={c.id} value={c.id}>{c.sym} {c.id}</option>)}
        </select>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={go} disabled={!label.trim()} className="rounded-full bg-stone-900 px-5 py-2 text-sm text-cream disabled:opacity-30">Create it</button>
        <button onClick={onCancel} className="text-xs text-stone-500 hover:text-stone-900">Cancel</button>
      </div>
    </div>
  )
}

// ── The list ────────────────────────────────────────────────────────
function ListView({ list, goals, projects, cover, onCover, onClearCover, coverNote, onUpdate, onRemove, onBack }) {
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
        {/* A list opened from a topic card is named after the topic, so saying
            it twice on one line is just noise. */}
        {list.label.toLowerCase() !== cls.label.toLowerCase() && (
          <span className="text-[10px] tracking-[0.16em] text-stone-400">{cls.label.toUpperCase()}</span>
        )}
        <button onClick={() => setSharing(true)} className="ml-auto flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">
          <Share2 size={12} strokeWidth={1.7} /> Share
        </button>
      </div>

      {/* The topic's face on the board. The mark is what it wears until she puts
          a photograph there, and the cover belongs to the topic rather than to
          this list — every Bags list shows the same one. */}
      <div className="mb-6 flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-stone-200 bg-[#EFEAE0] text-stone-900">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : React.createElement(assetMarkFor(cls), { size: 32 })}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:text-stone-900">
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onCover(f) }} />
            <ImagePlus size={12} strokeWidth={1.7} /> {cover ? 'Change cover' : 'Add a cover'}
          </label>
          {cover && <button onClick={onClearCover} className="text-xs text-stone-500 hover:text-stone-900">Remove</button>}
          {coverNote && <span className="text-[10px] tracking-[0.16em] text-stone-500">{coverNote}</span>}
        </div>
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

      {/* A list she is only looking at has nothing to delete yet. */}
      {list.id !== 'draft' && (
        <button onClick={onRemove} className="mt-8 text-xs text-stone-400 hover:text-phase-menstrual">Delete this list</button>
      )}

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
