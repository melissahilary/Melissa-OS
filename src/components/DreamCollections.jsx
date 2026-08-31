import React, { useMemo, useState } from 'react'
import { X, Plus, ExternalLink, Loader2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PILLAR_TAGS } from './DreamProjects'

const uid = () => Math.random().toString(36).slice(2, 10)
const tagMeta = (id) => PILLAR_TAGS.find((p) => p.id === id) || null

// ── Wishlist — lists of things, as things.
//
// The old version rendered pasted URLs as body text: a column of unreadable blue
// strings. A woman collecting a coat, a practitioner and a treatment is not
// keeping a to-do list, so nothing here is a checkbox and nothing is scored out
// of anything. An item is Wanted, Owned or Passed, and it looks like itself.

const TYPES = [
  { id: 'products', label: 'Products', noun: 'thing' },
  { id: 'practitioners', label: 'Practitioners', noun: 'person' },
  { id: 'places', label: 'Places', noun: 'place' },
  { id: 'treatments', label: 'Treatments', noun: 'treatment' },
  { id: 'recipes', label: 'Recipes', noun: 'recipe' },
  { id: 'books', label: 'Books', noun: 'book' },
]
const typeMeta = (id) => TYPES.find((t) => t.id === id) || TYPES[0]

const STATUS = [
  { id: 'wanted', label: 'Wanted', tint: '#A3A093' },
  { id: 'owned', label: 'Owned', tint: '#7C8B6B' },
  { id: 'passed', label: 'Passed', tint: '#C4BFB6' },
]

const isUrl = (s) => /^(https?:\/\/|www\.)\S+$/i.test(String(s).trim()) || /^[\w-]+\.[a-z]{2,}(\/\S*)?$/i.test(String(s).trim())
const money = (v) => { const n = parseFloat(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null }
const fmtMoney = (v, cur) => {
  const n = money(v)
  if (n == null) return ''
  const sym = cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : '$'
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: n % 1 ? 2 : 0 })}`
}

const normItem = (it) => ({
  id: it.id || uid(),
  title: it.title != null ? it.title : (it.text || ''),
  url: it.url || '',
  image: it.image || '',
  price: it.price || '',
  currency: it.currency || '',
  site: it.site || '',
  status: ['wanted', 'owned', 'passed'].includes(it.status) ? it.status : (it.done ? 'owned' : 'wanted'),
  pillar: it.pillar || '',
  goalId: it.goalId || '',
  projectId: it.projectId || '',
  note: it.note || '',
})

const normCollection = (c) => ({
  id: c.id || uid(),
  label: c.label || 'Untitled',
  type: TYPES.some((t) => t.id === c.type) ? c.type : 'products',
  items: Array.isArray(c.items) ? c.items.map(normItem) : [],
})

// The four lists that used to be hard-coded chapter pages, folded in on first
// open so nothing she already kept is lost.
const LEGACY = [
  { key: 'mos:dream:wishlist', label: 'Wishlist', type: 'products' },
  { key: 'mos:dream:places', label: 'Places', type: 'places' },
  { key: 'mos:dream:experiences', label: 'Experiences', type: 'places' },
  { key: 'mos:dream:people', label: 'People', type: 'practitioners' },
]

export default function DreamCollections({ goals = [], projects = [] }) {
  const [stored, setStore] = useLocalStorage('mos:dream:collections', [])
  const [migrated, setMigrated] = useLocalStorage('mos:dream:collections:migrated', '')
  const collections = useMemo(() => (Array.isArray(stored) ? stored : []).map(normCollection), [stored])
  const [openId, setOpenId] = useState(null)
  const [naming, setNaming] = useState(false)

  // Fold the old chapter lists in once.
  React.useEffect(() => {
    if (migrated) return
    const found = []
    LEGACY.forEach(({ key, label, type }) => {
      let rows = []
      try { rows = JSON.parse(window.localStorage.getItem(key) || 'null') } catch { rows = null }
      const arr = Array.isArray(rows) ? rows : []
      if (arr.length) found.push(normCollection({ label, type, items: arr.map(normItem) }))
    })
    if (found.length) setStore((prev) => [...(Array.isArray(prev) ? prev : []), ...found])
    setMigrated('done')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrated])

  const commit = (fn) => setStore((prev) => fn((Array.isArray(prev) ? prev : []).map(normCollection)))
  const addCollection = (label, type) => {
    const c = normCollection({ label, type })
    commit((arr) => [...arr, c])
    setNaming(false)
    setOpenId(c.id)
  }
  const update = (id, patch) => commit((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const remove = (id) => { commit((arr) => arr.filter((c) => c.id !== id)); setOpenId(null) }

  const open = collections.find((c) => c.id === openId) || null

  if (open) {
    return (
      <CollectionView
        collection={open}
        goals={goals}
        projects={projects}
        onUpdate={(patch) => update(open.id, patch)}
        onRemove={() => remove(open.id)}
        onBack={() => setOpenId(null)}
      />
    )
  }

  return (
    <div>
      <button onClick={() => setNaming(true)} className="mb-5 flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-stone-900">
        <Plus size={14} strokeWidth={1.8} /> New list
      </button>

      {naming && <NameSheet onCreate={addCollection} onClose={() => setNaming(false)} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => {
          const wanted = c.items.filter((i) => i.status === 'wanted')
          const total = wanted.reduce((n, i) => n + (money(i.price) || 0), 0)
          const covers = c.items.filter((i) => i.image).slice(0, 3)
          return (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="overflow-hidden rounded-2xl border border-stone-200 bg-white/50 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-24 gap-px bg-stone-100">
                {covers.length
                  ? covers.map((i) => <img key={i.id} src={i.image} alt="" className="h-full flex-1 object-cover" />)
                  : <span className="flex h-full w-full items-center justify-center text-[11px] text-stone-300">{typeMeta(c.type).label}</span>}
              </div>
              <div className="p-4">
                <p className="font-serif text-lg text-stone-900">{c.label}</p>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  {c.items.length} {c.items.length === 1 ? typeMeta(c.type).noun : `${typeMeta(c.type).noun}s`}
                  {total > 0 ? ` · ${fmtMoney(total, (wanted[0] || {}).currency)}` : ''}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NameSheet({ onCreate, onClose }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState('products')
  return (
    <div className="mb-5 rounded-2xl border border-stone-900 bg-white/60 p-5">
      <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus placeholder="What are you keeping a list of?" className="w-full border-b border-stone-300 bg-transparent pb-1.5 font-serif text-xl outline-none placeholder:text-stone-300 focus:border-stone-900" />
      <p className="kicker mb-2 mt-5 text-stone-400">Of what</p>
      <div className="flex flex-wrap gap-1.5">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${type === t.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600'}`}>{t.label}</button>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => label.trim() && onCreate(label.trim(), type)} disabled={!label.trim()} className="rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-30">Create</button>
        <button onClick={onClose} className="text-xs text-stone-400 hover:text-stone-700">Cancel</button>
      </div>
    </div>
  )
}

// ── One collection ──────────────────────────────────────────────────
function CollectionView({ collection: c, goals, projects, onUpdate, onRemove, onBack }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')

  const setItems = (fn) => onUpdate({ items: fn(c.items) })
  const patch = (id, p) => setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...p } : i)))
  const drop = (id) => setItems((arr) => arr.filter((i) => i.id !== id))

  // A pasted URL never renders as a URL. It is resolved first, and if the
  // resolver can't reach the page the item still arrives — named by its host,
  // with the link intact.
  const addFromDraft = async () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    if (!isUrl(t)) {
      setItems((arr) => [normItem({ title: t }), ...arr])
      return
    }
    const id = uid()
    const host = t.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0]
    setItems((arr) => [normItem({ id, title: host, url: /^https?:\/\//i.test(t) ? t : `https://${t}`, site: host }), ...arr])
    setBusy(true)
    try {
      const r = await fetch('/api/unfurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: t }) })
      const d = await r.json()
      if (d && !d.error) {
        patch(id, { title: d.title || host, image: d.image || '', price: d.price || '', currency: d.currency || '', site: d.site || host, url: d.url || t })
      }
    } catch { /* the item is already there; it just keeps its hostname */ }
    setBusy(false)
  }

  const shown = filter === 'all' ? c.items : c.items.filter((i) => i.status === filter)
  const wanted = c.items.filter((i) => i.status === 'wanted')
  const total = wanted.reduce((n, i) => n + (money(i.price) || 0), 0)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline gap-3">
        <button onClick={onBack} className="text-xs tracking-[0.14em] text-stone-400 hover:text-stone-900">← ALL LISTS</button>
        <h2 className="font-serif text-2xl text-stone-900">{c.label}</h2>
        <span className="text-[11px] tracking-[0.14em] text-stone-400">{typeMeta(c.type).label.toUpperCase()}</span>
        {total > 0 && <span className="ml-auto text-[11px] tabular-nums text-stone-400">{fmtMoney(total, (wanted[0] || {}).currency)} wanted</span>}
      </div>

      <div className="mb-5 flex items-center gap-2.5 border-b border-stone-200 pb-1.5 focus-within:border-stone-900">
        <Plus size={14} className="shrink-0 text-stone-300" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFromDraft()}
          placeholder="Paste a link, or write it"
          className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-300"
        />
        {busy && <Loader2 size={14} className="shrink-0 animate-spin text-stone-300" />}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ id: 'all', label: 'All' }, ...STATUS].map((s) => (
          <button key={s.id} onClick={() => setFilter(s.id)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${filter === s.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500 hover:border-stone-400'}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((it) => (
          <Item key={it.id} item={it} goals={goals} projects={projects} onPatch={(p) => patch(it.id, p)} onDrop={() => drop(it.id)} />
        ))}
      </div>

      <button onClick={onRemove} className="mt-8 text-xs text-stone-400 hover:text-phase-menstrual">Delete this list</button>
    </div>
  )
}

function Item({ item: it, goals, projects, onPatch, onDrop }) {
  const [open, setOpen] = useState(false)
  const st = STATUS.find((s) => s.id === it.status) || STATUS[0]
  const tag = tagMeta(it.pillar)

  return (
    <div className={`group overflow-hidden rounded-2xl border bg-white/50 transition-opacity ${it.status === 'passed' ? 'border-stone-200 opacity-50' : 'border-stone-200'}`}>
      {it.image && (
        <a href={it.url || undefined} target="_blank" rel="noreferrer" className="block h-36 w-full overflow-hidden bg-stone-100">
          <img src={it.image} alt="" className="h-full w-full object-cover" />
        </a>
      )}
      <div className="p-3.5">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm leading-snug text-stone-800">{it.title || 'Untitled'}</p>
          <button onClick={onDrop} className="shrink-0 text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={13} /></button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {it.price && <span className="font-serif text-base text-stone-900">{fmtMoney(it.price, it.currency)}</span>}
          {it.site && (
            <a href={it.url || undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700">
              {it.site}<ExternalLink size={9} />
            </a>
          )}
          {tag && (
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-500/5 px-2 py-0.5 text-[10px] text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tag.tint }} />{tag.label}
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-1">
          {STATUS.map((s) => (
            <button
              key={s.id}
              onClick={() => onPatch({ status: s.id })}
              className={`rounded-full px-2.5 py-1 text-[10px] tracking-[0.1em] transition-colors ${it.status === s.id ? 'text-cream' : 'text-stone-400 hover:text-stone-700'}`}
              style={it.status === s.id ? { background: s.tint } : undefined}
            >
              {s.label.toUpperCase()}
            </button>
          ))}
          <button onClick={() => setOpen((o) => !o)} className="ml-auto text-[10px] tracking-[0.1em] text-stone-300 hover:text-stone-700">
            {open ? 'LESS' : 'MORE'}
          </button>
        </div>

        {open && (
          <div className="mt-3 space-y-2.5 border-t border-stone-100 pt-3">
            <div className="flex flex-wrap gap-1">
              {PILLAR_TAGS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPatch({ pillar: it.pillar === t.id ? '' : t.id })}
                  className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${it.pillar === t.id ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-200 text-stone-500'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Send it somewhere it can actually be worked on. */}
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
            <input
              value={it.note}
              onChange={(e) => onPatch({ note: e.target.value })}
              placeholder="note"
              className="w-full border-b border-stone-200 bg-transparent pb-1 text-xs outline-none placeholder:text-stone-300 focus:border-stone-900"
            />
          </div>
        )}
      </div>
    </div>
  )
}
