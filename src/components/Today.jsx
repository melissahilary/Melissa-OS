import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseForConfig, PHASES } from '../lib/cycle'
import {
  dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW,
} from '../lib/date'
import { holidayFor } from '../lib/holidays'
import Horoscope from './Horoscope'
import { AddMealForm } from './shared/MealSlots'
import { slotMeta } from '../lib/meals'
import { useRegisterAdd, AddChooser } from './shared/AddButton'
import Checkbox from './shared/Checkbox'
import ActivityForm from './shared/ActivityForm'
import { useActivities } from '../hooks/useActivities'
import { activityOccursOn, isDoneOn, toMealShape, blankActivity, SECTION_CATS, partsOfActivity } from '../lib/activities'
import LocationField, { resolveCoords, locKey } from './shared/LocationField'

// Hourly UV index for the location, keyed by UTC hour ("YYYY-MM-DDTHH:00") so the
// current-hour value can be picked as the day progresses. Null on failure.
async function fetchUvHourly(location) {
  const loc = await resolveCoords(location)
  if (!loc) return null
  const f = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=uv_index&timezone=GMT&forecast_days=2`,
  )
  const fj = await f.json()
  const times = fj && fj.hourly && fj.hourly.time
  const vals = fj && fj.hourly && fj.hourly.uv_index
  if (!Array.isArray(times) || !Array.isArray(vals)) return null
  const map = {}
  times.forEach((t, i) => { map[t] = vals[i] })
  return map
}

// UTC-hour key matching Open-Meteo's GMT hourly timestamps.
const utcHourKey = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:00`

// UV exposure band by index. 0–2 low · 3–5 moderate · 6–7 high · 8+ very high.
const uvBand = (n) => (n <= 2 ? 'low' : n <= 5 ? 'moderate' : n <= 7 ? 'high' : 'very high')
const UV_TITLE = { low: 'Low', moderate: 'Moderate', high: 'High', 'very high': 'Very High' }
const UV_ADVICE = {
  low: 'SPF on face and hands',
  moderate: 'SPF everywhere, hat outdoors',
  high: 'SPF, hat, UPF gloves driving',
  'very high': 'SPF, hat, UPF gloves, UV umbrella',
}
const uvLabel = (n) => UV_TITLE[uvBand(n)]

// ── Cycle statistics — staged so a baseline only appears once enough data exists.
const daysBetweenKeys = (a, b) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000)
const addDaysKey = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d) }
const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length
const fmtDay = (k) => { const d = parseKey(k); return `${MONTHS[d.getMonth()]} ${d.getDate()}` }
const regularityLabel = (spread) => (spread <= 4 ? 'Very regular' : spread <= 7 ? 'Regular' : spread <= 9 ? 'Mostly regular' : 'Irregular')

// Contiguous period runs from the marked days.
function periodRuns(days) {
  const sorted = [...new Set((days || []).filter(Boolean))].sort()
  const runs = []
  sorted.forEach((d) => {
    const last = runs[runs.length - 1]
    if (last && daysBetweenKeys(last[last.length - 1], d) === 1) last.push(d)
    else runs.push([d])
  })
  return runs
}

// Heuristic BBT ovulation: first sustained thermal shift within a cycle window.
function detectOvulation(startKey, endKey, logs) {
  const temps = []
  for (let k = startKey; k < endKey; k = addDaysKey(k, 1)) {
    const b = logs[k] ? parseFloat(logs[k].bbt) : NaN
    temps.push(Number.isFinite(b) ? b : null)
  }
  const keysList = []
  for (let k = startKey, i = 0; i < temps.length; k = addDaysKey(k, 1), i++) keysList.push(k)
  if (temps.filter((t) => t != null).length < 8) return null
  for (let i = 3; i < temps.length - 1; i++) {
    const prior = temps.slice(Math.max(0, i - 3), i).filter((v) => v != null)
    if (prior.length < 2 || temps[i] == null) continue
    const base = mean(prior)
    if (temps[i] >= base + 0.3 && temps[i + 1] != null && temps[i + 1] >= base + 0.2) return keysList[i]
  }
  return null
}

function cycleStats({ cycleConfig, logs, today }) {
  const todayKey = dateKey(today)
  const periodDays = Array.isArray(cycleConfig.periodDays) && cycleConfig.periodDays.length
    ? cycleConfig.periodDays
    : [...(cycleConfig.history || []), cycleConfig.lastPeriodStart].filter(Boolean)
  const runs = periodRuns(periodDays)
  const runStarts = runs.map((r) => r[0])
  const periodLengths = runs.map((r) => r.length)
  const intervals = []
  for (let i = 1; i < runStarts.length; i++) intervals.push(daysBetweenKeys(runStarts[i - 1], runStarts[i]))
  const numPeriods = runs.length
  const numIntervals = intervals.length

  const avgCycle = numIntervals ? Math.round(mean(intervals)) : (Number(cycleConfig.cycleLength) > 0 ? Number(cycleConfig.cycleLength) : 28)
  const avgPeriodLen = numPeriods ? Math.round(mean(periodLengths) * 10) / 10 : null

  const lastStart = runStarts[runStarts.length - 1] || cycleConfig.lastPeriodStart || ''
  const currentDay = lastStart ? daysBetweenKeys(lastStart, todayKey) + 1 : null
  const nextPeriodKey = lastStart ? addDaysKey(lastStart, avgCycle) : null
  const daysToNext = nextPeriodKey ? daysBetweenKeys(todayKey, nextPeriodKey) : null

  const lutealLens = []
  for (let i = 0; i < runStarts.length - 1; i++) {
    const ov = detectOvulation(runStarts[i], runStarts[i + 1], logs)
    if (ov) lutealLens.push(daysBetweenKeys(ov, runStarts[i + 1]))
  }
  const avgLuteal = lutealLens.length >= 2 ? Math.round(mean(lutealLens)) : null

  const ovKey = nextPeriodKey ? addDaysKey(nextPeriodKey, -(avgLuteal || 14)) : null
  const daysToOv = ovKey ? daysBetweenKeys(todayKey, ovKey) : null
  const spread = numIntervals >= 1 ? Math.max(...intervals) - Math.min(...intervals) : null

  return { numPeriods, numIntervals, avgCycle, avgPeriodLen, currentDay, nextPeriodKey, daysToNext, avgLuteal, lutealCount: lutealLens.length, ovKey, daysToOv, spread }
}

// Build the ordered rows for the pop-up, each with staged unlock messaging.
function buildCycleRows(s) {
  const rows = []
  const { numPeriods, numIntervals, avgCycle, avgPeriodLen, currentDay, nextPeriodKey, daysToNext, avgLuteal, lutealCount, ovKey, daysToOv, spread } = s

  if (currentDay != null) {
    let value = `Day ${currentDay}`, note = ''
    if (numIntervals >= 1) {
      if (currentDay > avgCycle + 1) { value += ' · running long'; note = `past your ~${avgCycle}-day average` }
      else { value += ` of ~${avgCycle}`; note = currentDay < avgCycle - 1 ? 'on track' : 'right around your average' }
    }
    rows.push({ label: 'This cycle', value, note })
  } else rows.push({ label: 'This cycle', value: 'Collecting', note: 'Mark your period days to begin.' })

  if (daysToNext != null && nextPeriodKey) {
    let value
    if (daysToNext > 1) value = `In ${daysToNext} days · ${fmtDay(nextPeriodKey)}`
    else if (daysToNext === 1) value = `Tomorrow · ${fmtDay(nextPeriodKey)}`
    else if (daysToNext === 0) value = 'Expected today'
    else value = `Overdue ${Math.abs(daysToNext)} day${daysToNext === -1 ? '' : 's'}`
    const note = numIntervals >= 1 ? (numIntervals < 3 ? 'preliminary estimate' : '') : `on a ${avgCycle}-day default until you log more`
    rows.push({ label: 'Next period', value, note })
  } else rows.push({ label: 'Next period', value: 'Collecting', note: 'Log a period to project this.' })

  if (daysToOv != null && ovKey) {
    let value
    if (daysToOv >= -1 && daysToOv <= 1) value = 'Ovulating now · fertile window'
    else if (daysToOv > 1) value = `In ${daysToOv} days · ${fmtDay(ovKey)}`
    else value = `Passed · was ${fmtDay(ovKey)}`
    rows.push({ label: 'Ovulation', value, note: avgLuteal ? `from your ~${avgLuteal}-day luteal phase` : 'estimated ~14 days before your period' })
  } else rows.push({ label: 'Ovulation', value: 'Collecting', note: '' })

  rows.push(numPeriods >= 1 && avgPeriodLen != null
    ? { label: 'Average period length', value: `${avgPeriodLen} days`, note: numPeriods < 3 ? `preliminary · ${numPeriods} logged, firms up by 3` : '' }
    : { label: 'Average period length', value: 'Collecting', note: 'Log your first full period.' })

  rows.push(numIntervals >= 1
    ? { label: 'Average cycle length', value: `${avgCycle} days`, note: numIntervals < 3 ? `preliminary · ${numIntervals} cycle${numIntervals > 1 ? 's' : ''} logged` : numIntervals < 6 ? 'solidifying' : 'trustworthy' }
    : { label: 'Average cycle length', value: 'Collecting', note: 'Unlocks at your 2nd period — two starts make one cycle.' })

  rows.push(avgLuteal != null
    ? { label: 'Average luteal phase', value: `${avgLuteal} days`, note: lutealCount < 3 ? `early read · ${lutealCount} confirmed ovulation${lutealCount > 1 ? 's' : ''}` : 'a real hormone-health signal' }
    : { label: 'Average luteal phase', value: 'Collecting', note: 'Needs daily BBT through 2–3 ovulations (~month 3–4).' })

  rows.push(numIntervals >= 3 && spread != null
    ? { label: 'Cycle regularity', value: `${regularityLabel(spread)} · varies ${spread} day${spread === 1 ? '' : 's'}`, note: numIntervals < 6 ? 'early — reliable at 6 cycles' : numIntervals < 12 ? 'solid' : 'clinical-grade' }
    : { label: 'Cycle regularity', value: 'Collecting', note: 'Unlocks at 3 cycles (~month 4); reliable at 6.' })

  return rows
}

// WMO weather codes → short condition text.
const WMO = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain', 71: 'Snow', 73: 'Snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

// Live weather for a place, in °F: current temp/condition plus today's forecast
// (high/low, condition) and sun times (sunrise, sunset, daylight length).
async function fetchWeather(location) {
  const loc = await resolveCoords(location)
  if (!loc) return null
  const f = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&daily=sunrise,sunset,daylight_duration,temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=auto`,
  )
  const fj = await f.json()
  const cur = fj && fj.current
  if (!cur || cur.temperature_2m == null) return null
  const d = (fj && fj.daily) || {}
  const first = (a) => (Array.isArray(a) ? a[0] : null)
  return {
    temp: Math.round(cur.temperature_2m),
    condition: WMO[cur.weather_code] || '',
    sunrise: first(d.sunrise),
    sunset: first(d.sunset),
    daylight: first(d.daylight_duration),
    high: first(d.temperature_2m_max) != null ? Math.round(first(d.temperature_2m_max)) : null,
    low: first(d.temperature_2m_min) != null ? Math.round(first(d.temperature_2m_min)) : null,
    dayCondition: WMO[first(d.weather_code)] || '',
  }
}

// Format an Open-Meteo local ISO ("2026-07-18T05:57") as a 12-hour clock.
const fmtClock = (iso) => {
  if (!iso) return '—'
  const hm = (iso.split('T')[1] || iso).slice(0, 5)
  let [h, m] = hm.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ap}`
}
const fmtDuration = (sec) => { if (sec == null) return '—'; const h = Math.floor(sec / 3600); const m = Math.round((sec % 3600) / 60); return `${h}h ${m}m` }

const uid = () => Math.random().toString(36).slice(2, 10)

const PARTS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
]
const byTime = (a, b) => {
  const ta = a.time || '', tb = b.time || ''
  if (!ta && !tb) return 0
  if (!ta) return -1
  if (!tb) return 1
  return ta.localeCompare(tb)
}

const Cursive = ({ children, className = '' }) => (
  <span className={className} style={{ fontFamily: "'Pinyon Script', cursive" }}>
    {children}
  </span>
)

// A live, ticking clock (seconds) in the location's time zone, with a breathing
// dot. Always shows the real current time — locked, even when a past/future day
// is selected below.
// Clock-face geometry (viewBox 0 0 200 200). A ring of minute dots with tapered
// hour batons over it — the editorial City Hall look.
const CK_C = 100
const ckPt = (r, deg) => [CK_C + r * Math.sin((deg * Math.PI) / 180), CK_C - r * Math.cos((deg * Math.PI) / 180)]
const CK_DOTS = Array.from({ length: 60 }, (_, i) => ckPt(63, i * 6))
const CK_BATONS = Array.from({ length: 12 }, (_, i) => { const a = i * 30; const [x1, y1] = ckPt(90, a); const [x2, y2] = ckPt(76, a); return { x1, y1, x2, y2 } })

// Read the wall-clock hour/minute/second in a given IANA time zone. Seconds are
// whole numbers, so the second hand advances one real second per tick (one full
// revolution every 60 seconds — the same speed as any accurate clock).
function timePartsIn(date, tz) {
  let h = date.getHours(); let m = date.getMinutes(); let s = date.getSeconds()
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date)
      const get = (t) => Number(parts.find((p) => p.type === t)?.value)
      h = get('hour') % 24; m = get('minute'); s = get('second')
    } catch { /* fall back to local */ }
  }
  return { h, m, s }
}

// A living analog clock, shown under the title. Ticks once per second (like a
// quartz wall clock) and reads the chosen location's time zone.
function Clock({ location }) {
  const [now, setNow] = useState(new Date())
  const [tz, setTz] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!location) { setTz(null); return undefined }
    let alive = true
    ;(async () => {
      try { const loc = await resolveCoords(location); if (alive) setTz(loc && loc.timezone ? loc.timezone : null) }
      catch { if (alive) setTz(null) }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey(location)])

  const { h, m, s } = timePartsIn(now, tz)
  const secDeg = s * 6
  const minDeg = m * 6 + s * 0.1
  const hourDeg = (h % 12) * 30 + m * 0.5
  const [hx, hy] = ckPt(46, hourDeg)
  const [mx, my] = ckPt(68, minDeg)
  const [sx, sy] = ckPt(72, secDeg)
  const [stx, sty] = ckPt(-16, secDeg) // short tail on the second hand

  return (
    <div className="mt-4 flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="h-28 w-28 md:h-32 md:w-32" role="img" aria-label="Clock">
        <circle cx="100" cy="100" r="98" fill="none" stroke="#d6d3d1" strokeWidth="2" />
        <circle cx="100" cy="100" r="94" fill="#ffffff" stroke="#e7e5e4" strokeWidth="1" />
        {CK_DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill="#a8a29e" />)}
        {CK_BATONS.map((b, i) => <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke="#1c1917" strokeWidth="4" strokeLinecap="round" />)}
        <line x1="100" y1="100" x2={hx} y2={hy} stroke="#1c1917" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="100" y1="100" x2={mx} y2={my} stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
        <line x1={stx} y1={sty} x2={sx} y2={sy} stroke="#1c1917" strokeWidth="1" strokeLinecap="round" />
        <circle cx="100" cy="100" r="3.5" fill="#1c1917" />
      </svg>
    </div>
  )
}

// ── Info strip — phase · date · weather · UV · location, one elegant row. The date
// is a button that opens a calendar to view any day; a reset returns to today.
function InfoStrip({ today, selectedKey, onPickDay, location, setLocation, cycleConfig, goToCycle }) {
  const [cycleOpen, setCycleOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const todayKey = dateKey(today)
  const selected = parseKey(selectedKey)
  const phase = phaseForConfig(cycleConfig, selected)
  const phaseDay = phase ? `${phase.name} · Day ${phase.cycleDay}` : '—'
  const dateStr = `${MONTHS[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}`
  const Dot = () => <span className="text-stone-300">·</span>
  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-y border-stone-200 py-3 text-sm text-stone-600">
      <button onClick={() => setCycleOpen(true)} className="text-stone-600 hover:text-stone-900 transition-colors">{phaseDay}</button>
      {cycleOpen && <CyclePopup cycleConfig={cycleConfig || {}} today={selected} onEdit={goToCycle} onClose={() => setCycleOpen(false)} />}
      <Dot />
      <button onClick={() => setDateOpen(true)} className="text-stone-600 hover:text-stone-900 transition-colors">{dateStr}</button>
      {selectedKey !== todayKey && (
        <button onClick={() => onPickDay(todayKey)} className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-700">Reset to today</button>
      )}
      {dateOpen && <DatePopup value={selectedKey} today={today} cycleConfig={cycleConfig} onPick={(k) => { onPickDay(k); setDateOpen(false) }} onClose={() => setDateOpen(false)} />}
      <Dot />
      <WeatherField location={location} />
      <Dot />
      <UvField location={location} />
      <Dot />
      <LocationField
        location={location}
        setLocation={setLocation}
        className="w-32 bg-transparent border-b border-stone-200 pb-0.5 text-sm text-stone-700 outline-none focus:border-stone-900 transition-colors"
      />
    </div>
  )
}

// Calendar pop-up (planner popup style) to jump the viewed day to any date.
function DatePopup({ value, today, cycleConfig, onPick, onClose }) {
  const [month, setMonth] = useState(new Date(parseKey(value).getFullYear(), parseKey(value).getMonth(), 1))
  const cells = monthGrid(month)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="px-2 text-base text-stone-500 hover:text-stone-900">‹</button>
          <span className="font-serif text-base text-stone-900">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="px-2 text-base text-stone-500 hover:text-stone-900">›</button>
        </div>
        <div className="px-4 py-4">
          <div className="grid grid-cols-7 gap-1">
            {DOW.map((d) => <div key={d} className="text-center text-[9px] uppercase tracking-[0.1em] text-stone-400">{d[0]}</div>)}
            {cells.map((cell) => {
              const k = dateKey(cell)
              const inMonth = cell.getMonth() === month.getMonth()
              const isSel = k === value
              const isTod = isSameDay(cell, today)
              return (
                <button
                  key={k}
                  onClick={() => onPick(k)}
                  className={`flex aspect-square items-center justify-center rounded-full text-xs transition-colors ${isSel ? 'bg-stone-900 text-cream' : inMonth ? 'text-stone-700 hover:bg-stone-100' : 'text-stone-300 hover:bg-stone-100'} ${isTod && !isSel ? 'ring-1 ring-stone-400' : ''}`}
                >
                  {cell.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Live weather for the location; click for sun times + today's forecast.
function WeatherField({ location }) {
  const [w, setW] = useState(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!location) { setW(null); return undefined }
    let alive = true
    const load = async () => {
      try { const out = await fetchWeather(location); if (alive) setW(out) }
      catch { if (alive) setW(null) }
    }
    load()
    const id = setInterval(load, 10 * 60 * 1000) // keep it fresh through the day
    return () => { alive = false; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey(location)])
  if (!w) return <span className="text-stone-400">—</span>
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-stone-700 hover:text-stone-900 transition-colors">
        {w.temp}°{w.condition ? ` ${w.condition}` : ''}
      </button>
      {open && <WeatherPopup w={w} onClose={() => setOpen(false)} />}
    </>
  )
}

// Small pop-up: sunrise, sunset, daylight length + today's forecast.
function WeatherPopup({ w, onClose }) {
  const forecast = [w.high != null ? `High ${w.high}°` : null, w.low != null ? `Low ${w.low}°` : null, w.dayCondition].filter(Boolean).join(' · ')
  const rows = [
    ['Sunrise', fmtClock(w.sunrise)],
    ['Sunset', fmtClock(w.sunset)],
    ['Daylight', fmtDuration(w.daylight)],
    ['Today', forecast || '—'],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 shadow-2xl">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6">
          <div className="divide-y divide-stone-100">
            {rows.map(([label, value]) => (
              <div key={label} className="py-3">
                <p className="kicker text-stone-400 mb-1">{label}</p>
                <p className="text-sm text-stone-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// UV index — live for the location, tracking the current hour as the day goes on.
function UvField({ location }) {
  const [map, setMap] = useState(null)
  const [tick, setTick] = useState(0)

  // Fetch the hourly forecast on location change, and refresh every 30 minutes.
  useEffect(() => {
    if (!location) { setMap(null); return undefined }
    let alive = true
    const load = async () => {
      try { const m = await fetchUvHourly(location); if (alive) setMap(m) }
      catch { if (alive) setMap(null) }
    }
    load()
    const id = setInterval(load, 30 * 60 * 1000)
    return () => { alive = false; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey(location)])

  // Re-pick the current hour every minute so the value updates through the day.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const uv = useMemo(() => {
    if (!map) return null
    const v = map[utcHourKey(new Date())]
    return v != null ? Math.round(v) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tick])

  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => uv != null && setOpen(true)}
        disabled={uv == null}
        className={`text-stone-700 ${uv != null ? 'hover:text-stone-900 transition-colors' : ''}`}
      >
        UV {uv != null ? `${uv} ${uvLabel(uv)}` : '—'}
      </button>
      {open && uv != null && <UvPopup uv={uv} onClose={() => setOpen(false)} />}
    </>
  )
}

// Pop-up read of the cycle's stats, in an AI-OBGYN voice. Each baseline only
// appears once enough intervals exist; otherwise it reads "Collecting".
function CyclePopup({ cycleConfig, today, onEdit, onClose }) {
  const [logsRaw] = useLocalStorage('mos:cycle:logs', {})
  const logs = logsRaw && typeof logsRaw === 'object' ? logsRaw : {}
  const rows = useMemo(() => buildCycleRows(cycleStats({ cycleConfig, logs, today })), [cycleConfig, logs, today])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-12 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm bg-cream border border-stone-300 shadow-2xl">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6">
          <div className="divide-y divide-stone-100">
            {rows.map((r) => (
              <div key={r.label} className="py-3">
                <p className="kicker text-stone-400 mb-1">{r.label}</p>
                <p className={`text-sm ${r.value === 'Collecting' ? 'text-stone-400' : 'text-stone-800'}`}>{r.value}</p>
                {r.note && <p className="mt-0.5 text-xs text-stone-400">{r.note}</p>}
              </div>
            ))}
          </div>
          {onEdit && (
            <button onClick={() => { onEdit(); onClose() }} className="mt-5 w-full bg-stone-900 px-4 py-2.5 text-sm text-cream hover:bg-stone-700">Edit my cycle</button>
          )}
        </div>
      </div>
    </div>
  )
}

// Small pop-up with just the sun-protection guidance for the current UV band.
function UvPopup({ uv, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 shadow-2xl">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6">
          <p className="kicker text-stone-400 mb-1">Gear</p>
          <p className="text-sm text-stone-800">{UV_ADVICE[uvBand(uv)]}</p>
        </div>
      </div>
    </div>
  )
}

export default function Today({ cycleConfig, location, setLocation, pendingDay, clearPendingDay, goToCycle }) {
  const today = new Date()
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const selected = parseKey(selectedKey)
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [calView, setCalView] = useState('day') // 'day' (Today) | 'week' | 'month'

  // Arriving from another page with a specific day → open it in TODAY view.
  useEffect(() => {
    if (pendingDay) { setSelectedKey(pendingDay); setCalView('day'); clearPendingDay() }
  }, [pendingDay, clearPendingDay])

  const todayPhase = useMemo(
    () => phaseForConfig(cycleConfig, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cycleConfig.lastPeriodStart, cycleConfig.cycleLength, cycleConfig.manualPhase, dateKey(today)],
  )

  const { activities, add, update, updateDetails, remove, toggleComplete, setOrder } = useActivities()
  const [editing, setEditing] = useState(null) // an activity (new or existing)
  const [homeAdd, setHomeAdd] = useState(false) // section chooser open
  const [formAllowed, setFormAllowed] = useState(null) // restrict category dropdown

  const isNew = (a) => !activities.some((x) => x.id === a.id)

  const active = (a, k) => a.status !== 'archived' && activityOccursOn(a, k)

  // AGENDA — calendar events + Fitness/Appointments protocols, by part of day.
  const dayEvents = (k) => {
    const out = []
    activities.forEach((a) => {
      if (!active(a, k)) return
      if (a.type === 'event') {
        out.push({ id: a.id, title: a.title, part: a.details.partOfDay || 'morning', time: a.details.time || '', done: isDoneOn(a, k), order: a.order })
      } else if (a.type === 'protocol' && SECTION_CATS.agenda.includes(a.category)) {
        partsOfActivity(a).forEach((part) => out.push({ id: a.id, title: a.title, part, time: '', done: isDoneOn(a, k), order: a.order }))
      }
    })
    return out
  }

  // RITUAL — Skincare/Facial/Haircare/Body/Aesthetics/Treatments/Wellness protocols.
  const dayRituals = (k) => {
    const out = []
    activities.forEach((a) => {
      if (a.type !== 'protocol' || !SECTION_CATS.ritual.includes(a.category) || !active(a, k)) return
      partsOfActivity(a).forEach((part) => out.push({ id: a.id, title: a.title, part, done: isDoneOn(a, k), order: a.order }))
    })
    return out
  }

  // NOURISHMENT — meal items + supplements for a day, shaped for the slots.
  const dayMeals = (k) =>
    activities
      .filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && active(a, k))
      .map(toMealShape)

  // Quick inline add from a meal slot (AddMealForm shape → activity).
  const addMeal = (m) =>
    add(blankActivity(m.kind === 'supp' ? 'supplement' : 'meal_item', {
      title: m.name, frequency: m.frequency || 'daily', daysOfWeek: m.days || [], seriesStart: m.startDate || '',
      details: m.kind === 'supp' ? { slot: m.slot, dose: '', unit: 'mg' } : { slot: m.slot, beverage: m.slot === 'drink' },
    }))
  const removeMeal = (id) => remove(id)
  const toggleEvent = (id) => toggleComplete(id, selectedKey)

  // Carry-forward — only yesterday's unchecked ONE-TIME events. Recurring items
  // (daily/weekly protocols and events) repeat on their own and never carry over.
  const yKey = (() => { const y = parseKey(selectedKey); y.setDate(y.getDate() - 1); return dateKey(y) })()
  const carryForward = activities
    .filter((a) => a.type === 'event' && (a.frequency === 'asneeded' || a.frequency === 'once') && a.status !== 'archived' && activityOccursOn(a, yKey) && !isDoneOn(a, yKey))
    .sort((a, b) => (b.seriesStart || b.createdAt || '').localeCompare(a.seriesStart || a.createdAt || ''))
    .map((a) => ({ id: a.id, title: a.title }))
  const completeCarry = (id) => toggleComplete(id, yKey)
  const agendaHint = PHASE_AGENDA_HINT[todayPhase && todayPhase.id] || ''
  // Move an agenda item to another column — events by partOfDay, protocols by timeOfDay.
  const moveEventToPart = (id, part) => {
    const a = activities.find((x) => x.id === id)
    if (!a) return
    if (a.type === 'event') updateDetails(id, { partOfDay: part })
    else update(id, { timeOfDay: [part] })
  }

  const saveActivity = (a) => { if (isNew(a)) add(a); else update(a.id, a); setEditing(null) }

  // The TODAY-view add chooser routes by section → the right type + categories.
  const SECTION_ADD = {
    ritual: { label: 'Ritual', blurb: 'Skincare, hair, body, fitness, treatments', type: 'protocol', allowed: SECTION_CATS.ritual, overrides: { category: 'skincare', timeOfDay: ['morning'] } },
    nourishment: { label: 'Nourishment', blurb: 'Food, drink, supplements', type: 'meal_item', allowed: null, overrides: { details: { slot: 'breakfast', beverage: false } } },
    agenda: { label: 'Agenda', blurb: 'Events, appointments', type: 'event', allowed: null, overrides: { seriesStart: selectedKey, frequency: 'asneeded', details: { partOfDay: 'morning' } } },
  }
  const pickSection = (id) => {
    const s = SECTION_ADD[id]
    setHomeAdd(false)
    setFormAllowed(s.allowed)
    setEditing(blankActivity(s.type, s.overrides))
  }

  // Universal Add on the home page → choose a section, then open its form.
  useRegisterAdd(() => setHomeAdd(true), [])

  const pickDay = (k) => { setSelectedKey(k); setCalView('day') }

  return (
    <div>
      {/* Page title — centered at the very top of the main content */}
      <div className="mb-6 text-center">
        <Cursive className="text-5xl md:text-6xl text-stone-900 leading-tight">Melissa's Digital Planner</Cursive>
        <Clock location={location} />
      </div>

      <InfoStrip today={today} selectedKey={selectedKey} onPickDay={pickDay} location={location} setLocation={setLocation} cycleConfig={cycleConfig} goToCycle={goToCycle} />

      <Horoscope />

      <div className="pt-10">
      <h2 className="mb-8 font-serif text-3xl text-stone-900">schedule</h2>

      <Calendar
        view={calView}
        setView={setCalView}
        calMonth={calMonth}
        setCalMonth={setCalMonth}
        selectedKey={selectedKey}
        setSelectedKey={setSelectedKey}
        today={today}
        cycleConfig={cycleConfig}
        eventsFor={dayEvents}
        ritualsFor={dayRituals}
        mealsFor={dayMeals}
        carry={carryForward}
        onCompleteCarry={completeCarry}
        agendaHint={agendaHint}
        onPickDay={pickDay}
        onAddMeal={addMeal}
        onRemoveMeal={removeMeal}
        onReorder={setOrder}
        onMovePart={moveEventToPart}
        onToggle={toggleEvent}
        onOpen={(id) => { setFormAllowed(null); setEditing(activities.find((a) => a.id === id) || null) }}
      />
      </div>

      <TodayNotes />

      {homeAdd && (
        <AddChooser
          options={Object.entries(SECTION_ADD).map(([id, s]) => ({ id, label: s.label, blurb: s.blurb }))}
          onPick={pickSection}
          onClose={() => setHomeAdd(false)}
        />
      )}

      {editing && (
        <ActivityForm
          activity={editing}
          isNew={isNew(editing)}
          allowedCategories={formAllowed}
          onSave={(a) => { saveActivity(a); setFormAllowed(null) }}
          onDelete={() => { remove(editing.id); setEditing(null); setFormAllowed(null) }}
          onClose={() => { setEditing(null); setFormAllowed(null) }}
        />
      )}
    </div>
  )
}

// Very subtle per-phase cell tints for the month grid.
const PHASE_TINT = { menstrual: '#F9EDEE', follicular: '#EFF4EF', ovulation: '#FAF5EE', luteal: '#F0EEF4' }
const PHASE_LEGEND = [
  { id: 'menstrual', label: 'Menstrual' },
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
]
const VIEW_TABS = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]
// Phase-aware one-liner shown under the AGENDA header.
const PHASE_AGENDA_HINT = {
  follicular: 'Good day for new tasks and deep focus.',
  ovulation: 'Lead, communicate, be seen.',
  luteal: 'Finish and organize.',
  menstrual: 'Keep it light today.',
}

// ── Calendar ───────────────────────────────────────────────────────
function Calendar({ view, setView, calMonth, setCalMonth, selectedKey, setSelectedKey, today, cycleConfig, eventsFor, ritualsFor, mealsFor, carry, onCompleteCarry, agendaHint, onPickDay, onAddMeal, onRemoveMeal, onReorder, onMovePart, onToggle, onOpen }) {
  const [fromWeek, setFromWeek] = useState(false) // TODAY view reached from week
  const openDay = (k) => { setFromWeek(true); onPickDay(k) }
  const cells = monthGrid(calMonth)
  const anchorDate = parseKey(selectedKey)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = parseKey(selectedKey)
    d.setDate(d.getDate() - d.getDay() + i)
    return d
  })
  const shiftAnchor = (days) => {
    const d = parseKey(selectedKey)
    d.setDate(d.getDate() + days)
    setSelectedKey(dateKey(d))
  }

  const goPrev = () => {
    if (view === 'month') setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
    else shiftAnchor(view === 'week' ? -7 : -1)
  }
  const goNext = () => {
    if (view === 'month') setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
    else shiftAnchor(view === 'week' ? 7 : 1)
  }
  const goToday = () => {
    setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedKey(dateKey(today))
  }
  const notToday = selectedKey !== dateKey(today)
  const periodLabel =
    view === 'month'
      ? `${MONTHS[calMonth.getMonth()]} ${calMonth.getFullYear()}`
      : view === 'week'
        ? `Week of ${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getDate()}`
        : `${DOW[anchorDate.getDay()]}, ${MONTHS[anchorDate.getMonth()]} ${anchorDate.getDate()}`

  return (
    <section className="mb-12">
      {/* Nav: Prev far left · view toggle centered · Next far right */}
      <div className="my-4 grid grid-cols-3 items-center">
        <div className="flex min-w-0 items-center gap-2 justify-self-start">
          <button onClick={goPrev} className="px-2 text-sm text-stone-500 hover:text-stone-900">Prev</button>
          {notToday && (
            <span className="hidden truncate text-xs text-stone-400 sm:inline">
              Viewing {longDate(anchorDate)}.{' '}
              <button onClick={goToday} className="underline underline-offset-2 hover:text-stone-700">Back to today</button>
            </span>
          )}
        </div>
        <div className="flex justify-center gap-1">
          {VIEW_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setFromWeek(false); setView(t.id) }}
              className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition-colors ${view === t.id ? 'bg-stone-900 text-cream' : 'text-stone-600 hover:bg-stone-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={goNext} className="justify-self-end px-2 text-sm text-stone-500 hover:text-stone-900">Next</button>
      </div>
      <div className="mb-5 mt-6 flex items-center justify-center gap-3">
        {view === 'day' && fromWeek && (
          <button onClick={() => { setFromWeek(false); setView('week') }} className="text-xs text-stone-400 hover:text-stone-900">← Week</button>
        )}
        <h3 className="whitespace-nowrap text-center font-serif text-2xl text-stone-900">{periodLabel}</h3>
      </div>

      {view === 'day' && (
        <DayColumns
          events={eventsFor(selectedKey)}
          rituals={ritualsFor(selectedKey)}
          dateKeyStr={selectedKey}
          meals={mealsFor(selectedKey)}
          carry={carry}
          onCompleteCarry={onCompleteCarry}
          agendaHint={agendaHint}
          onAddMeal={onAddMeal}
          onRemoveMeal={onRemoveMeal}
          onReorder={onReorder}
          onMovePart={onMovePart}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      )}

      {view === 'month' && (
        <>
          <div className="grid grid-cols-7 border-l border-t border-stone-200">
            {DOW.map((d) => (
              <div key={d} className="border-b border-r border-stone-200 px-2 py-1.5 text-center kicker text-stone-400">
                {d[0]}
              </div>
            ))}
            {cells.map((cell) => {
              const key = dateKey(cell)
              const inMonth = cell.getMonth() === calMonth.getMonth()
              const isSel = key === selectedKey
              const isTod = isSameDay(cell, today)
              const holiday = holidayFor(cell)
              const dayEvents = eventsFor(key)
              const phase = phaseForConfig(cycleConfig, cell)
              const tint = phase ? PHASE_TINT[phase.id] : undefined
              return (
                <div
                  key={key}
                  style={tint ? { backgroundColor: tint } : undefined}
                  className={`group relative min-h-[78px] border-b border-r border-stone-200 px-1.5 py-1 text-left transition-colors ${
                    inMonth ? '' : 'text-stone-300'
                  } ${isSel ? 'ring-1 ring-inset ring-stone-900' : ''}`}
                >
                  <button onClick={() => onPickDay(key)} className="block w-full text-left">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center text-xs ${
                        isTod ? 'bg-stone-900 text-cream rounded-full' : inMonth ? 'text-stone-700' : 'text-stone-300'
                      }`}
                    >
                      {cell.getDate()}
                    </span>
                  </button>

                  {holiday && (
                    <p className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-stone-400">{holiday}</p>
                  )}

                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <button key={ev.id} onClick={() => onOpen(ev.id)} className="flex w-full items-center gap-1 text-left">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                        <span className={`truncate text-[10px] ${ev.done ? 'text-stone-400 line-through' : 'text-stone-600'}`}>
                          {ev.title || 'Untitled'}
                        </span>
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <button onClick={() => onPickDay(key)} className="text-[9px] text-stone-400 hover:text-stone-700">+{dayEvents.length - 2} more</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Cycle phase legend */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            {PHASE_LEGEND.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-stone-500">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (PHASES[p.id] && PHASES[p.id].color) || PHASE_TINT[p.id] }} />
                {p.label}
              </span>
            ))}
          </div>
        </>
      )}

      {view === 'week' && (
        <div className="grid grid-cols-7 items-stretch gap-2 md:gap-4">
          {weekDays.map((d) => {
            const key = dateKey(d)
            const isTod = isSameDay(d, today)
            const more = () => openDay(key)
            const ritual = dedupeById(ritualsFor(key)).map((r) => ({ id: r.id, label: r.title || 'Untitled', done: r.done }))
            const nourish = mealsFor(key).map((m) => ({ id: m.id, label: m.name }))
            const agenda = dedupeById(eventsFor(key).sort(byTime)).map((a) => ({ id: a.id, label: a.title || 'Untitled', done: a.done }))
            return (
              <div key={key} className="min-w-0 border-t border-stone-300 pt-2">
                <button onClick={more} className={`mb-2 block w-full truncate text-left kicker hover:text-stone-900 ${isTod ? 'text-stone-900' : 'text-stone-500'}`}>{DOW[d.getDay()]} {d.getDate()}</button>
                <WeekSection label="Ritual" variant="ritual" items={ritual} onToggle={onToggle} onMore={more} />
                <div className="my-2 border-t border-stone-100" />
                <WeekSection label="Nourish" variant="nourish" items={nourish} onMore={more} />
                <div className="my-2 border-t border-stone-100" />
                <WeekSection label="Agenda" variant="agenda" items={agenda} onToggle={onToggle} onMore={more} />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const dedupeById = (arr) => {
  const seen = new Set()
  return arr.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
}

// One compact week-view section: fixed height, up to 3 items, then a +N more link.
function WeekSection({ label, variant, items, onToggle, onMore }) {
  const shown = items.slice(0, 3)
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[9px] font-normal uppercase tracking-[0.14em] text-stone-400">{label}</p>
      <div className="min-h-[76px]">
        {items.length === 0 ? (
          <p className="text-xs italic text-stone-300">nothing</p>
        ) : (
          <div className="space-y-1">
            {shown.map((it, idx) => (
              <div key={it.id} className="flex items-center gap-1.5">
                {variant === 'agenda' && <span className="shrink-0 text-[10px] tabular-nums text-stone-400">{idx + 1}</span>}
                <span className={`min-w-0 flex-1 truncate text-xs ${variant === 'nourish' ? 'italic text-stone-500' : it.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                  {it.label}
                </span>
                {variant !== 'nourish' && <Checkbox checked={it.done} onClick={() => onToggle(it.id)} size={13} />}
              </div>
            ))}
            {items.length > 3 && (
              <button onClick={onMore} className="text-[10px] text-stone-400 hover:text-stone-700">+{items.length - 3} more</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Sort events by manual order (drag), falling back to time.
const sortEvents = (a, b) => {
  const ao = a.order, bo = b.order
  if (ao != null && bo != null) return ao - bo
  if (ao != null) return -1
  if (bo != null) return 1
  return byTime(a, b)
}

// The full day's nourishment slots, in order. Supplement rows aggregate every
// supp-item in that part; the representative slot is used when adding one.
const NOURISH_SLOTS = [
  { kind: 'food', slot: 'empty', label: 'Empty Stomach' },
  { kind: 'food', slot: 'breakfast', label: 'Breakfast' },
  { kind: 'supp', slot: 'breakfast', label: 'Supplements' },
  { kind: 'food', slot: 'snack', label: 'Snack' },
  { kind: 'food', slot: 'lunch', label: 'Lunch' },
  { kind: 'supp', slot: 'lunch', label: 'Supplements' },
  { kind: 'food', slot: 'snack2', label: 'Snack' },
  { kind: 'food', slot: 'dinner', label: 'Dinner' },
  { kind: 'supp', slot: 'dinner', label: 'Supplements' },
  { kind: 'food', slot: 'bed', label: 'Before Bed' },
  { kind: 'food', slot: 'drink', label: 'Drink' },
]

// Agenda order: manual drag order wins; otherwise morning→evening, then time.
const PART_RANK = { morning: 0, afternoon: 1, evening: 2 }
const agendaSort = (a, b) => {
  const ao = a.order, bo = b.order
  if (ao != null && bo != null) return ao - bo
  if (ao != null) return -1
  if (bo != null) return 1
  return ((PART_RANK[a.part] ?? 1) - (PART_RANK[b.part] ?? 1)) || byTime(a, b)
}

// A numbered, drag-to-reorder list with a checkbox per row (rituals + agenda).
function OrderedList({ items, emptyText, onToggle, onOpen, onReorder }) {
  const [drag, setDrag] = useState(null)
  const ids = items.map((i) => i.id)
  const dropBefore = (targetId) => {
    if (!drag) return
    const arr = ids.filter((id) => id !== drag)
    const at = arr.indexOf(targetId)
    arr.splice(at < 0 ? arr.length : at, 0, drag)
    onReorder(arr); setDrag(null)
  }
  const dropEnd = () => { if (!drag) return; const arr = ids.filter((id) => id !== drag); arr.push(drag); onReorder(arr); setDrag(null) }
  return (
    <div className="space-y-1.5" onDragOver={(e) => e.preventDefault()} onDrop={dropEnd}>
      {items.length === 0 ? (
        <p className="text-sm italic text-stone-400">{emptyText}</p>
      ) : (
        items.map((it, idx) => (
          <div
            key={it.id}
            draggable
            onDragStart={() => setDrag(it.id)}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.stopPropagation(); dropBefore(it.id) }}
            className={`group flex items-center gap-2 cursor-grab active:cursor-grabbing ${drag === it.id ? 'opacity-40' : ''}`}
          >
            <span className="shrink-0 text-sm text-stone-400 tabular-nums">{idx + 1}</span>
            <span className="shrink-0 text-stone-300">·</span>
            <button onClick={() => onOpen(it.id)} className={`flex-1 text-left text-sm ${it.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{it.title || 'Untitled'}</button>
            <Checkbox checked={it.done} onClick={() => onToggle(it.id)} />
          </div>
        ))
      )}
    </div>
  )
}

// Collapsible section header used in the TODAY columns — tinted zone boundary.
function Collapsible({ label, open, onToggle, children }) {
  return (
    <div>
      <button onClick={onToggle} className="mb-2 flex w-full items-center justify-between px-2 py-1.5" style={{ backgroundColor: '#F0EFED' }}>
        <span className="kicker text-stone-500">{label}</span>
        {open ? <ChevronDown size={13} className="text-stone-400" /> : <ChevronRight size={13} className="text-stone-400" />}
      </button>
      {open && children}
    </div>
  )
}

// ── TODAY view body — a single daily flow ──
// Morning Routine · Nourishment (full day) · Agenda (once) · Evening Routine.
function DayColumns({ events, rituals, dateKeyStr, meals, carry = [], onCompleteCarry, agendaHint, onAddMeal, onRemoveMeal, onReorder, onToggle, onOpen }) {
  const [collapsed, setCollapsed] = useState({})
  const toggleSec = (k) => setCollapsed((c) => ({ ...c, [k]: !c[k] }))
  const isOpen = (k) => !collapsed[k]

  const morningRituals = dedupeById(rituals.filter((r) => r.part === 'morning' || r.part === 'afternoon')).sort(sortEvents)
  const eveningRituals = dedupeById(rituals.filter((r) => r.part === 'evening')).sort(sortEvents)
  const agenda = dedupeById(events).sort(agendaSort)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* MORNING ROUTINE */}
      <Collapsible label="Morning Routine" open={isOpen('ritual:morning')} onToggle={() => toggleSec('ritual:morning')}>
        <OrderedList items={morningRituals} emptyText="Nothing yet." onToggle={onToggle} onOpen={onOpen} onReorder={onReorder} />
      </Collapsible>

      {/* NOURISHMENT — the full day */}
      <Collapsible label="Nourishment" open={isOpen('nourishment')} onToggle={() => toggleSec('nourishment')}>
        <div className="space-y-3">
          {NOURISH_SLOTS.map((sec) => (
            <MealSection key={sec.label} section={sec} part={slotMeta(sec.slot).part} meals={meals} dateKeyStr={dateKeyStr} onAdd={onAddMeal} onRemove={onRemoveMeal} />
          ))}
        </div>
      </Collapsible>

      {/* AGENDA — one list for the whole day */}
      <Collapsible label="Agenda" open={isOpen('agenda')} onToggle={() => toggleSec('agenda')}>
        {agendaHint && <p className="mb-2 text-xs italic text-stone-400">{agendaHint}</p>}
        {carry.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {carry.slice(0, 3).map((it) => (
              <div key={`carry-${it.id}`} className="flex items-center gap-2">
                <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-stone-300">yesterday</span>
                <span className="flex-1 text-sm italic text-stone-400">{it.title || 'Untitled'}</span>
                <Checkbox checked={false} onClick={() => onCompleteCarry(it.id)} />
              </div>
            ))}
            {carry.length > 3 && <p className="text-[10px] italic text-stone-300">+{carry.length - 3} more from yesterday</p>}
          </div>
        )}
        <OrderedList items={agenda} emptyText="Nothing scheduled." onToggle={onToggle} onOpen={onOpen} onReorder={onReorder} />
      </Collapsible>

      {/* EVENING ROUTINE */}
      <Collapsible label="Evening Routine" open={isOpen('ritual:evening')} onToggle={() => toggleSec('ritual:evening')}>
        <OrderedList items={eveningRituals} emptyText="Nothing yet." onToggle={onToggle} onOpen={onOpen} onReorder={onReorder} />
      </Collapsible>
    </div>
  )
}

function MealSection({ section, part, meals, dateKeyStr, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false)
  const items = (meals || []).filter((m) =>
    section.kind === 'supp'
      ? m.kind === 'supp' && slotMeta(m.slot).part === part
      : m.kind === 'food' && m.slot === section.slot,
  )
  return (
    <div>
      <p className="kicker text-stone-400 mb-1.5">{section.label}</p>
      {items.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {items.map((m) => (
            <span key={m.id} className="group inline-flex items-center gap-1 border border-stone-300 bg-white/50 px-2 py-0.5 text-xs text-stone-700">
              {m.name}
              <button onClick={() => onRemove(m.id)} className="text-stone-400 transition-colors hover:text-stone-700"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      {adding ? (
        <AddMealForm
          slot={slotMeta(section.slot)}
          kind={section.kind}
          dateKeyStr={dateKeyStr}
          onCancel={() => setAdding(false)}
          onSave={(item) => { onAdd({ ...item, slot: section.slot, kind: section.kind }); setAdding(false) }}
        />
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm italic hover:text-stone-700 transition-colors" style={{ color: 'rgba(28, 28, 26, 0.7)' }}>
          {section.kind === 'supp' ? 'add supplement' : 'add food'}
        </button>
      )}
    </div>
  )
}

// ── Today's notes — Keep-style card grid; click a card to edit it ───
const noteDateLabel = (d) => {
  const x = parseKey(d)
  return `${MONTHS[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}`
}

function TodayNotes() {
  const [stored, setNotes] = useLocalStorage('mos:today:notes-v2', [])
  const notes = Array.isArray(stored) ? stored : []
  const [draft, setDraft] = useState('')
  const [openId, setOpenId] = useState(null)

  const add = () => {
    const t = draft.trim()
    if (!t) return
    const note = { id: uid(), title: t, body: '', date: dateKey(new Date()) }
    setNotes((prev) => [note, ...(Array.isArray(prev) ? prev : [])])
    setDraft('')
  }
  const update = (id, patch) =>
    setNotes((prev) => (Array.isArray(prev) ? prev : []).map((n) => (n.id === id ? { ...n, ...patch } : n)))
  const remove = (id) => setNotes((prev) => (Array.isArray(prev) ? prev : []).filter((n) => n.id !== id))

  const openNote = notes.find((n) => n.id === openId) || null

  return (
    <section className="mb-14">
      <h2 className="mb-4 text-center text-4xl md:text-5xl leading-tight text-stone-900" style={{ fontFamily: "'Pinyon Script', cursive" }}>Today's Notes.</h2>

      <div className="mb-6 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New note title"
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={add} className="bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700">
          New note
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">No notes yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} onOpen={() => setOpenId(n.id)} />
          ))}
        </div>
      )}

      {openNote && (
        <NoteDetail
          note={openNote}
          onChange={(patch) => update(openNote.id, patch)}
          onDelete={() => {
            remove(openNote.id)
            setOpenId(null)
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  )
}

function NoteCard({ note, onOpen }) {
  const firstLine = (note.body || '').split('\n').find((l) => l.trim()) || ''
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-start border border-stone-200 bg-white/40 p-4 text-left transition-shadow hover:shadow-md"
    >
      <h3 className="font-serif text-xl text-stone-900">{note.title || 'Untitled'}</h3>
      {firstLine ? (
        <p className="mt-2 line-clamp-1 text-sm leading-relaxed text-stone-500">{firstLine}</p>
      ) : (
        <p className="mt-2 text-sm italic text-stone-300">No content yet.</p>
      )}
      <p className="kicker text-stone-400 mt-3">{noteDateLabel(note.date)}</p>
    </button>
  )
}

function NoteDetail({ note, onChange, onDelete, onClose }) {
  const taRef = useRef(null)
  const autosize = () => {
    const el = taRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }
  useEffect(() => {
    autosize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            value={note.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Title"
            autoFocus
            className="w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none"
          />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="px-6 py-5">
          <p className="kicker text-stone-400 mb-3">{noteDateLabel(note.date)}</p>
          <textarea
            ref={taRef}
            value={note.body}
            onChange={(e) => {
              onChange({ body: e.target.value })
              autosize()
            }}
            placeholder="Write it out…"
            className="block w-full resize-none overflow-hidden bg-transparent text-base leading-relaxed text-stone-800 placeholder-stone-300 outline-none"
            style={{ minHeight: '40vh' }}
          />
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-phase-menstrual">
            <Trash2 size={15} /> Delete
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Done</button>
        </div>
      </div>
    </div>
  )
}

