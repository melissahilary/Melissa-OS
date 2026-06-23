import React, { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { computeTransits } from '../lib/astrology/transits'

const GOLD = '#C4A882'

// Each planet / chart point as its plain-language "I" statement + the body name.
const MEANING = {
  Sun: 'I am', Moon: 'I feel', Mercury: 'I think', Venus: 'I love', Mars: 'I act',
  Jupiter: 'I expand', Saturn: 'I achieve', Uranus: 'I awaken', Neptune: 'I dream',
  Pluto: 'I transform', Ascendant: 'I appear', Midheaven: 'I aspire', NorthNode: 'I grow',
}
const meaningOf = (p) => MEANING[p] || p
const bodyLabel = (p) => (p === 'NorthNode' ? 'North Node' : p === 'Midheaven' ? 'Midheaven' : p)

// Short domain noun for each body, used to phrase the per-aspect meaning.
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
// The single through-line of the day, by the loudest aspect's quality.
const THEME = { friction: 'say it plainly.', flow: 'go after it.', focus: 'keep it simple.' }

const sentenceFor = (a) => {
  const q = qualityOf(a.aspect)
  return `Your ${DOMAIN[a.transit] || meaningOf(a.transit)} and ${DOMAIN[a.natal] || meaningOf(a.natal)} ${REL[q]} today. ${TAIL[q]}`
}

export default function Horoscope() {
  const today = useMemo(() => new Date(), [])
  const { aspects } = useMemo(() => computeTransits(today), [today])
  const top = aspects.slice(0, 4)
  const theme = top.length ? THEME[qualityOf(top[0].aspect)] : ''

  return (
    <section className="mb-10 border border-stone-200 bg-white/40 px-6 py-5">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={14} className="text-sand" />
        <p className="kicker text-stone-400">Today's Horoscope</p>
      </div>

      {top.length > 0 ? (
        <div className="flex justify-center">
          <MeaningWheel aspects={top} theme={theme} />
        </div>
      ) : (
        <p className="py-6 text-center font-serif italic text-lg text-stone-400">
          Quiet sky today — nothing strong hitting your chart.
        </p>
      )}
    </section>
  )
}

// The wheel IS the reading: "I" statement nodes on a gold ring, gold chords for
// today's aspects, a center theme that swaps to a line's meaning on hover/tap.
function MeaningWheel({ aspects, theme }) {
  const [active, setActive] = useState(null)
  const cx = 130
  const cy = 130
  const rRing = 78
  const rLabel = 92

  const P = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  // Unique nodes (meaning + body) in first-appearance order.
  const order = []
  const byMeaning = {}
  const addNode = (body) => {
    const m = meaningOf(body)
    if (!(m in byMeaning)) {
      byMeaning[m] = { meaning: m, body }
      order.push(byMeaning[m])
    }
  }
  aspects.forEach((a) => {
    addNode(a.transit)
    addNode(a.natal)
  })
  const N = order.length || 1
  const angleOfMeaning = (m) => (order.findIndex((o) => o.meaning === m) * 360) / N

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
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={rRing} fill="none" stroke={GOLD} strokeWidth="1" />

      {/* Aspect chords (solid = square, dashed = quincunx) + hover/tap targets */}
      {aspects.map((a, i) => {
        const m1 = meaningOf(a.transit)
        const m2 = meaningOf(a.natal)
        if (m1 === m2) return null
        const [x1, y1] = P(angleOfMeaning(m1), rRing)
        const [x2, y2] = P(angleOfMeaning(m2), rRing)
        const dashed = a.aspect === 'quincunx'
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

      {/* Center: theme by default, the hovered/tapped line's meaning when active */}
      <foreignObject x={cx - 74} y={cy - 50} width="148" height="100" pointerEvents="none">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 4px' }}>
          {active != null ? (
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '9px', lineHeight: 1.4, color: '#57534e' }}>
              {sentenceFor(aspects[active])}
            </span>
          ) : (
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '16px', letterSpacing: '1.5px', textTransform: 'uppercase', color: GOLD }}>
              {theme}
            </span>
          )}
        </div>
      </foreignObject>

      {/* Nodes — gold dot, small-caps "I" statement, tiny body name beneath */}
      {order.map(({ meaning, body }) => {
        const deg = angleOfMeaning(meaning)
        const [dx, dy] = P(deg, rRing)
        const [lx, ly] = P(deg, rLabel)
        const h = Math.cos(((deg - 90) * Math.PI) / 180)
        const anchor = h > 0.25 ? 'start' : h < -0.25 ? 'end' : 'middle'
        return (
          <g key={meaning} pointerEvents="none">
            <circle cx={dx} cy={dy} r="2.6" fill={GOLD} />
            <text x={lx} y={ly} fill={GOLD} fontSize="7" letterSpacing="1" textAnchor={anchor} dominantBaseline="middle">
              {meaning.toUpperCase()}
            </text>
            <text x={lx} y={ly + 8} fill={GOLD} fontSize="5.5" letterSpacing="0.5" textAnchor={anchor} dominantBaseline="middle" opacity="0.7">
              {bodyLabel(body)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
