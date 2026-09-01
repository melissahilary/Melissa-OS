import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MicIcon } from './marks'
import { createListener, speechSupported, tidy } from '../../lib/speech'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// ── Dictation, everywhere.
//
// Mounted once. Rather than threading a microphone through two hundred inputs —
// and every input written after today — this watches which field has focus and
// offers the mic there. One implementation, the whole house, including pages
// that don't exist yet.

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
// grey disappears against one or the other, and an ink mic that turns ink again
// while listening disappears exactly when it matters most.
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
    const place = () => {
      const r = field.getBoundingClientRect()
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) { setBox(null); return }
      // A one-line field takes the mic at its right edge, outside the text if
      // there is room. A tall box takes it in the bottom corner, clear of the
      // resize grip, with the listening note stacked above it rather than
      // running into it.
      const tall = r.height > 64
      const outside = !tall && r.right + 30 < window.innerWidth
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
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    if (ro) ro.observe(field)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
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
        className="fixed z-[60] flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full transition-colors"
        style={{
          top: box.y,
          left: box.x,
          backgroundColor: listening ? (box.dark ? '#FAF8F3' : '#1C1C1A') : 'transparent',
          color: listening ? (box.dark ? '#1C1C1A' : '#FAF8F3') : (box.dark ? '#8A837A' : '#C4BFB6'),
        }}
      >
        {listening && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${box.dark ? '#FAF8F3' : '#1C1C1A'}`, animation: 'mos-listen 1.6s ease-out infinite' }}
          />
        )}
        <MicIcon size={16} live={listening} />
      </button>

      {(listening || error) && (
        <div
          className="fixed z-[60] flex -translate-y-1/2 items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            top: box.pillY,
            right: Math.max(12, box.pillRight),
            backgroundColor: box.dark ? '#FAF8F3' : '#1C1C1A',
            color: box.dark ? '#1C1C1A' : '#FAF8F3',
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
