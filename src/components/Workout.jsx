import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PHASES, phaseForConfig, phaseFor, cycleDayFor, startOfDay, averageCycleLength } from '../lib/cycle'
import { dateKey, parseKey, addDays, MONTHS, monthGrid, DOW, isSameDay } from '../lib/date'
import CategorySchedule from './shared/CategorySchedule'
import PhaseColorEditor from './shared/PhaseColorEditor'
import { usePhaseColors } from '../hooks/usePhaseColors'
import { CategoryLog } from './shared/LogShelf'
import { useLifeStage } from '../lib/lifeStage'

// Hormone-specific sub-sections. Labs lead with the date because timing is the
// data — a draw on day 3 is a different point than day 21 — so a cycle-day field
// sits alongside it.
const HORMONE_LOG = {
  appointments: {
    addNoun: 'appointment',
    blurb: 'Provider visits where information is produced or the protocol changes.',
    suggestions: ['Endocrinology', 'Functional medicine', 'OBGYN', 'Follow-up consult', 'Dose adjustment'],
    place: { label: 'Who / where', placeholder: 'provider · clinic' },
    fields: [{ key: 'changes', label: 'What changed', placeholder: 'protocol / dose changes' }],
  },
  labs: {
    addNoun: 'lab',
    blurb: 'Hormone panels where timing matters — a day-3 draw is not a day-21 draw.',
    suggestions: ['Full panel', 'Thyroid panel', 'Cortisol curve', 'Cycle-day draw'],
    place: { label: 'Where', placeholder: 'lab · clinic' },
    fields: [
      { key: 'cycleDay', label: 'Cycle day', placeholder: 'e.g. day 3 / day 21' },
      { key: 'results', label: 'Results', placeholder: 'values to remember' },
    ],
  },
}
const HORMONE_SHELF = {
  products: {
    blurb: 'Supportive supplements.',
    suggestions: ['Magnesium', 'Seed cycling', 'Adaptogens', 'Vitamin D', 'Inositol', 'DIM'],
    notePlaceholder: 'what it supports · how often',
  },
}

const MS_DAY = 86400000
const fmt = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

// A period spans several contiguous days. Group marked days into runs and return
// each run's START — those are the real "period start" (Day 1) dates.
const dayGap = (a, b) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / MS_DAY)
const runStartsOf = (days) => {
  const sorted = [...new Set((days || []).filter(Boolean))].sort()
  const starts = []
  sorted.forEach((d, i) => { if (i === 0 || dayGap(sorted[i - 1], d) > 1) starts.push(d) })
  return starts
}
// Day 1 = the start of the most recent period run that has already begun
// (start ≤ today); if none has begun yet, the earliest run start.
const anchorStart = (runStarts, todayKey) => {
  if (!runStarts.length) return ''
  const begun = runStarts.filter((k) => k <= todayKey)
  const pool = begun.length ? begun : runStarts
  return pool[pool.length - 1]
}

export default function Workout({ cycleConfig = {}, setCycleConfig = () => {}, goToDay = () => {}, subPage = 'cycle' }) {
  if (subPage === 'schedule' || subPage === 'monthly' || subPage === 'weekly') return <CategorySchedule category="hormones" question="What do you want to track today?" noun="Item" cycleConfig={cycleConfig} />
  if (subPage === 'protocols') return <Protocols />
  if (HORMONE_LOG[subPage]) return <CategoryLog storeKey={`mos:hormones:${subPage}`} {...HORMONE_LOG[subPage]} />
  return <MyBody cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} goToDay={goToDay} />
}

// ── My Body — shaped by the life stage chosen in Settings → My Body. The whole
// arc: cycling gets the full tracker; trying adds the fertile window on top;
// expecting counts weeks; postpartum counts recovery; peri keeps the calendar
// but takes symptoms seriously; beyond cycles drops the cycle math entirely.
function MyBody({ cycleConfig, setCycleConfig, goToDay }) {
  const { stage } = useLifeStage()
  if (stage === 'pregnant') return <Expecting />
  if (stage === 'postpartum') return <Postpartum />
  if (stage === 'menopause') return <BeyondCycles />
  if (stage === 'perimenopause') return (
    <div className="space-y-10">
      <SymptomJournal storeKey="mos:meno:log" symptoms={MENO_SYMPTOMS.concat(['Irregular bleeding', 'Heavy flow'])} />
      <CyclePage cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} goToDay={goToDay} />
    </div>
  )
  if (stage === 'ttc') return (
    <div className="space-y-6">
      <FertileWindow cycleConfig={cycleConfig} />
      <CyclePage cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} goToDay={goToDay} />
    </div>
  )
  return <CyclePage cycleConfig={cycleConfig} setCycleConfig={setCycleConfig} goToDay={goToDay} />
}

// Fertile window — for the trying-to-conceive stage: the six days that matter,
// forecast from the same anchor the cycle calendar uses.
function FertileWindow({ cycleConfig = {} }) {
  const len = Number(cycleConfig.cycleLength) || 28
  const start = cycleConfig.lastPeriodStart ? parseKey(cycleConfig.lastPeriodStart) : null
  if (!start) return (
    <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-stone-200 p-6 text-center">
      <p className="font-serif italic text-lg text-stone-500">Mark your last period start below and your fertile window appears here.</p>
    </div>
  )
  const today = startOfDay(new Date())
  // Next ovulation: luteal phase is ~14 days, so ovulation ≈ cycle length − 14.
  let ov = addDays(start, len - 14)
  while (ov < today) ov = addDays(ov, len)
  const winStart = addDays(ov, -5)
  const daysToOv = Math.round((ov - today) / MS_DAY)
  const inWindow = today >= winStart && today <= ov
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white/40 p-6">
      <p className="kicker mb-1 text-stone-400">Fertile window</p>
      {inWindow ? (
        <p className="font-serif text-2xl text-stone-900">You are in it — ovulation expected {daysToOv === 0 ? 'today' : `in ${daysToOv} day${daysToOv === 1 ? '' : 's'}`}.</p>
      ) : (
        <p className="font-serif text-2xl text-stone-900">Opens {fmt(winStart)} · ovulation ~{fmt(ov)}.</p>
      )}
      <p className="mt-2 text-xs text-stone-400">Forecast from your cycle anchor — the six days ending at ovulation. Basal temperature and LH strips will always know better than math.</p>
    </div>
  )
}

// Postpartum — the fourth trimester: weeks since birth, and a recovery journal
// that asks how you really are.
const PP_SYMPTOMS = ['Bleeding', 'Sleep', 'Mood', 'Energy', 'Feeding', 'Pain', 'Anxiety', 'Tears', 'Feeling myself']
function Postpartum() {
  const [dataRaw, setData] = useLocalStorage('mos:postpartum', {})
  const d = dataRaw && typeof dataRaw === 'object' ? dataRaw : {}
  const set = (patch) => setData((p) => ({ ...(p && typeof p === 'object' ? p : {}), ...patch }))
  const days = d.birthDate ? Math.max(0, Math.floor((Date.now() - parseKey(d.birthDate).getTime()) / MS_DAY)) : null
  const weeks = days == null ? null : Math.floor(days / 7)
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white/40 p-8 text-center">
        {weeks != null ? (
          <>
            <p className="kicker text-stone-400">{weeks < 13 ? 'The fourth trimester' : 'Postpartum'}</p>
            <p className="mt-2 font-serif text-6xl leading-none text-stone-900 tabular-nums">{weeks}</p>
            <p className="mt-1 font-serif italic text-xl text-stone-600">weeks{days % 7 ? ` · ${days % 7}d` : ''}</p>
          </>
        ) : (
          <p className="font-serif italic text-xl text-stone-500">Set the birth date and your planner counts recovery with you.</p>
        )}
        <label className="mt-6 inline-flex items-center gap-3 text-sm text-stone-600">
          <span className="kicker text-stone-400">Baby arrived</span>
          <input type="date" value={d.birthDate || ''} onChange={(e) => set({ birthDate: e.target.value })} className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900" />
        </label>
      </div>
      <SymptomJournal storeKey="mos:postpartum:log" symptoms={PP_SYMPTOMS} />
      <p className="text-center text-xs italic text-stone-400">Your cycle calendar is resting. When your body brings it back, flip your stage in Settings → My Body — everything will be waiting.</p>
    </div>
  )
}

// Expecting — the week you're in, counted from your due date.
function Expecting() {
  const [dataRaw, setData] = useLocalStorage('mos:pregnancy', {})
  const d = dataRaw && typeof dataRaw === 'object' ? dataRaw : {}
  const set = (patch) => setData((p) => ({ ...(p && typeof p === 'object' ? p : {}), ...patch }))
  const week = d.dueDate ? Math.max(1, Math.min(42, 40 - Math.floor((parseKey(d.dueDate).getTime() - Date.now()) / (7 * 86400000)))) : null
  const trimester = week == null ? null : week <= 13 ? 'First trimester' : week <= 27 ? 'Second trimester' : 'Third trimester'
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-stone-200 bg-white/40 p-8 text-center">
        {week ? (
          <>
            <p className="kicker text-stone-400">{trimester}</p>
            <p className="mt-2 font-serif text-6xl leading-none text-stone-900 tabular-nums">{week}</p>
            <p className="mt-1 font-serif italic text-xl text-stone-600">weeks</p>
          </>
        ) : (
          <p className="font-serif italic text-xl text-stone-500">Set your due date and your planner counts the weeks with you.</p>
        )}
        <label className="mt-6 inline-flex items-center gap-3 text-sm text-stone-600">
          <span className="kicker text-stone-400">Due date</span>
          <input type="date" value={d.dueDate || ''} onChange={(e) => set({ dueDate: e.target.value })} className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900" />
        </label>
      </div>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white/40 p-6">
        <p className="kicker mb-3 text-stone-400">Notes for this week</p>
        <textarea value={d.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Symptoms, questions for your provider, what your body is telling you…" rows={4} className="w-full resize-y rounded-xl bg-stone-500/5 px-4 py-3 font-serif text-lg leading-relaxed outline-none" />
      </div>
    </div>
  )
}

// Beyond cycles — symptoms and therapies, without a period calendar in the way.
const MENO_SYMPTOMS = ['Hot flashes', 'Night sweats', 'Sleep', 'Mood', 'Brain fog', 'Joint aches', 'Energy', 'Libido', 'Skin & hair']
function BeyondCycles() {
  return <SymptomJournal storeKey="mos:meno:log" symptoms={MENO_SYMPTOMS} />
}

// The shared symptom journal — chips for today, a fortnight strip of how loud
// the days have been. Postpartum, peri, and beyond all speak through it.
function SymptomJournal({ storeKey, symptoms }) {
  const [logRaw, setLog] = useLocalStorage(storeKey, {})
  const log = logRaw && typeof logRaw === 'object' ? logRaw : {}
  const tk = dateKey(new Date())
  const today = Array.isArray(log[tk]) ? log[tk] : []
  const toggle = (s) => setLog((p) => { const pp = p && typeof p === 'object' ? p : {}; const cur = Array.isArray(pp[tk]) ? pp[tk] : []; return { ...pp, [tk]: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] } })
  // The last fortnight, as a quiet strip — how loudly the body has been speaking.
  const days14 = Array.from({ length: 14 }, (_, i) => { const d = addDays(new Date(), i - 13); const k = dateKey(d); return { k, d, n: (Array.isArray(log[k]) ? log[k] : []).length } })
  const maxN = Math.max(1, ...days14.map((x) => x.n))
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-stone-200 bg-white/40 p-6">
        <p className="kicker mb-1 text-stone-400">Today</p>
        <h3 className="mb-4 font-serif italic text-2xl text-stone-900">How is your body speaking?</h3>
        <div className="flex flex-wrap gap-1.5">
          {symptoms.map((s) => (
            <button key={s} onClick={() => toggle(s)} className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${today.includes(s) ? 'border-stone-900 bg-stone-900 text-cream' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-stone-200 bg-white/40 p-6">
        <p className="kicker mb-4 text-stone-400">The last fortnight</p>
        <div className="flex items-end justify-between gap-1">
          {days14.map(({ k, d, n }) => (
            <div key={k} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-14 w-full items-end justify-center">
                <div className="w-full max-w-[14px] rounded-t" style={{ height: `${Math.max(8, (n / maxN) * 100)}%`, background: '#A0654C', opacity: n ? 0.25 + 0.6 * (n / maxN) : 0.08 }} />
              </div>
              <span className="text-[9px] tabular-nums text-stone-300">{d.getDate()}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-stone-400">taller · louder — days you logged more symptoms</p>
      </div>
    </div>
  )
}

// ── Protocols — the compounds you run on purpose: peptides, HRT, cycles of
// anything. Each carries dose, cadence, a start date — and an adherence log:
// mark it taken today, watch the fortnight fill in, see how long you've run it.
function Protocols() {
  const [stored, setItems] = useLocalStorage('mos:hormones:protocols', [])
  const items = Array.isArray(stored) ? stored : []
  const [logRaw, setLog] = useLocalStorage('mos:hormones:protocols:log', {})
  const plog = logRaw && typeof logRaw === 'object' ? logRaw : {}
  const [openId, setOpenId] = useState(null)
  const uid2 = () => Math.random().toString(36).slice(2, 10)
  const tk = dateKey(new Date())
  const takenToday = (id) => Array.isArray(plog[tk]) && plog[tk].includes(id)
  const toggleTaken = (id) => setLog((p) => { const pp = p && typeof p === 'object' ? p : {}; const cur = Array.isArray(pp[tk]) ? pp[tk] : []; return { ...pp, [tk]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } })
  const weeksOn = (start) => (start ? Math.max(0, Math.floor((Date.now() - parseKey(start).getTime()) / (7 * 86400000))) : null)
  const strip14 = (id) => Array.from({ length: 14 }, (_, i) => { const k = dateKey(addDays(new Date(), i - 13)); return Array.isArray(plog[k]) && plog[k].includes(id) })

  const add = () => { const it = { id: uid2(), name: '', dose: '', cadence: '', start: dateKey(new Date()), notes: '', active: true }; setItems((p) => [...(Array.isArray(p) ? p : []), it]); setOpenId(it.id) }
  const update = (id, patch) => setItems((p) => (Array.isArray(p) ? p : []).map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const remove = (id) => { setItems((p) => (Array.isArray(p) ? p : []).filter((x) => x.id !== id)); setOpenId(null) }
  const open = items.find((x) => x.id === openId) || null
  const inputCls = 'w-full bg-transparent border-b border-stone-200 pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900'

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex justify-end">
        <button onClick={add} className="rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream hover:bg-stone-700">New protocol</button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-200 py-14 text-center font-serif italic text-lg text-stone-400">Nothing running yet.</p>
      ) : (
        <div className="space-y-3">
          {[...items.filter((x) => x.active !== false), ...items.filter((x) => x.active === false)].map((it) => {
            const wk = weeksOn(it.start)
            const taken = takenToday(it.id)
            return (
              <div key={it.id} className={`rounded-2xl border bg-white/50 p-4 ${it.active === false ? 'opacity-60' : ''} border-stone-200`}>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleTaken(it.id)}
                    aria-label={taken ? 'Taken today' : 'Mark taken'}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-serif transition-all ${taken ? 'border-transparent text-cream' : 'border-stone-300 text-stone-400 hover:border-stone-500'}`}
                    style={taken ? { backgroundColor: '#1C1C1A' } : undefined}
                  >{taken ? '✓' : '·'}</button>
                  <button onClick={() => setOpenId(it.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-serif text-lg leading-tight text-stone-900">{it.name || 'Untitled protocol'}</p>
                    <p className="text-xs text-stone-400">{[it.dose, it.cadence, wk != null ? `week ${wk + 1}` : null].filter(Boolean).join(' · ') || 'tap to fill in'}</p>
                  </button>
                  <span className="kicker text-stone-300">{it.active === false ? 'paused' : taken ? 'taken' : 'due'}</span>
                </div>
                {/* the fortnight, as dots */}
                <div className="mt-3 flex items-center gap-1 border-t border-stone-100 pt-3">
                  {strip14(it.id).map((on, i) => (
                    <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: on ? '#7C8B6B' : '#EAE6DC' }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setOpenId(null)} />
          <div className="relative w-full max-w-md rounded-t-3xl border border-stone-200 bg-cream shadow-2xl sm:rounded-3xl">
            <div className="space-y-5 px-6 pb-2 pt-6">
              <input autoFocus value={open.name} onChange={(e) => update(open.id, { name: e.target.value })} placeholder="The protocol — e.g. GLP-1, BPC-157" className="w-full border-b border-stone-200 bg-transparent pb-2 font-serif text-2xl text-stone-900 outline-none placeholder:italic placeholder:text-stone-300 focus:border-stone-900" />
              <div className="grid grid-cols-2 gap-4">
                <div><p className="kicker mb-1.5 text-stone-400">Dose</p><input value={open.dose || ''} onChange={(e) => update(open.id, { dose: e.target.value })} placeholder="e.g. 0.5 mg" className={inputCls} /></div>
                <div><p className="kicker mb-1.5 text-stone-400">Cadence</p><input value={open.cadence || ''} onChange={(e) => update(open.id, { cadence: e.target.value })} placeholder="e.g. weekly" className={inputCls} /></div>
              </div>
              <div><p className="kicker mb-1.5 text-stone-400">Started</p><input type="date" value={open.start || ''} onChange={(e) => update(open.id, { start: e.target.value })} className={inputCls} /></div>
              <div><p className="kicker mb-1.5 text-stone-400">Notes</p><input value={open.notes || ''} onChange={(e) => update(open.id, { notes: e.target.value })} placeholder="source, timing, how you feel on it" className={inputCls} /></div>
              <label className="flex items-center gap-3 text-sm text-stone-600">
                <button onClick={() => update(open.id, { active: open.active === false })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${open.active !== false ? 'bg-stone-900' : 'bg-stone-300'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all ${open.active !== false ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
                {open.active !== false ? 'Running' : 'Paused'}
              </label>
            </div>
            <div className="flex items-center justify-between px-6 pb-6 pt-4">
              <button onClick={() => remove(open.id)} className="text-xs text-stone-400 hover:text-phase-menstrual">Delete</button>
              <button onClick={() => setOpenId(null)} className="rounded-full bg-stone-900 px-8 py-2.5 text-sm text-cream hover:bg-stone-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cycle tracking ──────────────────────────────────────────────────
const SYMPTOMS = [
  'Bloating', 'Cramps', 'Headache', 'Fatigue', 'High Energy', 'Brain Fog', 'Mood Swings',
  'Clear Skin', 'Breakouts', 'Strong Libido', 'Low Libido', 'Tender Breasts', 'Back Pain',
  'Insomnia', 'Deep Sleep', 'Anxiety', 'Calm', 'Irritable', 'Emotional', 'Confident',
]
const FLOW = ['Spotting', 'Light', 'Medium', 'Heavy']

// Phase segments across one cycle, in day order, with their starting cycle-day.
const PHASE_SEG = [
  { id: 'menstrual', label: 'Menstrual', start: 1 },
  { id: 'follicular', label: 'Follicular', start: 6 },
  { id: 'ovulation', label: 'Ovulatory', start: 14 },
  { id: 'luteal', label: 'Luteal', start: 17 },
]

const ENERGY = { menstrual: 1, follicular: 4, ovulation: 5, luteal: 3 }
const INTENTION = {
  follicular: 'Your mind is sharp and your energy is building. Schedule deep work and new starts.',
  ovulation: 'Peak output day. Be visible, pitch, connect, lead.',
  luteal: 'Wrap up, organize, reflect. Protect your energy in the second half.',
  menstrual: "Rest and reset. Honor the slowdown — it's productive in its own way.",
}

const chipCls = (on) => `rounded-full px-3.5 py-1.5 text-xs border transition-colors ${on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`
const REAL_FLOW = ['Light', 'Medium', 'Heavy'] // a real period day (sets Day 1); Spotting doesn't

function CyclePage({ cycleConfig, setCycleConfig, goToDay = () => {} }) {
  const today = new Date()
  const todayKey = dateKey(today)
  const start = cycleConfig.lastPeriodStart || ''
  const len = Number(cycleConfig.cycleLength) > 0 ? Number(cycleConfig.cycleLength) : 28
  const phase = phaseForConfig(cycleConfig, today)
  const cycleDay = cycleDayFor(today, start, len)

  const [logs, setLogs] = useLocalStorage('mos:cycle:logs', {})
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [reading, setReading] = useState(null)

  // The whole log form is bound to the SELECTED day, not just today.
  const selD = parseKey(selectedKey)
  const isToday = selectedKey === todayKey
  const selLog = logs[selectedKey] || { symptoms: [], flow: '', bbt: '', notes: '' }
  const setSel = (patch) => setLogs((p) => ({ ...p, [selectedKey]: { symptoms: [], flow: '', bbt: '', notes: '', ...(p[selectedKey] || {}), ...patch } }))
  const toggleSymptom = (s) => { const cur = selLog.symptoms || []; setSel({ symptoms: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] }) }

  const history = Array.isArray(cycleConfig.history) ? cycleConfig.history : []
  const setCfg = (patch) => setCycleConfig({ ...cycleConfig, ...patch })

  // Every marked period day (the full runs) — source of truth for the calendar.
  // Falls back to the legacy union of history + lastPeriodStart for old data.
  const periodDays = Array.isArray(cycleConfig.periodDays) && cycleConfig.periodDays.length
    ? [...new Set(cycleConfig.periodDays.filter(Boolean))].sort()
    : [...new Set([...history, start].filter(Boolean))].sort()

  // Setting period days re-derives Day 1 from the runs' start dates and stores run
  // starts as history (for average cycle length) — driving phase + predictions
  // everywhere on the site.
  const setPeriodDays = (arr) => {
    const days = [...new Set(arr.filter(Boolean))].sort()
    if (!days.length) { setCfg({ periodDays: [], lastPeriodStart: '', history: [], manualPhase: '' }); return }
    const starts = runStartsOf(days)
    const anchor = anchorStart(starts, todayKey)
    const rest = starts.filter((k) => k !== anchor).sort((a, b) => (a < b ? 1 : -1))
    setCfg({ periodDays: days, lastPeriodStart: anchor, history: rest, manualPhase: '' })
  }

  // Choosing a flow logs the bleeding type AND, for a real flow, marks the selected
  // day as a period day (which sets Day 1); Spotting/none only logs.
  const setFlow = (f) => {
    const val = selLog.flow === f ? '' : f
    setSel({ flow: val, ...(val ? {} : { flowTime: '' }) })
    const cur = new Set(periodDays)
    if (REAL_FLOW.includes(val)) cur.add(selectedKey); else cur.delete(selectedKey)
    setPeriodDays([...cur])
  }

  // Self-heal legacy/incorrect data on load: Day 1 must be a period-run START.
  useEffect(() => {
    if (!periodDays.length) return
    const starts = runStartsOf(periodDays)
    const anchor = anchorStart(starts, todayKey)
    const rest = starts.filter((k) => k !== anchor).sort((a, b) => (a < b ? 1 : -1))
    if (anchor !== start || !Array.isArray(cycleConfig.periodDays)) {
      setCfg({ periodDays, lastPeriodStart: anchor, history: rest })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Predictions.
  const predictions = (() => {
    if (!start) return null
    const s0 = startOfDay(parseKey(start))
    const daysSince = Math.floor((startOfDay(today) - s0) / MS_DAY)
    const cyclesDone = Math.max(0, Math.floor(daysSince / len))
    const curStart = addDays(s0, cyclesDone * len)
    const nextStart = addDays(s0, (cyclesDone + 1) * len)
    const cd = cycleDay || 1
    const ovById = (base) => ({ from: addDays(base, 13), to: addDays(base, 15) })
    const nextOv = cd < 14 ? ovById(curStart) : ovById(nextStart)
    const boundaries = [6, 14, 17, len + 1]
    const nextBoundDay = boundaries.find((b) => b > cd)
    let nextPhaseDate, nextPhaseName
    if (nextBoundDay && nextBoundDay <= len) { nextPhaseDate = addDays(curStart, nextBoundDay - 1); const m = PHASE_SEG.find((p) => p.start === nextBoundDay); nextPhaseName = m ? m.label : '' }
    else { nextPhaseDate = nextStart; nextPhaseName = 'Menstrual' }
    return { nextPeriod: nextStart, nextOv, nextPhaseDate, nextPhaseName }
  })()

  const loggedKeys = new Set(
    Object.keys(logs).filter((k) => { const l = logs[k]; return l && ((l.symptoms && l.symptoms.length) || l.flow || l.bbt || (l.notes && l.notes.trim())) }),
  )
  const pastKeys = [...loggedKeys].filter((k) => k !== selectedKey).sort((a, b) => (a < b ? 1 : -1))

  return (
    <div className="mb-10 space-y-10">
      {/* Phase headline */}
      <section>
        {phase ? (
          <p className="font-serif italic text-4xl md:text-5xl text-stone-900">{phase.name}<span className="text-stone-400"> · Day {cycleDay}</span></p>
        ) : (
          <p className="font-serif italic text-2xl text-stone-500">Log a period day below to see your phase.</p>
        )}
        <p className="mt-2 max-w-xl text-sm italic text-stone-400">Tap any day to log it — bleeding, symptoms, notes. Marking a Light/Medium/Heavy flow makes it a period day and sets Day 1 for the whole planner.</p>
      </section>

      {/* Calendar — tap a day to select it */}
      <PeriodCalendar periodDays={periodDays} loggedKeys={loggedKeys} selectedKey={selectedKey} onSelect={setSelectedKey} today={today} cycleConfig={cycleConfig} />

      {/* The selected day's log — one clean card, everything writes to that day */}
      <section className="rounded-2xl border border-stone-200/80 bg-white/50 p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <h3 className="font-serif italic text-2xl text-stone-900">
            {isToday ? 'Today' : fmt(selD)}
            {isToday && <span className="ml-2 text-base not-italic text-stone-400">{fmt(selD)}</span>}
          </h3>
          {!isToday && <button onClick={() => setSelectedKey(todayKey)} className="shrink-0 kicker text-stone-400 hover:text-stone-900">back to today</button>}
        </div>

        <div className="mb-7">
          <p className="kicker text-stone-400 mb-2">Bleeding</p>
          <div className="flex flex-wrap gap-1.5">
            {FLOW.map((f) => <button key={f} onClick={() => setFlow(f)} className={chipCls(selLog.flow === f)}>{f}</button>)}
          </div>
          {selLog.flow && (
            <div className="mt-3">
              <label className="kicker text-stone-400 mb-1.5 block">{selLog.flow === 'Spotting' ? 'Time spotting started' : 'Time it started'}</label>
              <input type="time" value={selLog.flowTime || ''} onChange={(e) => setSel({ flowTime: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
            </div>
          )}
          <p className="mt-2 text-xs italic text-stone-400">Light, Medium or Heavy marks a true period day; Spotting is logged but won't reset your cycle.</p>
        </div>

        <div className="mb-7">
          <p className="kicker text-stone-400 mb-2">Symptoms</p>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOMS.map((s) => <button key={s} onClick={() => toggleSymptom(s)} className={chipCls((selLog.symptoms || []).includes(s))}>{s}</button>)}
          </div>
        </div>

        <div className="grid gap-7 md:grid-cols-[auto,1fr]">
          <div>
            <label className="kicker text-stone-400 mb-2 block">Basal body temp (°F)</label>
            <input type="number" step="0.1" value={selLog.bbt || ''} onChange={(e) => setSel({ bbt: e.target.value })} placeholder="97.8" className="w-24 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
          </div>
          <div>
            <label className="kicker text-stone-400 mb-2 block">Notes</label>
            <textarea value={selLog.notes || ''} onChange={(e) => setSel({ notes: e.target.value })} placeholder={isToday ? 'How you feel today' : 'How you felt'} className="w-full min-h-[90px] resize-y bg-white/60 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
          </div>
        </div>
      </section>

      {/* Predictions — What's Coming */}
      {predictions && (
        <section className="border-t border-stone-200 pt-6">
          <h3 className="font-serif italic text-2xl text-stone-900 mb-4">What's Coming.</h3>
          <div>
            {[
              ['Next period', fmt(predictions.nextPeriod)],
              ['Next ovulation', `${MONTHS[predictions.nextOv.from.getMonth()]} ${predictions.nextOv.from.getDate()} – ${predictions.nextOv.to.getDate()}`],
              ['Next phase', `${predictions.nextPhaseName} · ${fmt(predictions.nextPhaseDate)}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between border-b border-stone-100 py-2.5">
                <span className="kicker text-stone-400">{label}</span>
                <span className="text-sm text-stone-800">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past entries */}
      <section className="border-t border-stone-200 pt-6">
        <h3 className="font-serif italic text-2xl text-stone-900 mb-4">Past entries.</h3>
        {pastKeys.length === 0 ? (
          <p className="text-sm italic text-stone-400">No other logs yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {pastKeys.map((k) => {
              const l = logs[k]
              return (
                <button key={k} onClick={() => setSelectedKey(k)} className="flex w-full items-center justify-between py-2.5 text-left hover:text-stone-900">
                  <span className="text-sm text-stone-700">{fmt(parseKey(k))}</span>
                  <span className="text-xs text-stone-400">{(l.symptoms || []).length} symptom{(l.symptoms || []).length === 1 ? '' : 's'}{l.flow ? ` · ${l.flow}` : ''}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {reading && logs[reading] && (
        <PastEntry dateKeyStr={reading} log={logs[reading]} onClose={() => setReading(null)} />
      )}
    </div>
  )
}

// ── Settings — its own subsection under Cycle ───────────────────────
function CycleSettings({ cycleConfig, setCycleConfig }) {
  const today = new Date()
  const todayKey = dateKey(today)
  const start = cycleConfig.lastPeriodStart || ''
  const history = Array.isArray(cycleConfig.history) ? cycleConfig.history : []
  const setCfg = (patch) => setCycleConfig({ ...cycleConfig, ...patch })
  const setHistory = (arr) => setCfg({ history: arr.filter(Boolean).sort((a, b) => (a < b ? 1 : -1)) })
  const avgLen = averageCycleLength([...history, start])
  const manualPhase = cycleConfig.manualPhase || ''

  return (
    <div className="mb-10">
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-8">Settings.</h2>

      <div className="flex flex-wrap items-end gap-6">
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Last period started</label>
          <input type="date" value={start} onChange={(e) => setCfg({ lastPeriodStart: e.target.value })} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
        <div>
          <label className="kicker text-stone-400 mb-1.5 block">Cycle length</label>
          <input type="number" min="20" max="45" value={cycleConfig.cycleLength || 28} onChange={(e) => setCfg({ cycleLength: Number(e.target.value) })} className="w-16 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
        </div>
      </div>

      <div className="mt-8">
        <label className="kicker text-stone-400 mb-2 block">Phase</label>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setCfg({ manualPhase: '' })} className={`rounded-full px-3.5 py-1.5 text-xs border transition-colors ${!manualPhase ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>Use calculated phase</button>
          <button onClick={() => setCfg({ manualPhase: manualPhase || 'follicular' })} className={`rounded-full px-3.5 py-1.5 text-xs border transition-colors ${manualPhase ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'}`}>Set phase manually</button>
          {manualPhase && (
            <select value={manualPhase} onChange={(e) => setCfg({ manualPhase: e.target.value })} className="ml-1 border-b border-stone-300 bg-transparent pb-1 text-sm outline-none">
              {Object.values(PHASES).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-2 flex items-center gap-3">
          <label className="kicker text-stone-400">Period history</label>
          {history.length >= 3 && avgLen && (
            <button onClick={() => setCfg({ cycleLength: avgLen })} className="text-[11px] uppercase tracking-[0.16em] text-stone-400 hover:text-stone-900">Avg {avgLen}d · use as length</button>
          )}
        </div>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm italic text-stone-400">No past period dates logged.</p>}
          {history.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="date" value={d} onChange={(e) => setHistory(history.map((x, j) => (j === i ? e.target.value : x)))} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
              <button onClick={() => setHistory(history.filter((_, j) => j !== i))} className="text-stone-300 hover:text-stone-700"><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => setHistory([...history, start || todayKey])} className="text-[11px] uppercase tracking-[0.16em] text-stone-400 hover:text-stone-900">Add past date</button>
        </div>
      </div>
    </div>
  )
}

// Fade a hex accent to a soft translucent wash for the round tracker cells.
const withAlpha = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const PHASE_LEGEND = [
  { id: 'menstrual', label: 'Menstrual' },
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
]

// An inline month calendar. Tapping a day SELECTS it for logging (a ring). Period
// days are solid red; every other day is tinted by its projected cycle phase, so
// paging month-to-month shows the whole menstrual/follicular/ovulatory/luteal
// pattern. A small dot marks any day that already carries a log.
function PeriodCalendar({ periodDays, loggedKeys, selectedKey, onSelect, today, cycleConfig = {} }) {
  const { colors, setColor, resetColor } = usePhaseColors()
  const [editPhase, setEditPhase] = useState(null)
  const [month, setMonth] = useState(new Date(parseKey(selectedKey).getFullYear(), parseKey(selectedKey).getMonth(), 1))
  // Follow the selection into its month (e.g. "back to today" or a past entry).
  useEffect(() => {
    const d = parseKey(selectedKey)
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])
  const periodSet = new Set(periodDays)
  const cells = monthGrid(month)
  return (
    <div className="mx-auto max-w-md border border-stone-200 bg-white/40 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">‹</button>
        <span className="font-serif text-lg text-stone-900">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="px-3 py-1 text-base text-stone-500 hover:text-stone-900">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d) => <div key={d} className="text-center text-[9px] uppercase tracking-[0.1em] text-stone-400">{d[0]}</div>)}
        {cells.map((cell) => {
          const k = dateKey(cell)
          const inMonth = cell.getMonth() === month.getMonth()
          const isPeriod = periodSet.has(k)
          const isSel = k === selectedKey
          const isTod = isSameDay(cell, today)
          const logged = loggedKeys.has(k) && !isPeriod
          // Projected phase for this day (calculated, ignoring any manual override).
          const ph = phaseFor(cell, cycleConfig.lastPeriodStart, cycleConfig.cycleLength)
          // Soften the accent into a light wash for these round tracker cells.
          const tint = inMonth && ph ? withAlpha(colors[ph.id], 0.3) : undefined
          const style = isPeriod
            ? { backgroundColor: PHASES.menstrual.color, color: '#FAFAF7' }
            : tint ? { backgroundColor: tint } : undefined
          return (
            <button
              key={k}
              onClick={() => onSelect(k)}
              style={style}
              className={`relative flex aspect-square items-center justify-center rounded-full text-xs transition-colors ${isPeriod ? '' : inMonth ? 'text-stone-700 hover:brightness-95' : 'text-stone-300 hover:bg-stone-100'} ${isSel ? 'ring-2 ring-stone-900' : isTod ? 'ring-1 ring-stone-400' : ''}`}
            >
              {cell.getDate()}
              {logged && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-stone-500" />}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-stone-100 pt-3">
        <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-stone-500">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PHASES.menstrual.color }} />
          Period
        </span>
        {PHASE_LEGEND.filter((p) => p.id !== 'menstrual').map((p) => (
          <button key={p.id} onClick={() => setEditPhase(p.id)} title={`Recolour ${p.label}`} className="group flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-stone-500 transition-colors hover:text-stone-900">
            <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10 transition-transform group-hover:scale-110" style={{ backgroundColor: colors[p.id] }} />
            {p.label}
          </button>
        ))}
        <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-stone-500">
          <span className="inline-block h-1 w-1 rounded-full bg-stone-500" />
          Logged
        </span>
      </div>

      {editPhase && (
        <PhaseColorEditor
          phaseId={editPhase}
          value={colors[editPhase]}
          onSave={(hex) => setColor(editPhase, hex)}
          onReset={() => resetColor(editPhase)}
          onClose={() => setEditPhase(null)}
        />
      )}
    </div>
  )
}

function Prediction({ label, value }) {
  return (
    <div className="border border-stone-200 bg-white/40 p-4">
      <p className="kicker text-stone-400 mb-1.5">{label}</p>
      <p className="font-serif text-lg text-stone-900">{value}</p>
    </div>
  )
}

function PastEntry({ dateKeyStr, log, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-cream border border-stone-300 p-6 shadow-2xl">
        <p className="font-serif italic text-2xl text-stone-900 mb-4">{fmt(parseKey(dateKeyStr))}</p>
        {(log.symptoms || []).length > 0 && (
          <div className="mb-4">
            <p className="kicker text-stone-400 mb-1.5">Symptoms</p>
            <p className="text-sm text-stone-700">{(log.symptoms || []).join(', ')}</p>
          </div>
        )}
        {log.flow && <p className="mb-4 text-sm text-stone-700"><span className="kicker text-stone-400 mr-2">Flow</span>{log.flow}{log.flowTime ? ` · ${log.flowTime}` : ''}{log.periodStart ? ' · Day 1' : ''}</p>}
        {log.bbt && <p className="mb-4 text-sm text-stone-700"><span className="kicker text-stone-400 mr-2">BBT</span>{log.bbt}°F</p>}
        {log.notes && log.notes.trim() && (
          <div className="mb-4">
            <p className="kicker text-stone-400 mb-1.5">Notes</p>
            <p className="text-sm leading-relaxed text-stone-700">{log.notes}</p>
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <button onClick={onClose} className="bg-stone-900 px-5 py-2 text-sm text-cream hover:bg-stone-700">Close</button>
        </div>
      </div>
    </div>
  )
}
