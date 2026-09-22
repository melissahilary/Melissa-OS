import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, ChevronDown, Pause, BookOpen } from 'lucide-react'
import { CloseIcon, NextIcon } from './shared/marks'
import { BTN, BTN_SM, QUIET, FIELD, CHIP, CHIP_ON, CHIP_OFF } from './shared/buttons'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { phaseForConfig } from '../lib/cycle'
import {
  dateKey, parseKey, longDate, isSameDay, monthGrid, MONTHS, DOW,
} from '../lib/date'
import { fmtSpan } from '../lib/date'
import { holidayFor } from '../lib/holidays'
import Horoscope from './Horoscope'
import DayLists from './DayLists'
import DaySchedule from './DaySchedule'
import MonthGrid from './shared/MonthGrid'
import { AddMealForm } from './shared/MealSlots'
import { slotMeta, SITTINGS, spoken } from '../lib/meals'
import { useRegisterAdd, AddChooser } from './shared/AddButton'
import Checkbox from './shared/Checkbox'
import ActivityForm from './shared/ActivityForm'
import { useActivities } from '../hooks/useActivities'
import { activityOccursOn, isDoneOn, toMealShape, blankActivity, SECTION_CATS, partsOfActivity, daySectionsOf, eventPartsOf, ACTIVITY_CATEGORIES } from '../lib/activities'
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

// Hourly air quality for the location — US AQI and the fine-particulate number
// behind it — keyed the same way as the UV map so the two read off the same
// clock. Null on failure, which the strip shows as a dash rather than a zero.
async function fetchAirHourly(location) {
  const loc = await resolveCoords(location)
  if (!loc) return null
  const f = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=us_aqi,pm2_5&timezone=GMT&forecast_days=2`,
  )
  const fj = await f.json()
  const times = fj && fj.hourly && fj.hourly.time
  const aqi = fj && fj.hourly && fj.hourly.us_aqi
  const pm = fj && fj.hourly && fj.hourly.pm2_5
  if (!Array.isArray(times) || !Array.isArray(aqi)) return null
  const map = {}
  times.forEach((t, i) => { map[t] = { aqi: aqi[i], pm: Array.isArray(pm) ? pm[i] : null } })
  return map
}

// ── The time zone, in place of the town.
//
// The strip used to print the exact city she lives in, which is a thing a
// screenshot gives away for good. The zone is what the page actually needs —
// the clock and the sun times run on it — and it says nothing narrower than a
// third of a continent.
const tzLabel = (tz) => {
  if (!tz) return ''
  for (const style of ['longGeneric', 'long', 'short']) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style }).formatToParts(new Date())
      const v = parts.find((x) => x.type === 'timeZoneName')
      if (v && v.value && !/^GMT[+-]/.test(v.value)) return v.value
    } catch { /* try the next style */ }
  }
  return String(tz).split('/').pop().replace(/_/g, ' ')
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

// US EPA air quality bands, and what each one is actually asking of her. The
// names are the EPA's; the counsel is the house's — where to train, what to do
// with the windows, whether the purifier goes on.
const aqiBand = (n) => (n <= 50 ? 'good' : n <= 100 ? 'moderate' : n <= 150 ? 'sensitive' : n <= 200 ? 'unhealthy' : n <= 300 ? 'very' : 'hazardous')
const AQI_TITLE = { good: 'Good', moderate: 'Moderate', sensitive: 'Sensitive', unhealthy: 'Unhealthy', very: 'Very poor', hazardous: 'Hazardous' }
const aqiLabel = (n) => AQI_TITLE[aqiBand(n)]
const AQI_ADVICE = {
  good: 'Open the windows. Train outside for as long as you like.',
  moderate: 'Fine for almost everyone. If you are reactive, keep the long outdoor session for another day.',
  sensitive: 'Take the hard session indoors. Windows shut through the afternoon, purifier on.',
  unhealthy: 'Train indoors today. Windows shut, purifier on, and mask anything long outside.',
  very: 'Stay in. Windows sealed, purifier running, no outdoor exertion at all.',
  hazardous: 'Stay in, seal the windows, run the purifier, and go out only if you have to — masked.',
}

// ── Cycle statistics — staged so a baseline only appears once enough data exists.
//
// ORPHANED. These, and CyclePopup below, were reached from the phase line in
// the day masthead. That masthead is now the two routines, so nothing opens
// them. The code is kept rather than deleted because the read itself is worth
// having — regularity, average length, the ovulation estimate — and it has
// never lived anywhere else. It needs a home; it does not need rewriting.
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

// ── Info strip — moon · date · forecast · UV · air · zone, one elegant row.
//
// The cycle used to open it: LUTEAL · DAY 23, printed twice on the same screen,
// because the masthead an inch below says the same thing and then says what to
// do about it. The strip's job is the world outside the window — what the sky
// is doing, what the air is doing, what hour it is where she stands — and all
// of it re-reads itself on the clock rather than sitting where it was at dawn.
//
// The town is gone from the end of it. A planner that prints the city you live
// in has put that in every screenshot you will ever send; the time zone is what
// the page actually runs on and gives away nothing narrower than a coast.
function InfoStrip({ today, selectedKey, onPickDay, location, setLocation, cycleConfig }) {
  const [dateOpen, setDateOpen] = useState(false)
  const todayKey = dateKey(today)
  const selected = parseKey(selectedKey)
  const dateStr = `${MONTHS[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}`
  // The separators are flex children, so a wrap strands one at the end of a
  // line — a full stop where the line simply ran out. Six readings across three
  // lines on a phone need no dots at all; the gap already separates them.
  const Dot = () => <span aria-hidden className="hidden text-stone-300 sm:inline">·</span>
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 py-4 text-sm text-stone-600 sm:gap-x-6">
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
      <AirField location={location} />
      <Dot />
      <ZoneField location={location} setLocation={setLocation} />
    </div>
  )
}

// The zone, and the way back to changing it. It reads as a word rather than a
// field because it is not somewhere to type — the picker opens on a tap, and
// what it sets is still a city, because the forecast needs one. Only the
// printing of it changed.
function ZoneField({ location, setLocation }) {
  const [tz, setTz] = useState(null)
  const [open, setOpen] = useState(false)
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

  const label = tzLabel(tz)
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-stone-600 transition-colors hover:text-stone-900">
        {label || 'Set a city'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="w-full max-w-xs border border-stone-200 bg-cream">
            <div className="flex justify-end px-4 pt-3">
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
            </div>
            <div className="px-6 pb-6">
              <p className="kicker mb-2 text-stone-500">Where you are</p>
              <LocationField
                location={location}
                setLocation={setLocation}
                className="w-full border-b border-stone-300 bg-transparent pb-1.5 text-sm text-stone-900 outline-none transition-colors focus:border-stone-900 placeholder:text-stone-400"
              />
              <p className="mt-3 text-xs italic text-stone-500">
                The forecast, the sun times and the clock run on this. Only the zone{label ? ` — ${label} —` : ''} is printed on the page.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Air quality, read off the same clock as the UV.
function AirField({ location }) {
  const [map, setMap] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!location) { setMap(null); return undefined }
    let alive = true
    const load = async () => {
      try { const m = await fetchAirHourly(location); if (alive) setMap(m) }
      catch { if (alive) setMap(null) }
    }
    load()
    const id = setInterval(load, 30 * 60 * 1000)
    return () => { alive = false; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey(location)])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const now = useMemo(() => {
    if (!map) return null
    const v = map[utcHourKey(new Date())]
    return v && v.aqi != null ? { aqi: Math.round(v.aqi), pm: v.pm } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tick])

  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => now && setOpen(true)}
        disabled={!now}
        className={`text-stone-700 ${now ? 'transition-colors hover:text-stone-900' : ''}`}
      >
        Air {now ? `${now.aqi} ${aqiLabel(now.aqi)}` : '—'}
      </button>
      {open && now && <AirPopup air={now} onClose={() => setOpen(false)} />}
    </>
  )
}

function AirPopup({ air, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs border border-stone-200 bg-cream">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
        </div>
        <div className="px-6 pb-6">
          <p className="kicker mb-1 text-stone-500">Today</p>
          <p className="text-sm text-stone-800">{AQI_ADVICE[aqiBand(air.aqi)]}</p>
          {air.pm != null && (
            <p className="mt-3 border-t border-stone-200 pt-3 text-xs tracking-[0.12em] text-stone-500">
              PM2.5 {Math.round(air.pm * 10) / 10} µg/m³
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Calendar pop-up (planner popup style) to jump the viewed day to any date.
function DatePopup({ value, today, cycleConfig, onPick, onClose }) {
  const [month, setMonth] = useState(new Date(parseKey(value).getFullYear(), parseKey(value).getMonth(), 1))
  const cells = monthGrid(month)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm text-left" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-200">
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
      <div className="w-full max-w-xs bg-cream border border-stone-200">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
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
      <div className="w-full max-w-sm bg-cream border border-stone-200">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
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
            <button onClick={() => { onEdit(); onClose() }} className={`mt-5 w-full justify-center ${BTN}`}>Edit my cycle</button>
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
      <div className="w-full max-w-xs bg-cream border border-stone-200">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
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
      <div className="w-full max-w-xs bg-cream border border-stone-200">
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
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

export default function Today({ cycleConfig, location, setLocation, pendingDay, clearPendingDay, goToCycle, goToDream }) {
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
  const [blockAdd, setBlockAdd] = useState(false) // block-scoped add popup open
  const [currentBlock, setCurrentBlock] = useState(DAY_BLOCKS[0]) // the visible day slide
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
        out.push({ id: a.id, title: a.title, part: eventPartsOf(a)[0], time: a.details.time || '', endTime: a.details.endTime || '', done: isDoneOn(a, k), order: a.order })
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
      // `category` rides along because the routines print the pillar an item
      // belongs to. This object is a reduction of the activity, and anything
      // left out of it is simply not on the page — which is how the calendar's
      // rhythm dots went missing once already.
      const add = (part, blk) => out.push({ id: a.id, title: a.title, category: a.category || '', part, block: moved || blk || PART_TO_BLOCK[part] || 'morning', time, endTime: a.details?.endTime || '', done: isDoneOn(a, k), order: a.order })
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
      .map((a) => ({ id: a.id, title: a.title, done: a.done, part: a.part, time: a.time }))
  }

  // NOURISHMENT — meal items + supplements for a day, shaped for the slots.
  const dayMeals = (k) =>
    activities
      .filter((a) => (a.type === 'meal_item' || a.type === 'supplement') && active(a, k))
      .map((a) => ({ ...toMealShape(a), done: isDoneOn(a, k) }))

  // Quick inline add from a meal slot (AddMealForm shape → activity).
  const addMeal = (m) =>
    add(blankActivity(m.kind === 'supp' ? 'supplement' : 'meal_item', {
      title: m.name, frequency: m.frequency || 'daily', daysOfWeek: m.days || [], seriesStart: m.startDate || '',
      details: m.kind === 'supp' ? { slot: m.slot, dose: '', unit: 'mg' } : { slot: m.slot, beverage: slotMeta(m.slot).label === 'Drink' },
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
  // Add a one-time appointment on the selected day, at a time. Shows in the day's
  // agenda and on the calendars.
  const partForTime = (t) => { if (!t) return 'morning'; const h = parseInt(t.slice(0, 2), 10); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening' }
  const addEvent = (title, time, endTime) =>
    add(blankActivity('event', {
      title, category: 'personal', frequency: 'once', seriesStart: selectedKey,
      details: { time: time || '', endTime: time ? (endTime || '') : '', partOfDay: partForTime(time), description: '', attendees: '', durationMinutes: '' },
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
  // The floating Add opens a small popup scoped to the block currently on screen
  // (Empty Stomach, Dinner, Daytime…) → add a to-do, food, drink, or supplement
  // straight into that block.
  useRegisterAdd(() => setBlockAdd(true), [])

  const pickDay = (k) => { setSelectedKey(k); setCalMonth(new Date(parseKey(k).getFullYear(), parseKey(k).getMonth(), 1)) }
  const openActivity = (id) => { setFormAllowed(null); setEditing(activities.find((a) => a.id === id) || null) }

  return (
    <div>
      {/* The page opens on the two routines and the day's sittings — the part
          of it that is actually worked, rather than a clock she already has on
          the wall and in her hand. */}
      <DayMasthead
        selectedKey={selectedKey}
        rituals={dayRituals(selectedKey)}
        meals={dayMeals(selectedKey)}
        onOpen={openActivity}
      />

      {/* The world outside the window, read as one line under the routines. */}
      <InfoStrip today={today} selectedKey={selectedKey} onPickDay={pickDay} location={location} setLocation={setLocation} cycleConfig={cycleConfig} />

      <DayColumns
        rituals={dayRituals(selectedKey)}
        dateKeyStr={selectedKey}
        meals={dayMeals(selectedKey)}
        onAddMeal={addMeal}
        onRemoveMeal={removeMeal}
        onMoveTaskBlock={moveTaskToBlock}
        onAddTask={addTask}
        onPause={pauseItem}
        onToggle={toggleEvent}
        onOpen={openActivity}
        onBlockChange={setCurrentBlock}
      />

      {/* The day as a spine: only the hours that hold something, in order. */}
      <DaySchedule
        dateKeyStr={selectedKey}
        rituals={dayRituals(selectedKey)}
        meals={dayMeals(selectedKey)}
        phase={todayPhase}
        onAdd={(title, at) => addEvent(title, at)}
      />

      {/* What is owed rather than scheduled: the tasks, the reminders and the
          running list. They sit directly under the strip, before the reading,
          because they are the part of the page she is most often here for. */}
      <DayLists />

      <Horoscope />

      <div className="pt-6">
      <Calendar
        calMonth={calMonth}
        setCalMonth={setCalMonth}
        selectedKey={selectedKey}
        setSelectedKey={setSelectedKey}
        today={today}
        cycleConfig={cycleConfig}
        goToCycle={goToCycle}
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
        onOpen={openActivity}
        onBlockChange={setCurrentBlock}
      />
      </div>

      {/* Notes and the list are a pair — side by side once there's room for them */}
      {/* The shopping list used to sit here beside the notes. It is one of the
          three lists at the head of the page now, on the same store, so
          nothing already written down moved. */}
      <TodayNotes />

      {/* The way into Becoming. It used to sit in the index, under the twelve
          pillars, which put a place you visit once a week beside twelve you
          keep daily. At the foot of the day it is where it belongs for now:
          after everything today asks of her, the thing the days are for. */}
      {goToDream && (
        <div className="mt-6 flex flex-col items-center border-t border-stone-200 pt-10">
          <p className="kicker text-stone-500">What the days are for</p>
          <button
            onClick={goToDream}
            className="mt-4 inline-flex items-center gap-2.5 rounded-full bg-stone-900 px-8 py-3 font-serif text-lg tracking-wide text-cream transition-opacity hover:opacity-90"
          >
            Becoming
          </button>
        </div>
      )}

      {blockAdd && (
        <BlockAddChooser
          block={currentBlock}
          onAddTask={addTask}
          onAddMeal={addMeal}
          onAddEvent={addEvent}
          onClose={() => setBlockAdd(false)}
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

// ── A routine, as a surface.
//
// One of the two panels that head the day: a kicker, the phrase, and the
// routine itself as a numbered ledger. Cobalt for the morning, ink for the
// evening — the only two places in the product where the accent fills
// something this large, and they are a pair or they are nothing.
//
// The right-hand column is the pillar the item belongs to, not its state. Ten
// thousand steps reads FITNESS. Whether it is kept is said by the tick marks
// further down the page, and saying it twice says it once.
const PER_PAGE = 6

function Routine({ kicker, lead, italic, tail, items, ground, onOpen }) {
  const [page, setPage] = useState(0)
  const dim = ground === '#1D2FC4' ? 'rgba(247,244,237,0.55)' : 'rgba(247,244,237,0.45)'
  const rule = ground === '#1D2FC4' ? 'rgba(247,244,237,0.22)' : 'rgba(247,244,237,0.16)'
  // Six at a time. A routine of twenty is a wall; six is a page of one, and
  // the arrow only exists when there is a seventh.
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE))
  const p = Math.min(page, pages - 1)
  const shown = items.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE)

  return (
    <section className="flex flex-col px-7 py-9 sm:px-10 sm:py-12" style={{ backgroundColor: ground }}>
      <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: dim }}>{kicker}</p>
      <h2 className="mt-7 font-serif text-[40px] leading-[1.02] text-cream sm:text-[52px]">
        {lead}<br /><em className="italic">{italic}</em><br />{tail}
      </h2>
      <div className="mt-10 flex-1">
        {shown.length === 0 ? (
          <p className="text-[15px]" style={{ color: dim }}>Nothing set.</p>
        ) : shown.map((it, i) => (
          <button
            key={it.id}
            onClick={() => onOpen && onOpen(it.id)}
            className="flex w-full items-baseline gap-5 py-3 text-left transition-opacity hover:opacity-75"
            style={{ borderBottom: `1px solid ${rule}` }}
          >
            <span className="w-6 shrink-0 text-[10px] tracking-[0.1em]" style={{ color: dim }}>{String(p * PER_PAGE + i + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1 text-[17px] leading-snug text-cream">{it.title || 'Untitled'}</span>
            {pillarOf(it) && (
              <span className="shrink-0 text-[10px] uppercase tracking-[0.14em]" style={{ color: dim }}>{pillarOf(it)}</span>
            )}
          </button>
        ))}
      </div>
      {pages > 1 && (
        <div className="mt-7 flex items-center justify-end gap-5">
          <span className="text-[10px] tracking-[0.14em]" style={{ color: dim }}>{p + 1}&thinsp;/&thinsp;{pages}</span>
          <button
            onClick={() => setPage((n) => (n + 1) % pages)}
            aria-label="More"
            className="text-xl leading-none transition-opacity hover:opacity-60"
            style={{ color: 'rgb(247,244,237)' }}
          >
            →
          </button>
        </div>
      )}
    </section>
  )
}

// Which pillar an item belongs to, in her own words — the category it was
// filed under. Ten thousand steps is filed fitness, so it reads FITNESS.
const pillarOf = (a) => {
  const c = ACTIVITY_CATEGORIES.find((x) => x.id === (a.category || ''))
  return c ? c.label : ''
}

function DayMasthead({ selectedKey, rituals = [], meals = [], onOpen }) {
  // Deduped, and keyed on the block a task actually sits in rather than its
  // part of day — a repeat that shows in two parts is still one task.
  const uniq = dedupeById(rituals)

  const morning = uniq.filter((r) => effectiveBlock(r) === 'morning')
  const evening = uniq.filter((r) => effectiveBlock(r) === 'evening')

  return (
    <header>
      {/* The two routines, filling the split the date and the cycle used to
          hold. Each row names the pillar it belongs to rather than whether it
          is kept — the tick marks below already say that, and a row that says
          KEPT twice on one page is saying nothing the second time. */}
      <div className="mos-bleed grid gap-px md:grid-cols-2">
        <Routine
          kicker="Morning routine"
          lead="Before"
          italic="anyone"
          tail="asks."
          items={morning}
          ground="#1D2FC4"
          onOpen={onOpen}
        />
        <Routine
          kicker="Evening routine"
          lead="After"
          italic="everyone"
          tail="has gone."
          items={evening}
          ground="#16130F"
          onOpen={onOpen}
        />
      </div>
    </header>
  )
}

// ── Calendar ───────────────────────────────────────────────────────
// A full month grid with prev/next month navigation; clicking a day expands the
// whole day's plan (routine, nourishment, agenda) below the grid.
function Calendar({ calMonth, setCalMonth, selectedKey, today, cycleConfig, goToCycle, eventsFor, ritualsFor, mealsFor, carry, onCompleteCarry, agendaHint, onPickDay, onAddMeal, onRemoveMeal, onReorder, onMovePart, onMoveTaskBlock, onAddTask, onPause, onToggle, onOpen, onBlockChange }) {
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
        daySignal={(k) => {
          const list = eventsFor(k) || []
          return {
            morning: list.some((e) => e.part === 'morning'),
            afternoon: list.some((e) => e.part === 'afternoon'),
            evening: list.some((e) => e.part === 'evening'),
            special: list.some((e) => !!e.time),
          }
        }}
      />

      {/* The routines and the sittings for the selected day head the page now,
          above the reading, so the calendar ends with the grid itself. */}
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
//
// `no` and `hours` are what turn eight lists into one day. A planner that shows
// you five identical white boxes has told you nothing about when any of it
// happens; a running order — VII · Evening · 6—10 PM — is a shape you can hold
// in your head, and it is the difference between a checklist and a day.
//
// Said, not clocked. A twenty-four hour readout belongs on a departures board.
const DAY_BLOCKS = [
  { id: 'waking', type: 'todo', noTasks: true, no: 'I', hours: '6—7 AM', top: 'Nourish', sub: 'Empty Stomach', mealRows: [
    { kind: 'food', slot: 'emptydrink', label: 'Drink' },
    { kind: 'supp', slot: 'empty', label: 'Supplements' },
  ] },
  { id: 'breakfast', type: 'meal', no: 'II', hours: '7—9 AM', top: 'Meal', sub: 'Breakfast', mealRows: [
    { kind: 'food', slot: 'breakfast', label: 'Breakfast' },
    { kind: 'food', slot: 'drink', label: 'Drink' },
    { kind: 'supp', slot: 'breakfast', label: 'Supplements' },
  ] },
  { id: 'morning', type: 'todo', no: 'III', hours: '7 AM—12 PM', top: 'To Do', sub: 'Morning', mealRows: [] },
  { id: 'lunch', type: 'meal', no: 'IV', hours: '12—2 PM', top: 'Meal', sub: 'Lunch', mealRows: [
    { kind: 'food', slot: 'lunch', label: 'Lunch' },
    { kind: 'food', slot: 'lunchdrink', label: 'Drink' },
    { kind: 'supp', slot: 'lunch', label: 'Supplements' },
  ] },
  { id: 'daytime', type: 'todo', no: 'V', hours: '12—6 PM', top: 'To Do', sub: 'Daytime', mealRows: [] },
  { id: 'dinner', type: 'meal', no: 'VI', hours: '6—8 PM', top: 'Meal', sub: 'Dinner', mealRows: [
    { kind: 'food', slot: 'dinner', label: 'Dinner' },
    { kind: 'food', slot: 'dinnerdrink', label: 'Drink' },
    { kind: 'supp', slot: 'dinner', label: 'Supplements' },
  ] },
  { id: 'evening', type: 'todo', no: 'VII', hours: '6—10 PM', top: 'To Do', sub: 'Evening', mealRows: [] },
  { id: 'bed', type: 'todo', noTasks: true, no: 'VIII', hours: '10—11 PM', top: 'Nourish', sub: 'Before Bed', mealRows: [
    { kind: 'food', slot: 'beddrink', label: 'Drink' },
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
// Empty Stomach / Before Bed carry only nourishment now — any to-dos that land in
// them fold into the neighbouring Morning / Evening lists.
const BLOCK_REMAP = { waking: 'morning', bed: 'evening' }
const effectiveBlock = (r) => {
  const raw = r.block && BLOCK_ORDER.includes(r.block) ? r.block : (PART_TO_BLOCK[r.part] || 'morning')
  return BLOCK_REMAP[raw] || raw
}

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
        {open ? <ChevronDown size={13} className="text-stone-400" /> : <NextIcon size={13} className="text-stone-400" />}
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
// The day's body. It was three ruled columns — III Morning, V Daytime, VII
// Evening — under the food. The morning and the evening are the two surfaces
// at the head of the page now, and the food is the strip, so the columns were
// the same day written a second time. DayFlow went with them; this is what is
// left of it.
function DayColumns({ dateKeyStr, meals, onAddMeal, onOpen }) {
  return <Sittings meals={meals} dateKeyStr={dateKeyStr} onAdd={onAddMeal} onOpen={onOpen} />
}

// ── The day's nourishment, as seven sittings.
//
// The strip runs the width of the page and the ground darkens across it —
// paper at twenty to seven in the morning, near-black at ten at night — so
// where you are in the day is a colour before it is a word. It opens on the
// sitting nearest the hour rather than at dawn.
//
// Each card states the hour the way a person says it, then what is eaten, what
// is taken and what is drunk. No measurements: a drink is what it is, not how
// many millilitres of it. Beside each of the three is a plus, and it opens the
// same form the rest of the app adds meals with — which asks whether this is a
// one-off or something that repeats, so a dinner tonight does not become a
// dinner every night.
function Sittings({ meals, dateKeyStr, onAdd, onOpen }) {
  // When she set an hour, and for how long. `standing` is the hour from here
  // on; `days` holds the one-off changes, so moving dinner tonight does not
  // move it for good.
  const [clockRaw, setClock] = useLocalStorage('mos:sittings', { standing: {}, days: {} })
  const clock = clockRaw && typeof clockRaw === 'object' ? clockRaw : {}
  const hourOf = (id) => {
    const day = (clock.days && clock.days[dateKeyStr]) || {}
    if (day[id]) return day[id]
    const st = (clock.standing || {})[id]
    if (st) return st
    return (SITTINGS.find((x) => x.id === id) || {}).at
  }

  const nearest = () => {
    const now = new Date()
    const mins = now.getHours() * 60 + now.getMinutes()
    let best = 0
    SITTINGS.forEach((x, k) => {
      const [h, m] = hourOf(x.id).split(':').map(Number)
      if (h * 60 + m <= mins) best = k
    })
    return best
  }
  const [i, setI] = useState(nearest)
  const [adding, setAdding] = useState(null) // { slot, kind }
  const [editing, setEditing] = useState(null) // { id, value }
  const [asking, setAsking] = useState(null)   // { id, value } — today, or from now on
  const rail = useRef(null)
  const n = SITTINGS.length

  // How many scroll positions the rail actually has. With seven cards three
  // across there are five: asking for the sixth and the seventh lands exactly
  // where the fifth did, so those two marks were dead — they lit up and moved
  // nothing. The count is measured rather than assumed, so it is right at
  // every width, and on a phone where one card fills the rail all seven stay.
  const [stops, setStops] = useState(n)
  useEffect(() => {
    const el = rail.current
    if (!el) return undefined
    const measure = () => {
      const card = el.children[0]
      const w = card ? card.getBoundingClientRect().width : 0
      if (!w) return
      const perView = Math.max(1, Math.round(el.clientWidth / w))
      setStops(Math.max(1, n - perView + 1))
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro) ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [n])

  useEffect(() => { if (i > stops - 1) setI(stops - 1) }, [stops])

  // Keep the chosen card in view — by scrolling the rail itself, never the
  // page. scrollIntoView would drag the whole document down to reach a card
  // that is below the fold, which on load reads as the page jumping.
  useEffect(() => {
    const strip = rail.current
    const el = strip && strip.children[i]
    if (!strip || !el) return
    strip.scrollTo({ left: el.offsetLeft - strip.offsetLeft, behavior: 'smooth' })
  }, [i])

  const itemsIn = (slot, kind) => (meals || []).filter((m) => m.slot === slot && m.kind === kind)

  return (
    <div className="mos-bleed mb-12">
      <div ref={rail} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {SITTINGS.map((x, idx) => {
          const ink = x.dark ? '#F7F4ED' : '#16130F'
          const dim = x.dark ? 'rgba(247,244,237,0.58)' : 'rgba(22,19,15,0.52)'
          const rule = x.dark ? 'rgba(247,244,237,0.20)' : 'rgba(22,19,15,0.16)'
          const food = itemsIn(x.food, 'food')
          const supps = itemsIn(x.food, 'supp')
          const drink = itemsIn(x.drink, 'food')
          const Group = ({ label, list, slot, kind }) => (
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: dim }}>{label}</span>
                <button
                  onClick={() => setAdding({ slot, kind })}
                  aria-label={`Add to ${label.toLowerCase()}`}
                  className="text-[13px] leading-none transition-opacity hover:opacity-60"
                  style={{ color: dim }}
                >
                  +
                </button>
              </div>
              {list.length === 0 ? (
                <p className="mt-1.5 text-[15px]" style={{ color: dim }}>None</p>
              ) : (
                <p className="mt-1.5 text-[15px] leading-snug" style={{ color: ink }}>
                  {list.map((m, k) => (
                    <span key={m.id}>
                      {k > 0 && <span style={{ color: dim }}> · </span>}
                      <button onClick={() => onOpen && onOpen(m.id)} className="text-left transition-opacity hover:opacity-70">{m.name}</button>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )
          return (
            <section
              key={x.id}
              className="mos-sitting flex min-h-[420px] shrink-0 snap-start flex-col px-7 py-9 sm:px-9"
              style={{ backgroundColor: x.ground, color: ink }}
              aria-current={idx === i ? 'true' : undefined}
            >
              <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: dim }}>{x.label}</p>
              {/* The hour, and a way to change it. Enter asks whether this is
                  tonight or from now on — the app has no other way to say the
                  difference, and guessing it is how a one-off becomes a rule. */}
              {editing && editing.id === x.id ? (
                <input
                  autoFocus
                  type="time"
                  value={editing.value}
                  onChange={(e) => setEditing({ id: x.id, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editing.value) { setAsking({ id: x.id, value: editing.value }); setEditing(null) }
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  onBlur={() => { if (editing.value && editing.value !== hourOf(x.id)) setAsking({ id: x.id, value: editing.value }); setEditing(null) }}
                  className="mt-2 w-full bg-transparent font-serif text-[40px] leading-none outline-none sm:text-[48px]"
                  style={{ color: ink, borderBottom: `1px solid ${rule}` }}
                />
              ) : (
                <button
                  onClick={() => setEditing({ id: x.id, value: hourOf(x.id) })}
                  aria-label={`Change the time for ${x.label}`}
                  className="mt-2 text-left font-serif text-[44px] leading-none transition-opacity hover:opacity-70 sm:text-[52px]"
                  style={{ color: ink }}
                >
                  {spoken(hourOf(x.id))}
                </button>
              )}
              <span className="mt-6 block h-px w-full" style={{ backgroundColor: rule }} />
              <div className="mt-6 flex-1 space-y-6">
                <Group label="Meal" list={food} slot={x.food} kind="food" />
                <Group label="Supplements" list={supps} slot={x.food} kind="supp" />
                <Group label="Drink" list={drink} slot={x.drink} kind="food" />
              </div>
            </section>
          )
        })}
      </div>

      {/* Where along the day she is. Centred, and only as many marks as there
          are places to go — the arrows are gone because the marks do the same
          job and the rail takes a swipe on its own. */}
      {stops > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: stops }, (_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`${SITTINGS[idx].label} ${spoken(hourOf(SITTINGS[idx].id))}`}
              aria-current={idx === i ? 'true' : undefined}
              className={`h-[3px] transition-all ${idx === i ? 'w-8 bg-stone-900' : 'w-4 bg-stone-300 hover:bg-stone-500'}`}
            />
          ))}
        </div>
      )}

      {/* Tonight, or from now on. The app cannot tell the difference between
          moving dinner once and moving it for good, and guessing is how a
          one-off quietly becomes a rule — so it asks, once, in two lines. */}
      {asking && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setAsking(null) }}>
          <div className="w-full max-w-sm border border-stone-200 bg-cream p-6">
            <p className="kicker text-stone-500">{(SITTINGS.find((x) => x.id === asking.id) || {}).label}</p>
            <p className="mt-2 font-serif text-3xl leading-tight text-stone-900">{spoken(asking.value)}</p>
            <div className="mt-7">
              <button
                onClick={() => {
                  setClock((prev) => {
                    const c = prev && typeof prev === 'object' ? prev : {}
                    const days = { ...(c.days || {}) }
                    days[dateKeyStr] = { ...(days[dateKeyStr] || {}), [asking.id]: asking.value }
                    return { ...c, days }
                  })
                  setAsking(null)
                }}
                className="block w-full border-b border-stone-200 pb-3 pt-3 text-left transition-opacity hover:opacity-70"
              >
                <span className="block font-serif text-[19px] leading-snug text-stone-900">Just today</span>
                <span className="mt-1 block text-sm text-stone-500">Tomorrow goes back to {spoken(((SITTINGS.find((x) => x.id === asking.id) || {}).at))}.</span>
              </button>
              <button
                onClick={() => {
                  setClock((prev) => {
                    const c = prev && typeof prev === 'object' ? prev : {}
                    return { ...c, standing: { ...(c.standing || {}), [asking.id]: asking.value } }
                  })
                  setAsking(null)
                }}
                className="block w-full border-b border-cobalt pb-3 pt-4 text-left transition-opacity hover:opacity-70"
              >
                <span className="flex items-baseline justify-between gap-4">
                  <span className="font-serif text-[19px] leading-snug text-stone-900">Start a series</span>
                  <span className="shrink-0 text-[9px] tracking-[0.16em] text-cobalt">RECOMMENDED</span>
                </span>
                <span className="mt-1 block text-sm text-stone-500">Every day from today, until you change it again.</span>
              </button>
            </div>
            <button onClick={() => setAsking(null)} className={`mt-6 ${QUIET}`}>Cancel</button>
          </div>
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setAdding(null) }}>
          <div className="w-full max-w-sm border border-stone-200 bg-cream p-6">
            <p className="kicker mb-4 text-stone-500">{slotMeta(adding.slot).label} · {adding.kind === 'supp' ? 'Supplement' : 'Food'}</p>
            <AddMealForm
              slot={slotMeta(adding.slot)}
              kind={adding.kind}
              dateKeyStr={dateKeyStr}
              onCancel={() => setAdding(null)}
              onSave={(item) => { onAdd({ ...item, slot: adding.slot, kind: adding.kind }); setAdding(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// The floating Add — a full picker: choose what (To-do / Food / Drink /
// Supplement), then when (any time of day or mealtime), then name it. Reuses the
// same quick-add handlers the inline links use. `block` is the slide on screen and
// only pre-selects the matching "when" so the common case is one tap faster.
const ADD_TYPES = [
  { key: 'todo', label: 'To‑do', wheres: [
    { label: 'Morning', block: 'morning' },
    { label: 'Daytime', block: 'daytime' },
    { label: 'Evening', block: 'evening' },
  ] },
  { key: 'appt', label: 'Appointment', appt: true },
  { key: 'food', label: 'Food', kind: 'food', wheres: [
    { label: 'Breakfast', slot: 'breakfast' },
    { label: 'Lunch', slot: 'lunch' },
    { label: 'Dinner', slot: 'dinner' },
  ] },
  { key: 'drink', label: 'Drink', kind: 'food', wheres: [
    { label: 'Empty Stomach', slot: 'emptydrink' },
    { label: 'Breakfast', slot: 'drink' },
    { label: 'Lunch', slot: 'lunchdrink' },
    { label: 'Dinner', slot: 'dinnerdrink' },
    { label: 'Before Bed', slot: 'beddrink' },
  ] },
  { key: 'supp', label: 'Supplement', kind: 'supp', wheres: [
    { label: 'Empty Stomach', slot: 'empty' },
    { label: 'Breakfast', slot: 'breakfast' },
    { label: 'Lunch', slot: 'lunch' },
    { label: 'Dinner', slot: 'dinner' },
    { label: 'Before Bed', slot: 'bed' },
  ] },
]

function BlockAddChooser({ block, onAddTask, onAddMeal, onAddEvent, onClose }) {
  const [type, setType] = useState(null)
  const [where, setWhere] = useState(null)
  const [val, setVal] = useState('')
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  const commit = () => {
    const t = val.trim()
    if (!t || !type) return
    if (type.appt) { if (onAddEvent) onAddEvent(t, time, endTime) }
    else if (!where) return
    else if (type.key === 'todo') onAddTask(where.block, t)
    else onAddMeal({ name: t, kind: type.kind, slot: where.slot })
    onClose()
  }

  const Pill = ({ onClick, active, children }) => (
    <button onClick={onClick} className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}>{children}</button>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs overflow-hidden border border-stone-200 bg-cream">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <span className="kicker text-stone-400">
            {!type ? 'Add' : type.label}{type && where ? ` · ${where.label}` : ''}
          </span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
        </div>
        <div className="px-5 py-5">
          {/* Step 1 — what are we adding? */}
          {!type ? (
            <div className="flex flex-wrap gap-2">
              {ADD_TYPES.map((t) => (
                <Pill key={t.key} onClick={() => setType(t)}>{t.label}</Pill>
              ))}
            </div>
          ) : type.appt ? (
            /* Appointment — name + an optional time, on the day you're viewing. */
            <div>
              <p className="kicker mb-2 text-stone-400">Appointment</p>
              <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit() }} placeholder="What is it?" className={`mb-3 ${FIELD}`} />
              <div className="flex items-center gap-2">
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
                {!!time && <>
                  <span className="text-sm text-stone-400">to</span>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={FIELD} />
                </>}
                <button onClick={commit} className={`ml-auto shrink-0 ${BTN_SM}`}>Add</button>
              </div>
              <button onClick={() => { setType(null); setVal(''); setTime(''); setEndTime('') }} className="mt-3 text-xs text-stone-400 hover:text-stone-700">‹ Back</button>
            </div>
          ) : !where ? (
            /* Step 2 — when? any time of day or mealtime. */
            <div>
              <p className="kicker mb-3 text-stone-400">{type.key === 'todo' ? 'Time of day' : 'Mealtime'}</p>
              <div className="flex flex-wrap gap-2">
                {type.wheres.map((w) => (
                  <Pill key={w.label} active={w.label === block.sub} onClick={() => setWhere(w)}>{w.label}</Pill>
                ))}
              </div>
              <button onClick={() => setType(null)} className="mt-4 text-xs text-stone-400 hover:text-stone-700">‹ Back</button>
            </div>
          ) : (
            /* Step 3 — name it. */
            <div>
              <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-cream py-1.5 pl-4 pr-1.5 focus-within:border-stone-400">
                <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit() }} placeholder={`Add ${type.label.toLowerCase()}…`} className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-400" />
                <button onClick={commit} className={`shrink-0 ${BTN_SM}`}>Add</button>
              </div>
              <button onClick={() => { setWhere(null); setVal('') }} className="mt-3 text-xs text-stone-400 hover:text-stone-700">‹ Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── A section break ────────────────────────────────────────────────
//
// What stood here was an <h2> set to text-4xl and then dragged back down to
// 0.62em by an inline style — a heading fighting its own class list, twice, in
// two places. A break is a name between two rules: the house's own signature,
// and it costs nothing.
function SectionRule({ children }) {
  return (
    <div className="mb-7 flex items-center gap-4">
      <span className="h-px flex-1 bg-stone-200" />
      <span className="kicker shrink-0 text-stone-900">{children}</span>
      <span className="h-px flex-1 bg-stone-200" />
    </div>
  )
}

// A line you write on, with the verb riding inside it. The verb used to be a
// bordered box standing outside the end of the rule, which is a second rectangle
// doing the job a word does — and there were two of them on this page.
function WriteLine({ value, onChange, onCommit, placeholder, action = 'Add' }) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-300 pb-1.5 transition-colors focus-within:border-stone-900">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onCommit()}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-1 text-[15px] outline-none placeholder:text-stone-400"
      />
      {/* Not disabled when the line is empty. A greyed-out 10px mono label on
          ivory is 1.6:1 — a word you cannot read, telling you about a state you
          can already see. It stays legible and says what Enter does; pressing
          it with nothing written does nothing, which is the same as Enter. */}
      <button onClick={onCommit} className="shrink-0 text-[10px] tracking-[0.16em] text-stone-500 transition-colors hover:text-stone-900">
        {action.toUpperCase()}
      </button>
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
  const [browsing, setBrowsing] = useState(false)
  const todayKey = dateKey(new Date())

  const add = () => {
    const t = draft.trim()
    if (!t) return
    const note = { id: uid(), title: t, body: '', date: todayKey }
    setNotes((prev) => [note, ...(Array.isArray(prev) ? prev : [])])
    setDraft('')
  }
  const update = (id, patch) =>
    setNotes((prev) => (Array.isArray(prev) ? prev : []).map((n) => (n.id === id ? { ...n, ...patch } : n)))
  const remove = (id) => setNotes((prev) => (Array.isArray(prev) ? prev : []).filter((n) => n.id !== id))

  const openNote = notes.find((n) => n.id === openId) || null
  const todaysNotes = notes.filter((n) => n.date === todayKey)
  const olderCount = notes.length - todaysNotes.length

  return (
    <section className="mb-14">
      <SectionRule>Today's notes</SectionRule>

      <div className="mx-auto mb-8 w-full max-w-xl xl:max-w-none">
        <WriteLine value={draft} onChange={setDraft} onCommit={add} placeholder="Write a note…" />
      </div>

      {todaysNotes.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {todaysNotes.map((n) => (
            <NoteCard key={n.id} note={n} onOpen={() => setOpenId(n.id)} />
          ))}
        </div>
      )}

      {/* The way into the whole notebook. It was a bordered button floating in
          the middle of the column, which is the shape of a primary action — and
          reading back through what you have written is not one. It is a verb at
          the end of the section now, on the section's own rule. */}
      <div className={`flex items-center gap-4 border-t border-stone-200 pt-3 ${todaysNotes.length > 0 ? 'mt-7' : 'mt-5'}`}>
        <span className="text-[11px] italic text-stone-400">{olderCount > 0 ? `${olderCount} before today` : 'Kept as you write them'}</span>
        <button onClick={() => setBrowsing(true)} className={`ml-auto ${QUIET}`}>
          <BookOpen size={14} strokeWidth={1.75} />
          Notebook <span aria-hidden>→</span>
        </button>
      </div>

      {browsing && (
        <NotesArchive notes={notes} onOpen={(id) => { setOpenId(id); setBrowsing(false) }} onClose={() => setBrowsing(false)} />
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
      className="flex flex-col items-start border border-stone-200 bg-cream/50 p-5 text-left transition-colors hover:border-stone-900"
    >
      <h3 className="font-serif text-xl leading-tight text-stone-900">{note.title || 'Untitled'}</h3>
      {/* An empty note used to announce itself — "No content yet." under every
          one-line note, which is a sentence spent saying there is no sentence. */}
      {firstLine && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-500">{firstLine}</p>}
      <p className="kicker mt-3 text-stone-500">{noteDateLabel(note.date)}</p>
    </button>
  )
}

// Browse every note — search by words or jump to a specific day. Notes group
// under their date, newest first; tapping one opens it to read or edit.
function NotesArchive({ notes, onOpen, onClose }) {
  const [q, setQ] = useState('')
  const [day, setDay] = useState('')
  const term = q.trim().toLowerCase()
  const filtered = (notes || []).filter((n) => {
    if (day && n.date !== day) return false
    if (!term) return true
    return `${n.title || ''} ${n.body || ''}`.toLowerCase().includes(term)
  })
  const byDate = {}
  filtered.forEach((n) => { (byDate[n.date] = byDate[n.date] || []).push(n) })
  const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1))
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-cream border border-stone-200">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
          <span className="font-serif italic text-2xl text-stone-900">All notes</span>
          <button onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-900"><CloseIcon size={20} /></button>
        </div>
        <div className="space-y-3 border-b border-stone-200 px-6 py-4">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" className="w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
          <div className="flex items-center gap-3">
            <span className="kicker text-stone-400">Jump to</span>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900" />
            {day && <button onClick={() => setDay('')} className="text-xs text-stone-400 hover:text-stone-700">clear</button>}
          </div>
        </div>
        <div className="max-h-[58vh] overflow-y-auto px-6 py-4">
          {dates.length === 0 ? (
            <p className="text-sm italic text-stone-400">No notes found.</p>
          ) : (
            dates.map((d) => (
              <div key={d} className="mb-5">
                <p className="kicker text-stone-400 mb-2">{noteDateLabel(d)}</p>
                <div>
                  {byDate[d].map((n) => {
                    const firstLine = (n.body || '').split('\n').find((l) => l.trim()) || ''
                    return (
                      <button key={n.id} onClick={() => onOpen(n.id)} className="flex w-full flex-col items-start border-b border-stone-100 py-2.5 text-left transition-colors hover:text-stone-900">
                        <span className="font-serif text-base text-stone-800">{n.title || 'Untitled'}</span>
                        {firstLine && <span className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-stone-500">{firstLine}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
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
      <div className="w-full max-w-xl bg-cream border border-stone-200">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <input
            value={note.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Title"
            autoFocus
            className="w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none"
          />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900"><CloseIcon size={20} /></button>
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
          <button onClick={onClose} className={BTN_SM}>Done</button>
        </div>
      </div>
    </div>
  )
}

