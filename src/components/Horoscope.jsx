import React, { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey } from '../lib/date'
import { computeTransits } from '../lib/astrology/transits'
import { natalLongitudesWith, SIGNS } from '../lib/astrology/natal'

const DEFAULT_SIGNS = { sun: 'Libra', moon: 'Taurus', rising: 'Libra' }
const signSig = (s) => `${s.sun}|${s.moon}|${s.rising}`

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

// Aspect operator glyphs, keyed by aspect type. Only these four are rendered.
const ASPECT_OP = { square: '×', quincunx: '↗', trine: '△', sextile: '∗' }
const aspectOp = (t) => ASPECT_OP[String(t || '').toLowerCase()]

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
  const summary = d && typeof d.summary === 'string' ? d.summary : ''
  const aspects = d && Array.isArray(d.aspects) ? d.aspects.filter(isValidAspect) : []
  return { theme, summary, aspects }
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

// Editorial reading: just the prose summary. The heading opens the sign editor.
function HoroscopeCard({ data, onEdit }) {
  const safe = normalizeData(data)
  const summary = safe.summary
    ? cleanMeaning(safe.summary)
    : safe.aspects.slice(0, 3).map((a) => cleanMeaning(a.meaning)).join(' ')

  const Heading = onEdit ? 'button' : 'h2'
  return (
    <section className="mb-10">
      <div className="mb-6 text-center">
        <Heading
          onClick={onEdit || undefined}
          style={{ fontFamily: "'Pinyon Script', cursive" }}
          className={`text-4xl md:text-5xl leading-tight text-stone-900 ${onEdit ? 'transition-colors hover:text-stone-500' : ''}`}
          title={onEdit ? 'Edit your Sun, Moon & Rising' : undefined}
        >
          horoscope
        </Heading>
      </div>

      {safe.aspects.length > 0 ? (
        summary && (
          <p className="max-w-2xl text-base leading-relaxed text-stone-600">{summary}</p>
        )
      ) : (
        <p className="py-2 font-serif italic text-lg text-stone-400">
          Quiet sky today — nothing strong hitting your chart.
        </p>
      )}
    </section>
  )
}

function HoroscopeInner() {
  const today = useMemo(() => new Date(), [])
  const key = dateKey(today)

  const [signsRaw, setSigns] = useLocalStorage('mos:astro:signs', DEFAULT_SIGNS)
  const signs = {
    sun: SIGNS.includes(signsRaw?.sun) ? signsRaw.sun : DEFAULT_SIGNS.sun,
    moon: SIGNS.includes(signsRaw?.moon) ? signsRaw.moon : DEFAULT_SIGNS.moon,
    rising: SIGNS.includes(signsRaw?.rising) ? signsRaw.rising : DEFAULT_SIGNS.rising,
  }
  const sig = signSig(signs)
  const [editing, setEditing] = useState(false)

  // Guard the math too — a thrown transit calc must not crash the page. The chosen
  // Sun/Moon/Rising personalize which natal points today's transits aspect.
  const top = useMemo(() => {
    try {
      const natalLons = natalLongitudesWith({ Sun: signs.sun, Moon: signs.moon, Ascendant: signs.rising })
      const { aspects } = computeTransits(today, natalLons)
      return Array.isArray(aspects) ? aspects.slice(0, 4) : []
    } catch {
      return []
    }
  }, [today, sig])

  const [cached, setCached] = useLocalStorage('mos:horoscope', null)
  const [data, setData] = useState(() => fallbackData(top))

  useEffect(() => {
    // Use the cache only if it's today's, matches the current signs, and is valid.
    if (
      cached &&
      cached.date === key &&
      cached.signs === sig &&
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
    const natalContext = { sun: `${signs.sun} Sun`, moon: `${signs.moon} Moon`, rising: `${signs.rising} Rising` }
    ;(async () => {
      try {
        const res = await fetch('/api/horoscope', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: key, aspects: payload, natal: natalContext }),
        })
        if (!res.ok) return
        const json = await res.json()
        const next = normalizeData(json)
        if (next.aspects.length && next.theme && alive) {
          setData(next)
          setCached({ date: key, signs: sig, theme: next.theme, summary: next.summary, aspects: next.aspects, source: 'claude' })
        }
      } catch {
        /* offline / no key — the deterministic fallback already rendered */
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, top, sig])

  return (
    <>
      <HoroscopeCard data={data} onEdit={() => setEditing(true)} />
      {editing && (
        <SignsModal
          signs={signs}
          onSave={(next) => { setSigns(next); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}

// ── Sun / Moon / Rising editor — a pop-up in the planner's house style ──
const BIG_THREE_ROLES = [
  { key: 'sun', label: 'Sun', note: 'Identity' },
  { key: 'moon', label: 'Moon', note: 'Inner world' },
  { key: 'rising', label: 'Rising', note: 'How you show up' },
]

function SignsModal({ signs, onSave, onClose }) {
  const [draft, setDraft] = useState(signs)
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-5">
          <span className="kicker text-stone-400">Your chart</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-stone-500">Set your Sun, Moon and Rising. Each day's reading is drawn from these.</p>
          {BIG_THREE_ROLES.map((r) => (
            <div key={r.key}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="kicker text-stone-400">{r.label}</span>
                <span className="text-[11px] uppercase tracking-[0.14em] text-stone-300">{r.note}</span>
              </div>
              <div className="relative">
                <select
                  value={draft[r.key]}
                  onChange={(e) => set(r.key, e.target.value)}
                  className="w-full appearance-none bg-transparent border-b border-stone-300 pb-1.5 font-serif text-xl text-stone-900 outline-none focus:border-stone-900"
                >
                  {SIGNS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="pointer-events-none absolute bottom-1.5 right-1 text-stone-400">▾</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-stone-200 px-6 py-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
          <button onClick={() => onSave(draft)} className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700">Save</button>
        </div>
      </div>
    </div>
  )
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
