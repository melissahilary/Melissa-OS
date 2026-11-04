import React, { useRef, useState } from 'react'
import SwipeAway, { OXBLOOD } from './SwipeAway'

// ── The house's own page furniture.
//
// The pillars were built on a set of shared parts that predate the brand page
// — cards with a corner radius, a × in the corner to delete, a pill for every
// tab. The radius is forced off in the stylesheet, so what actually reached
// her was the rest: a cross where the house slides a row aside, and a card
// where the house rules a line.
//
// These are the parts the day is built from, pulled out so a pillar can be
// written in the same hand: a name set large, rows ruled between, one + at the
// foot, and a walnut sheet to write in. No radius, no shadow, no cross.

export const WALNUT = '#68472C'
export const TAN = '#C0966F'
export const GROUND = '#F8F4EC'

// ── A pillar's page.
export function Page({ kicker, title, intro, children }) {
  return (
    <section className="mx-auto max-w-3xl">
      {kicker && <p className="kicker text-stone-500">{kicker}</p>}
      <h2 className="mt-4 font-serif text-[42px] leading-[0.98] text-stone-900 sm:text-[54px]">{title}</h2>
      {intro && <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-stone-500">{intro}</p>}
      <div className="mt-12">{children}</div>
    </section>
  )
}

// ── A heading inside a page, for a page that holds two kinds of thing.
export function Band({ children, count }) {
  return (
    <div className="mb-5 mt-14 flex items-baseline justify-between gap-6 first:mt-0">
      <span className="kicker text-stone-500">{children}</span>
      {count != null && <span className="text-[10px] uppercase tracking-[0.16em] text-stone-400">{count}</span>}
    </div>
  )
}

// ── A row. Slid aside to be rid of it, pressed to open it.
export function Row({ onOpen, onAway, first, children, aside }) {
  return (
    <SwipeAway ground={GROUND} onAway={onAway}>
      <div className={`flex items-start gap-6 py-6 ${first ? '' : 'border-t border-stone-200'}`}>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70">
          {children}
        </button>
        {aside}
      </div>
    </SwipeAway>
  )
}

// The name of a thing, and the small caps under it that say what it is.
export function Name({ children, struck }) {
  return (
    <span className={`block font-serif text-[26px] leading-tight sm:text-[30px] ${struck ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
      {children || 'Untitled'}
    </span>
  )
}
export function Meta({ children }) {
  if (!children) return null
  return <span className="mt-1.5 block text-[10px] uppercase tracking-[0.16em] text-stone-500">{children}</span>
}

// A word at the right-hand end of a row — the one thing it can be told.
export function Mark({ on, onClick, children, label }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className="mt-[9px] shrink-0 text-[10px] uppercase tracking-[0.18em] transition-opacity hover:opacity-60"
      style={{ color: on ? '#A8A29E' : TAN }}
    >
      {children}
    </button>
  )
}

// ── The one + at the foot of a list.
export function Plus({ onClick, label }) {
  return (
    <div className="pt-6">
      <button
        onClick={onClick}
        aria-label={label}
        className="mx-auto block px-6 py-2 text-[30px] leading-none text-stone-900 transition-opacity hover:opacity-60"
      >
        +
      </button>
    </div>
  )
}

// ── The way in, for someone who has never used the page.
//
// A blank page and a + is a test she did not ask to sit. These are the
// answers most people give, one press each, filled in with the sensible
// defaults — and the + is still there for anything else. It is the catalogue's
// trick, which is the one thing in the app nobody has to be taught.
export function Starters({ label = 'Start with', options = [], has = () => false, onPick }) {
  const left = options.filter((o) => !has(o))
  if (!left.length) return null
  return (
    <div className="mt-10 border-t border-stone-200 pt-7">
      <p className="kicker text-stone-400">{label}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {left.map((o) => (
          <button
            key={typeof o === 'string' ? o : o.name}
            type="button"
            onClick={() => onPick(o)}
            className="border border-stone-300 px-3.5 py-2 text-[13px] lowercase text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-900"
          >
            {typeof o === 'string' ? o : o.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Empty({ children }) {
  return <p className="py-6 text-[15px] italic text-stone-400">{children}</p>
}

// ── The sheet. Walnut, as every sheet in the house is.
export function Sheet({ kicker, onClose, onDrop, onSave, saveLabel = 'Save', children }) {
  const hold = (e) => e.preventDefault()
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ background: 'rgba(22,19,15,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="mos-scroll max-h-[calc(88vh_-_var(--mos-kb))] w-full max-w-md overflow-y-auto px-7 pb-9 pt-8 sm:px-9"
        style={{ background: WALNUT, color: '#F7F4ED' }}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        {kicker && <p className="text-[10px] uppercase tracking-[0.22em] text-cream/60">{kicker}</p>}
        {children}
        <div className="mt-9 flex items-center justify-between gap-6">
          {onDrop ? (
            <button onMouseDown={hold} onClick={onDrop} className="text-[10px] uppercase tracking-[0.22em] transition-opacity hover:opacity-70" style={{ color: OXBLOOD }}>Delete</button>
          ) : <span />}
          <div className="flex items-center gap-7">
            <button onMouseDown={hold} onClick={onClose} className="text-[10px] uppercase tracking-[0.22em] text-cream/60 transition-opacity hover:opacity-70">Cancel</button>
            <button onMouseDown={hold} onClick={onSave} className="text-[10px] uppercase tracking-[0.22em] text-cream transition-opacity hover:opacity-70">{saveLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── What a sheet is made of.
const LABEL = 'text-[10px] uppercase tracking-[0.18em] text-cream/60'
const UNDER = 'w-full border-b border-cream/30 bg-transparent pb-2 outline-none placeholder:text-cream/30'

export const Big = React.forwardRef(function Big({ value, onChange, placeholder, onEnter }, ref) {
  return (
    <input
      autoFocus
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-no-dictation
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
      className={`mt-4 font-serif text-[30px] lowercase text-cream ${UNDER}`}
    />
  )
})

export function Field({ label, value, onChange, placeholder, type, width = '', onEnter }) {
  return (
    <label className={`block ${width}`}>
      <span className={LABEL}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-no-dictation
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
        className={`mt-2 text-[17px] lowercase text-cream ${UNDER}`}
        style={type === 'date' || type === 'time' ? { colorScheme: 'dark' } : undefined}
      />
    </label>
  )
}

export function Notes({ value, onChange, label = 'Notes', placeholder = 'Anything worth remembering about it.' }) {
  return (
    <label className="mt-8 block">
      <span className={LABEL}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={placeholder}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} data-no-dictation
        className="mos-scroll mt-3 block min-h-[150px] w-full resize-y border-b border-cream/30 bg-transparent pb-3 text-[16px] lowercase leading-relaxed text-cream outline-none placeholder:text-cream/35"
      />
    </label>
  )
}

// A short set of answers, chosen rather than typed.
export function Chips({ label, options, value, onChange }) {
  return (
    <div className="mt-8">
      <span className={LABEL}>{label}</span>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.id
          return (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(o.id)}
              aria-pressed={on}
              className="border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors"
              style={{
                borderColor: on ? '#F7F4ED' : 'rgba(247,244,237,0.3)',
                background: on ? '#F7F4ED' : 'transparent',
                color: on ? WALNUT : 'rgba(247,244,237,0.75)',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// A name that must be written before the thing can be kept.
export function useRequiredName(initial = '') {
  const [name, setName] = useState(initial)
  const field = useRef(null)
  const ready = () => {
    const t = name.trim().toLowerCase()
    if (!t) { if (field.current) field.current.focus(); return null }
    return t
  }
  return { name, setName, field, ready }
}

// A photograph off a phone is four megabytes. It is shrunk and written down
// at middling quality before it is kept, because this is a planner and not a
// darkroom — and because everything here lives in one row of a database.
export const shrink = (file) => new Promise((done, fail) => {
  const reader = new FileReader()
  reader.onerror = fail
  reader.onload = () => {
    const img = new Image()
    img.onerror = fail
    img.onload = () => {
      const max = 900
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      done(c.toDataURL('image/jpeg', 0.68))
    }
    img.src = reader.result
  }
  reader.readAsDataURL(file)
})

export const uid = () => Math.random().toString(36).slice(2, 10)
export const arr = (v) => (Array.isArray(v) ? v : [])
