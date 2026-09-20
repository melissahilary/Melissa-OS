import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MicIcon } from './marks'
import { createListener, speechSupported, tidy } from '../../lib/speech'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// ── Dictation, everywhere.
//
// Mounted once. Rather than threading a microphone through two hundred inputs —
// and every input written after today — this watches which field she is in and
// offers the mic there. One implementation, the whole house, including pages
// that don't exist yet.
//
// It briefly stood a mic beside every field on the page at once. That was
// wrong in three ways at the same time: the mood board's cards each carry a
// caption field on their hidden back, so a mic appeared over every photograph;
// a page of fields became a scattering of little icons on top of other icons;
// and re-measuring them all on every mutation made them twitch. One mic, on the
// field she is actually in, is the whole of what dictation needs.

const TEXTY = new Set(['text', 'search', 'url', 'tel', 'email', ''])

function dictatable(el) {
  if (!el || el.readOnly || el.disabled) return false
  if (el.dataset && el.dataset.noDictation !== undefined) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName !== 'INPUT') return false
  return TEXTY.has((el.type || 'text').toLowerCase())
}

// What the field is sitting on. The Brain Dump writes into a near-black panel
// and most other fields are on cream, so the mic has to read on both — a fixed
// grey disappears against one or the other.
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

export default function Dictation() {
  const [enabledRaw] = useLocalStorage('mos:settings:dictation', true)
  const enabled = enabledRaw !== false
  const supported = useMemo(() => speechSupported(), [])

  const [field, setField] = useState(null)
  const [box, setBox] = useState(null)
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
    const s = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length
    const e = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length
    anchor.current = { el, before: el.value.slice(0, s), after: el.value.slice(e) }
    listenerRef.current.start()
  }, [])

  // ── Which field is she standing in ────────────────────────────────
  useEffect(() => {
    if (!supported || !enabled) return undefined
    const onIn = (e) => setField(dictatable(e.target) ? e.target : null)
    const onOut = (e) => {
      // Focus moving to the mic itself is prevented at mousedown, so a real
      // focusout means she has left the field.
      if (e.relatedTarget && e.relatedTarget.dataset && e.relatedTarget.dataset.micButton !== undefined) return
      setField(null)
    }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [supported, enabled])

  // Leaving the field ends the session — dictation should never outlive the
  // place it was speaking into.
  useEffect(() => { stop(); setError('') }, [field, stop])

  // ── Keeping the mic on the field as the page moves ────────────────
  useEffect(() => {
    if (!field) { setBox(null); return undefined }
    let raf = 0
    const place = () => {
      raf = 0
      const r = field.getBoundingClientRect()
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) { setBox(null); return }
      // A one-line field takes the mic at its right edge, outside the text if
      // there is room and nothing else is standing there. A tall box takes it
      // in the bottom corner, clear of the resize grip, with the listening note
      // stacked above rather than running into it.
      const tall = r.height > 64
      let outside = !tall && r.right + 30 < window.innerWidth
      if (outside) {
        const hit = document.elementFromPoint(r.right + 19, r.top + r.height / 2)
        if (hit && hit !== field && hit.closest('input, textarea, button, select, a, label')) outside = false
      }
      const x = outside ? r.right + 8 : r.right - 30
      const y = tall ? Math.min(r.bottom - 24, window.innerHeight - 24) : r.top + r.height / 2
      setBox({
        x,
        y,
        pillY: tall ? y - 30 : Math.min(r.bottom + 18, window.innerHeight - 22),
        pillRight: window.innerWidth - (x + 12),
        dark: onDarkGround(field),
      })
    }
    // Coalesced into a frame: a field inside a panel that is still sliding in
    // would otherwise be measured a dozen times on the way.
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place) }
    place()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    if (ro) ro.observe(field)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      if (ro) ro.disconnect()
    }
  }, [field])

  // ── Keys: hold nothing, remember one ──────────────────────────────
  useEffect(() => {
    if (!supported || !enabled) return undefined
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        if (!field) return
        e.preventDefault()
        if (listening) stop()
        else start(field)
        return
      }
      if (!listening) return
      // Escape keeps the words and closes the mic; Enter commits the line, so
      // the mic must not carry on into whatever comes next.
      if (e.key === 'Escape' || e.key === 'Enter') stop()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [supported, enabled, field, listening, start, stop])

  if (!supported || !enabled || !box) return null

  return createPortal(
    <>
      <button
        data-mic-button=""
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (listening ? stop() : start(field))}
        aria-label={listening ? 'Stop dictating' : 'Dictate'}
        aria-pressed={listening}
        title={listening ? 'Listening — click to stop' : 'Dictate (⌘⇧D)'}
        className="fixed z-[70] flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full transition-colors"
        style={{
          top: box.y,
          left: box.x,
          backgroundColor: listening ? (box.dark ? 'var(--mos-cream, #F7F4ED)' : 'rgb(var(--mos-s900, 22 19 15))') : 'transparent',
          color: listening ? (box.dark ? 'rgb(var(--mos-s900, 22 19 15))' : 'var(--mos-cream, #F7F4ED)') : (box.dark ? 'var(--mos-r400, #CEC3AF)' : 'var(--mos-t500, #5F5442)'),
        }}
      >
        {listening && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${box.dark ? 'var(--mos-cream, #F7F4ED)' : 'rgb(var(--mos-s900, 22 19 15))'}`, animation: 'mos-listen 1.6s ease-out infinite' }}
          />
        )}
        <MicIcon size={16} live={listening} />
      </button>

      {(listening || error) && (
        <div
          className="fixed z-[70] flex -translate-y-1/2 items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            top: box.pillY,
            right: Math.max(12, box.pillRight),
            backgroundColor: box.dark ? 'var(--mos-cream, #F7F4ED)' : 'rgb(var(--mos-s900, 22 19 15))',
            color: box.dark ? 'rgb(var(--mos-s900, 22 19 15))' : 'var(--mos-cream, #F7F4ED)',
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
