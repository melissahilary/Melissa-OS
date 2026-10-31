import React, { useState } from 'react'
import { parseKey, dateKey, MONTHS, DOW_LONG } from '../../lib/date'
import { activityOccursOn } from '../../lib/activities'

// ── How often, said in words.
//
// Everything in this app that happens more than once needs the same six
// answers and one way out of them, and until now the only answers on offer
// were a row of chips that could not say "the last Friday of the month" or
// "every three weeks until March".
//
// The six are written out of the day she is standing on — weekly on THIS
// weekday, annually on THIS date — so she is reading the thing she is about
// to make rather than a word that could mean several things. Everything the
// six cannot say is behind Custom, which is a sheet of its own.
//
// Underneath it is the same series the rest of the app already understood;
// nothing here invents a new kind of repeat, it only gives her the ones the
// engine could always do.

const WALNUT = '#68472C'
const IVORY = '#F7F4ED'
const FAINT = 'rgba(247,244,237,0.22)'
const MUTED = 'rgba(247,244,237,0.62)'

const ORDINALS = ['first', 'second', 'third', 'fourth']
const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
const isLast = (d) => d.getDate() + 7 > daysInMonth(d)
const ordinalOf = (d) => (isLast(d) ? 'last' : ORDINALS[Math.ceil(d.getDate() / 7) - 1])

const UNITS = [
  { id: 'day', one: 'day', many: 'days' },
  { id: 'week', one: 'week', many: 'weeks' },
  { id: 'month', one: 'month', many: 'months' },
  { id: 'year', one: 'year', many: 'years' },
]
const MARKS = [
  { d: 0, label: 'S', name: 'Sunday' }, { d: 1, label: 'M', name: 'Monday' },
  { d: 2, label: 'T', name: 'Tuesday' }, { d: 3, label: 'W', name: 'Wednesday' },
  { d: 4, label: 'T', name: 'Thursday' }, { d: 5, label: 'F', name: 'Friday' },
  { d: 6, label: 'S', name: 'Saturday' },
]

// The six that cover almost every case, written out of the day she is on.
export function presets(startKey) {
  const d = parseKey(startKey)
  const dow = d.getDay()
  return [
    { id: 'once', label: 'Does not repeat', rule: { frequency: 'once' } },
    { id: 'daily', label: 'Daily', rule: { frequency: 'daily' } },
    { id: 'weekly', label: `Weekly on ${DOW_LONG[dow]}`, rule: { frequency: 'weekly', daysOfWeek: [dow] } },
    { id: 'monthlyday', label: `Monthly on the ${ordinalOf(d)} ${DOW_LONG[dow]}`, rule: { frequency: 'monthlyday', daysOfWeek: [dow] } },
    { id: 'yearly', label: `Annually on ${MONTHS[d.getMonth()]} ${d.getDate()}`, rule: { frequency: 'yearly' } },
    { id: 'weekdays', label: 'Every weekday, Monday to Friday', rule: { frequency: 'weekdays' } },
  ]
}

const sameDays = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x))

// Which of the six this is, if it is one of them.
export function presetOf(rule, startKey) {
  if (!rule) return null
  if (rule.seriesEnd) return null // an ending is never one of the six
  return presets(startKey).find((p) => (
    p.rule.frequency === rule.frequency && sameDays(p.rule.daysOfWeek || [], rule.daysOfWeek || [])
  )) || null
}

// What a rule says, in a line — for the row that is standing in for it.
export function describe(rule, startKey) {
  if (!rule) return 'Does not repeat'
  const p = presetOf(rule, startKey)
  if (p) return p.label
  const n = rule.interval && rule.interval > 0 ? rule.interval : 1
  const unit = UNITS.find((u) => u.id === (rule.frequency === 'nweeks' ? 'week' : rule.intervalUnit)) || UNITS[1]
  let out = n === 1 ? `Every ${unit.one}` : `Every ${n} ${unit.many}`
  if (unit.id === 'week' && Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length) {
    out += ` on ${rule.daysOfWeek.slice().sort().map((d) => DOW_LONG[d].slice(0, 3)).join(', ')}`
  }
  if (rule.seriesEnd) {
    const e = parseKey(rule.seriesEnd)
    out += `, until ${MONTHS[e.getMonth()]} ${e.getDate()}`
  }
  return out
}

// "After twelve times" is a date once you know where it starts, so it is
// worked out here and stored as one — the series itself only understands days.
export function endsAfter(rule, startKey, times) {
  const a = { ...rule, seriesStart: startKey }
  let d = parseKey(startKey)
  let seen = 0
  for (let i = 0; i < 366 * 12; i += 1) {
    const k = dateKey(d)
    if (activityOccursOn(a, k)) {
      seen += 1
      if (seen >= times) return k
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  }
  return ''
}

// The one mark of choice in the house: a square hairline that fills.
function Mark({ on }) {
  return (
    <span
      aria-hidden
      className="mt-[3px] h-[15px] w-[15px] shrink-0 border transition-colors"
      style={{ borderColor: on ? IVORY : 'rgba(247,244,237,0.45)', background: on ? IVORY : 'transparent' }}
    />
  )
}

// ── The field itself: six lines and a way out of them.
export default function RepeatField({ value, startKey, onChange }) {
  const [custom, setCustom] = useState(false)
  const list = presets(startKey)
  const chosen = presetOf(value, startKey)
  const isCustom = !chosen

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>How often</p>
      <div className="mt-4">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.rule)}
            aria-pressed={chosen && chosen.id === p.id}
            className="flex w-full items-start gap-4 py-2.5 text-left text-[16px] leading-snug transition-opacity hover:opacity-85"
            style={{ color: IVORY }}
          >
            <Mark on={!!chosen && chosen.id === p.id} />
            <span className="min-w-0 flex-1">{p.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          aria-pressed={isCustom}
          className="flex w-full items-start gap-4 py-2.5 text-left text-[16px] leading-snug transition-opacity hover:opacity-85"
          style={{ color: IVORY }}
        >
          <Mark on={isCustom} />
          <span className="min-w-0 flex-1">
            {isCustom ? describe(value, startKey) : 'Something else…'}
          </span>
        </button>
      </div>

      {custom && (
        <CustomRepeat
          value={isCustom ? value : null}
          startKey={startKey}
          onClose={() => setCustom(false)}
          onDone={(r) => { onChange(r); setCustom(false) }}
        />
      )}
    </div>
  )
}

// ── Everything the six cannot say.
//
// Every so many days, weeks, months or years; on which days of the week when
// it is weeks; and whether it ever stops — never, on a date, or after a
// number of times.
function CustomRepeat({ value, startKey, onClose, onDone }) {
  const start = parseKey(startKey)
  const [n, setN] = useState(value && value.interval > 0 ? value.interval : 1)
  const [unit, setUnit] = useState(value ? (value.frequency === 'nweeks' ? 'week' : value.intervalUnit || 'week') : 'week')
  const [days, setDays] = useState(
    value && Array.isArray(value.daysOfWeek) && value.daysOfWeek.length ? value.daysOfWeek : [start.getDay()],
  )
  const [ends, setEnds] = useState(value && value.seriesEnd ? 'on' : 'never')
  const [until, setUntil] = useState(value && value.seriesEnd ? value.seriesEnd : '')
  const [times, setTimes] = useState(13)

  const toggle = (d) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const done = () => {
    const count = Math.max(1, Number(n) || 1)
    const rule = unit === 'week'
      ? { frequency: 'nweeks', interval: count, daysOfWeek: days.length ? days : [start.getDay()] }
      : { frequency: 'custom', interval: count, intervalUnit: unit, daysOfWeek: [] }
    if (ends === 'on' && until) rule.seriesEnd = until
    if (ends === 'after') {
      const k = endsAfter(rule, startKey, Math.max(1, Number(times) || 1))
      if (k) rule.seriesEnd = k
    }
    onDone(rule)
  }

  const u = UNITS.find((x) => x.id === unit) || UNITS[1]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      style={{ background: 'rgba(22,19,15,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="mos-scroll max-h-[calc(88vh_-_var(--mos-kb))] w-full max-w-md overflow-y-auto px-7 pb-9 pt-8 sm:px-9"
        style={{ background: WALNUT, color: IVORY }}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: MUTED }}>Something else</p>

        <p className="mt-7 text-[10px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>Repeat every</p>
        <div className="mt-3 flex items-end gap-5">
          <input
            type="number"
            min="1"
            max="99"
            value={n}
            onChange={(e) => setN(e.target.value)}
            aria-label="How many"
            className="w-[72px] border-b bg-transparent pb-2 text-center font-serif text-[28px] leading-none outline-none"
            style={{ borderColor: FAINT, color: IVORY }}
          />
          <div className="flex flex-wrap gap-2">
            {UNITS.map((x) => {
              const on = x.id === unit
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setUnit(x.id)}
                  aria-pressed={on}
                  className="border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors"
                  style={on
                    ? { borderColor: IVORY, background: IVORY, color: WALNUT }
                    : { borderColor: FAINT, color: IVORY }}
                >
                  {Number(n) > 1 ? x.many : x.one}
                </button>
              )
            })}
          </div>
        </div>

        {unit === 'week' && (
          <>
            <p className="mt-8 text-[10px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>Repeat on</p>
            <div className="mt-3 flex gap-2">
              {MARKS.map((m) => {
                const on = days.includes(m.d)
                return (
                  <button
                    key={m.d}
                    type="button"
                    onClick={() => toggle(m.d)}
                    aria-pressed={on}
                    aria-label={m.name}
                    className="h-10 flex-1 border text-[11px] uppercase tracking-[0.1em] transition-colors"
                    style={on
                      ? { borderColor: IVORY, background: IVORY, color: WALNUT }
                      : { borderColor: FAINT, color: IVORY }}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <p className="mt-8 text-[10px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>Ends</p>
        <div className="mt-3">
          <button type="button" onClick={() => setEnds('never')} aria-pressed={ends === 'never'} className="flex w-full items-start gap-4 py-2.5 text-left text-[16px]" style={{ color: IVORY }}>
            <Mark on={ends === 'never'} />
            <span>Never</span>
          </button>
          <div className="flex items-center gap-4 py-2.5">
            <button type="button" onClick={() => setEnds('on')} aria-pressed={ends === 'on'} aria-label="Ends on a date" className="flex items-start gap-4 text-left text-[16px]" style={{ color: IVORY }}>
              <Mark on={ends === 'on'} />
              <span>On</span>
            </button>
            <input
              type="date"
              value={until}
              onChange={(e) => { setUntil(e.target.value); setEnds('on') }}
              aria-label="The last day"
              className="min-w-0 flex-1 border-b bg-transparent pb-1.5 text-[15px] outline-none"
              style={{ borderColor: FAINT, color: IVORY, colorScheme: 'dark', opacity: ends === 'on' ? 1 : 0.5 }}
            />
          </div>
          <div className="flex items-center gap-4 py-2.5">
            <button type="button" onClick={() => setEnds('after')} aria-pressed={ends === 'after'} aria-label="Ends after a number of times" className="flex items-start gap-4 text-left text-[16px]" style={{ color: IVORY }}>
              <Mark on={ends === 'after'} />
              <span>After</span>
            </button>
            <input
              type="number"
              min="1"
              value={times}
              onChange={(e) => { setTimes(e.target.value); setEnds('after') }}
              aria-label="How many times"
              className="w-[64px] border-b bg-transparent pb-1.5 text-center text-[15px] outline-none"
              style={{ borderColor: FAINT, color: IVORY, opacity: ends === 'after' ? 1 : 0.5 }}
            />
            <span className="text-[13px]" style={{ color: MUTED, opacity: ends === 'after' ? 1 : 0.5 }}>times</span>
          </div>
        </div>

        <div className="mt-9 flex items-center justify-end gap-7">
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70" style={{ color: MUTED }}>Cancel</button>
          <button onClick={done} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70">Done</button>
        </div>
      </div>
    </div>
  )
}
