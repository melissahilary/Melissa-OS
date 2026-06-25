import React, { useMemo, useState } from 'react'
import { Plus, X, Trash2, Pin, Search, Check, CalendarPlus, ChevronLeft } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PHASES } from '../lib/cycle'
import { dateKey, parseKey } from '../lib/date'

const uid = () => Math.random().toString(36).slice(2, 10)

// ── Taxonomy ────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'nutrition', label: 'Nutrition', def: 'Shots, drinks, foods and recipes you consume intentionally' },
  { id: 'skincare', label: 'Skincare', def: 'Your daily AM and PM product routine in order' },
  { id: 'facial', label: 'Facial Care', def: 'Masks, treatments and ingredients applied to the face' },
  { id: 'haircare', label: 'Haircare', def: 'Masks, oils, treatments and steps for the hair and scalp' },
  { id: 'body', label: 'Body Care', def: 'Scrubs, oils, lotions and body treatment steps' },
  { id: 'fitness', label: 'Fitness', def: 'Workouts, movement, exercises, sets, reps and flow practices' },
  { id: 'aesthetics', label: 'Aesthetics', def: 'At-home tools, devices and enhancement steps' },
  { id: 'supplements', label: 'Supplements', def: 'Vitamins, peptides, compounds, doses and timing' },
  { id: 'wellness', label: 'Wellness Practices', def: 'Breathwork, meditation, journaling, energy work, rituals, rest practices' },
  { id: 'treatments', label: 'Treatments', def: 'Professional or at-home physical treatments: facials, laser, massage, gua sha, beauty treatments' },
  { id: 'appointments', label: 'Appointments', def: 'Recurring professional relationships: therapy, coaching, acupuncture, doctors' },
]
const ALL_DEF = 'Every protocol across all categories'
const CAT_IDS = CATEGORIES.map((c) => c.id)
const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || {}).label || id
const catDef = (id) => (CATEGORIES.find((c) => c.id === id) || {}).def || ''

const PHASE_OPTS = [
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
  { id: 'menstrual', label: 'Menstrual' },
  { id: 'any', label: 'Any' },
]
const TOD_OPTS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'any', label: 'Any' },
]
const FREQ_OPTS = [
  { id: 'daily', label: 'Daily' },
  { id: '2x', label: '2x Week' },
  { id: '3x', label: '3x Week' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'asneeded', label: 'As Needed' },
]
const STATUS_OPTS = [
  { id: 'active', label: 'Active', color: '#6B8E5A' },
  { id: 'paused', label: 'Paused', color: '#C9A961' },
  { id: 'archived', label: 'Archived', color: '#A8A29E' },
]
const freqLabel = (id) => (FREQ_OPTS.find((o) => o.id === id) || {}).label || id
const statusColor = (id) => (STATUS_OPTS.find((o) => o.id === id) || {}).color || '#A8A29E'

const WEEKDAYS = [
  { d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' }, { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' },
]
const UNITS = ['', 'cup', 'tbsp', 'tsp', 'oz', 'g', 'mg', 'ml', 'L', 'piece', 'drop', 'pump', 'scoop', 'to taste']

// Migrate the original named records into the right category.
const NAME_CATEGORY = {
  'olive oil shot': 'nutrition',
  'anti aging gelatin gummies': 'nutrition',
  'tomatoe shot': 'nutrition',
  'vitamin stack': 'supplements',
  'am skincare': 'skincare',
  'pm skincare': 'skincare',
  'peptide stack': 'supplements',
}

// Normalize a stored protocol; restores older recipe-shaped records and migrates
// the known names into categories, preserving prep/notes and all legacy fields.
const norm = (p) => {
  const title = p.title || p.name || ''
  const mapped = NAME_CATEGORY[title.trim().toLowerCase()]
  const category = p.category && CAT_IDS.includes(p.category) ? p.category : mapped || 'nutrition'
  return {
    ...p,
    id: p.id || uid(),
    title,
    category,
    phases: Array.isArray(p.phases) ? p.phases : [],
    timeOfDay: p.timeOfDay || 'any',
    frequency: p.frequency || 'daily',
    days: Array.isArray(p.days) ? p.days : [],
    series: p.series || (p.startDate ? 'series' : 'onetime'),
    startDate: p.startDate || '',
    endDate: p.endDate || '',
    noEndDate: p.noEndDate != null ? p.noEndDate : !p.endDate,
    status: p.status || 'active',
    pinned: !!p.pinned,
    lastCompleted: p.lastCompleted || '',
    notes: p.notes || p.prep || '',
  }
}

const blank = (category = 'nutrition') => ({
  id: uid(), title: '', category, phases: [], timeOfDay: 'any',
  frequency: 'daily', days: [], series: 'onetime', startDate: '', endDate: '', noEndDate: true,
  status: 'active', pinned: false, lastCompleted: '', notes: '',
})

// ── Root ────────────────────────────────────────────────────────────
export default function Protocols() {
  const [stored, setProtocols] = useLocalStorage('mos:menu:recipes', [])
  const protocols = useMemo(() => (Array.isArray(stored) ? stored.map(norm) : []), [stored])
  const [, setEvents] = useLocalStorage('mos:today:events', {})

  const [view, setView] = useState('landing') // 'landing' | 'all' | <categoryId>
  const [search, setSearch] = useState('')
  const [fPhase, setFPhase] = useState(null)
  const [fFreq, setFFreq] = useState(null)
  const [fTod, setFTod] = useState(null)
  const [fStatus, setFStatus] = useState(null)
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [editing, setEditing] = useState(null)

  const save = (p) => {
    setProtocols((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const exists = list.some((r) => r.id === p.id)
      return exists ? list.map((r) => (r.id === p.id ? p : r)) : [...list, p]
    })
    setEditing(null)
  }
  const remove = (id) => {
    setProtocols((prev) => (Array.isArray(prev) ? prev : []).filter((r) => r.id !== id))
    setEditing(null)
  }
  const togglePin = (id) =>
    setProtocols((prev) => (Array.isArray(prev) ? prev : []).map((r) => (r.id === id ? { ...norm(r), pinned: !norm(r).pinned } : r)))

  const addToCalendar = (p) => {
    const today = new Date()
    const base = p.series === 'series' && p.startDate ? p.startDate : dateKey(today)
    const part = ['morning', 'afternoon', 'evening'].includes(p.timeOfDay) ? p.timeOfDay : 'morning'
    const end = p.series === 'series' && !p.noEndDate && p.endDate ? p.endDate : ''
    const title = p.title || 'Untitled protocol'
    const make = (k, frequency, days) => ({
      key: k,
      ev: { id: uid(), title, time: '', part, description: p.notes || '', attendees: '', frequency, days: days || [], endDate: end, done: false },
    })
    const additions = []
    if (p.frequency === 'daily') additions.push(make(base, 'daily', []))
    else if (p.frequency === 'monthly') additions.push(make(base, 'monthly', []))
    else if (p.frequency === 'yearly') additions.push(make(base, 'yearly', []))
    else if (p.frequency === 'quarterly' || p.frequency === 'asneeded') additions.push(make(base, 'once', []))
    else {
      const evFreq = p.frequency === 'biweekly' ? 'biweekly' : 'weekly'
      const days = p.days && p.days.length ? p.days : [parseKey(base).getDay()]
      days.forEach((dow) => {
        const d = parseKey(base)
        d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7))
        additions.push(make(dateKey(d), evFreq, [dow]))
      })
    }
    setEvents((prev) => {
      const next = { ...prev }
      additions.forEach(({ key, ev }) => { next[key] = [...(next[key] || []), ev] })
      return next
    })
  }

  const matchFilters = (p) => {
    if (fPhase && !(p.phases.includes(fPhase) || p.phases.includes('any'))) return false
    if (fFreq && p.frequency !== fFreq) return false
    if (fTod && p.timeOfDay !== fTod) return false
    if (fStatus && p.status !== fStatus) return false
    if (pinnedOnly && !p.pinned) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!`${p.title} ${p.notes} ${catLabel(p.category)}`.toLowerCase().includes(q)) return false
    }
    return true
  }

  const sortPinned = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)

  const openModal = (p) => setEditing(p)

  // ── Landing ──
  if (view === 'landing') {
    const results = search.trim() ? protocols.filter(matchFilters).sort(sortPinned) : null
    return (
      <section className="mb-10">
        <div className="mb-6">
          <SearchBox value={search} onChange={setSearch} />
        </div>

        {results ? (
          <>
            <div className="mb-2 flex justify-end"><span className="text-sm text-stone-400">{results.length} found</span></div>
            {results.length === 0 ? (
              <p className="font-serif italic text-lg text-stone-400">Nothing matches that search.</p>
            ) : (
              <CardGrid items={results} onOpen={openModal} onPin={togglePin} showCategory />
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CategoryCard label="All" def={ALL_DEF} count={protocols.length} onClick={() => setView('all')} />
            {CATEGORIES.map((c) => (
              <CategoryCard
                key={c.id}
                label={c.label}
                def={c.def}
                count={protocols.filter((p) => p.category === c.id).length}
                onClick={() => setView(c.id)}
              />
            ))}
          </div>
        )}

        {editing && (
          <ProtocolModal protocol={editing} isNew={!protocols.some((r) => r.id === editing.id)} onClose={() => setEditing(null)} onSave={save} onDelete={remove} onAddToCalendar={addToCalendar} />
        )}
      </section>
    )
  }

  // ── All / category view ──
  const inCat = view !== 'all'
  const list = (inCat ? protocols.filter((p) => p.category === view) : protocols).filter(matchFilters).sort(sortPinned)

  return (
    <section className="mb-10">
      <button onClick={() => setView('landing')} className="mb-5 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors">
        <ChevronLeft size={16} /> All categories
      </button>

      <div className="mb-6">
        <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">{inCat ? catLabel(view) : 'All'}</h2>
        <p className="mt-1 text-sm text-stone-500">{inCat ? catDef(view) : ALL_DEF}</p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        <aside className="w-full shrink-0 md:w-48">
          <div className="mb-5"><SearchBox value={search} onChange={setSearch} small /></div>
          <FilterGroup title="Phase" options={PHASE_OPTS} active={fPhase} onPick={setFPhase} phaseColors />
          <FilterGroup title="Frequency" options={FREQ_OPTS} active={fFreq} onPick={setFFreq} />
          <FilterGroup title="Time of Day" options={TOD_OPTS} active={fTod} onPick={setFTod} />
          <FilterGroup title="Status" options={STATUS_OPTS} active={fStatus} onPick={setFStatus} />
          <div className="mb-5">
            <p className="kicker text-stone-400 mb-2">Pinned</p>
            <button
              onClick={() => setPinnedOnly((v) => !v)}
              className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${pinnedOnly ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-700'}`}
              style={pinnedOnly ? { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: '#a8a29e' } : undefined}
            >
              Show pinned only
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-3 flex items-center justify-end gap-4">
            <span className="text-sm text-stone-400">{list.length} on file</span>
            <button onClick={() => setEditing(blank(inCat ? view : 'nutrition'))} className="flex items-center gap-1.5 bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700">
              <Plus size={15} /> New protocol
            </button>
          </div>

          {list.length === 0 ? (
            <p className="font-serif italic text-lg text-stone-400">Nothing here yet.</p>
          ) : (
            <CardGrid items={list} onOpen={openModal} onPin={togglePin} showCategory={!inCat} />
          )}
        </div>
      </div>

      {editing && (
        <ProtocolModal protocol={editing} isNew={!protocols.some((r) => r.id === editing.id)} onClose={() => setEditing(null)} onSave={save} onDelete={remove} onAddToCalendar={addToCalendar} />
      )}
    </section>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────
function SearchBox({ value, onChange, small }) {
  return (
    <div className="flex items-center gap-2 border-b border-stone-300 pb-1.5">
      <Search size={small ? 14 : 16} className="text-stone-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search protocols"
        className={`w-full bg-transparent outline-none ${small ? 'text-sm' : ''} placeholder-stone-300`}
      />
      {value && <button onClick={() => onChange('')} className="text-stone-300 hover:text-stone-700"><X size={14} /></button>}
    </div>
  )
}

function CategoryCard({ label, def, count, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start border border-stone-200 bg-white/40 p-5 text-left transition-shadow hover:shadow-md">
      <div className="flex w-full items-baseline justify-between">
        <h3 className="font-serif text-2xl text-stone-900">{label}</h3>
        <span className="text-xs text-stone-400">{count}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">{def}</p>
    </button>
  )
}

function FilterGroup({ title, options, active, onPick, phaseColors }) {
  return (
    <div className="mb-5">
      <p className="kicker text-stone-400 mb-2">{title}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((o) => {
          const on = active === o.id
          const underline = phaseColors ? PHASES[o.id]?.color || '#a8a29e' : '#a8a29e'
          return (
            <button
              key={o.id}
              onClick={() => onPick(on ? null : o.id)}
              className={`text-[11px] uppercase tracking-[0.16em] transition-colors ${on ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-700'}`}
              style={on ? { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: underline } : undefined}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CardGrid({ items, onOpen, onPin, showCategory }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <ProtocolCard key={p.id} protocol={p} onOpen={() => onOpen(p)} onPin={() => onPin(p.id)} showCategory={showCategory} />
      ))}
    </div>
  )
}

function ProtocolCard({ protocol, onOpen, onPin, showCategory }) {
  const preview = (protocol.notes || '').split('\n').find((l) => l.trim()) || ''
  return (
    <div className="relative border border-stone-200 bg-white/40 p-4 transition-shadow hover:shadow-md">
      <button
        onClick={(e) => { e.stopPropagation(); onPin() }}
        className={`absolute right-3 top-3 ${protocol.pinned ? 'text-stone-900' : 'text-stone-300 hover:text-stone-600'}`}
        title={protocol.pinned ? 'Unpin' : 'Pin'}
      >
        <Pin size={15} fill={protocol.pinned ? 'currentColor' : 'none'} />
      </button>
      <button onClick={onOpen} className="flex w-full flex-col items-start text-left">
        <div className="flex items-center gap-2 pr-6">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusColor(protocol.status) }} />
          <h3 className="font-serif text-xl text-stone-900">{protocol.title || 'Untitled'}</h3>
        </div>
        {preview ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-500">{preview}</p>
        ) : (
          <p className="mt-2 text-sm italic text-stone-300">No notes yet.</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {showCategory && <span className="border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">{catLabel(protocol.category)}</span>}
          <span className="border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-600">{freqLabel(protocol.frequency)}</span>
          {protocol.phases.filter((x) => x !== 'any').map((id) => (
            <span key={id} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-stone-500">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PHASES[id]?.color }} />
              {(PHASE_OPTS.find((o) => o.id === id) || {}).label}
            </span>
          ))}
        </div>
      </button>
    </div>
  )
}

// ── Reusable field bits ─────────────────────────────────────────────
const labelCls = 'kicker text-stone-400 mb-2 block'
const lineCls = 'w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900'

function TextLine({ label, value, onChange, placeholder }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={lineCls} />
    </div>
  )
}
function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full min-h-[90px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
    </div>
  )
}
function SelectLine({ label, value, onChange, options }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={lineCls}>
        {options.map((o) => {
          const id = typeof o === 'string' ? o : o.id
          const lab = typeof o === 'string' ? o : o.label
          return <option key={id} value={id}>{lab}</option>
        })}
      </select>
    </div>
  )
}
function DateLine({ label, value, onChange }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
    </div>
  )
}
function SegToggle({ label, value, onChange, options }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const id = typeof o === 'string' ? o : o.id
          const lab = typeof o === 'string' ? o : o.label
          const on = value === id
          return (
            <button key={id} type="button" onClick={() => onChange(id)} className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{lab}</button>
          )
        })}
      </div>
    </div>
  )
}

// Generic editor for a list of typed rows (ingredients, steps, products, exercises).
function RowList({ label, value, onChange, fields, numbered, addLabel = 'Add' }) {
  const items = Array.isArray(value) ? value : []
  const add = () => onChange([...items, fields.reduce((o, f) => ({ ...o, [f.key]: f.def || '' }), { id: uid() })])
  const upd = (id, patch) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const del = (id) => onChange(items.filter((it) => it.id !== id))
  const cell = (f, it) =>
    f.type === 'select' ? (
      <select key={f.key} value={it[f.key] || ''} onChange={(e) => upd(it.id, { [f.key]: e.target.value })} className={`${f.width} bg-transparent border-b border-stone-300 pb-0.5 text-sm outline-none focus:border-stone-900`}>
        {f.options.map((u) => <option key={u} value={u}>{u || f.placeholder || '—'}</option>)}
      </select>
    ) : (
      <input key={f.key} type={f.type || 'text'} value={it[f.key] || ''} placeholder={f.placeholder} onChange={(e) => upd(it.id, { [f.key]: e.target.value })} className={`${f.width} bg-transparent border-b border-stone-300 pb-0.5 text-sm outline-none focus:border-stone-900`} />
    )
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={it.id} className="flex items-center gap-2">
            {numbered && <span className="w-5 shrink-0 text-xs text-stone-400">{idx + 1}.</span>}
            {fields.map((f) => cell(f, it))}
            <button onClick={() => del(it.id)} className="shrink-0 text-stone-300 hover:text-stone-700"><X size={14} /></button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900"><Plus size={13} /> {addLabel}</button>
    </div>
  )
}

// ── Category-specific section ───────────────────────────────────────
function CategoryFields({ draft, set }) {
  const c = draft.category
  if (c === 'nutrition') return (
    <>
      <RowList label="Ingredients" value={draft.ingredients} onChange={(v) => set('ingredients', v)} addLabel="Add ingredient"
        fields={[{ key: 'name', placeholder: 'Ingredient', width: 'flex-1' }, { key: 'amount', placeholder: 'Amt', width: 'w-16 text-right' }, { key: 'unit', type: 'select', options: UNITS, width: 'w-24', placeholder: 'unit' }]} />
      <RowList label="Prep steps" value={draft.prepSteps} onChange={(v) => set('prepSteps', v)} numbered addLabel="Add step" fields={[{ key: 'text', placeholder: 'Step', width: 'flex-1' }]} />
      <TextLine label="Timing (when to consume)" value={draft.timing} onChange={(v) => set('timing', v)} placeholder="e.g. first thing, empty stomach" />
    </>
  )
  if (c === 'skincare') return (
    <>
      <RowList label="Products in order" value={draft.products} onChange={(v) => set('products', v)} numbered addLabel="Add product"
        fields={[{ key: 'name', placeholder: 'Product', width: 'flex-1' }, { key: 'brand', placeholder: 'Brand', width: 'w-24' }, { key: 'amount', placeholder: 'Amt', width: 'w-16' }]} />
      <SegToggle label="AM / PM" value={draft.amPm || 'both'} onChange={(v) => set('amPm', v)} options={[{ id: 'am', label: 'AM' }, { id: 'pm', label: 'PM' }, { id: 'both', label: 'Both' }]} />
      <RowList label="Steps" value={draft.steps} onChange={(v) => set('steps', v)} numbered addLabel="Add step" fields={[{ key: 'text', placeholder: 'Step', width: 'flex-1' }]} />
    </>
  )
  if (c === 'facial') return (
    <>
      <RowList label="Ingredients" value={draft.ingredients} onChange={(v) => set('ingredients', v)} addLabel="Add ingredient" fields={[{ key: 'name', placeholder: 'Ingredient', width: 'flex-1' }, { key: 'amount', placeholder: 'Amt', width: 'w-20' }]} />
      <RowList label="Steps (wait min after each)" value={draft.steps} onChange={(v) => set('steps', v)} numbered addLabel="Add step" fields={[{ key: 'text', placeholder: 'Step', width: 'flex-1' }, { key: 'wait', type: 'number', placeholder: 'min', width: 'w-14' }]} />
      <TextLine label="Treatment frequency note" value={draft.treatmentFreq} onChange={(v) => set('treatmentFreq', v)} />
    </>
  )
  if (c === 'haircare') return (
    <>
      <RowList label="Ingredients" value={draft.ingredients} onChange={(v) => set('ingredients', v)} addLabel="Add ingredient" fields={[{ key: 'name', placeholder: 'Ingredient', width: 'flex-1' }, { key: 'amount', placeholder: 'Amt', width: 'w-20' }]} />
      <RowList label="Steps (wait min after each)" value={draft.steps} onChange={(v) => set('steps', v)} numbered addLabel="Add step" fields={[{ key: 'text', placeholder: 'Step', width: 'flex-1' }, { key: 'wait', type: 'number', placeholder: 'min', width: 'w-14' }]} />
      <SegToggle label="Rinse" value={draft.rinse || 'rinse'} onChange={(v) => set('rinse', v)} options={[{ id: 'rinse', label: 'Rinse' }, { id: 'norinse', label: 'No-rinse' }]} />
      <TextLine label="Hair type notes" value={draft.hairType} onChange={(v) => set('hairType', v)} />
    </>
  )
  if (c === 'body') return (
    <>
      <RowList label="Ingredients" value={draft.ingredients} onChange={(v) => set('ingredients', v)} addLabel="Add ingredient" fields={[{ key: 'name', placeholder: 'Ingredient', width: 'flex-1' }, { key: 'amount', placeholder: 'Amt', width: 'w-20' }]} />
      <RowList label="Steps" value={draft.steps} onChange={(v) => set('steps', v)} numbered addLabel="Add step" fields={[{ key: 'text', placeholder: 'Step', width: 'flex-1' }]} />
      <TextLine label="Application method" value={draft.applicationMethod} onChange={(v) => set('applicationMethod', v)} />
      <SegToggle label="Rinse" value={draft.rinse || 'rinse'} onChange={(v) => set('rinse', v)} options={[{ id: 'rinse', label: 'Rinse' }, { id: 'norinse', label: 'No-rinse' }]} />
    </>
  )
  if (c === 'fitness') return (
    <>
      <SegToggle label="Type" value={draft.fitnessType || 'structured'} onChange={(v) => set('fitnessType', v)} options={[{ id: 'structured', label: 'Structured' }, { id: 'flow', label: 'Flow-based' }]} />
      {(draft.fitnessType || 'structured') === 'flow' ? (
        <>
          <TextLine label="Duration" value={draft.duration} onChange={(v) => set('duration', v)} placeholder="e.g. 30 min" />
          <TextLine label="Style" value={draft.flowStyle} onChange={(v) => set('flowStyle', v)} placeholder="e.g. vinyasa, freeform" />
        </>
      ) : (
        <>
          <RowList label="Exercises" value={draft.exercises} onChange={(v) => set('exercises', v)} addLabel="Add exercise"
            fields={[{ key: 'name', placeholder: 'Exercise', width: 'flex-1' }, { key: 'sets', placeholder: 'Sets', width: 'w-12' }, { key: 'reps', placeholder: 'Reps', width: 'w-12' }, { key: 'weight', placeholder: 'Wt', width: 'w-12' }, { key: 'rest', placeholder: 'Rest', width: 'w-14' }]} />
          <TextLine label="Duration" value={draft.duration} onChange={(v) => set('duration', v)} placeholder="e.g. 45 min" />
        </>
      )}
    </>
  )
  if (c === 'aesthetics') return (
    <>
      <TextLine label="Tool or product name" value={draft.toolName} onChange={(v) => set('toolName', v)} />
      <RowList label="Steps (duration per step)" value={draft.steps} onChange={(v) => set('steps', v)} numbered addLabel="Add step" fields={[{ key: 'text', placeholder: 'Step', width: 'flex-1' }, { key: 'wait', placeholder: 'mins', width: 'w-16' }]} />
      <TextLine label="Frequency note" value={draft.treatmentFreq} onChange={(v) => set('treatmentFreq', v)} />
    </>
  )
  if (c === 'supplements') return (
    <>
      <TextLine label="Compound name" value={draft.compound} onChange={(v) => set('compound', v)} />
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <div className="w-24"><TextLine label="Dose" value={draft.dose} onChange={(v) => set('dose', v)} /></div>
        <div className="w-28"><SelectLine label="Unit" value={draft.doseUnit || 'mg'} onChange={(v) => set('doseUnit', v)} options={['mg', 'mcg', 'g', 'ml', 'IU']} /></div>
      </div>
      <SelectLine label="Timing" value={draft.suppTiming || 'AM'} onChange={(v) => set('suppTiming', v)} options={['AM', 'PM', 'With food', 'Before bed', 'Other']} />
      <TextLine label="Cycle length" value={draft.cycleLength} onChange={(v) => set('cycleLength', v)} placeholder="e.g. 8 weeks on, 4 off" />
      <TextArea label="Stack notes" value={draft.stackNotes} onChange={(v) => set('stackNotes', v)} />
      <TextLine label="Provider or source" value={draft.provider} onChange={(v) => set('provider', v)} />
    </>
  )
  if (c === 'wellness') return (
    <>
      <SelectLine label="Practice type" value={draft.practiceType || 'Breathwork'} onChange={(v) => set('practiceType', v)} options={['Breathwork', 'Meditation', 'Journaling', 'Energy Work', 'Ritual', 'Rest', 'Other']} />
      <RowList label="Steps" value={draft.steps} onChange={(v) => set('steps', v)} numbered addLabel="Add step" fields={[{ key: 'text', placeholder: 'Step', width: 'flex-1' }]} />
      <TextLine label="Duration" value={draft.duration} onChange={(v) => set('duration', v)} placeholder="e.g. 10 min" />
      <TextArea label="Prompts (for journaling)" value={draft.prompts} onChange={(v) => set('prompts', v)} />
      <TextLine label="Tools or materials needed" value={draft.materials} onChange={(v) => set('materials', v)} />
    </>
  )
  if (c === 'treatments') return (
    <>
      <TextLine label="Treatment name" value={draft.treatmentName} onChange={(v) => set('treatmentName', v)} />
      <SegToggle label="Where" value={draft.atHome || 'athome'} onChange={(v) => set('atHome', v)} options={[{ id: 'athome', label: 'At-home' }, { id: 'provider', label: 'With provider' }]} />
      {draft.atHome === 'provider' && (
        <>
          <TextLine label="Provider name" value={draft.providerName} onChange={(v) => set('providerName', v)} />
          <TextLine label="Provider contact" value={draft.providerContact} onChange={(v) => set('providerContact', v)} />
        </>
      )}
      <TextArea label="Pre-care instructions" value={draft.preCare} onChange={(v) => set('preCare', v)} />
      <TextArea label="Post-care instructions" value={draft.postCare} onChange={(v) => set('postCare', v)} />
      <TextLine label="Downtime" value={draft.downtime} onChange={(v) => set('downtime', v)} />
      <DateLine label="Next appointment date" value={draft.nextAppt} onChange={(v) => set('nextAppt', v)} />
    </>
  )
  if (c === 'appointments') return (
    <>
      <TextLine label="Provider name" value={draft.apptProvider} onChange={(v) => set('apptProvider', v)} />
      <SelectLine label="Provider type" value={draft.providerKind || 'Therapist'} onChange={(v) => set('providerKind', v)} options={['Therapist', 'Coach', 'Acupuncturist', 'Doctor', 'Dentist', 'Other']} />
      <TextLine label="Contact info" value={draft.contactInfo} onChange={(v) => set('contactInfo', v)} />
      <TextArea label="Session notes" value={draft.sessionNotes} onChange={(v) => set('sessionNotes', v)} />
      <DateLine label="Next appointment date" value={draft.nextAppt} onChange={(v) => set('nextAppt', v)} />
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={!!draft.recurringReminder} onChange={(e) => set('recurringReminder', e.target.checked)} />
        Recurring reminder
      </label>
    </>
  )
  return null
}

// ── Detail modal ────────────────────────────────────────────────────
function ProtocolModal({ protocol, isNew, onClose, onSave, onDelete, onAddToCalendar }) {
  const [draft, setDraft] = useState(() => ({ ...blank(protocol.category), ...protocol, phases: [...(protocol.phases || [])], days: [...(protocol.days || [])] }))
  const [added, setAdded] = useState(false)
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const togglePhase = (id) => setDraft((d) => ({ ...d, phases: d.phases.includes(id) ? d.phases.filter((x) => x !== id) : [...d.phases, id] }))
  const toggleDay = (n) => setDraft((d) => ({ ...d, days: d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n] }))
  const showDays = draft.frequency !== 'daily' && draft.frequency !== 'asneeded'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xl bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Protocol name" autoFocus className="w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none" />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-6 py-5 space-y-6">
          <SelectLine label="Category" value={draft.category} onChange={(v) => set('category', v)} options={CATEGORIES} />

          {/* Phase */}
          <div>
            <span className={labelCls}>Phase</span>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_OPTS.map((o) => {
                const on = draft.phases.includes(o.id)
                const color = PHASES[o.id]?.color
                return (
                  <button key={o.id} type="button" onClick={() => togglePhase(o.id)} className="flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors"
                    style={on ? (color ? { backgroundColor: color, color: PHASES[o.id].ink, borderColor: color } : { backgroundColor: '#1c1917', color: '#FAFAF7', borderColor: '#1c1917' }) : { borderColor: '#d6d3d1', color: '#57534e' }}>
                    {color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time of day + Frequency */}
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <div className="min-w-[140px] flex-1"><SelectLine label="Time of Day" value={draft.timeOfDay} onChange={(v) => set('timeOfDay', v)} options={TOD_OPTS} /></div>
            <div className="min-w-[140px] flex-1"><SelectLine label="Frequency" value={draft.frequency} onChange={(v) => set('frequency', v)} options={FREQ_OPTS} /></div>
          </div>

          {/* Days of week */}
          {showDays && (
            <div>
              <span className={labelCls}>Days of Week</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const on = draft.days.includes(w.d)
                  return <button key={w.d} type="button" onClick={() => toggleDay(w.d)} className={`px-2.5 py-1 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{w.label}</button>
                })}
              </div>
            </div>
          )}

          {/* Series */}
          <div>
            <span className={labelCls}>Series</span>
            <div className="flex items-center gap-4 text-sm text-stone-700">
              <label className="flex items-center gap-1.5"><input type="radio" name="series" checked={draft.series === 'onetime'} onChange={() => set('series', 'onetime')} /> One-time</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="series" checked={draft.series === 'series'} onChange={() => set('series', 'series')} /> Series</label>
            </div>
            {draft.series === 'series' && (
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
                <DateLine label="Start date" value={draft.startDate} onChange={(v) => set('startDate', v)} />
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-xs text-stone-500"><input type="checkbox" checked={draft.noEndDate} onChange={(e) => set('noEndDate', e.target.checked)} /> No end date</label>
                  {!draft.noEndDate && <input type="date" value={draft.endDate} onChange={(e) => set('endDate', e.target.value)} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />}
                </div>
              </div>
            )}
          </div>

          {/* Status + Pinned + Last completed */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="min-w-[120px]"><SelectLine label="Status" value={draft.status} onChange={(v) => set('status', v)} options={STATUS_OPTS} /></div>
            <label className="flex items-center gap-2 pb-1 text-sm text-stone-700"><input type="checkbox" checked={!!draft.pinned} onChange={(e) => set('pinned', e.target.checked)} /> Pinned</label>
            <DateLine label="Last completed" value={draft.lastCompleted} onChange={(v) => set('lastCompleted', v)} />
          </div>

          <button type="button" onClick={() => { onAddToCalendar({ ...draft, title: (draft.title || '').trim() || 'Untitled' }); setAdded(true) }} className="flex items-center gap-1.5 border border-stone-900 px-3 py-1.5 text-sm text-stone-900 hover:bg-stone-900 hover:text-cream transition-colors">
            {added ? <><Check size={15} /> Added to calendar</> : <><CalendarPlus size={15} /> Add to calendar</>}
          </button>

          <TextArea label="Notes" value={draft.notes} onChange={(v) => set('notes', v)} placeholder="Anything to remember" />

          {/* Category-specific */}
          <div className="space-y-6 border-t border-stone-200 pt-6">
            <p className="kicker text-stone-400">{catLabel(draft.category)} details</p>
            <CategoryFields draft={draft} set={set} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? <span /> : (
            <button onClick={() => onDelete(draft.id)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-phase-menstrual"><Trash2 size={15} /> Delete</button>
          )}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button onClick={() => onSave({ ...draft, title: (draft.title || '').trim() || 'Untitled' })} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
