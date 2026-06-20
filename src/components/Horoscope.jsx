import React, { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { dateKey, longDate } from '../lib/date'
import { computeTransits, PLANET_GLYPH } from '../lib/astrology/transits'
import { templateNarrative, aspectSummary } from '../lib/astrology/narrative'

const BIG_THREE = {
  sun: 'Libra 24° (Mercury also in Libra, conjunct the Sun)',
  moon: 'Taurus 11°',
  rising: 'Libra 25° — a double Libra',
  ruler: 'Venus in Sagittarius rules the entire chart, twice over',
  fire: 'Venus & Mars in Sagittarius — honest, direct, unbothered',
  midheaven: 'Cancer — builds nurturing, home-like things in the world',
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

  const topChips = aspects.slice(0, 4)

  return (
    <section className="mb-10 border border-stone-200 bg-white/40 px-6 py-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={14} className="text-sand" />
        <p className="kicker text-stone-400">Today's sky · {longDate(today)}</p>
      </div>

      {text ? (
        <p className="font-serif text-lg md:text-xl leading-relaxed text-stone-800">{text}</p>
      ) : (
        <p className="font-serif italic text-lg text-stone-400">Reading the sky…</p>
      )}

      {topChips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {topChips.map((a, i) => (
            <span
              key={i}
              title={`${a.transit} ${a.aspect} natal ${a.natal} · orb ${a.orb}°`}
              className="inline-flex items-center gap-1.5 border border-stone-200 px-2 py-0.5 text-xs text-stone-500"
            >
              <span className="text-sm text-stone-700">{PLANET_GLYPH[a.transit]}</span>
              <span className="text-stone-400">{a.glyph}</span>
              <span className="text-sm text-stone-700">{PLANET_GLYPH[a.natal] || a.natal}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
