import React, { useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { activityOccursOn } from '../lib/activities'
import SwipeAway, { OXBLOOD } from './shared/SwipeAway'
import RepeatField from './shared/Repeat'

// ── Moved, not measured.
//
// What she did with her body today, kept the way the rest of the day is kept:
// a line, how long it took, and whatever unit that particular thing is counted
// in — three miles, four sets of eight. The app does not care which, because a
// body does not keep one unit.
//
// What it was FOR is never hers to type. Each line is read for her — strength,
// core, glutes, and the rest — and the eight bars at the foot are the week in
// those terms. The three numerals below them are the only measuring on the
// page, and they are hers to write rather than a device's to report.

const uid = () => Math.random().toString(36).slice(2, 10)
const arr = (v) => (Array.isArray(v) ? v : [])
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const two = (n) => String(n).padStart(2, '0')

const mins = (v) => {
  const n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// ── How long it took, wherever she happened to write it.
//
// How long was a field of its own only lately; before that she wrote it into
// the line that counts the thing — "30 mins", "1 h 15". Those lines are still
// in her planner, so the length is read out of them rather than lost, and
// what is left of the line is what is shown beside it.
const readLength = (text) => {
  let rest = ` ${String(text || '')} `
  let total = 0
  const hm = rest.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)\b/i)
  if (hm) {
    total += Math.round(parseFloat(hm[1]) * 60)
    rest = rest.replace(hm[0], ' ')
    // "1 h 15" — the minutes after an hour need no unit of their own.
    const bare = rest.match(/^\s*(\d{1,2})\b/)
    if (bare) { total += Number(bare[1]); rest = rest.replace(bare[0], ' ') }
  }
  const mm = rest.match(/(\d+)\s*(?:minutes|minute|mins|min|m)\b/i)
  if (mm) { total += Number(mm[1]); rest = rest.replace(mm[0], ' ') }
  rest = rest.replace(/\s+/g, ' ').replace(/^[\s·,|-]+|[\s·,|-]+$/g, '')
  return { minutes: total, rest }
}

// ── The intention, read from what she wrote.
//
// Nothing here counts her steps, and a second form asking her to set a number
// she has already set would be the app not listening. She writes "walk 10k
// steps" as the thing she means to do; that IS the figure. Ten thousand, two
// fives, eight — whatever the day's lines add up to is what the day is for.
const readSteps = (text) => {
  let total = 0
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(k\b)?\s*steps\b/gi
  let m = re.exec(String(text || ''))
  while (m) {
    const n = parseFloat(m[1].replace(/,/g, ''))
    if (Number.isFinite(n)) total += Math.round(m[2] ? n * 1000 : n)
    m = re.exec(String(text || ''))
  }
  return total
}
const stepsIn = (x) => readSteps(`${(x && x.name) || ''} ${(x && x.detail) || ''}`)

// The length of one line, from the field if it has one and from the line it
// counts if it does not.
const lengthOf = (x) => mins(x && x.minutes) || readLength(x && x.detail).minutes

// She does not put an hour to these. She puts a part of the day.
const WHEN = [
  { id: 'morning', label: 'Morning' },
  { id: 'daytime', label: 'Daytime' },
  { id: 'evening', label: 'Evening' },
]
const WHEN_ORDER = { morning: 0, daytime: 1, evening: 2 }
const whenLabel = (id) => (WHEN.find((w) => w.id === id) || {}).label || ''

// Hours and minutes, said the way she would say them.
const spoken = (total) => {
  if (!total) return ''
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${two(m)}` : `${h} h`
}

export default function Movement({ dateKeyStr }) {
  const [raw, setRaw] = useLocalStorage('mos:movement', [])
  const [tallyRaw, setTally] = useLocalStorage('mos:movement:tally', {})
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(null)

  const key = dateKeyStr || dateKey(new Date())
  const all = arr(raw)
  const tally = obj(tallyRaw)[key] || {}

  // What lands on this day, in the order she put it in.
  const today = all
    .filter((x) => activityOccursOn({ ...x, seriesStart: x.seriesStart || '', type: 'protocol' }, key))
    .sort((a, b) => {
      const w = (WHEN_ORDER[a.when] ?? 1) - (WHEN_ORDER[b.when] ?? 1)
      return w || (a.order || 0) - (b.order || 0)
    })

  // ── Carrying a workout to where it belongs.
  //
  // The same hold as the routines: the row is lifted out and carried under the
  // finger while the others close behind it. The day is still kept in its own
  // order — morning, then daytime, then evening — so a row dropped among the
  // evening ones becomes an evening one. The sequence she let go of is the
  // sequence she gets.
  const [held, setHeld] = useState(null)
  const [lift, setLift] = useState(0)
  const drag = useRef(null)
  const rail = useRef(null)

  // The order in hand while a row is in hand; hers again once it is let go.
  const rows = (() => {
    if (!held) return today
    const held0 = held.ids.map((id) => today.find((y) => y.id === id)).filter(Boolean)
    return held0.length === today.length ? held0 : today
  })()


  const reorder = (ids) => setRaw((prev) => {
    const all0 = arr(prev)
    const seq = ids.map((id) => all0.find((y) => y.id === id)).filter(Boolean)
    const moved = drag.current && drag.current.id
    const at = seq.findIndex((y) => y.id === moved)
    // It takes the part of the day of whatever it was put beside.
    const beside = at > 0 ? seq[at - 1] : seq[1]
    const landed = beside ? beside.when || 'daytime' : null
    return all0.map((y) => {
      const k = seq.findIndex((z) => z.id === y.id)
      if (k < 0) return y
      return { ...y, order: k, when: y.id === moved && landed ? landed : y.when }
    })
  })

  const grab = (id, clientY) => {
    drag.current = { id, ids: rows.map((r) => r.id), y: clientY, dy: 0, raf: 0, settling: false }
    setLift(0)
    setHeld({ id, ids: drag.current.ids })
  }

  const place = (clientY) => {
    const d = drag.current
    if (!d || !rail.current) return
    const others = [...rail.current.children].filter((el) => el.dataset.id && el.dataset.id !== d.id)
    let to = others.length
    for (let i = 0; i < others.length; i += 1) {
      const r = others[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) { to = i; break }
    }
    const rest = d.ids.filter((x) => x !== d.id)
    rest.splice(to, 0, d.id)
    if (rest.join() !== d.ids.join()) {
      d.ids = rest
      setHeld({ id: d.id, ids: rest })
    }
  }

  const frame = () => {
    const d = drag.current
    if (!d) return
    const el = rail.current && rail.current.querySelector(`[data-id="${d.id}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      const off = d.y - (r.top + r.height / 2)
      if (Math.abs(off) > 0.4) { d.dy += off; setLift(d.dy) }
    }
    place(d.y)
    d.raf = requestAnimationFrame(frame)
  }

  // On the window, not on the grip: reordering moves the grip's own row through
  // the DOM, and a capture held on a node that has just moved is dropped.
  useEffect(() => {
    if (!held) return undefined
    const at = (e) => (e.touches && e.touches.length ? e.touches[0].clientY : e.clientY)
    const onMove = (e) => { if (e.cancelable) e.preventDefault(); if (drag.current) drag.current.y = at(e) }
    const onUp = () => {
      const d = drag.current
      if (!d) return
      cancelAnimationFrame(d.raf)
      reorder(d.ids)
      d.settling = true
      setLift(0)
      setTimeout(() => { drag.current = null; setHeld(null) }, 180)
    }
    drag.current.raf = requestAnimationFrame(frame)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    window.addEventListener('touchcancel', onUp)
    return () => {
      if (drag.current) cancelAnimationFrame(drag.current.raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('touchcancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held && held.id])

  const done = (x) => !!(x.completions && x.completions[key])
  const setDone = (id, on) => setRaw((prev) => arr(prev).map((x) => {
    if (x.id !== id) return x
    const c = { ...(x.completions || {}) }
    if (on) c[key] = true
    else delete c[key]
    return { ...x, completions: c }
  }))

  const write = (field) => (e) => {
    const v = e.target.value
    setTally((prev) => ({ ...obj(prev), [key]: { ...obj(obj(prev)[key]), [field]: v } }))
  }

  // Active is not hers to write. It is the day's movement added up — every
  // line she has put down, whether or not she has kept it yet.
  const active = today.reduce((n, x) => n + lengthOf(x), 0)

  // And what she set out to walk, added up the same way.
  const stepGoal = today.reduce((n, x) => n + stepsIn(x), 0)

  return (
    <section className="mos-bleed border-t border-stone-200 px-6 py-14 md:px-12 md:py-20">
      <div className="mx-auto max-w-5xl">
        {/* Headed the way every other section on the day is headed: the small
            word for what this is, then the name of it set large. The phrase
            that stood here was a poster, not a heading — it told her what the
            section was for, which is not a thing she needs told every day. */}
        <h2 className="font-serif text-[46px] leading-[0.95] text-stone-900 sm:text-[62px]">Workouts</h2>

        {/* The record. */}
        <div
          className="mt-14 select-none"
          ref={rail}
          style={{ touchAction: held ? 'none' : undefined, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          {rows.map((x, idx) => {
            const kept = done(x)
            const long = lengthOf(x)
            const said = mins(x.minutes) ? x.detail : readLength(x.detail).rest
            const meta = [whenLabel(x.when), long ? `${long} min` : '', said].filter(Boolean).join(' · ')
            return (
              <div
                key={x.id}
                data-id={x.id}
                className="relative"
                style={held && held.id === x.id ? {
                  transform: `translateY(${lift}px)`,
                  transition: drag.current && drag.current.settling ? 'transform 180ms ease-out' : 'none',
                  zIndex: 20,
                  background: '#F8F4EC',
                  outline: '1px solid #D6D3D1',
                } : null}
              >
              <SwipeAway
                ground="#F8F4EC"
                disabled={!!held}
                onAway={() => setRaw((prev) => arr(prev).filter((y) => y.id !== x.id))}
              >
                <div className={`flex items-start gap-6 py-6 ${idx && !held ? 'border-t border-stone-200' : ''}`}>
                  {/* Keeping it is the only thing to press on a row, so it is
                      the thing on the left rather than a word on the right. */}
                  <button
                    onClick={() => setDone(x.id, !kept)}
                    aria-pressed={kept}
                    aria-label={`${kept ? 'Kept' : 'Keep'} ${x.name}`}
                    className="mt-[11px] flex h-[19px] w-[19px] shrink-0 items-center justify-center border transition-colors"
                    style={{ borderColor: kept ? '#16130F' : '#D6D3D1' }}
                  >
                    {kept && (
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden>
                        <path d="M1 5.1 L4.3 8.4 L11 1.3" stroke="#16130F" strokeWidth="1.4" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setOpen(x)}
                    className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70"
                  >
                    <span className={`block font-serif text-[26px] leading-tight sm:text-[30px] ${kept ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                      {x.name}
                    </span>
                    {meta && <span className="mt-1.5 block text-[10px] uppercase tracking-[0.16em] text-stone-500">{meta}</span>}
                  </button>
                  {/* The grip. Three fine rules, the same hold as the routines. */}
                  <span
                    role="button"
                    tabIndex={-1}
                    data-no-swipe
                    aria-label={`Move ${x.name}`}
                    onPointerDown={(e) => { e.preventDefault(); grab(x.id, e.clientY) }}
                    onTouchStart={(e) => { if (e.cancelable) e.preventDefault(); grab(x.id, e.touches[0].clientY) }}
                    onContextMenu={(e) => e.preventDefault()}
                    className="-my-2 mt-[4px] flex h-10 w-10 shrink-0 cursor-grab select-none flex-col items-end justify-center gap-[3px] active:cursor-grabbing"
                    style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                  >
                    <span className="block h-px w-4 bg-stone-400" />
                    <span className="block h-px w-4 bg-stone-400" />
                    <span className="block h-px w-4 bg-stone-400" />
                  </span>
                </div>
              </SwipeAway>
              </div>
            )
          })}

          <div className="pt-6">
            <button
              onClick={() => setAdding(true)}
              aria-label="Add something she moved for"
              className="mx-auto block px-6 py-2 text-[30px] leading-none text-stone-900 transition-opacity hover:opacity-60"
            >
              +
            </button>
          </div>
        </div>

        {/* The footnote. Steps are hers to write; the hours add themselves. */}
        <div className="mt-14 grid grid-cols-2 gap-8 border-t border-stone-200 pt-9">
          <label className="block">
            <span className="kicker block text-stone-500">Steps</span>
            <input
              value={tally.steps || ''}
              onChange={write('steps')}
              placeholder="8,412"
              autoComplete="off"
              data-no-dictation
              className="mt-3 w-full bg-transparent font-serif text-[34px] leading-none text-stone-900 outline-none placeholder:text-stone-300 sm:text-[44px]"
            />
            {/* What she set out to walk, printed under what she walked. It is
                the intention, not a verdict: no colour, no mark, nothing that
                turns a quiet day into a failure. */}
            {!!stepGoal && (
              <span className="mt-3 block text-[10px] uppercase tracking-[0.16em] text-stone-500">
                of {stepGoal.toLocaleString()}
              </span>
            )}
          </label>
          <div className="block">
            <span className="kicker block text-stone-500">Active</span>
            <span className="mt-3 block font-serif text-[34px] leading-none sm:text-[44px]" style={{ color: active ? '#16130F' : '#D6D3D1' }}>
              {active ? spoken(active) : '0 min'}
            </span>
          </div>
        </div>
      </div>

      {adding && (
        <MovementSheet
          startKey={key}
          onClose={() => setAdding(false)}
          onSave={(m) => {
            setRaw((prev) => [...arr(prev), { ...m, id: uid(), order: arr(prev).length, completions: {}, seriesStart: key }])
            setAdding(false)
          }}
        />
      )}

      {open && (
        <MovementSheet
          startKey={open.seriesStart || key}
          item={open}
          onClose={() => setOpen(null)}
          onDrop={() => { setRaw((prev) => arr(prev).filter((y) => y.id !== open.id)); setOpen(null) }}
          onSave={(m) => {
            setRaw((prev) => arr(prev).map((y) => (y.id === open.id ? { ...y, ...m } : y)))
            setOpen(null)
          }}
        />
      )}
    </section>
  )
}

// ── Adding, or opening, a form of movement.
//
// Any kind at all: the name, how long it takes, and one line of however it is
// counted — three miles, four by eight. One field for the unit rather than
// three, because the thing being counted changes with the thing being done.
// Nothing here asks what it was for; that is read from the name.
function MovementSheet({ item, startKey, onSave, onDrop, onClose }) {
  const [name, setName] = useState(item ? item.name : '')
  const [when, setWhen] = useState(item && item.when ? item.when : 'morning')
  const [length, setLength] = useState(item ? String(mins(item.minutes) || readLength(item.detail).minutes || '') : '')
  const [detail, setDetail] = useState(item ? (mins(item.minutes) ? item.detail || '' : readLength(item.detail).rest) : '')
  const [notes, setNotes] = useState(item ? item.notes || '' : '')
  const [repeat, setRepeat] = useState(() => {
    const r = { frequency: (item && item.frequency) || 'once' }
    if (item && Array.isArray(item.daysOfWeek) && item.daysOfWeek.length) r.daysOfWeek = item.daysOfWeek
    if (item && item.interval) r.interval = item.interval
    if (item && item.intervalUnit) r.intervalUnit = item.intervalUnit
    if (item && item.seriesEnd) r.seriesEnd = item.seriesEnd
    return r
  })

  // Pressing an action must not first blur the field: on a phone that dismisses
  // the keyboard, the sheet grows back under her thumb, and the press lands on
  // nothing. Holding focus through the press keeps the button where she aimed.
  const hold = (e) => e.preventDefault()

  const field = useRef(null)
  const save = () => {
    const t = name.trim().toLowerCase()
    if (!t) { if (field.current) field.current.focus(); return }
    const r = repeat || {}
    onSave({
      name: t,
      when,
      minutes: mins(length) || '',
      detail: detail.trim().toLowerCase(),
      notes,
      frequency: r.frequency || 'once',
      daysOfWeek: r.daysOfWeek || [],
      interval: r.interval || 0,
      intervalUnit: r.intervalUnit || '',
      seriesEnd: r.seriesEnd || '',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ background: 'rgba(22,19,15,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="mos-scroll max-h-[calc(88vh_-_var(--mos-kb))] w-full max-w-md overflow-y-auto px-7 pb-9 pt-8 sm:px-9"
        style={{ background: '#68472C', color: '#F7F4ED' }}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        <p className="text-[10px] uppercase tracking-[0.22em] text-cream/60">Moved</p>

        <input
          autoFocus
          ref={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Reformer, with Ines"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          data-no-dictation
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
          className="mt-4 w-full border-b border-cream/30 bg-transparent pb-2 font-serif text-[30px] lowercase text-cream outline-none placeholder:text-cream/30"
        />

        {/* Not an hour. A part of the day, which is the only way she thinks
            about when she moves. */}
        <div className="mt-8">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">When</span>
          <div className="mt-3 flex gap-2">
            {WHEN.map((w) => {
              const on = when === w.id
              return (
                <button
                  key={w.id}
                  type="button"
                  onMouseDown={hold}
                  onClick={() => setWhen(w.id)}
                  aria-pressed={on}
                  className="h-10 flex-1 border text-[10px] uppercase tracking-[0.14em] transition-colors"
                  style={{
                    borderColor: on ? '#F7F4ED' : 'rgba(247,244,237,0.3)',
                    background: on ? '#F7F4ED' : 'transparent',
                    color: on ? '#68472C' : 'rgba(247,244,237,0.75)',
                  }}
                >
                  {w.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-8 flex items-end gap-6">
          <label className="w-[40%] block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">How long</span>
            <span className="mt-2 flex items-baseline gap-2 border-b border-cream/30 pb-2">
              <input
                value={length}
                onChange={(e) => setLength(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="50"
                autoComplete="off"
                data-no-dictation
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
                className="min-w-0 w-full bg-transparent font-serif text-[26px] leading-none text-cream outline-none placeholder:text-cream/30"
              />
              <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-cream/60">min</span>
            </span>
          </label>
          <label className="min-w-0 flex-1 block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">However it is counted</span>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="3.1 mi · 4 × 8"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-no-dictation
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
              className="mt-2 w-full border-b border-cream/30 bg-transparent pb-2 text-[17px] lowercase text-cream outline-none placeholder:text-cream/30"
            />
          </label>
        </div>

        <div className="mt-8">
          <RepeatField value={repeat} startKey={startKey} onChange={setRepeat} />
        </div>

        <label className="mt-8 block">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cream/60">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Anything worth remembering about it."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-no-dictation
            className="mos-scroll mt-3 block min-h-[150px] w-full resize-y border-b border-cream/30 bg-transparent pb-3 text-[16px] lowercase leading-relaxed text-cream outline-none placeholder:text-cream/35"
          />
        </label>

        <div className="mt-9 flex items-center justify-between gap-6">
          {onDrop ? (
            <button onMouseDown={hold} onClick={onDrop} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70" style={{ color: OXBLOOD }}>Delete</button>
          ) : <span />}
          <div className="flex items-center gap-7">
            <button onMouseDown={hold} onClick={onClose} className="text-[10px] uppercase tracking-[0.22em] text-cream/60 transition-opacity hover:opacity-70">Cancel</button>
            <button onMouseDown={hold} onClick={save} className="text-[10px] uppercase tracking-[0.22em] text-cream transition-opacity hover:opacity-70">{item ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
