import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X, Trash2, ChevronDown, ChevronRight, Pause } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseForConfig, PHASES } from '../lib/cycle'
import {
  dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW,
} from '../lib/date'
import { holidayFor } from '../lib/holidays'
import Horoscope from './Horoscope'
import Vitals from './Vitals'
import MonthGrid from './shared/MonthGrid'
import { AddMealForm } from './shared/MealSlots'
import { slotMeta } from '../lib/meals'
import { useRegisterAdd, AddChooser } from './shared/AddButton'
import Checkbox from './shared/Checkbox'
import ActivityForm from './shared/ActivityForm'
import { useActivities } from '../hooks/useActivities'
import { activityOccursOn, isDoneOn, toMealShape, blankActivity, SECTION_CATS, partsOfActivity, daySectionsOf, eventPartsOf } from '../lib/activities'
import { moonInfo } from '../lib/moon'
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
      <MoonField />
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

// A little moon that draws its real illuminated shape. `angle` is the phase angle
// (0 new · 90 first quarter · 180 full · 270 third quarter); the lit limb sits on
// the right while waxing, the left while waning — a soft carved terminator between.
function MoonGlyph({ angle, size = 16 }) {
  const R = 50, C = 60
  const a = ((angle % 360) + 360) % 360
  const f = (1 - Math.cos((a * Math.PI) / 180)) / 2 // illuminated fraction
  const waxing = a < 180
  const dark = '#57534e', lit = '#FAF9F4'
  const rx = R * Math.abs(Math.cos(Math.PI * f))
  const litSemi = waxing
    ? `M ${C},${C - R} A ${R},${R} 0 0 1 ${C},${C + R} Z` // right half
    : `M ${C},${C - R} A ${R},${R} 0 0 0 ${C},${C + R} Z` // left half
  const ellipseFill = f < 0.5 ? dark : lit
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="inline-block shrink-0" aria-hidden="true">
      <circle cx={C} cy={C} r={R} fill={dark} />
      {f > 0.002 && <path d={litSemi} fill={lit} />}
      {f > 0.002 && Math.abs(f - 0.5) > 0.002 && <ellipse cx={C} cy={C} rx={rx} ry={R} fill={ellipseFill} />}
      <circle cx={C} cy={C} r={R} fill="none" stroke="#c9c5bd" strokeWidth="2" />
    </svg>
  )
}

// Today's moon in the info strip — its shape + name, recomputed live. Click for
// the current symbol and the next new / full moons.
function MoonField() {
  const [info, setInfo] = useState(() => moonInfo(new Date()))
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setInfo(moonInfo(new Date())), 60 * 60 * 1000) // hourly
    return () => clearInterval(id)
  }, [])
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-stone-600 hover:text-stone-900 transition-colors">
        <MoonGlyph angle={info.angle} size={15} />
        {info.phase.name}
      </button>
      {open && <MoonPopup info={info} onClose={() => setOpen(false)} />}
    </>
  )
}

// Pop-up: the current moon symbol + name up top, then when the next new and full
// moons arrive (date + how far off).
function MoonPopup({ info, onClose }) {
  const fmt = (d) => {
    if (!d) return '—'
    const days = Math.round((d.getTime() - Date.now()) / 86400000)
    const rel = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${rel}`
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 shadow-2xl">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6">
          <div className="mb-5 flex flex-col items-center">
            <MoonGlyph angle={info.angle} size={72} />
            <p className="mt-3 font-serif text-xl text-stone-900">{info.phase.name}</p>
            <p className="kicker text-stone-400 mt-1">{Math.round(info.fraction * 100)}% illuminated</p>
          </div>
          <div className="divide-y divide-stone-100 border-t border-stone-100">
            {[['Next full moon', fmt(info.nextFull)], ['Next new moon', fmt(info.nextNew)]].map(([label, value]) => (
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

export default function Today({ cycleConfig, location, setLocation, pendingDay, clearPendingDay, goToCycle }) {
  const today = new Date()
  const [selectedKey, setSelectedKey] = useState(dateKey(today))
  const selected = parseKey(selectedKey)
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  // Arriving from another page with a specific day → select it and show its month.
  useEffect(() => {
    if (pendingDay) {
      setSelectedKey(pendingDay)
      setCalMonth(new Date(parseKey(pendingDay).getFullYear(), parseKey(pendingDay).getMonth(), 1))
      clearPendingDay()
    }
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

  // Paused items are parked off Today (they still show, tagged, in their section).
  const active = (a, k) => a.status !== 'archived' && a.status !== 'paused' && activityOccursOn(a, k)

  // AGENDA — calendar events + Appointments protocols + anything explicitly
  // tagged "During the Day", by part of day. The agenda is one chronological
  // list, so an event shows once (its primary part orders it).
  const dayEvents = (k) => {
    const out = []
    activities.forEach((a) => {
      if (!active(a, k)) return
      if (a.type === 'event') {
        out.push({ id: a.id, title: a.title, part: eventPartsOf(a)[0], time: a.details.time || '', done: isDoneOn(a, k), order: a.order })
      } else if (a.type === 'protocol') {
        const secs = daySectionsOf(a)
        if (secs.includes('day')) {
          out.push({ id: a.id, title: a.title, part: 'afternoon', time: '', done: isDoneOn(a, k), order: a.order })
        } else if (!secs.length && SECTION_CATS.agenda.includes(a.category)) {
          partsOfActivity(a).forEach((part) => out.push({ id: a.id, title: a.title, part, time: '', done: isDoneOn(a, k), order: a.order }))
        }
      }
    })
    return out
  }

  // ROUTINE — every section's protocols become the block checklist ("Routine"),
  // so anything scheduled in any section (Skincare, Mindset, Relationships,
  // Diagnostics, Hormones, …) carries into the main view. Meals/supplements live
  // in the Nourishment carousel and appointments live in the day's Schedule, so
  // both are excluded here. Day-section placement: morning → Upon Waking/Morning,
  // day → Afternoon, night → Evening (an item may carry more than one).
  // TO-DOS — everything that isn't food: every section's protocols plus events
  // and appointments, placed into a to-do block by time of day, carrying a time
  // when it has one (appointments). Meals/supplements live on the meal slides.
  const dayRituals = (k) => {
    const out = []
    activities.forEach((a) => {
      if (!active(a, k)) return
      if (a.type === 'meal_item' || a.type === 'supplement') return
      const moved = a.details?.block
      const time = a.details?.time || ''
      const add = (part, blk) => out.push({ id: a.id, title: a.title, part, block: moved || blk || PART_TO_BLOCK[part] || 'morning', time, done: isDoneOn(a, k), order: a.order })
      if (a.type === 'event') { [...new Set(eventPartsOf(a))].forEach((part) => add(part)); return }
      const secs = daySectionsOf(a)
      if (secs.length) {
        secs.forEach((s) => { const blk = SECTION_BLOCK[s]; if (blk) add(BLOCK_PART[blk], blk) })
        return
      }
      partsOfActivity(a).forEach((part) => add(part))
    })
    return out
  }

  // The main month grid previews everything scheduled that day (to-dos), deduped.
  const dayGridItems = (k) => {
    const seen = new Set()
    return dayRituals(k)
      .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
      .map((a) => ({ id: a.id, title: a.title, done: a.done }))
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
    if (a.type === 'event') updateDetails(id, { partOfDay: part, parts: [part] })
    else update(id, { timeOfDay: [part] })
  }
  // Move a routine task into one of the five day-flow blocks (persisted).
  const moveTaskToBlock = (id, block) => updateDetails(id, { block })
  // Park an item off Today — it stays in its section, tagged "paused".
  const pauseItem = (id) => update(id, { status: 'paused' })
  // Add a quick to-do to a specific block on the selected day (a daily ritual
  // pinned to that block; edit it later to change how often it repeats).
  const addTask = (block, title) =>
    add(blankActivity('protocol', {
      title, category: 'wellness', frequency: 'daily', seriesStart: selectedKey,
      timeOfDay: [BLOCK_PART[block] || 'morning'], details: { block },
    }))

  const saveActivity = (a) => { if (isNew(a)) add(a); else update(a.id, a); setEditing(null) }

  // The TODAY-view add chooser adds straight into a specific category, so a new
  // item lands in that section (and carries into Today). Nutrition adds a meal;
  // Appointment adds a timed event; everything else adds that category's task.
  const ADD_SECTIONS = [
    { id: 'mindset', label: 'Mindset', type: 'protocol', category: 'mindset' },
    { id: 'skincare', label: 'Skincare', type: 'protocol', category: 'skincare' },
    { id: 'haircare', label: 'Haircare', type: 'protocol', category: 'haircare' },
    { id: 'aesthetics', label: 'Aesthetics', type: 'protocol', category: 'aesthetics' },
    { id: 'body', label: 'Bodycare', type: 'protocol', category: 'body' },
    { id: 'fitness', label: 'Fitness', type: 'protocol', category: 'fitness' },
    { id: 'nutrition', label: 'Nutrition', type: 'meal_item', category: 'nutrition' },
    { id: 'hormones', label: 'Hormones', type: 'protocol', category: 'hormones' },
    { id: 'diagnostics', label: 'Diagnostics', type: 'protocol', category: 'diagnostics' },
    { id: 'relationship', label: 'Relationships', type: 'protocol', category: 'relationship' },
    { id: 'spirituality', label: 'Spirituality', type: 'protocol', category: 'spirituality' },
    { id: 'appointments', label: 'To Do', type: 'protocol', category: 'appointments' },
  ]
  const pickSection = (id) => {
    const s = ADD_SECTIONS.find((x) => x.id === id)
    if (!s) return
    setHomeAdd(false)
    setFormAllowed([s.category])
    const overrides =
      s.type === 'meal_item' ? { category: s.category, details: { slot: 'breakfast', beverage: false } }
        : s.type === 'event' ? { category: s.category, seriesStart: selectedKey, frequency: 'asneeded', details: { partOfDay: 'morning' } }
          : { category: s.category, timeOfDay: ['morning'] }
    setEditing(blankActivity(s.type, overrides))
  }

  // Universal Add on the home page → choose a section, then open its form.
  useRegisterAdd(() => setHomeAdd(true), [])

  const pickDay = (k) => { setSelectedKey(k); setCalMonth(new Date(parseKey(k).getFullYear(), parseKey(k).getMonth(), 1)) }

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
        <Vitals />
      </div>

      <div className="pt-4">
      <Calendar
        calMonth={calMonth}
        setCalMonth={setCalMonth}
        selectedKey={selectedKey}
        setSelectedKey={setSelectedKey}
        today={today}
        cycleConfig={cycleConfig}
        eventsFor={dayGridItems}
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
        onMoveTaskBlock={moveTaskToBlock}
        onAddTask={addTask}
        onPause={pauseItem}
        onToggle={toggleEvent}
        onOpen={(id) => { setFormAllowed(null); setEditing(activities.find((a) => a.id === id) || null) }}
      />
      </div>

      <TodayNotes />

      {homeAdd && (
        <AddChooser
          options={ADD_SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
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
// Phase-aware one-liner shown under the AGENDA header.
const PHASE_AGENDA_HINT = {
  follicular: 'Good day for new tasks and deep focus.',
  ovulation: 'Lead, communicate, be seen.',
  luteal: 'Finish and organize.',
  menstrual: 'Keep it light today.',
}

// ── Calendar ───────────────────────────────────────────────────────
// A full month grid with prev/next month navigation; clicking a day expands the
// whole day's plan (routine, nourishment, agenda) below the grid.
function Calendar({ calMonth, setCalMonth, selectedKey, today, cycleConfig, eventsFor, ritualsFor, mealsFor, carry, onCompleteCarry, agendaHint, onPickDay, onAddMeal, onRemoveMeal, onReorder, onMovePart, onMoveTaskBlock, onAddTask, onPause, onToggle, onOpen }) {
  const selected = parseKey(selectedKey)

  return (
    <section className="mb-12">
      <MonthGrid
        month={calMonth}
        setMonth={setCalMonth}
        selectedKey={selectedKey}
        onPickDay={onPickDay}
        today={today}
        cycleConfig={cycleConfig}
        itemsForDay={eventsFor}
        onOpenItem={onOpen}
      />

      {/* Selected day — expands into everything planned that day */}
      <div className="mt-10 border-t border-stone-200 pt-6">
        <h3 className="mb-6 text-center font-serif text-2xl text-stone-900">{longDate(selected)}</h3>
        <DayColumns
          rituals={ritualsFor(selectedKey)}
          dateKeyStr={selectedKey}
          meals={mealsFor(selectedKey)}
          onAddMeal={onAddMeal}
          onRemoveMeal={onRemoveMeal}
          onMoveTaskBlock={onMoveTaskBlock}
          onAddTask={onAddTask}
          onPause={onPause}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      </div>
    </section>
  )
}

const dedupeById = (arr) => {
  const seen = new Set()
  return arr.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
}

// Sort events by manual order (drag), falling back to time.
const sortEvents = (a, b) => {
  const ao = a.order, bo = b.order
  if (ao != null && bo != null) return ao - bo
  if (ao != null) return -1
  if (bo != null) return 1
  return byTime(a, b)
}

// The day's nourishment, grouped into five swipeable time-blocks. Each block has
// a two-part badge (time · meal) and its own food + supplement rows. Supplement
// rows match by exact slot so a supp lives in exactly one block.
// The day is a carousel of slides. Meals are their own slides (nourishment
// only); to-dos live in their own time slides (Empty Stomach → Before Bed). A
// couple of to-do slots also carry the supplements taken then, so nothing is
// lost. `type` is 'meal' or 'todo'; `mealRows` is the nourishment shown.
const DAY_BLOCKS = [
  { id: 'waking', type: 'todo', top: 'To Do', sub: 'Empty Stomach', mealRows: [
    { kind: 'food', slot: 'empty', label: 'Food' },
    { kind: 'supp', slot: 'empty', label: 'Supplements' },
  ] },
  { id: 'breakfast', type: 'meal', top: 'Meal', sub: 'Breakfast', mealRows: [
    { kind: 'food', slot: 'breakfast', label: 'Breakfast' },
    { kind: 'food', slot: 'drink', label: 'Drink' },
    { kind: 'supp', slot: 'breakfast', label: 'Supplements' },
  ] },
  { id: 'morning', type: 'todo', top: 'To Do', sub: 'Morning', mealRows: [] },
  { id: 'lunch', type: 'meal', top: 'Meal', sub: 'Lunch', mealRows: [
    { kind: 'food', slot: 'lunch', label: 'Lunch' },
    { kind: 'supp', slot: 'lunch', label: 'Supplements' },
  ] },
  { id: 'daytime', type: 'todo', top: 'To Do', sub: 'Daytime', mealRows: [] },
  { id: 'dinner', type: 'meal', top: 'Meal', sub: 'Dinner', mealRows: [
    { kind: 'food', slot: 'dinner', label: 'Dinner' },
    { kind: 'supp', slot: 'dinner', label: 'Supplements' },
  ] },
  { id: 'evening', type: 'todo', top: 'To Do', sub: 'Evening', mealRows: [] },
  { id: 'bed', type: 'todo', top: 'To Do', sub: 'Before Bed', mealRows: [
    { kind: 'food', slot: 'bed', label: 'Food' },
    { kind: 'supp', slot: 'bed', label: 'Supplements' },
  ] },
]

// The five to-do blocks a task can live in, in order. A task's block comes from
// its time of day and can be moved; it's persisted on the activity (details.block).
const BLOCK_ORDER = ['waking', 'morning', 'daytime', 'evening', 'bed']
const PART_TO_BLOCK = { morning: 'morning', afternoon: 'daytime', evening: 'evening' }
// The part of day a block belongs to — used when a new to-do is created in it.
const BLOCK_PART = { waking: 'morning', morning: 'morning', daytime: 'afternoon', evening: 'evening', bed: 'evening' }
// A time-of-day section id (waking/morning/day/night/bed) → its to-do block.
const SECTION_BLOCK = { waking: 'waking', morning: 'morning', day: 'daytime', night: 'evening', bed: 'bed' }
const effectiveBlock = (r) =>
  r.block && BLOCK_ORDER.includes(r.block) ? r.block : (PART_TO_BLOCK[r.part] || 'morning')

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

// "14:30" → "2:30 PM"; blank/invalid → ''
const fmtApptTime = (t) => {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

// ── TODAY view body ──
// A swipeable carousel of the day's slides. Meals are their own slides
// (nourishment only); to-dos live in their own time slides (Empty Stomach →
// Before Bed). The dots move between them.
function DayColumns({ rituals, dateKeyStr, meals, onAddMeal, onRemoveMeal, onMoveTaskBlock, onAddTask, onPause, onToggle, onOpen }) {
  return (
    <div className="mx-auto max-w-2xl">
      <DayFlow
        rituals={rituals || []}
        meals={meals}
        dateKeyStr={dateKeyStr}
        onAdd={onAddMeal}
        onRemove={onRemoveMeal}
        onMoveTaskBlock={onMoveTaskBlock}
        onAddTask={onAddTask}
        onPause={onPause}
        onToggle={onToggle}
        onOpen={onOpen}
      />
    </div>
  )
}

// Soft framed card used for each slide.
const DAY_CARD = 'rounded-2xl border border-stone-200/80 bg-white/50 p-6 shadow-sm md:p-8'

// One carousel slide — a meal (nourishment) or a to-do block. A couple of to-do
// blocks also carry the supplements taken then. Arrows/dots move between slides.
function DayFlow({ rituals, meals, dateKeyStr, onAdd, onRemove, onMoveTaskBlock, onAddTask, onPause, onToggle, onOpen }) {
  const [i, setI] = useState(0)
  const [addingTask, setAddingTask] = useState(false)
  const n = DAY_BLOCKS.length
  const block = DAY_BLOCKS[i]
  const jump = (idx) => { setI(Math.max(0, Math.min(n - 1, idx))); setAddingTask(false) }
  const isTodo = block.type === 'todo'
  const tasks = isTodo ? dedupeById(rituals.filter((r) => effectiveBlock(r) === block.id)).sort(sortEvents) : []

  // Move a to-do to the previous/next to-do block, and follow it to that slide.
  const moveTask = (id, dir) => {
    const cur = BLOCK_ORDER.indexOf(block.id)
    const nb = BLOCK_ORDER[Math.max(0, Math.min(BLOCK_ORDER.length - 1, cur + dir))]
    if (!nb || nb === block.id) return
    onMoveTaskBlock(id, nb)
    setI(DAY_BLOCKS.findIndex((b) => b.id === nb))
  }
  const todoIndex = BLOCK_ORDER.indexOf(block.id)

  return (
    <div>
      <div className={DAY_CARD}>
        {/* Slide header — eyebrow, serif name, a small centred rule — flanked by arrows */}
        <div className="mb-7 flex items-center justify-between">
          <button onClick={() => jump(i - 1)} disabled={i === 0} className={`px-2 py-1 text-xl ${i === 0 ? 'text-stone-200' : 'text-stone-400 hover:text-stone-900'}`}>‹</button>
          <div className="text-center leading-tight">
            <p className="kicker text-stone-400">{block.top}</p>
            <p className="mt-1 font-serif text-2xl text-stone-900">{block.sub}</p>
            <span className="mx-auto mt-3 block h-px w-8 bg-stone-300" />
          </div>
          <button onClick={() => jump(i + 1)} disabled={i === n - 1} className={`px-2 py-1 text-xl ${i === n - 1 ? 'text-stone-200' : 'text-stone-400 hover:text-stone-900'}`}>›</button>
        </div>

        <div className="min-h-[150px] space-y-7">
          {/* To Do — only on to-do slides */}
          {isTodo && (
            <div>
              {tasks.length > 0 && (
                <div className="mb-2 space-y-0.5">
                  {tasks.map((t) => (
                    <TaskRow key={t.id} task={t} blockIndex={todoIndex} lastIndex={BLOCK_ORDER.length - 1} onToggle={onToggle} onOpen={onOpen} onMove={(dir) => moveTask(t.id, dir)} onPause={() => onPause(t.id)} />
                  ))}
                </div>
              )}
              {addingTask ? (
                <AddTaskForm onCancel={() => setAddingTask(false)} onSave={(title) => { onAddTask(block.id, title); setAddingTask(false) }} />
              ) : (
                <AddRow label="add to‑do" onClick={() => setAddingTask(true)} />
              )}
            </div>
          )}

          {/* Nourishment — meal slides, plus the supplements on Empty Stomach / Before Bed */}
          {block.mealRows.length > 0 && (
            <div className="space-y-5">
              {block.mealRows.map((row) => (
                <MealSection key={`${row.kind}:${row.slot}:${row.label}`} section={row} meals={meals} dateKeyStr={dateKeyStr} onAdd={onAdd} onRemove={onRemove} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-1.5">
        {DAY_BLOCKS.map((b, idx) => (
          <button
            key={b.id}
            onClick={() => jump(idx)}
            aria-label={`${b.top} · ${b.sub}`}
            className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-stone-700' : 'w-1.5 bg-stone-300 hover:bg-stone-400'}`}
          />
        ))}
      </div>
    </div>
  )
}

// A task within a day-flow block: check it off, tap to edit, or nudge it to the
// previous/next block with the hairline ‹ › marks (which surface on hover). The
// leading checkbox sits in a fixed gutter so its label aligns with every other
// row in the block, tasks and nutrition alike.
function TaskRow({ task, blockIndex, lastIndex, onToggle, onOpen, onMove, onPause }) {
  return (
    <div className="group flex items-center gap-3 py-0.5">
      <span className="flex w-4 shrink-0 justify-center"><Checkbox checked={task.done} onClick={() => onToggle(task.id)} /></span>
      <button onClick={() => onOpen(task.id)} className={`flex-1 text-left text-sm ${task.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
        {fmtApptTime(task.time) && <span className="mr-2 font-serif text-stone-500 tabular-nums">{fmtApptTime(task.time)}</span>}
        {task.title || 'Untitled'}
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={() => onMove(-1)} disabled={blockIndex === 0} aria-label="Move to earlier block" className={`px-1 text-sm ${blockIndex === 0 ? 'text-stone-200' : 'text-stone-400 hover:text-stone-900'}`}>‹</button>
        <button onClick={() => onMove(1)} disabled={blockIndex === lastIndex} aria-label="Move to later block" className={`px-1 text-sm ${blockIndex === lastIndex ? 'text-stone-200' : 'text-stone-400 hover:text-stone-900'}`}>›</button>
        {onPause && <button onClick={onPause} aria-label="Pause — park off Today" title="Pause — park off Today" className="px-1 text-stone-400 hover:text-stone-900"><Pause size={13} /></button>}
      </div>
    </div>
  )
}

// Inline "add …" affordance, indented to sit in the shared text column.
function AddRow({ label, onClick }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-4 shrink-0" />
      <button onClick={onClick} className="text-sm italic hover:text-stone-700 transition-colors" style={{ color: 'rgba(28, 28, 26, 0.7)' }}>{label}</button>
    </div>
  )
}

// Inline "add to-do" for a day-flow block — a quiet single-line entry.
function AddTaskForm({ onCancel, onSave }) {
  const [val, setVal] = useState('')
  const commit = () => { const t = val.trim(); if (t) onSave(t); else onCancel() }
  return (
    <div className="flex items-center gap-3">
      <span className="w-4 shrink-0" />
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
        onBlur={commit}
        placeholder="A to‑do for this block…"
        className="flex-1 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
      />
    </div>
  )
}

// Nutrition rows — same list language as the tasks: one text column, a quiet
// remove mark on hover, no checkbox (nutrition is never "achieved").
function MealSection({ section, meals, dateKeyStr, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false)
  const items = (meals || []).filter((m) => m.kind === section.kind && m.slot === section.slot)
  return (
    <div>
      <p className="kicker text-stone-400 mb-2">{section.label}</p>
      {items.length > 0 && (
        <div className="mb-1 space-y-0.5">
          {items.map((m) => (
            <div key={m.id} className="group flex items-center gap-3 py-0.5">
              <span className="w-4 shrink-0" />
              <span className="flex-1 text-sm text-stone-700">{m.name}</span>
              <button onClick={() => onRemove(m.id)} aria-label="Remove" className="shrink-0 px-1 text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div className="flex items-start gap-3">
          <span className="w-4 shrink-0" />
          <div className="flex-1">
            <AddMealForm
              slot={slotMeta(section.slot)}
              kind={section.kind}
              dateKeyStr={dateKeyStr}
              onCancel={() => setAdding(false)}
              onSave={(item) => { onAdd({ ...item, slot: section.slot, kind: section.kind }); setAdding(false) }}
            />
          </div>
        </div>
      ) : (
        <AddRow label={section.kind === 'supp' ? 'add supplement' : 'add food'} onClick={() => setAdding(true)} />
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

