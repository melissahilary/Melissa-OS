import React, { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { computeTransits } from '../lib/astrology/transits'

const INK = '#1C1C1A'
const inkA = (a) => `rgba(28, 28, 26, ${a})`

// Irregular decorative scatter around the wheel's outer edge (fixed, not random).
const SCATTER = [
  { deg: 12, r: 116, mark: '✦', o: 0.5, size: 5 },
  { deg: 41, r: 107, mark: '·', o: 0.45, size: 7 },
  { deg: 73, r: 121, mark: '✦', o: 0.35, size: 4 },
  { deg: 104, r: 110, mark: '·', o: 0.5, size: 7 },
  { deg: 131, r: 119, mark: '✦', o: 0.3, size: 5 },
  { deg: 159, r: 106, mark: '·', o: 0.45, size: 7 },
  { deg: 191, r: 120, mark: '✦', o: 0.4, size: 4 },
  { deg: 218, r: 108, mark: '·', o: 0.35, size: 7 },
  { deg: 247, r: 118, mark: '✦', o: 0.5, size: 5 },
  { deg: 281, r: 112, mark: '·', o: 0.4, size: 7 },
  { deg: 309, r: 121, mark: '✦', o: 0.3, size: 4 },
  { deg: 338, r: 107, mark: '·', o: 0.45, size: 7 },
]

// Melissa's hard-coded big three. Trailing U+FE0E forces text (not emoji) glyphs.
const BIG_THREE_SIGNS = [
  { glyph: '♎︎', sign: 'Libra', role: 'Sun' },
  { glyph: '♉︎', sign: 'Taurus', role: 'Moon' },
  { glyph: '♎︎', sign: 'Libra', role: 'Rising' },
]

// Aspect operator glyphs for the one-line aspect summary.
const ASPECT_OP = { friction: '×', flow: '↗', focus: '·' }

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
const meaningOf = (p) => MEANING[p] || p || ''
const bodyLabel = (p) => (p === 'NorthNode' ? 'North Node' : p || '')
const BODY_OF_STATEMENT = {}
Object.entries(MEANING).forEach(([body, m]) => {
  BODY_OF_STATEMENT[m.toUpperCase()] = body
})
const bodyOfStatement = (s) => bodyLabel(BODY_OF_STATEMENT[(s || '').toUpperCase()] || '')

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
  friction: "Don't force it, just say what you mean plainly.",
  flow: "Lean into it; it's working for you.",
  focus: 'Keep it simple and direct.',
}
const THEME = { friction: 'say it plainly', flow: 'go after it', focus: 'keep it simple' }

// A valid wheel aspect has all four string fields.
const isValidAspect = (a) =>
  a &&
  typeof a.from === 'string' &&
  typeof a.to === 'string' &&
  typeof a.type === 'string' &&
  typeof a.meaning === 'string'

// Coerce any value into a safe { theme, aspects[] } the wheel can render.
function normalizeData(d) {
  const theme = d && typeof d.theme === 'string' ? d.theme : ''
  const aspects = d && Array.isArray(d.aspects) ? d.aspects.filter(isValidAspect) : []
  return { theme, aspects }
}

// Strip em/en dashes from any tooltip sentence (covers API + fallback text).
const cleanMeaning = (m) => (m || '').replace(/\s*[—–]\s*/g, ', ')

// Deterministic JSON built from the real aspects — used while the API call is in
// flight and whenever it is unavailable or malformed.
function fallbackData(top) {
  const list = Array.isArray(top) ? top : []
  return {
    theme: list.length ? THEME[qualityOf(list[0].aspect)] || '' : '',
    aspects: list.map((a) => {
      const q = qualityOf(a.aspect)
      return {
        from: meaningOf(a.transit).toUpperCase(),
        to: meaningOf(a.natal).toUpperCase(),
        type: String(a.aspect || ''),
        meaning: `Your ${DOMAIN[a.transit] || meaningOf(a.transit)} and ${DOMAIN[a.natal] || meaningOf(a.natal)} ${REL[q]} today. ${TAIL[q]}`,
      }
    }),
  }
}

// ── Error boundary — never let a bad reading take down the page ──────
class HoroscopeBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    /* swallow — the empty state below is enough */
  }
  render() {
    if (this.state.failed) return <HoroscopeCard />
    return this.props.children
  }
}

export default function Horoscope() {
  return (
    <HoroscopeBoundary>
      <HoroscopeInner />
    </HoroscopeBoundary>
  )
}

// Editorial reading: a single italic theme, a short prose summary, the aspects
// on one small-caps line, then the big three. All from live data — no wheel.
function HoroscopeCard({ data }) {
  const safe = normalizeData(data)
  const theme = safe.theme ? safe.theme.charAt(0).toUpperCase() + safe.theme.slice(1).replace(/[.\s]+$/, '') + '.' : ''
  const summary =
    data && typeof data.summary === 'string' && data.summary.trim()
      ? cleanMeaning(data.summary.trim())
      : safe.aspects.slice(0, 3).map((a) => cleanMeaning(a.meaning)).join(' ')
  const aspectLine = safe.aspects
    .map((a) => `${a.from} ${ASPECT_OP[qualityOf(a.type)] || '·'} ${a.to}`)
    .join('   ·   ')

  return (
    <section className="mb-10">
      <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900 mb-6">Today's Horoscope</h2>

      {safe.aspects.length > 0 ? (
        <div className="mx-auto max-w-2xl text-center">
          {theme && (
            <p className="font-serif italic text-3xl md:text-4xl leading-tight text-stone-900">{theme}</p>
          )}
          {summary && (
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-stone-600">{summary}</p>
          )}
          {aspectLine && (
            <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-stone-400">{aspectLine}</p>
          )}
          <BigThree />
        </div>
      ) : (
        <p className="py-6 text-center font-serif italic text-lg text-stone-400">
          Quiet sky today — nothing strong hitting your chart.
        </p>
      )}
    </section>
  )
}

function HoroscopeInner() {
  const today = useMemo(() => new Date(), [])
  const key = dateKey(today)

  // Guard the math too — a thrown transit calc must not crash the page.
  const top = useMemo(() => {
    try {
      const { aspects } = computeTransits(today)
      return Array.isArray(aspects) ? aspects.slice(0, 4) : []
    } catch {
      return []
    }
  }, [today])

  const [cached, setCached] = useLocalStorage('mos:horoscope', null)
  const [data, setData] = useState(() => fallbackData(top))

  useEffect(() => {
    // Use the cache only if it's today's AND in the new, valid shape.
    if (
      cached &&
      cached.date === key &&
      typeof cached.theme === 'string' &&
      Array.isArray(cached.aspects) &&
      cached.aspects.length > 0 &&
      cached.aspects.every(isValidAspect)
    ) {
      setData(normalizeData(cached))
      return undefined
    }

    setData(fallbackData(top))
    if (!top.length) return undefined

    let alive = true
    const payload = top.map((a) => ({
      from: meaningOf(a.transit).toUpperCase(),
      to: meaningOf(a.natal).toUpperCase(),
      type: String(a.aspect || ''),
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
        const next = normalizeData(json)
        if (next.aspects.length && next.theme && alive) {
          setData(next)
          setCached({ date: key, theme: next.theme, aspects: next.aspects, source: 'claude' })
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

  return <HoroscopeCard data={data} />
}

// Melissa's big three — glyph + sign on one line, role in small-caps beneath.
function BigThree() {
  return (
    <div className="mt-8 flex flex-wrap items-start justify-center gap-x-10 gap-y-4">
      {BIG_THREE_SIGNS.map((it, i) => (
        <span key={i} className="flex flex-col items-center leading-none">
          <span className="font-serif text-xl" style={{ color: inkA(0.8) }}>
            <span style={{ fontFamily: "'Georgia', serif", fontVariantEmoji: 'text' }}>{it.glyph}</span>{' '}{it.sign}
          </span>
          <span className="kicker mt-2" style={{ color: inkA(0.4) }}>{it.role}</span>
        </span>
      ))}
    </div>
  )
}
