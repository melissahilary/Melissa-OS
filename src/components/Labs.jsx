import React, { useMemo, useRef, useState } from 'react'
import { X, Plus, Link2, ClipboardPaste, PenLine, ChevronRight, Upload } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLifeStage } from '../lib/lifeStage'
import { phaseForConfig } from '../lib/cycle'
import { dateKey, parseKey, MONTHS } from '../lib/date'
import {
  BIOMARKERS, BY_ID, PANELS, byPanel, resolveMarker, toCanonical, unitsFor,
  rangeFor, placeValue, positionIn, STATE_COLOR, STATE_LABEL,
} from '../lib/biomarkers'
import { readAny } from '../lib/labImport'

const uid = () => Math.random().toString(36).slice(2, 10)
const fmtDate = (k) => { const d = parseKey(k); return d ? `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}` : k }
const num = (v) => { const n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null }
// Labs report to the precision the assay actually has. A converted value
// carries false precision if you print it whole — 95 nmol/L is 38.1 ng/mL, not
// 38.06 — so significance follows magnitude.
const round = (n) => {
  if (n == null || !Number.isFinite(n)) return ''
  const a = Math.abs(n)
  if (a >= 100) return Math.round(n)
  if (a >= 10) return Math.round(n * 10) / 10
  return Math.round(n * 100) / 100
}

// ── The record ──────────────────────────────────────────────────────
// A reading is an event: this marker, this number, on this date, at this point
// in her cycle. Held flat rather than nested under each marker, because the
// questions worth asking later run across markers, not down one.
const emptyRecord = { markers: {}, readings: [] }

const normRecord = (r) => {
  if (!r || typeof r !== 'object') return emptyRecord
  return {
    markers: r.markers && typeof r.markers === 'object' ? r.markers : {},
    readings: Array.isArray(r.readings) ? r.readings : [],
  }
}

// The old shelf held free-text markers with their own readings. Nothing is
// thrown away: anything the catalogue recognises is folded in under its
// canonical id, and anything it doesn't becomes a marker she keeps by hand.
function migrateLegacy(legacy, record) {
  const rows = Array.isArray(legacy) ? legacy : []
  if (!rows.length) return record
  const out = { markers: { ...record.markers }, readings: [...record.readings] }
  rows.forEach((m) => {
    const name = (m.name || '').trim()
    if (!name) return
    const known = resolveMarker(name)
    const id = known ? known.id : `custom:${name.toLowerCase().replace(/\s+/g, '-')}`
    if (!out.markers[id]) {
      out.markers[id] = known
        ? { id, notes: m.notes || '' }
        : { id, custom: true, label: name, unit: '', range: m.range || '', notes: m.notes || '' }
    }
    const readings = Array.isArray(m.readings) ? m.readings : []
    const single = !readings.length && (m.result || '').trim() ? [{ value: m.result, unit: m.unit, date: m.date }] : []
    ;[...readings, ...single].forEach((r) => {
      const v = num(r.value)
      if (v == null) return
      out.readings.push({
        id: uid(),
        marker: id,
        date: r.date || '',
        value: v,
        unit: r.unit || (known ? known.unit : ''),
        canonical: known ? toCanonical(known, v, r.unit || known.unit) : v,
        labRange: null,
        source: 'hand',
      })
    })
  })
  return out
}

export default function Labs({ cycleConfig }) {
  const [raw, setRaw] = useLocalStorage('mos:labs', emptyRecord)
  const [legacy, setLegacy] = useLocalStorage('mos:diagnostics', [])
  const [migrated, setMigrated] = useLocalStorage('mos:labs:migrated', '')
  const { stage } = useLifeStage()
  const [openId, setOpenId] = useState(null)
  const [route, setRoute] = useState(null) // connect | import | hand

  const record = normRecord(raw)

  // One-time fold of the old free-text shelf into the catalogue.
  React.useEffect(() => {
    if (migrated) return
    const rows = Array.isArray(legacy) ? legacy : []
    if (rows.length) setRaw(migrateLegacy(rows, normRecord(raw)))
    setMigrated(dateKey(new Date()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrated])

  const ctx = useMemo(() => ({ stage }), [stage])

  const readingsFor = (id) => record.readings
    .filter((r) => r.marker === id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const addReadings = (rows, { date, source }) => {
    setRaw((prev) => {
      const rec = normRecord(prev)
      const markers = { ...rec.markers }
      const readings = [...rec.readings]
      rows.forEach((r) => {
        if (!markers[r.marker]) markers[r.marker] = { id: r.marker, notes: '' }
        readings.push({ id: uid(), source, ...r, date: r.date || date })
      })
      return { markers, readings }
    })
  }

  const watch = (id) => setRaw((prev) => {
    const rec = normRecord(prev)
    if (rec.markers[id]) return rec
    return { ...rec, markers: { ...rec.markers, [id]: { id, notes: '' } } }
  })
  const unwatch = (id) => setRaw((prev) => {
    const rec = normRecord(prev)
    const markers = { ...rec.markers }
    delete markers[id]
    return { markers, readings: rec.readings.filter((r) => r.marker !== id) }
  })
  const dropReading = (rid) => setRaw((prev) => {
    const rec = normRecord(prev)
    return { ...rec, readings: rec.readings.filter((r) => r.id !== rid) }
  })
  const setNotes = (id, notes) => setRaw((prev) => {
    const rec = normRecord(prev)
    return { ...rec, markers: { ...rec.markers, [id]: { ...(rec.markers[id] || { id }), notes } } }
  })

  const watched = Object.keys(record.markers)
  const open = openId ? (BY_ID[openId] || record.markers[openId]) : null

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <p className="mb-8 text-center font-serif italic text-lg text-stone-500">
        Every number you have, in one place, read against the body you actually have.
      </p>

      <Intake route={route} setRoute={setRoute} onAdd={addReadings} cycleConfig={cycleConfig} stage={stage} />

      {watched.length === 0 ? (
        <Empty onWatch={watch} />
      ) : (
        <div className="mt-10 space-y-8">
          {PANELS.map((panel) => {
            const ids = watched.filter((id) => (BY_ID[id] || {}).panel === panel.id)
            if (!ids.length) return null
            return (
              <section key={panel.id}>
                <div className="mb-3 border-b border-stone-200 pb-2">
                  <h2 className="kicker text-stone-400">{panel.label}</h2>
                  <p className="mt-1 text-xs text-stone-400">{panel.blurb}</p>
                </div>
                <div className="divide-y divide-stone-100">
                  {ids.map((id) => (
                    <MarkerRow key={id} marker={BY_ID[id]} readings={readingsFor(id)} ctx={ctx} onOpen={() => setOpenId(id)} />
                  ))}
                </div>
              </section>
            )
          })}

          {/* Anything the catalogue never knew — kept, never quietly dropped. */}
          {watched.some((id) => id.startsWith('custom:')) && (
            <section>
              <div className="mb-3 border-b border-stone-200 pb-2">
                <h2 className="kicker text-stone-400">Your own</h2>
                <p className="mt-1 text-xs text-stone-400">Markers outside the catalogue, kept as you wrote them.</p>
              </div>
              <div className="divide-y divide-stone-100">
                {watched.filter((id) => id.startsWith('custom:')).map((id) => (
                  <MarkerRow key={id} marker={record.markers[id]} readings={readingsFor(id)} ctx={ctx} onOpen={() => setOpenId(id)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {open && (
        <MarkerSheet
          marker={open}
          entry={record.markers[openId] || {}}
          readings={readingsFor(openId)}
          ctx={ctx}
          onClose={() => setOpenId(null)}
          onNotes={(n) => setNotes(openId, n)}
          onDropReading={dropReading}
          onRemove={() => { unwatch(openId); setOpenId(null) }}
        />
      )}
    </div>
  )
}

// ── The three ways in ───────────────────────────────────────────────
// Manual entry is the floor, not the plan. Most of a woman's numbers already
// exist somewhere — the job of this row is to make typing them the last resort
// rather than the only option.
function Intake({ route, setRoute, onAdd, cycleConfig, stage }) {
  const routes = [
    { id: 'import', icon: ClipboardPaste, label: 'Paste a report', blurb: 'Any lab PDF, portal page or email. It reads the markers out.' },
    { id: 'connect', icon: Link2, label: 'Connect a source', blurb: 'Where your numbers already live, and how to get them out.' },
    { id: 'hand', icon: PenLine, label: 'Add by hand', blurb: 'One number, from the catalogue.' },
  ]
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {routes.map((r) => {
          const on = route === r.id
          const Icon = r.icon
          return (
            <button
              key={r.id}
              onClick={() => setRoute(on ? null : r.id)}
              className={`rounded-2xl border p-4 text-left transition-all ${on ? 'border-stone-900 bg-white/70' : 'border-stone-200 hover:border-stone-400'}`}
            >
              <Icon size={16} strokeWidth={1.6} className={on ? 'text-stone-900' : 'text-stone-400'} />
              <p className="mt-2 font-serif text-lg leading-tight text-stone-900">{r.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-stone-400">{r.blurb}</p>
            </button>
          )
        })}
      </div>

      {route === 'import' && <ImportPanel onAdd={onAdd} cycleConfig={cycleConfig} onDone={() => setRoute(null)} />}
      {route === 'connect' && <ConnectPanel onPaste={() => setRoute('import')} />}
      {route === 'hand' && <ByHand onAdd={onAdd} cycleConfig={cycleConfig} stage={stage} onDone={() => setRoute(null)} />}
    </div>
  )
}

// ── Paste a report ──────────────────────────────────────────────────
function ImportPanel({ onAdd, cycleConfig, onDone }) {
  const [text, setText] = useState('')
  const [date, setDate] = useState(dateKey(new Date()))
  const [skip, setSkip] = useState({})
  const fileRef = useRef(null)

  const parsed = useMemo(() => (text.trim() ? readAny(text) : { found: [], unread: [] }), [text])
  const phase = useMemo(() => phaseForConfig(cycleConfig, parseKey(date) || new Date()), [cycleConfig, date])

  const take = parsed.found.filter((f) => !skip[f.marker])

  const commit = () => {
    if (!take.length) return
    onAdd(take.map((f) => ({
      marker: f.marker,
      value: f.value,
      unit: f.unit || (BY_ID[f.marker] || {}).unit || '',
      canonical: f.canonical,
      labRange: f.labRange || null,
      date: f.date || date,
      cycleDay: phase ? phase.cycleDay : null,
      phase: phase ? phase.id : null,
    })), { date, source: 'import' })
    setText('')
    onDone()
  }

  const readFile = (file) => {
    if (!file) return
    const r = new FileReader()
    r.onload = () => setText(String(r.result || ''))
    r.readAsText(file)
  }

  return (
    <div className="mt-4 rounded-2xl border border-stone-900 bg-white/60 p-5">
      <p className="text-sm text-stone-500">
        Select the whole results page — from the lab’s portal, the PDF, the email — and paste it here.
        Nothing is guessed: you’ll see exactly what was read before anything is kept.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData && e.clipboardData.getData('text')
          if (t) { e.preventDefault(); setText(t) }
        }}
        rows={text ? 5 : 7}
        placeholder={'Ferritin, Serum          22      ng/mL     15–150\nVitamin D, 25-Hydroxy    38.2    ng/mL     30–100\nTSH                      2.85    uIU/mL    0.45–4.50'}
        className="mt-3 w-full resize-y rounded-xl border border-stone-200 bg-cream/60 p-3 font-mono text-[12px] leading-relaxed text-stone-700 outline-none placeholder:text-stone-300 focus:border-stone-900"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button onClick={() => fileRef.current && fileRef.current.click()} className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900">
          <Upload size={13} strokeWidth={1.7} /> or open a .csv / .txt file
        </button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/plain" className="hidden" onChange={(e) => readFile(e.target.files && e.target.files[0])} />
      </div>

      {!!parsed.found.length && (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 pb-2">
            <p className="kicker text-stone-400">Read · {parsed.found.length}</p>
            <label className="flex items-center gap-2 text-xs text-stone-400">
              Drawn
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-b border-stone-300 bg-transparent pb-0.5 text-xs text-stone-700 outline-none focus:border-stone-900" />
              {phase && <span style={{ color: phase.color }}>· day {phase.cycleDay}, {phase.name.toLowerCase()}</span>}
            </label>
          </div>
          <div className="divide-y divide-stone-100">
            {parsed.found.map((f) => {
              const m = BY_ID[f.marker]
              const off = !!skip[f.marker]
              return (
                <label key={f.marker} className={`flex cursor-pointer items-center gap-3 py-2 ${off ? 'opacity-40' : ''}`}>
                  <input type="checkbox" checked={!off} onChange={() => setSkip((s) => ({ ...s, [f.marker]: !off }))} className="h-3.5 w-3.5 shrink-0 accent-stone-900" />
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{m ? m.label : f.name}</span>
                  <span className="shrink-0 font-serif text-base text-stone-900">{round(f.value)}</span>
                  <span className="w-20 shrink-0 text-[11px] text-stone-400">{f.unit || (m && m.unit)}</span>
                  {f.labRange && (
                    <span className="hidden w-24 shrink-0 text-right text-[10px] text-stone-400 sm:block">
                      lab {f.labRange[0] == null ? '<' : f.labRange[0]}{f.labRange[0] != null && f.labRange[1] != null ? '–' : ''}{f.labRange[1] == null ? '' : f.labRange[1]}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          <button onClick={commit} disabled={!take.length} className="mt-4 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-30">
            Keep {take.length} result{take.length === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {!!parsed.unread.length && (
        <div className="mt-5 border-t border-stone-200 pt-3">
          <p className="kicker text-stone-400">Not recognised · {parsed.unread.length}</p>
          <p className="mt-1 text-[11px] text-stone-400">
            These lines held a number the catalogue doesn’t know. Nothing was dropped silently — add any of them by hand.
          </p>
          <ul className="mt-2 space-y-0.5">
            {parsed.unread.slice(0, 8).map((u, i) => (
              <li key={i} className="truncate font-mono text-[11px] text-stone-400">{u}</li>
            ))}
          </ul>
        </div>
      )}

      {!!text.trim() && !parsed.found.length && (
        <p className="mt-4 text-sm text-stone-400">Nothing recognisable yet — paste the results table itself, including the units column.</p>
      )}
    </div>
  )
}

// ── Connect a source ────────────────────────────────────────────────
// None of these silos offer a consumer API, and saying "connected" when nothing
// is connected would be the worst kind of decoration. So this room does the one
// genuinely useful thing available today: it tells her exactly how to get her
// own data out of each place, and hands it to the reader that understands it.
const SOURCES = [
  { id: 'function', label: 'Function Health', holds: 'Full biomarker panels, twice yearly', how: 'Open a result → Download report, or select the biomarker table on the results page and copy it.' },
  { id: 'quest', label: 'Quest / MyQuest', holds: 'Routine and specialist panels', how: 'MyQuest → Results → View → Download PDF. Open it, select all, copy.' },
  { id: 'labcorp', label: 'Labcorp OnDemand', holds: 'Routine and specialist panels', how: 'Labcorp Patient → Results → the results table copies cleanly as text.' },
  { id: 'apple', label: 'Apple Health', holds: 'Lab records synced from your providers', how: 'Health → Browse → Lab Results, or Profile → Export All Health Data for the full archive.' },
  { id: 'oura', label: 'Oura', holds: 'Sleep, HRV, overnight temperature', how: 'Oura web → Account → Export data. Trends land here; nightly detail stays in Oura.' },
  { id: 'clinic', label: 'Your clinic’s portal', holds: 'Everything ordered through your doctor', how: 'Almost every portal runs on MyChart or similar — the results page selects and copies as plain text.' },
]

function ConnectPanel({ onPaste }) {
  const [openId, setOpenId] = useState(null)
  return (
    <div className="mt-4 rounded-2xl border border-stone-900 bg-white/60 p-5">
      <p className="text-sm text-stone-500">
        Your numbers are scattered across places that don’t talk to each other, and none of them yet offer
        a door to walk through. Until they do, here is how to get your own data out of each — and it lands
        in the same record either way.
      </p>
      <div className="mt-4 divide-y divide-stone-100">
        {SOURCES.map((s) => {
          const on = openId === s.id
          return (
            <div key={s.id}>
              <button onClick={() => setOpenId(on ? null : s.id)} className="flex w-full items-center gap-3 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-stone-800">{s.label}</span>
                  <span className="block text-[11px] text-stone-400">{s.holds}</span>
                </span>
                <span className="shrink-0 text-[10px] tracking-[0.14em] text-stone-400">EXPORT</span>
                <ChevronRight size={14} className={`shrink-0 text-stone-300 transition-transform ${on ? 'rotate-90' : ''}`} />
              </button>
              {on && (
                <div className="pb-4 pl-0 pr-8">
                  <p className="text-[12px] leading-relaxed text-stone-500">{s.how}</p>
                  <button onClick={onPaste} className="mt-2 text-[11px] tracking-[0.12em] text-stone-900 underline underline-offset-4">PASTE IT HERE</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-4 border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-400">
        Direct sync arrives here first as each source opens one. Nothing on this list is connected today,
        and the app will never say otherwise.
      </p>
    </div>
  )
}

// ── Add by hand ─────────────────────────────────────────────────────
function ByHand({ onAdd, cycleConfig, stage, onDone }) {
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(null)
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [date, setDate] = useState(dateKey(new Date()))

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const hit = resolveMarker(t)
    const list = BIOMARKERS.filter((b) => b.label.toLowerCase().includes(t) || (b.short || '').toLowerCase().includes(t) || (b.aliases || []).some((a) => a.includes(t)))
    if (hit && !list.some((b) => b.id === hit.id)) list.unshift(hit)
    return list.slice(0, 8)
  }, [q])

  const choose = (m) => { setPick(m); setUnit(m.unit); setQ('') }
  const phase = useMemo(() => phaseForConfig(cycleConfig, parseKey(date) || new Date()), [cycleConfig, date])
  const canonical = pick ? toCanonical(pick, value, unit) : null
  const placed = pick && canonical != null ? placeValue(pick, canonical, { stage, phase: phase ? phase.id : null }) : null

  const commit = () => {
    if (!pick || canonical == null) return
    onAdd([{
      marker: pick.id,
      value: num(value),
      unit,
      canonical,
      labRange: null,
      date,
      cycleDay: phase ? phase.cycleDay : null,
      phase: phase ? phase.id : null,
    }], { date, source: 'hand' })
    setPick(null); setValue(''); setQ('')
    onDone()
  }

  return (
    <div className="mt-4 rounded-2xl border border-stone-900 bg-white/60 p-5">
      {!pick ? (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Which marker — ferritin, estradiol, TSH…"
            className="w-full border-b border-stone-300 bg-transparent pb-1.5 text-sm outline-none placeholder:text-stone-300 focus:border-stone-900"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(matches.length ? matches : BIOMARKERS.slice(0, 10)).map((m) => (
              <button key={m.id} onClick={() => choose(m)} className="rounded-full border border-stone-300 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">
                {m.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-serif text-xl text-stone-900">{pick.label}</p>
            <button onClick={() => setPick(null)} className="text-xs text-stone-400 hover:text-stone-900">change</button>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="min-w-[7rem] flex-1">
              <span className="kicker mb-1 block text-stone-400">Value</span>
              <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus className="w-full border-b border-stone-300 bg-transparent pb-1 font-serif text-xl outline-none focus:border-stone-900" />
            </label>
            <label>
              <span className="kicker mb-1 block text-stone-400">Unit</span>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="border-b border-stone-300 bg-transparent pb-1.5 text-sm outline-none focus:border-stone-900">
                {unitsFor(pick).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label>
              <span className="kicker mb-1 block text-stone-400">Drawn</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-b border-stone-300 bg-transparent pb-1.5 text-sm outline-none focus:border-stone-900" />
            </label>
          </div>

          {unit !== pick.unit && canonical != null && (
            <p className="mt-3 text-[11px] text-stone-400">
              = {round(canonical)} {pick.unit} — converted so it can sit beside your other readings.
            </p>
          )}
          {placed && <Reading marker={pick} canonical={canonical} placed={placed} className="mt-4" />}

          <button onClick={commit} disabled={canonical == null} className="mt-5 rounded-full bg-stone-900 px-5 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-30">
            Keep it
          </button>
        </>
      )}
    </div>
  )
}

// ── Where a number sits ─────────────────────────────────────────────
// The band, drawn. A green dot and a red dot answer "is this flagged" — which
// is not the question anyone actually has. This answers "where am I, against
// what, and why that range".
function Reading({ marker, canonical, placed, className = '' }) {
  const band = placed.band
  const pos = band ? positionIn(band, canonical) : null
  const opt = placed.optimal
  return (
    <div className={className}>
      {band ? (
        <>
          <div className="relative h-[3px] w-full rounded-full bg-stone-200">
            {opt && (
              <span
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${(positionIn(band, opt[0] == null ? band[0] : opt[0]) || 0) * 100}%`,
                  right: `${100 - (positionIn(band, opt[1] == null ? band[1] : opt[1]) || 1) * 100}%`,
                  backgroundColor: '#7C8B6B',
                  opacity: 0.45,
                }}
              />
            )}
            <span
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${Math.max(0, Math.min(1, pos)) * 100}%`, backgroundColor: STATE_COLOR[placed.state] }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-stone-400">
            <span>{band[0] == null ? '' : band[0]}</span>
            <span style={{ color: STATE_COLOR[placed.state] }}>{STATE_LABEL[placed.state]}</span>
            <span>{band[1] == null ? '' : band[1]}</span>
          </div>
        </>
      ) : (
        <p className="text-[11px] text-stone-400">{STATE_LABEL.unknown}</p>
      )}
      <p className="mt-1 text-[10px] tracking-[0.14em] text-stone-400">{(placed.basis || '').toUpperCase()}</p>
    </div>
  )
}

// ── A row in the record ─────────────────────────────────────────────
function MarkerRow({ marker, readings, ctx, onOpen }) {
  const latest = readings[0] || null
  const custom = !marker || marker.custom
  const canonical = latest ? (latest.canonical != null ? latest.canonical : num(latest.value)) : null
  const placed = !custom && canonical != null
    ? placeValue(marker, canonical, { ...ctx, phase: latest.phase || null })
    : null

  const nums = readings.map((r) => (r.canonical != null ? r.canonical : num(r.value))).filter((n) => n != null)
  const trend = nums.length >= 2 ? (nums[0] > nums[1] ? '↑' : nums[0] < nums[1] ? '↓' : '·') : null

  return (
    <button onClick={onOpen} className="flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-stone-500/[0.03]">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-stone-800">{marker ? marker.label : 'Marker'}</span>
        {latest ? (
          <span className="block text-[11px] text-stone-400">
            {fmtDate(latest.date)}
            {latest.cycleDay ? ` · day ${latest.cycleDay}` : ''}
            {latest.source === 'import' ? ' · imported' : ''}
          </span>
        ) : (
          <span className="block text-[11px] text-stone-300">No reading yet</span>
        )}
      </span>

      {latest && (
        <span className="shrink-0 text-right">
          <span className="block font-serif text-lg leading-none text-stone-900">
            {round(canonical)}
            {trend && <span className="ml-1 text-xs text-stone-400">{trend}</span>}
          </span>
          <span className="block text-[10px] text-stone-400">{marker && marker.unit ? marker.unit : latest.unit}</span>
        </span>
      )}

      <span className="w-28 shrink-0 sm:w-40">
        {placed ? <Reading marker={marker} canonical={canonical} placed={placed} /> : <span className="block h-[3px] rounded-full bg-stone-100" />}
      </span>
      <ChevronRight size={14} className="shrink-0 text-stone-300" />
    </button>
  )
}

// ── The dossier ─────────────────────────────────────────────────────
function MarkerSheet({ marker, entry, readings, ctx, onClose, onNotes, onDropReading, onRemove }) {
  const custom = !marker || marker.custom
  const latest = readings[0] || null
  const canonical = latest ? (latest.canonical != null ? latest.canonical : num(latest.value)) : null
  const placed = !custom && canonical != null ? placeValue(marker, canonical, { ...ctx, phase: latest.phase || null }) : null
  const applies = !custom ? rangeFor(marker, { ...ctx, phase: latest ? latest.phase : null }) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/25 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-cream p-6 sm:rounded-3xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-serif text-2xl leading-tight text-stone-900">{marker.label}</h3>
            {!custom && <p className="mt-0.5 text-[11px] tracking-[0.14em] text-stone-400">{(PANELS.find((p) => p.id === marker.panel) || {}).label?.toUpperCase()}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>

        {latest && placed && (
          <div className="mb-5 rounded-2xl border border-stone-200 bg-white/50 p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl text-stone-900">{round(canonical)}</span>
              <span className="text-sm text-stone-400">{marker.unit}</span>
              <span className="ml-auto text-[11px] text-stone-400">{fmtDate(latest.date)}</span>
            </div>
            <Reading marker={marker} canonical={canonical} placed={placed} className="mt-3" />
            {latest.labRange && (
              <p className="mt-2 text-[11px] text-stone-400">
                Your lab printed {latest.labRange[0] == null ? `< ${latest.labRange[1]}` : latest.labRange[1] == null ? `> ${latest.labRange[0]}` : `${latest.labRange[0]}–${latest.labRange[1]}`} — where they differ, your lab’s range governs.
              </p>
            )}
          </div>
        )}

        {!custom && marker.note && (
          <p className="mb-5 font-serif italic text-[15px] leading-relaxed text-stone-500">{marker.note}</p>
        )}

        {applies && !applies.band && (
          <p className="mb-5 text-sm text-stone-500">{applies.basis}.</p>
        )}

        {/* Every reading, with the day of her cycle it was taken on — which for
            half these markers is the difference between a number and a fact. */}
        <div className="mb-5">
          <p className="kicker mb-2 text-stone-400">History</p>
          {readings.length === 0 ? (
            <p className="text-sm text-stone-400">Nothing recorded yet.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {readings.map((r) => {
                const c = r.canonical != null ? r.canonical : num(r.value)
                const p = !custom && c != null ? placeValue(marker, c, { ...ctx, phase: r.phase || null }) : null
                return (
                  <div key={r.id} className="group flex items-center gap-3 py-2">
                    <span className="w-24 shrink-0 text-[11px] text-stone-400">{fmtDate(r.date)}</span>
                    <span className="font-serif text-base text-stone-900">{round(c)}</span>
                    <span className="text-[10px] text-stone-400">{marker.unit || r.unit}</span>
                    {r.cycleDay && <span className="text-[10px] text-stone-400">· day {r.cycleDay}</span>}
                    {p && <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATE_COLOR[p.state] }} title={STATE_LABEL[p.state]} />}
                    <button onClick={() => onDropReading(r.id)} className="shrink-0 text-stone-300 opacity-0 transition-opacity hover:text-stone-900 group-hover:opacity-100" aria-label="Remove reading">
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-5">
          <p className="kicker mb-1.5 text-stone-400">Notes</p>
          <textarea
            value={entry.notes || ''}
            onChange={(e) => onNotes(e.target.value)}
            rows={2}
            className="w-full resize-y rounded-xl border border-stone-200 bg-white/50 p-2.5 text-sm outline-none focus:border-stone-900"
          />
        </div>

        <button onClick={onRemove} className="text-xs text-stone-400 hover:text-phase-menstrual">Stop watching this marker</button>
      </div>
    </div>
  )
}

// ── Nothing yet ─────────────────────────────────────────────────────
function Empty({ onWatch }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-stone-200 p-8 text-center">
      <p className="font-serif italic text-lg text-stone-400">Nothing watched yet.</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-stone-400">
        Paste your last panel above and it fills itself — or start with the markers most worth watching in a woman’s body.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {['ferritin', 'vitamin_d', 'tsh', 'estradiol', 'progesterone', 'hba1c', 'hscrp', 'b12', 'apob', 'fsh'].map((id) => (
          <button key={id} onClick={() => onWatch(id)} className="rounded-full border border-stone-300 px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-cream">
            {BY_ID[id].label}
          </button>
        ))}
      </div>
    </div>
  )
}
