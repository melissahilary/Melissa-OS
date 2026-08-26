import React, { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRegisterAdd } from './shared/AddButton'
import CategorySchedule from './shared/CategorySchedule'
import { CategoryLog } from './shared/LogShelf'
import { dateKey } from '../lib/date'

const uid = () => Math.random().toString(36).slice(2, 10)

// Testing — where every routine draw, scan and exam lives, dated with results.
export default function Diagnostics({ subPage, cycleConfig }) {
  if (subPage === 'bloodwork') return <CategoryLog storeKey="mos:testing:bloodwork" addNoun="draw" blurb="Every draw, dated — because a number without its date is noise." suggestions={['Full panel', 'CBC', 'Metabolic panel', 'Lipids', 'Thyroid', 'Vitamin D', 'Iron / ferritin', 'HbA1c', 'hs-CRP']} place={{ label: 'Where', placeholder: 'lab · clinic' }} fields={[{ key: 'fasting', label: 'Fasting?', placeholder: 'fasted · fed' }, { key: 'results', label: 'Key results', placeholder: 'values to remember' }]} />
  if (subPage === 'imaging') return <CategoryLog storeKey="mos:testing:imaging" addNoun="exam" blurb="Scans and structural exams — what was looked at, and what was seen." suggestions={['DEXA', 'Ultrasound', 'MRI', 'Mammogram', 'Skin check', 'Dental exam', 'Eye exam', 'VO2 max']} place={{ label: 'Where', placeholder: 'imaging center · clinic' }} fields={[{ key: 'results', label: 'Findings', placeholder: 'what was seen' }]} />
  if (subPage === 'log') return <ResultsBook />
  return <CategorySchedule category="diagnostics" noun="Test" cycleConfig={cycleConfig} />
}

// ── Results — every marker you watch, as its own small dossier: a history of
// readings, the reference range you're aiming at, and the direction of travel.
// A number without its history is noise; this is where numbers become a story.

const MARKER_SUGGESTIONS = ['Ferritin', 'Vitamin D', 'TSH', 'HbA1c', 'hs-CRP', 'Fasting glucose', 'ApoB', 'Estradiol', 'Progesterone', 'Testosterone', 'Cortisol (AM)', 'Iron', 'B12']

// Legacy rows were {name, result, date} — fold that single result into readings.
const normMarker = (m) => {
  const readings = Array.isArray(m.readings) ? m.readings : []
  if (!readings.length && (m.result || '').trim()) {
    readings.push({ id: uid(), value: m.result, unit: m.unit || '', date: m.date || '' })
  }
  return { id: m.id || uid(), name: m.name || '', range: m.range || '', notes: m.notes || '', readings }
}

const numOf = (v) => { const n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null }
// A range like "30–100", "30-100", "< 5", "> 50" → verdict for a value.
const inRange = (rangeStr, v) => {
  const n = numOf(v)
  if (n == null || !(rangeStr || '').trim()) return null
  const r = rangeStr.replace(/–/g, '-').trim()
  const pair = r.match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)/)
  if (pair) return n >= parseFloat(pair[1]) && n <= parseFloat(pair[2])
  const lt = r.match(/^<\s*(-?[\d.]+)/)
  if (lt) return n < parseFloat(lt[1])
  const gt = r.match(/^>\s*(-?[\d.]+)/)
  if (gt) return n > parseFloat(gt[1])
  return null
}

// Latest-first readings; trend compares the two most recent numeric values.
const sortedReadings = (m) => [...m.readings].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
const trendOf = (m) => {
  const nums = sortedReadings(m).map((r) => numOf(r.value)).filter((n) => n != null)
  if (nums.length < 2) return null
  if (nums[0] > nums[1]) return 'up'
  if (nums[0] < nums[1]) return 'down'
  return 'flat'
}

// A tiny dot-line of the last few numeric readings, oldest → newest.
function Spark({ m }) {
  const nums = sortedReadings(m).map((r) => numOf(r.value)).filter((n) => n != null).slice(0, 6).reverse()
  if (nums.length < 2) return null
  const min = Math.min(...nums), max = Math.max(...nums)
  const span = max - min || 1
  return (
    <svg width={64} height={20} className="shrink-0" aria-hidden>
      {nums.map((n, i) => {
        const x = 4 + (i * 56) / (nums.length - 1)
        const y = 16 - ((n - min) / span) * 12
        const prev = i > 0 ? { x: 4 + ((i - 1) * 56) / (nums.length - 1), y: 16 - ((nums[i - 1] - min) / span) * 12 } : null
        return (
          <g key={i}>
            {prev && <line x1={prev.x} y1={prev.y} x2={x} y2={y} stroke="#A8A29E" strokeWidth="1" />}
            <circle cx={x} cy={y} r={i === nums.length - 1 ? 2.4 : 1.6} fill={i === nums.length - 1 ? '#1C1917' : '#A8A29E'} />
          </g>
        )
      })}
    </svg>
  )
}

function ResultsBook() {
  const [stored, setItems] = useLocalStorage('mos:diagnostics', [])
  const items = (Array.isArray(stored) ? stored : []).map(normMarker)
  const [openId, setOpenId] = useState(null)
  const [draft, setDraft] = useState('')

  const commit = (fn) => setItems((prev) => fn((Array.isArray(prev) ? prev : []).map(normMarker)))
  const add = (name) => {
    const t = (name != null ? name : draft).trim()
    if (!t) return
    const m = { id: uid(), name: t, range: '', notes: '', readings: [] }
    commit((arr) => [m, ...arr])
    setDraft('')
    setOpenId(m.id)
  }
  const edit = (id, patch) => commit((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const remove = (id) => { commit((arr) => arr.filter((x) => x.id !== id)); setOpenId(null) }
  useRegisterAdd(() => { const el = document.getElementById('mos-marker-draft'); if (el) el.focus() }, [])

  const open = items.find((x) => x.id === openId) || null

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-2">
        <input
          id="mos-marker-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="A marker to watch — ferritin, vitamin D, TSH…"
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={() => add()} className="rounded-full bg-stone-900 px-4 py-1.5 text-sm text-cream hover:bg-stone-700">Add</button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center">
          <p className="font-serif italic text-lg text-stone-400">Nothing watched yet.</p>
          <p className="mt-1 text-sm text-stone-400">Start with the markers your last panel measured:</p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {MARKER_SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => add(s)} className="rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((m) => {
            const latest = sortedReadings(m)[0] || null
            const ok = latest ? inRange(m.range, latest.value) : null
            const tr = trendOf(m)
            return (
              <button key={m.id} onClick={() => setOpenId(m.id)} className="flex w-full items-center gap-4 rounded-2xl border border-stone-200 bg-white/50 px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md">
                {ok != null && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ok ? '#7C8B6B' : '#A0654C' }} title={ok ? 'In range' : 'Out of range'} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg leading-tight text-stone-900">{m.name}</span>
                  <span className="text-xs text-stone-400">
                    {latest ? `${latest.value}${latest.unit ? ` ${latest.unit}` : ''}${latest.date ? ` · ${latest.date}` : ''}` : 'No reading yet'}
                    {m.range ? ` · range ${m.range}` : ''}
                    {tr ? ` · ${tr === 'up' ? '↗' : tr === 'down' ? '↘' : '→'}` : ''}
                  </span>
                </span>
                <Spark m={m} />
                <span className="text-xs tabular-nums text-stone-300">{m.readings.length || ''}</span>
              </button>
            )
          })}
        </div>
      )}

      {open && <MarkerSheet m={open} onEdit={(patch) => edit(open.id, patch)} onRemove={() => remove(open.id)} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function MarkerSheet({ m, onEdit, onRemove, onClose }) {
  const [val, setVal] = useState('')
  const [unit, setUnit] = useState(sortedReadings(m)[0]?.unit || '')
  const [date, setDate] = useState(dateKey(new Date()))
  const addReading = () => {
    if (!val.trim()) return
    onEdit({ readings: [...m.readings, { id: uid(), value: val.trim(), unit: unit.trim(), date }] })
    setVal('')
  }
  const rmReading = (rid) => onEdit({ readings: m.readings.filter((r) => r.id !== rid) })
  const hist = sortedReadings(m)
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-6 pb-1 pt-5">
          <span className="kicker text-stone-400">Marker</span>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="space-y-5 px-6 pb-2 pt-2">
          <input value={m.name} onChange={(e) => onEdit({ name: e.target.value })} className="w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-2xl text-stone-900 outline-none focus:border-stone-900" />

          <div>
            <p className="kicker mb-1.5 text-stone-400">Reference range</p>
            <input value={m.range} onChange={(e) => onEdit({ range: e.target.value })} placeholder="e.g. 30–100, < 5, > 50" className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900" />
          </div>

          <div>
            <p className="kicker mb-2 text-stone-400">New reading</p>
            <div className="flex items-end gap-2">
              <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addReading()} placeholder="Value" className="w-24 border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900" />
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" className="w-20 border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none focus:border-stone-900" />
              <button onClick={addReading} aria-label="Add reading" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-cream hover:bg-stone-700"><Plus size={15} /></button>
            </div>
          </div>

          {hist.length > 0 && (
            <div>
              <p className="kicker mb-1.5 text-stone-400">History</p>
              <div className="divide-y divide-stone-100">
                {hist.map((r) => {
                  const ok = inRange(m.range, r.value)
                  return (
                    <div key={r.id} className="group flex items-center gap-3 py-2">
                      {ok != null && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ok ? '#7C8B6B' : '#A0654C' }} />}
                      <span className="flex-1 text-sm text-stone-800">{r.value}{r.unit ? ` ${r.unit}` : ''}</span>
                      <span className="text-xs tabular-nums text-stone-400">{r.date || '—'}</span>
                      <button onClick={() => rmReading(r.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={13} /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="kicker mb-1.5 text-stone-400">Notes</p>
            <input value={m.notes} onChange={(e) => onEdit({ notes: e.target.value })} placeholder="Protocol changes, what your provider said…" className="w-full border-b border-stone-200 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900" />
          </div>
        </div>
        <div className="flex items-center justify-between px-6 pb-6 pt-4">
          <button onClick={onRemove} className="text-xs text-stone-400 hover:text-phase-menstrual">Remove marker</button>
          <button onClick={onClose} className="rounded-full bg-stone-900 px-8 py-2.5 text-sm text-cream hover:bg-stone-700">Done</button>
        </div>
      </div>
    </div>
  )
}
