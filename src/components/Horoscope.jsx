import React, { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { computeTransits } from '../lib/astrology/transits'

const GOLD = '#C4A882'

const BIG_THREE = {
  sun: 'Libra 24° (Mercury also in Libra, conjunct the Sun)',
  moon: 'Taurus 11°',
  rising: 'Libra 25° — a double Libra',
  ruler: 'Venus in Sagittarius rules the entire chart, twice over',
  fire: 'Venus & Mars in Sagittarius — honest, direct, unbothered',
  midheaven: 'Cancer — builds nurturing, home-like things in the world',
}

// Each planet / chart point as its "I" statement + the body name beneath it.
const MEANING = {
  Sun: 'I am', Moon: 'I feel', Mercury: 'I think', Venus: 'I love', Mars: 'I act',
  Jupiter: 'I expand', Saturn: 'I achieve', Uranus: 'I awaken', Neptune: 'I dream',
  Pluto: 'I transform', Ascendant: 'I appear', Midheaven: 'I aspire', NorthNode: 'I grow',
}
const meaningOf = (p) => MEANING[p] || p
const bodyLabel = (p) => (p === 'NorthNode' ? 'North Node' : p)
// "I THINK" → "Mercury", for the tiny body line under each node.
const BODY_OF_STATEMENT = {}
Object.entries(MEANING).forEach(([body, m]) => {
  BODY_OF_STATEMENT[m.toUpperCase()] = body
})
const bodyOfStatement = (s) => bodyLabel(BODY_OF_STATEMENT[s] || '')

// Short domain noun per body, for the deterministic fallback sentences.
const DOMAIN = {
  Sun: 'identity', Moon: 'emotions', Mercury: 'thoughts', Venus: 'affection', Mars: 'drive',
  Jupiter: 'growth', Saturn: 'discipline', Uranus: 'independence', Neptune: 'imagination',
  Pluto: 'control', Ascendant: 'image', Midheaven: 'ambition', NorthNode: 'direction',
}
const qualityOf = (asp) =>
  asp === 'square' || asp === 'opposition' || asp === 'quincunx'
    ? 'friction'
    : asp === 'trine' || asp === 'sextile'
      ? 'flow'
      : 'focus'
const REL = { friction: 'are at odds', flow: 'are in sync', focus: 'come together' }
const TAIL = {
  friction: "Don't force it — say what you mean, plainly.",
  flow: "Lean into it; it's working for you.",
  focus: 'Keep it simple and direct.',
}
const THEME = { friction: 'say it plainly', flow: 'go after it', focus: 'keep it simple' }

// Build the JSON the wheel renders from, deterministically from the real aspects.
// Used while the API call is in flight and whenever it is unavailable.
function fallbackData(top) {
  return {
    theme: top.length ? THEME[qualityOf(top[0].aspect)] : '',
    aspects: top.map((a) => {
      const q = qualityOf(a.aspect)
      return {
        from: meaningOf(a.transit).toUpperCase(),
        to: meaningOf(a.natal).toUpperCase(),
        type: a.aspect,
        meaning: `Your ${DOMAIN[a.transit] || meaningOf(a.transit)} and ${DOMAIN[a.natal] || meaningOf(a.natal)} ${REL[q]} today. ${TAIL[q]}`,
      }
    }),
  }
}

export default function Horoscope() {
  const today = useMemo(() => new Date(), [])
  const key = dateKey(today)
  const { aspects } = useMemo(() => computeTransits(today), [today])
  const top = useMemo(() => aspects.slice(0, 4), [aspects])

  const [cached, setCached] = useLocalStorage('mos:horoscope', null)
  const [data, setData] = useState(() => fallbackData(top))

  useEffect(() => {
    // Same-day cache (only API successes are cached) — render it and stop.
    if (cached && cached.date === key && Array.isArray(cached.aspects) && cached.aspects.length) {
      setData({ theme: cached.theme, aspects: cached.aspects })
      return
    }
    setData(fallbackData(top))
    if (!top.length) return

    let alive = true
    const payload = top.map((a) => ({
      from: meaningOf(a.transit).toUpperCase(),
      to: meaningOf(a.natal).toUpperCase(),
      type: a.aspect,
      quality: qualityOf(a.aspect),
      orb: a.orb,
    }))
    ;(async () => {
      try {
        const res = await fetch('/api/horoscope', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: key, aspects: payload, natal: BIG_THREE }),
        })
        if (!res.ok) return
        const json = await res.json()
        if (json && json.theme && Array.isArray(json.aspects) && json.aspects.length) {
          const clean = json.aspects.filter((a) => a && a.from && a.to && a.type && a.meaning)
          if (clean.length && alive) {
            const next = { theme: json.theme, aspects: clean }
            setData(next)
            setCached({ date: key, theme: next.theme, aspects: next.aspects, source: 'claude' })
          }
        }
      } catch {
        /* offline / no key — the deterministic fallback already rendered */
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, top])

  return (
    <section className="mb-10 border border-stone-200 bg-white/40 px-6 py-5">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={14} className="text-sand" />
        <p className="kicker text-stone-400">Today's Horoscope</p>
      </div>

      {data.aspects.length > 0 ? (
        <div className="flex justify-center">
          <MeaningWheel data={data} />
        </div>
      ) : (
        <p className="py-6 text-center font-serif italic text-lg text-stone-400">
          Quiet sky today — nothing strong hitting your chart.
        </p>
      )}
    </section>
  )
}

// The wheel IS the reading. Renders entirely from { theme, aspects[] }: "I"
// statement nodes on a gold ring, gold chords per aspect, a center theme that
// swaps to a line's own meaning on hover/tap.
function MeaningWheel({ data }) {
  const [active, setActive] = useState(null)
  const cx = 130
  const cy = 130
  const rRing = 78
  const rLabel = 92

  const P = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  // Unique nodes (the "I" statements) in first-appearance order.
  const order = []
  const seen = new Set()
  const add = (s) => {
    if (!seen.has(s)) {
      seen.add(s)
      order.push(s)
    }
  }
  data.aspects.forEach((a) => {
    add(a.from)
    add(a.to)
  })
  const N = order.length || 1
  const angleOf = (s) => (order.indexOf(s) * 360) / N

  return (
    <svg
      viewBox="0 0 260 260"
      width="260"
      height="260"
      className="block h-auto max-w-full"
      role="img"
      aria-label="Today's aspects, as meanings"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
      onClick={() => setActive(null)}
    >
      <circle cx={cx} cy={cy} r={rRing} fill="none" stroke={GOLD} strokeWidth="1" />

      {/* Aspect chords (solid square, dashed quincunx) + hover/tap targets */}
      {data.aspects.map((a, i) => {
        if (a.from === a.to) return null
        const [x1, y1] = P(angleOf(a.from), rRing)
        const [x2, y2] = P(angleOf(a.to), rRing)
        const dashed = a.type === 'quincunx'
        return (
          <g key={`a${i}`}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={GOLD}
              strokeWidth={active === i ? '1.4' : '0.9'}
              opacity={active === null || active === i ? 0.85 : 0.3}
              strokeDasharray={dashed ? '3 3' : undefined}
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth="16"
              pointerEvents="stroke"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={(e) => {
                e.stopPropagation()
                setActive((cur) => (cur === i ? null : i))
              }}
            />
          </g>
        )
      })}

      {/* Center: theme by default; the active line's meaning on hover/tap */}
      <foreignObject x={cx - 74} y={cy - 50} width="148" height="100" pointerEvents="none">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 4px' }}>
          {active != null ? (
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', lineHeight: 1.4, color: '#57534e' }}>
              {data.aspects[active].meaning}
            </span>
          ) : (
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '16px', letterSpacing: '1.5px', textTransform: 'uppercase', color: GOLD }}>
              {data.theme}
            </span>
          )}
        </div>
      </foreignObject>

      {/* Nodes — gold dot, small-caps "I" statement, tiny body name beneath */}
      {order.map((s) => {
        const deg = angleOf(s)
        const [dx, dy] = P(deg, rRing)
        const [lx, ly] = P(deg, rLabel)
        const h = Math.cos(((deg - 90) * Math.PI) / 180)
        const anchor = h > 0.25 ? 'start' : h < -0.25 ? 'end' : 'middle'
        return (
          <g key={s} pointerEvents="none">
            <circle cx={dx} cy={dy} r="2.6" fill={GOLD} />
            <text x={lx} y={ly} fill={GOLD} fontSize="7" letterSpacing="1" textAnchor={anchor} dominantBaseline="middle">
              {s.toUpperCase()}
            </text>
            <text x={lx} y={ly + 8} fill={GOLD} fontSize="5.5" letterSpacing="0.5" textAnchor={anchor} dominantBaseline="middle" opacity="0.7">
              {bodyOfStatement(s.toUpperCase())}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
