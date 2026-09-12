import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Share2, GripVertical, ImagePlus } from 'lucide-react'
import { AddIcon, CloseIcon, LoggedIcon, EditIcon } from './shared/marks'
import { coverImage, blobToDataUrl } from '../lib/coverImage'
import * as store from '../lib/dataStore'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PILLAR_TAGS } from './DreamProjects'
import EmptyState from './shared/EmptyState'
import SearchBar, { hits } from './shared/SearchBar'
import { useSignedUrls } from '../hooks/useSignedUrls'
import PolaroidRail from './shared/PolaroidRail'
import { assetMarkFor } from './shared/assetMarks'
import {
  ASSET_GROUPS, ASSET_CLASSES, classMeta, hasSizes, CURRENCIES, setCustomClasses,
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
const TOPICS_KEY = 'mos:dream:topics'

// The sixty shelves are a starting set, not a fixture. This row is the only
// record of what she has done to it: which she has taken down, and which she has
// put up that were never there. A new account has neither, so a new account sees
// all sixty, which is the point of having them.
const normTopics = (t) => ({
  hidden: Array.isArray(t && t.hidden) ? t.hidden.filter((x) => typeof x === 'string') : [],
  custom: Array.isArray(t && t.custom) ? t.custom.filter((c) => c && c.id && c.label) : [],
})

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
  const [adding, setAdding] = useState(null) // the group she is putting a shelf back on
  const [section, setSection] = useState(null) // the section she has opened, as a page of its own

  const [topicsRaw, setTopics] = useLocalStorage(TOPICS_KEY, { hidden: [], custom: [] })
  const topics = useMemo(() => normTopics(topicsRaw), [topicsRaw])
  // Registered before anything renders, so classMeta answers for her own shelves
  // everywhere it is already called — the share sheet included.
  useMemo(() => setCustomClasses(topics.custom), [topics.custom])
  const hidden = useMemo(() => new Set(topics.hidden), [topics.hidden])

  const classesIn = (g) => [
    ...g.classes.filter((c) => !hidden.has(c.id)),
    ...topics.custom.filter((c) => c.group === g.id && !hidden.has(c.id)),
  ]
  const hiddenIn = (gid) => {
    const g = ASSET_GROUPS.find((x) => x.id === gid)
    if (!g) return []
    return [...g.classes, ...topics.custom.filter((c) => c.group === gid)].filter((c) => hidden.has(c.id))
  }

  const hideTopic = (id) => {
    setTopics((prev) => { const t = normTopics(prev); return { ...t, hidden: [...new Set([...t.hidden, id])] } })
    store.flush(TOPICS_KEY)
    setOpenId(null)
    setDraftCls(null)
  }
  const showTopic = (id) => {
    setTopics((prev) => { const t = normTopics(prev); return { ...t, hidden: t.hidden.filter((x) => x !== id) } })
    store.flush(TOPICS_KEY)
  }
  // Hiding takes a shelf down and keeps it: Add a list offers it back. Deleting
  // is only ever offered for a shelf she invented, because a built-in one has
  // nothing to delete — taking it down is the whole of it.
  const dropTopic = (id) => {
    setTopics((prev) => {
      const t = normTopics(prev)
      return { ...t, custom: t.custom.filter((c) => c.id !== id), hidden: t.hidden.filter((x) => x !== id) }
    })
    store.flush(TOPICS_KEY)
    setOpenId(null)
    setDraftCls(null)
  }
  const addTopic = (gid, label) => {
    const name = (label || '').trim()
    if (!name) return
    const id = `own_${uid()}`
    setTopics((prev) => { const t = normTopics(prev); return { ...t, custom: [...t.custom, { id, label: name, group: gid }] } })
    store.flush(TOPICS_KEY)
    setAdding(null)
  }
  const [coverNote, setCoverNote] = useState('') // what the cover is doing, when it isn't just there
  const [topicQuery, setTopicQuery] = useState('')

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

  const setCover = async (clsId, file) => {
    if (!file) return
    setCoverNote('SAVING')
    try {
      const out = await coverImage(file, 900)
      // A file the browser cannot decode — most often an iPhone HEIC opened
      // somewhere with no decoder for it — used to vanish without a word, which
      // looks exactly like a cover that was added and didn't stay. Say so.
      if (!out) { setCoverNote("THAT FILE COULDN'T BE READ"); return }
      let path = ''
      if (out.blob) path = (await store.uploadPhoto(out.blob)) || ''
      // If the upload could not land — offline, or signed out — hold the small
      // copy so the cover is there rather than silently nothing. An empty entry
      // is the exact shape of the bug this is all about.
      const held = path ? '' : (out.dataUrl || (await blobToDataUrl(out.blob)))
      if (!path && !held) { setCoverNote("THAT ONE DIDN'T SAVE — TRY AGAIN"); return }
      setCovers((prev) => ({ ...(prev && typeof prev === 'object' ? prev : {}), [clsId]: { path, dataUrl: held } }))
      // The file is already in the bucket; anything that ends the page inside
      // the debounce would leave an uploaded cover with nothing pointing at it.
      store.flush(COVERS_KEY)
      setCoverNote('')
    } catch {
      // Whatever went wrong, the control must not be left saying SAVING for
      // ever — that is the state she has to reload the page to get out of.
      setCoverNote("THAT ONE DIDN'T SAVE — TRY AGAIN")
    }
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
        coverNote={coverNote}
        onDelete={() => hideTopic(draftCls)}
        onUpdate={materialise}
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
        coverNote={coverNote}
        onDelete={() => {
          // An empty list takes its shelf down with it, unless another list of
          // the same kind is still standing on it.
          const others = lists.filter((l) => l.cls === open.cls && l.id !== open.id)
          remove(open.id)
          if (!open.items.length && !others.length) hideTopic(open.cls)
        }}
        onUpdate={(patch) => update(open.id, patch)}
        onBack={() => setOpenId(null)}
      />
    )
  }

  if (creating) return <NewWishlist onCreate={create} onCancel={() => setCreating(false)} />

  if (adding) {
    const g = ASSET_GROUPS.find((x) => x.id === adding)
    return (
      <AddTopic
        group={g}
        back={hiddenIn(adding)}
        onRestore={(id) => { showTopic(id); setAdding(null) }}
        onCreate={(label) => addTopic(adding, label)}
        onCancel={() => setAdding(null)}
      />
    )
  }

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

  if (section) {
    const g = ASSET_GROUPS.find((x) => x.id === section)
    if (g) {
      return (
        <SectionPage
          group={g}
          shelves={classesIn(g)}
          coverSrc={coverSrc}
          noteFor={noteFor}
          onOpen={openTopic}
          onHide={hideTopic}
          onDrop={dropTopic}
          mine={new Set(topics.custom.map((c) => c.id))}
          onAdd={() => setAdding(g.id)}
          onBack={() => setSection(null)}
        />
      )
    }
  }

  return (
    <div>
      {/* The same toolbar the board has: whatever lives on the left, and the one
          cobalt action on the right, at the size Add photos is. */}
      <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-opacity hover:opacity-90">
          <ImagePlus size={15} strokeWidth={1.75} /> Add wishlist
        </button>
      </div>

      <SearchBar value={topicQuery} onChange={setTopicQuery} label="Search your wishlists" className="mb-4" />

      {/* The topics are the wishlists. There is no separate shelf of boxes above
          them — a topic she has something in says so under its name, and opening
          it is the same tap as opening an empty one. */}
      <div className="space-y-7">
        {ASSET_GROUPS.map((g, gi) => {
          // Sixty shelves is more than anyone scrolls. The search runs over the
          // name and the examples underneath it, so "socks" finds Accessories
          // even though the word is not on the card. A row with no match is not
          // an empty row; it is not there.
            const shelves = classesIn(g).filter((c) => hits(`${c.label} ${c.about || ''}`, topicQuery))
            if (!shelves.length) return null
            return (
              <div key={g.id}>
                {/* The section name is the way into the section. A row of
                    topics is a preview of the shelf, not the whole of it — the
                    page behind the name is where they are all laid out. */}
                <button
                  onClick={() => setSection(g.id)}
                  className="mb-3 flex w-full items-baseline gap-2 border-b border-stone-200 pb-1.5 text-left text-[10px] tracking-[0.16em] text-stone-400 transition-colors hover:text-stone-900"
                >
                  {g.label.toUpperCase()}
                  <span aria-hidden className="ml-auto text-stone-300">→</span>
                </button>
                <PolaroidRail
                  items={shelves.map((c) => ({ id: c.id, label: c.label, Icon: assetMarkFor(c), cover: coverSrc(c.id), note: noteFor(c.id) }))}
                  reverse={gi % 2 === 1}
                  onPick={openTopic}
                  onAdd={topicQuery ? undefined : () => setAdding(g.id)}
                />
              </div>
            )
        })}
      </div>
    </div>
  )
}

// ── A section, laid out as a catalogue ──────────────────────────────
//
// The rail on the landing page is a preview: a few shelves drifting past, which
// is right for browsing and useless for finding. Behind the section's name is
// the whole of it at once — every shelf in the section, its picture, its name,
// and underneath in small type the things that belong on it.
//
// It is a catalogue page, and it is laid out like one: the picture on plain
// ground with nothing drawn around it, the name in italic serif beneath, the
// examples smaller and greyer beneath that. Four across on a desk, two on a
// phone. No frames, no cards, no borders — a page of products in a lookbook
// has none of those, and they are what would make this read as an interface
// rather than as something to look through.
function SectionPage({ group, shelves, coverSrc, noteFor, onOpen, onHide, onDrop, mine, onAdd, onBack }) {
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(null)
  const shown = shelves.filter((c) => hits(`${c.label} ${c.about || ''}`, q))

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="text-[10px] tracking-[0.16em] text-stone-400 transition-colors hover:text-stone-900">
          ← ALL SECTIONS
        </button>
        <button onClick={onAdd} className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-opacity hover:opacity-90">
          <AddIcon size={15} strokeWidth={1.75} /> Add a list
        </button>
      </div>

      <div className="mb-6 border-b border-stone-200 pb-4">
        <h2 className="font-serif text-3xl leading-tight text-stone-900">{group.label}</h2>
        <p className="mt-1 text-sm text-stone-500">{shelves.length} {shelves.length === 1 ? 'list' : 'lists'}</p>
      </div>

      <SearchBar value={q} onChange={setQ} label={`Search ${group.label}`} className="mb-6" />

      {shown.length === 0 ? (
        <p className="py-14 text-center font-serif italic text-lg text-stone-500">Nothing by that name.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((c) => {
            const cover = coverSrc(c.id)
            const note = noteFor(c.id)
            return (
              <div key={c.id} className="group text-center">
              <button onClick={() => onOpen(c.id)} className="block w-full text-center">
                {/* One frame, the same for every list. Letting each picture keep
                    its own proportions made a page of different-sized holes and
                    a ragged line of names; a catalogue's whole argument is that
                    the things on it are directly comparable, and that starts
                    with them being drawn the same size. */}
                <span className="mb-3 block w-full overflow-hidden bg-stone-500/5">
                  <span className="flex aspect-[3/4] w-full items-center justify-center">
                    {cover
                      ? <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                      : React.createElement(assetMarkFor(c), { size: 40, className: 'text-stone-300 transition-colors group-hover:text-stone-900' })}
                  </span>
                </span>
                <span className="block font-serif text-[15px] italic leading-tight text-stone-900">{c.label}</span>
                {note && <span className="mt-0.5 block text-[9px] tracking-[0.14em] text-stone-400">{note}</span>}
              </button>
              {/* Quiet, and under the name rather than over the picture: taking
                  a shelf down is a thing she does rarely and on purpose. */}
              <div className="mt-1.5 flex items-center justify-center gap-3 text-[9px] tracking-[0.14em]">
                {confirm === c.id ? (
                  <>
                    <button onClick={() => { onDrop(c.id); setConfirm(null) }} className="text-phase-menstrual">DELETE FOR GOOD</button>
                    <button onClick={() => setConfirm(null)} className="text-stone-400 hover:text-stone-900">KEEP</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onHide(c.id)} className="text-stone-300 transition-colors hover:text-stone-900">HIDE</button>
                    {mine.has(c.id) && (
                      <button onClick={() => setConfirm(c.id)} className="text-stone-300 transition-colors hover:text-phase-menstrual">DELETE</button>
                    )}
                  </>
                )}
              </div>
              </div>
            )
          })}
        </div>
      )}
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

// ── Putting a shelf on the wall ─────────────────────────────────────
// Two ways: one she took down and wants back, or one that was never in the
// sixty. The first is the case that matters — she cleared Maternity out of the
// Wardrobe two years ago and today she wants it there again.
function AddTopic({ group, back, onRestore, onCreate, onCancel }) {
  const [label, setLabel] = useState('')
  const go = () => { if (label.trim()) onCreate(label.trim()) }
  return (
    <div className="mx-auto max-w-xl border border-stone-900 bg-white/60 p-5">
      <p className="kicker">ADD TO {(group ? group.label : '').toUpperCase()}</p>

      {back.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-stone-500">Ones you took down</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {back.map((c) => (
              <button key={c.id} onClick={() => onRestore(c.id)} className="rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm text-stone-500">Or one of your own</p>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus={!back.length}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder="Ski · Costume · Uniform"
          className="mt-1 w-full border-b border-stone-300 bg-transparent pb-1.5 font-serif text-2xl outline-none placeholder:text-stone-300 focus:border-stone-900"
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={go} disabled={!label.trim()} className="rounded-full bg-stone-900 px-5 py-2 text-sm text-cream disabled:opacity-30">Put it up</button>
        <button onClick={onCancel} className="text-xs text-stone-500 hover:text-stone-900">Cancel</button>
      </div>
    </div>
  )
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
function ListView({ list, goals, projects, cover, onCover, coverNote, onDelete, onUpdate, onBack }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [itemQuery, setItemQuery] = useState('')
  const [dragId, setDragId] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [killing, setKilling] = useState(false)
  const coverRef = useRef(null)

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

  // The same rule as the board and the goals wall: everything the item knows
  // about itself, including the class's own fields, so a size or a brand finds
  // it as readily as its name.
  const itemText = (i) => [i.title, i.brand, i.site, i.size, i.note, ...Object.values(i.fields || {})].join(' ')
  const shown = (filter === 'all' ? list.items : list.items.filter((i) => i.status === filter))
    .filter((i) => hits(itemText(i), itemQuery))

  return (
    <div>
            {/* ── The head of a list.
          It had four bordered controls, a thumbnail and a title fighting over
          two lines of a phone, which is what congestion is. Now: the way back
          on its own line with Share opposite it; then the cover, the name and
          what the topic is actually for, in one block; then the small changes
          she rarely makes, as plain text under all of it. */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-xs tracking-[0.14em] text-stone-400 hover:text-stone-900">← ALL LISTS</button>
          <button onClick={() => setSharing(true)} className="ml-auto flex items-center gap-1.5 rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">
            <Share2 size={12} strokeWidth={1.7} /> Share
          </button>
        </div>

        <div className="mt-3 flex items-start gap-4">
          {/* The picture is the button, and the pencil sitting on its corner is
              how anyone knows that. Two text links saying Change cover and
              Remove cover were a sentence where a mark would do — and an X for
              removing it was a second mark crowding the title for something
              nobody does. Replacing a cover is how you change your mind. */}
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onCover(f) }} />
          <span className="relative block h-16 w-16 shrink-0">
            <button
              type="button"
              onClick={() => coverRef.current && coverRef.current.click()}
              aria-label={cover ? 'Change the cover' : 'Add a cover'}
              title={cover ? 'Change the cover' : 'Add a cover'}
              className="flex h-full w-full items-center justify-center overflow-hidden border border-stone-200 bg-[#EFEAE0] text-stone-900 transition-colors hover:border-stone-900"
            >
              {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : React.createElement(assetMarkFor(cls), { size: 32 })}
            </button>
            <span aria-hidden className="pointer-events-none absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center bg-stone-900 text-cream">
              <EditIcon size={16} />
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-serif text-2xl leading-tight text-stone-900">{list.label}</h2>
              {/* A list opened from a topic card is named after the topic, so
                  saying it twice on one line is just noise. */}
              {list.label.toLowerCase() !== cls.label.toLowerCase() && (
                <span className="text-[10px] tracking-[0.16em] text-stone-400">{cls.label.toUpperCase()}</span>
              )}
            </div>
            {/* What the shelf is for, in the words she would use looking for it.
                Outerwear meant nothing to her until someone said coats. */}
            {cls.about && <p className="mt-1 text-sm leading-snug text-stone-500">{cls.about}</p>}
            {/* One delete, in one place. An empty list takes its shelf off the
                wall with it, because an empty shelf she has just deleted is not
                something she wants to keep looking at; a list with things in it
                is asked about first and leaves the shelf standing. */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
              {killing ? (
                <>
                  <span className="text-stone-600">Delete {list.items.length} {list.items.length === 1 ? 'thing' : 'things'}?</span>
                  <button onClick={onDelete} className="text-oxblood underline underline-offset-2">Delete</button>
                  <button onClick={() => setKilling(false)} className="hover:text-stone-900">Keep</button>
                </>
              ) : (
                <button onClick={() => (list.items.length ? setKilling(true) : onDelete())} className="hover:text-oxblood">Delete list</button>
              )}
              {coverNote && <span className="tracking-[0.16em] text-stone-500">{coverNote}</span>}
            </div>
          </div>
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
          <SearchBar value={itemQuery} onChange={setItemQuery} label="Search this wishlist" className="mb-4" />

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
