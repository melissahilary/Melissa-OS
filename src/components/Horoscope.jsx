import React, { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { computeTransits } from '../lib/astrology/transits'
import { NATAL_LONGITUDES } from '../lib/astrology/natal'
import { templateNarrative, aspectSummary } from '../lib/astrology/narrative'

const BIG_THREE = {
  sun: 'Libra 24° (Mercury also in Libra, conjunct the Sun)',
  moon: 'Taurus 11°',
  rising: 'Libra 25° — a double Libra',
  ruler: 'Venus in Sagittarius rules the entire chart, twice over',
  fire: 'Venus & Mars in Sagittarius — honest, direct, unbothered',
  midheaven: 'Cancer — builds nurturing, home-like things in the world',
}

const GOLD = '#C4A882'

// Each planet / chart point as its plain-language "I" statement.
const MEANING = {
  Sun: 'I am', Moon: 'I feel', Mercury: 'I think', Venus: 'I love', Mars: 'I act',
  Jupiter: 'I expand', Saturn: 'I achieve', Uranus: 'I awaken', Neptune: 'I dream',
  Pluto: 'I transform', Ascendant: 'I appear', Midheaven: 'I aspire', NorthNode: 'I grow',
}
const meaningOf = (p) => MEANING[p] || p
const ASPECT_SYMBOL = {
  conjunction: '☌', sextile: '⚹', square: '×', trine: '△', opposition: '☍', quincunx: '↗',
}

export default function Horoscope() {
  const today = useMemo(() => new Date(), [])
  const key = dateKey(today)

  const { aspects } = useMemo(() => computeTransits(today), [today])
  const [cached, setCached] = useLocalStorage('mos:horoscope', null)
  const [text, setText] = useState(null)

  useEffect(() => {
    let alive = true
    if (cached && cached.date === key && cached.text) {
      setText(cached.text)
      return
    }
    setText(null)
    const summary = aspectSummary(aspects)
    ;(async () => {
      let out = null
      let source = 'written'
      try {
        const res = await fetch('/api/horoscope', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: key, aspects: summary, natal: BIG_THREE }),
        })
        if (res.ok) {
          const json = await res.json()
          if (json && json.text) {
            out = json.text
            source = 'claude'
          }
        }
      } catch {
        /* offline or endpoint missing — fall back below */
      }
      if (!out) out = templateNarrative(aspects, today)
      if (!alive) return
      setText(out)
      setCached({ date: key, text: out, source, aspects: summary })
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cached])

  const top = aspects.slice(0, 4)

  return (
    <section className="mb-10 border border-stone-200 bg-white/40 px-6 py-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={14} className="text-sand" />
        <p className="kicker text-stone-400">Today's Horoscope</p>
      </div>

      {text ? (
        <p className="font-serif text-lg md:text-xl leading-relaxed text-stone-800">{text}</p>
      ) : (
        <p className="font-serif italic text-lg text-stone-400">Reading the sky…</p>
      )}

      {top.length > 0 && (
        <div className="mt-6 flex flex-col items-center">
          <MeaningWheel aspects={top} />
          <p className="mt-4 text-center text-[11px] uppercase tracking-[0.18em] text-stone-500">
            {top
              .map((a) => `${meaningOf(a.transit).toUpperCase()} ${ASPECT_SYMBOL[a.aspect] || '·'} ${meaningOf(a.natal).toUpperCase()}`)
              .join(' · ')}
          </p>
        </div>
      )}
    </section>
  )
}

// A meaning-first wheel: active "I" statements as nodes on a gold ring, with
// gold chords for today's aspects (solid = square, dashed = quincunx). Open center.
function MeaningWheel({ aspects }) {
  const cx = 130
  const cy = 130
  const rRing = 82
  const rLabel = 92

  // Angle measured clockwise from the top.
  const P = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  // Unique "I" statements involved today, in first-appearance order.
  const order = []
  const seen = new Set()
  const add = (m) => {
    if (!seen.has(m)) {
      seen.add(m)
      order.push(m)
    }
  }
  aspects.forEach((a) => {
    add(meaningOf(a.transit))
    add(meaningOf(a.natal))
  })
  const N = order.length || 1
  const angleOf = (m) => (order.indexOf(m) * 360) / N

  return (
    <svg viewBox="0 0 260 260" width="260" height="260" className="block h-auto max-w-full" role="img" aria-label="Today's aspects, as meanings" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={rRing} fill="none" stroke={GOLD} strokeWidth="1" />

      {/* Aspect chords across the open center */}
      {aspects.map((a, i) => {
        const m1 = meaningOf(a.transit)
        const m2 = meaningOf(a.natal)
        if (m1 === m2) return null
        const [x1, y1] = P(angleOf(m1), rRing)
        const [x2, y2] = P(angleOf(m2), rRing)
        const dashed = a.aspect === 'quincunx'
        return (
          <line
            key={`a${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={GOLD}
            strokeWidth="0.9"
            opacity="0.8"
            strokeDasharray={dashed ? '3 3' : undefined}
          />
        )
      })}

      {/* Nodes — gold dot + small-caps label just outside the ring */}
      {order.map((m) => {
        const deg = angleOf(m)
        const [dx, dy] = P(deg, rRing)
        const [lx, ly] = P(deg, rLabel)
        const h = Math.cos(((deg - 90) * Math.PI) / 180) // horizontal component
        const anchor = h > 0.25 ? 'start' : h < -0.25 ? 'end' : 'middle'
        return (
          <g key={m}>
            <circle cx={dx} cy={dy} r="2.6" fill={GOLD} />
            <text x={lx} y={ly} fill={GOLD} fontSize="7" letterSpacing="1" textAnchor={anchor} dominantBaseline="middle">
              {m.toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
