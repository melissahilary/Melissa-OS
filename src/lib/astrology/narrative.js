// Deterministic, written-from-the-aspects horoscope — the fallback voice used
// when the Claude narrative endpoint isn't configured. Editorial, second person.

const TRANSIT_THEME = {
  Sun: 'vitality and focus',
  Moon: 'mood and instinct',
  Mercury: 'thinking and conversation',
  Venus: 'love, money, and taste',
  Mars: 'drive and assertion',
  Jupiter: 'expansion and good fortune',
  Saturn: 'structure and discipline',
  Uranus: 'surprise and the unexpected',
  Neptune: 'dreams and intuition',
  Pluto: 'depth and transformation',
}

const NATAL_THEME = {
  Sun: 'your core self',
  Moon: 'your inner world',
  Ascendant: 'how you meet the world',
  Venus: 'your sense of beauty and worth',
  Mercury: 'your mind',
  Mars: 'your ambition',
  Midheaven: 'your public path',
  Jupiter: 'your growth',
  Saturn: 'your commitments',
  Uranus: 'your independence',
  Neptune: 'your imagination',
  Pluto: 'your power',
  NorthNode: 'your direction',
}

const TONE = {
  conjunction: 'meets',
  sextile: 'opens a quiet door to',
  square: 'presses against',
  trine: 'moves in easy concord with',
  opposition: 'sits across from',
}

const PLANET_NAME = {
  Sun: 'the Sun', Moon: 'the Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars',
  Jupiter: 'Jupiter', Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune', Pluto: 'Pluto',
}

function sentenceFor(a) {
  const t = PLANET_NAME[a.transit] || a.transit
  const tone = TONE[a.aspect] || 'touches'
  const natal = NATAL_THEME[a.natal] || `your natal ${a.natal}`
  const theme = TRANSIT_THEME[a.transit] || 'the day'
  return `${t} ${tone} ${natal} — ${theme} colors the hours ahead.`
}

export function templateNarrative(aspects, date = new Date()) {
  const top = (aspects || []).slice(0, 3)
  if (!top.length) {
    return 'A quiet sky today — no exact contacts to your chart. Move at your own pace and let the day stay soft.'
  }
  const lines = [sentenceFor(top[0])]
  if (top[1]) lines.push(sentenceFor(top[1]))
  // A Venus-ruled closing note, since the whole chart answers to her.
  lines.push('Venus rules your chart twice over; let beauty and balance lead the choices that matter.')
  return lines.join(' ')
}

// Compact context the LLM endpoint receives — never the raw math to recompute.
export function aspectSummary(aspects) {
  return (aspects || []).slice(0, 6).map((a) => ({
    transit: a.transit,
    aspect: a.aspect,
    natal: a.natal,
    orb: a.orb,
  }))
}
