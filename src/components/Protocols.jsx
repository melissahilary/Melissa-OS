import React, { useMemo, useState } from 'react'
import { Plus, X, Trash2, CalendarPlus, Check } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PHASES } from '../lib/cycle'
import { dateKey, parseKey } from '../lib/date'

const uid = () => Math.random().toString(36).slice(2, 10)

const CATEGORIES = [
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'facial', label: 'Facial Care' },
  { id: 'aesthetics', label: 'Aesthetics' },
  { id: 'haircare', label: 'Haircare' },
  { id: 'body', label: 'Body Care' },
]

// Cycle phases for tagging (uses the app's phase ids; "Ovulatory" label = ovulation id).
const PHASE_OPTS = [
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
  { id: 'menstrual', label: 'Menstrual' },
]
const PHASE_OPTS_ANY = [...PHASE_OPTS, { id: 'any', label: 'Any' }]

const TOD_OPTS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'any', label: 'Any' },
]

const FREQ_OPTS = [
  { id: 'daily', label: 'Daily' },
  { id: '2x', label: '2x week' },
  { id: '3x', label: '3x week' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'asneeded', label: 'As needed' },
]

// Mon-first weekday checkboxes; stored as JS getDay() indices (Sun=0).
const WEEKDAYS = [
  { d: 1, label: 'Mon' }, { d: 2, label: 'Tue' }, { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' }, { d: 5, label: 'Fri' }, { d: 6, label: 'Sat' }, { d: 0, label: 'Sun' },
]

const labelOf = (opts, id) => (opts.find((o) => o.id === id) || {}).label || id
const freqLabel = (id) => labelOf(FREQ_OPTS, id)

const blankProtocol = () => ({
  id: uid(),
  title: '',
  category: 'nutrition',
  phases: [],
  timeOfDay: 'any',
  frequency: 'daily',
  days: [],
  series: 'onetime',
  startDate: '',
  endDate: '',
  noEndDate: true,
  notes: '',
})

// Normalize a stored protocol (tolerates older / partial shapes).
const norm = (p) => ({
  id: p.id || uid(),
  title: p.title || '',
  category: p.category || 'nutrition',
  phases: Array.isArray(p.phases) ? p.phases : [],
  timeOfDay: p.timeOfDay || 'any',
  frequency: p.frequency || 'daily',
  days: Array.isArray(p.days) ? p.days : [],
  series: p.series === 'series' ? 'series' : 'onetime',
  startDate: p.startDate || '',
  endDate: p.endDate || '',
  noEndDate: p.noEndDate !== false,
  notes: p.notes || '',
})

export default function Protocols() {
  const [stored, setProtocols] = useLocalStorage('mos:workout:protocols', [])
  const protocols = useMemo(() => (Array.isArray(stored) ? stored.map(norm) : []), [stored])
  const [, setEvents] = useLocalStorage('mos:today:events', {})

  const [filterCat, setFilterCat] = useState(null)
  const [filterPhase, setFilterPhase] = useState(null)
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

  // Turn a protocol's schedule into recurring events on the main calendar.
  const addToCalendar = (p) => {
    const today = new Date()
    const base = p.series === 'series' && p.startDate ? p.startDate : dateKey(today)
    const part = ['morning', 'afternoon', 'evening'].includes(p.timeOfDay) ? p.timeOfDay : 'morning'
    const end = p.series === 'series' && !p.noEndDate && p.endDate ? p.endDate : ''
    const title = p.title || 'Untitled protocol'

    const make = (k, frequency, days) => ({
      key: k,
      ev: {
        id: uid(), title, time: '', part,
        description: p.notes || '', attendees: '',
        frequency, days: days || [], endDate: end, done: false,
      },
    })

    const additions = []
    if (p.frequency === 'daily') {
      additions.push(make(base, 'daily', []))
    } else if (p.frequency === 'monthly') {
      additions.push(make(base, 'monthly', []))
    } else if (p.frequency === 'asneeded') {
      additions.push(make(base, 'once', []))
    } else {
      // weekly / bi-weekly / 2x / 3x — one weekly(or bi-weekly) event per chosen day.
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
      additions.forEach(({ key, ev }) => {
        next[key] = [...(next[key] || []), ev]
      })
      return next
    })
  }

  const visible = useMemo(
    () =>
      protocols.filter((p) => {
        if (filterCat && p.category !== filterCat) return false
        if (filterPhase && !(p.phases.includes(filterPhase) || p.phases.includes('any'))) return false
        return true
      }),
    [protocols, filterCat, filterPhase],
  )

  return (
    <section className="mb-10">
      <div className="mb-2 flex justify-end">
        <span className="text-sm text-stone-400">{protocols.length} on file</span>
      </div>
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setEditing(blankProtocol())}
          className="flex items-center gap-1.5 bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700"
        >
          <Plus size={15} /> New protocol
        </button>
      </div>

      {/* Filter bar — categories left, phases right */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-y border-stone-100 py-3">
        <Filters options={CATEGORIES} active={filterCat} onPick={setFilterCat} />
        <Filters options={PHASE_OPTS} active={filterPhase} onPick={setFilterPhase} phaseColors />
      </div>

      {protocols.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">No protocols yet.</p>
      ) : visible.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">Nothing matches that filter.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProtocolCard key={p.id} protocol={p} onOpen={() => setEditing(p)} />
          ))}
        </div>
      )}

      {editing && (
        <ProtocolModal
          protocol={editing}
          isNew={!protocols.some((r) => r.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
          onAddToCalendar={addToCalendar}
        />
      )}
    </section>
  )
}

function Filters({ options, active, onPick, phaseColors }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {options.map((o) => {
        const on = active === o.id
        const underline = phaseColors ? PHASES[o.id]?.color : '#a8a29e'
        return (
          <button
            key={o.id}
            onClick={() => onPick(on ? null : o.id)}
            className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${
              on ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-700'
            }`}
            style={on ? { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: underline } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function ProtocolCard({ protocol, onOpen }) {
  const notes = (protocol.notes || '').trim()
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-start border border-stone-200 bg-white/40 p-4 text-left transition-shadow hover:shadow-md"
    >
      <h3 className="font-serif text-xl text-stone-900">{protocol.title || 'Untitled'}</h3>
      {notes ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-500">{notes}</p>
      ) : (
        <p className="mt-2 text-sm italic text-stone-300">No notes yet.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-600">{freqLabel(protocol.frequency)}</span>
        {protocol.phases.map((id) =>
          id === 'any' ? (
            <span key={id} className="border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">Any</span>
          ) : (
            <span key={id} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-stone-500">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PHASES[id]?.color }} />
              {labelOf(PHASE_OPTS, id)}
            </span>
          ),
        )}
      </div>
    </button>
  )
}

function ProtocolModal({ protocol, isNew, onClose, onSave, onDelete, onAddToCalendar }) {
  const [draft, setDraft] = useState(() => ({ ...blankProtocol(), ...protocol, phases: [...(protocol.phases || [])], days: [...(protocol.days || [])] }))
  const [added, setAdded] = useState(false)
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  const togglePhase = (id) =>
    setDraft((d) => ({ ...d, phases: d.phases.includes(id) ? d.phases.filter((x) => x !== id) : [...d.phases, id] }))
  const toggleDay = (n) =>
    setDraft((d) => ({ ...d, days: d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n] }))

  const showDays = draft.frequency === 'weekly' || draft.frequency === 'biweekly' || draft.frequency === '2x' || draft.frequency === '3x'

  const labelCls = 'kicker text-stone-400 mb-2 block'
  const lineCls = 'w-full bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Protocol name"
            autoFocus
            className="w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none"
          />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-6 py-5 space-y-6">
          {/* Category */}
          <div>
            <span className={labelCls}>Category</span>
            <select value={draft.category} onChange={(e) => set('category', e.target.value)} className={lineCls}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {/* Phase (multi-select) */}
          <div>
            <span className={labelCls}>Phase</span>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_OPTS_ANY.map((o) => {
                const on = draft.phases.includes(o.id)
                const color = PHASES[o.id]?.color
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => togglePhase(o.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors"
                    style={
                      on
                        ? color
                          ? { backgroundColor: color, color: PHASES[o.id].ink, borderColor: color }
                          : { backgroundColor: '#1c1917', color: '#FAFAF7', borderColor: '#1c1917' }
                        : { borderColor: '#d6d3d1', color: '#57534e' }
                    }
                  >
                    {color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
                    {o.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time of day + Frequency */}
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <div className="min-w-[140px] flex-1">
              <span className={labelCls}>Time of day</span>
              <select value={draft.timeOfDay} onChange={(e) => set('timeOfDay', e.target.value)} className={lineCls}>
                {TOD_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div className="min-w-[140px] flex-1">
              <span className={labelCls}>Frequency</span>
              <select value={draft.frequency} onChange={(e) => set('frequency', e.target.value)} className={lineCls}>
                {FREQ_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Days of week */}
          {showDays && (
            <div>
              <span className={labelCls}>Days of week</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const on = draft.days.includes(w.d)
                  return (
                    <button
                      key={w.d}
                      type="button"
                      onClick={() => toggleDay(w.d)}
                      className={`px-2.5 py-1 text-xs border transition-colors ${
                        on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'
                      }`}
                    >
                      {w.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Series */}
          <div>
            <span className={labelCls}>Series</span>
            <div className="flex items-center gap-4 text-sm text-stone-700">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="series" checked={draft.series === 'onetime'} onChange={() => set('series', 'onetime')} />
                One-time
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="series" checked={draft.series === 'series'} onChange={() => set('series', 'series')} />
                Series
              </label>
            </div>
            {draft.series === 'series' && (
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
                <div>
                  <span className={labelCls}>Start date</span>
                  <input type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
                </div>
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-xs text-stone-500">
                    <input type="checkbox" checked={draft.noEndDate} onChange={(e) => set('noEndDate', e.target.checked)} />
                    No end date
                  </label>
                  {!draft.noEndDate && (
                    <input type="date" value={draft.endDate} onChange={(e) => set('endDate', e.target.value)} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <span className={labelCls}>Notes</span>
            <textarea
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Anything to remember"
              className="w-full min-h-[100px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
            />
          </div>

          {/* Add to calendar */}
          <button
            type="button"
            onClick={() => {
              onAddToCalendar({ ...draft, title: (draft.title || '').trim() || 'Untitled' })
              setAdded(true)
            }}
            className="flex items-center gap-1.5 border border-stone-900 px-3 py-1.5 text-sm text-stone-900 hover:bg-stone-900 hover:text-cream transition-colors"
          >
            {added ? <><Check size={15} /> Added to calendar</> : <><CalendarPlus size={15} /> Add to calendar</>}
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? (
            <span />
          ) : (
            <button onClick={() => onDelete(draft.id)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-phase-menstrual">
              <Trash2 size={15} /> Delete
            </button>
          )}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button
              onClick={() => onSave({ ...draft, title: (draft.title || '').trim() || 'Untitled' })}
              className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
