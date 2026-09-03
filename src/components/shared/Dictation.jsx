import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MicIcon } from './marks'
import { createListener, speechSupported, tidy } from '../../lib/speech'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// ── Dictation, everywhere.
//
// Mounted once. Rather than threading a microphone through two hundred inputs —
// and every input written after today — this watches the page for text fields
// and stands a mic beside each one. One implementation, the whole house,
// including pages that don't exist yet.
//
// The mic used to appear only once a field had focus, which meant nobody knew
// it was there. It is beside every field now, all the time.

const TEXTY = new Set(['text', 'search', 'url', 'tel', 'email', ''])

function dictatable(el) {
  if (!el || el.readOnly || el.disabled) return false
  if (el.dataset && el.dataset.noDictation !== undefined) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName !== 'INPUT') return false
  return TEXTY.has((el.type || 'text').toLowerCase())
}

// What the field is sitting on. The Brain Dump writes into a near-black panel
// and most other fields are on cream, so the mic has to read on both.
function onDarkGround(el) {
  let node = el
  for (let i = 0; node && i < 8; i += 1) {
    const bg = getComputedStyle(node).backgroundColor
    const m = bg && bg.match(/rgba?\(([^)]+)\)/)
    if (m) {
      const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n))
      if (a === undefined || a > 0.5) return (0.299 * r + 0.587 * g + 0.114 * b) < 128
    }
    node = node.parentElement
  }
  return false
}

// React installs its own value setter on the node, so assigning `el.value`
// changes the pixels and nothing else. Going through the prototype setter and
// dispatching a real input event is what makes React — and therefore the store —
// actually see the words.
function writeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')
  if (setter && setter.set) setter.set.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// Every text field on the page that is actually visible.
function visibleFields() {
  const out = []
  document.querySelectorAll('input, textarea').forEach((el) => {
    if (!dictatable(el)) return
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    if (r.bottom < -40 || r.top > window.innerHeight + 40) return
    out.push(el)
  })
  return out
}

// Where a mic stands for a given field. A one-line field takes it at its right
// edge, outside the text if there is room. A tall box takes it in the bottom
// corner, clear of the resize grip.
function placeFor(el) {
  const r = el.getBoundingClientRect()
  const tall = r.height > 64
  // Outside the field if there is room — and the room is actually empty. In a
  // row of short fields the space to the right is the next field, and a mic
  // standing on a neighbour's first letter is worse than one tucked inside.
  let outside = !tall && r.right + 30 < window.innerWidth
  if (outside) {
    const hit = document.elementFromPoint(r.right + 19, r.top + r.height / 2)
    if (hit && hit !== el && hit.closest('input, textarea, button, select, a, label, [data-mic-button]')) outside = false
  }
  const x = outside ? r.right + 8 : r.right - 30
  const y = tall ? Math.min(r.bottom - 24, window.innerHeight - 24) : r.top + r.height / 2
  return {
    x,
    y,
    pillY: tall ? y - 30 : Math.min(r.bottom + 18, window.innerHeight - 22),
    pillRight: window.innerWidth - (x + 12),
    dark: onDarkGround(el),
  }
}

export default function Dictation() {
  const [enabledRaw] = useLocalStorage('mos:settings:dictation', true)
  const enabled = enabledRaw !== false
  const supported = useMemo(() => speechSupported(), [])

  // Every field with a mic, and where each mic stands.
  const [spots, setSpots] = useState([]) // [{ el, box }]
  const [active, setActive] = useState(null) // the field being dictated into
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')

  // Where the words go: what sat either side of the caret when she started.
  const anchor = useRef(null)
  const listenerRef = useRef(null)

  const receive = useCallback((said) => {
    const a = anchor.current
    if (!a) return
    const { el, before, after } = a
    // Continuing a sentence she already typed must not capitalise mid-thought.
    const fresh = !before.trim() || /[.!?]\s*$/.test(before) || /\n\s*$/.test(before)
    const words = tidy(said, { fresh })
    const head = before && !/[\s\n]$/.test(before) && words ? `${before} ${words}` : before + words
    writeValue(el, head + after)
    try { el.setSelectionRange(head.length, head.length) } catch { /* type has no caret */ }
  }, [])

  // One listener for the life of the app.
  useEffect(() => {
    if (!supported || !enabled) return undefined
    listenerRef.current = createListener({
      onText: receive,
      onState: (on) => { setListening(on); if (on) setError('') },
      onError: (msg) => { setError(msg); setListening(false) },
    })
    return () => { if (listenerRef.current) listenerRef.current.stop() }
  }, [supported, enabled, receive])

  const stop = useCallback(() => { if (listenerRef.current) listenerRef.current.stop() }, [])

  const start = useCallback((el) => {
    if (!el || !listenerRef.current) return
    if (document.activeElement !== el) { try { el.focus({ preventScroll: true }) } catch { /* fine */ } }
    const s = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length
    const e = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length
    anchor.current = { el, before: el.value.slice(0, s), after: el.value.slice(e) }
    setActive(el)
    setError('')
    listenerRef.current.start()
  }, [])

  // ── Keeping a mic beside every field as the page changes ─────────
  useEffect(() => {
    if (!supported || !enabled) return undefined
    let raf = 0
    const place = () => {
      raf = 0
      const els = visibleFields()
      setSpots(els.map((el) => ({ el, box: placeFor(el) })))
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place) }
    place()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'disabled', 'readonly'] })
    // Fields that grow as she types (a textarea being resized) move their mic.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    if (ro) ro.observe(document.body)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      mo.disconnect()
      if (ro) ro.disconnect()
    }
  }, [supported, enabled])

  // A field that leaves the page ends its dictation — the words should never
  // outlive the place they were going.
  useEffect(() => {
    if (!active) return
    if (!spots.some((s) => s.el === active)) { stop(); setActive(null) }
  }, [spots, active, stop])
  useEffect(() => { if (!listening) setActive(null) }, [listening])

  // ── Keys: hold nothing, remember one ──────────────────────────────
  useEffect(() => {
    if (!supported || !enabled) return undefined
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        const el = document.activeElement
        if (!dictatable(el)) return
        e.preventDefault()
        if (listening && active === el) stop()
        else start(el)
        return
      }
      if (!listening) return
      // Escape keeps the words and closes the mic; Enter commits the line, so
      // the mic must not carry on into whatever comes next.
      if (e.key === 'Escape' || e.key === 'Enter') stop()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [supported, enabled, active, listening, start, stop])

  if (!supported || !enabled || !spots.length) return null

  const activeSpot = active ? spots.find((s) => s.el === active) : null

  return createPortal(
    <>
      {spots.map(({ el, box }, i) => {
        const live = listening && el === active
        return (
          <button
            key={i}
            data-mic-button=""
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (live ? stop() : start(el))}
            aria-label={live ? 'Stop dictating' : 'Dictate into this field'}
            aria-pressed={live}
            title={live ? 'Listening — click to stop' : 'Dictate (⌘⇧D)'}
            className="fixed z-[60] flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full transition-colors"
            style={{
              top: box.y,
              left: box.x,
              backgroundColor: live ? (box.dark ? '#FAF6ED' : '#16130F') : 'transparent',
              // Readable at rest, on either ground — a mic she cannot see is
              // a mic she does not have.
              color: live ? (box.dark ? '#16130F' : '#FAF6ED') : (box.dark ? '#CEC3AF' : '#75684F'),
            }}
          >
            {live && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ border: `1px solid ${box.dark ? '#FAF6ED' : '#16130F'}`, animation: 'mos-listen 1.6s ease-out infinite' }}
              />
            )}
            <MicIcon size={16} live={live} />
          </button>
        )
      })}

      {activeSpot && (listening || error) && (
        <div
          className="fixed z-[60] flex -translate-y-1/2 items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            top: activeSpot.box.pillY,
            right: Math.max(12, activeSpot.box.pillRight),
            backgroundColor: activeSpot.box.dark ? '#FAF6ED' : '#16130F',
            color: activeSpot.box.dark ? '#16130F' : '#FAF6ED',
          }}
        >
          {!error && (
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#A0654C', animation: 'mos-listen-dot 1.4s ease-in-out infinite' }} />
          )}
          <span className="whitespace-nowrap text-[10px] tracking-[0.16em]">
            {error ? error.toUpperCase() : 'RECORDING · ESC TO STOP'}
          </span>
        </div>
      )}
    </>,
    document.body,
  )
}
