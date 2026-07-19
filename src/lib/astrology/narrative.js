// Turn the computed aspect list into a reading. Voice: Melissa spoken to as a
// Greek goddess — magnetism, peace, effortlessness, desire and life energy.
// Honest but never fearful: every tension is framed as her power, her invitation,
// what is being refined in her — never a warning or a deficit. This fallback is
// used when the Claude endpoint isn't configured; it dedupes, avoids stacking
// contradictory tones, and resolves into ONE lifted, coherent thought.

function quality(aspect) {
  if (aspect === 'square' || aspect === 'opposition') return 'friction'
  if (aspect === 'trine' || aspect === 'sextile') return 'flow'
  return 'focus' // conjunction
}

// How each transiting planet tends to feel, in plain words, by aspect quality.
const TRANSIT_PLAIN = {
  Moon: {
    friction: 'your feelings run close to the surface, and that sensitivity is your intelligence, not a flaw',
    flow: 'you feel steady and at home in yourself, soft and unhurried',
    focus: 'your inner world is vivid today, and you can trust what it tells you',
  },
  Mercury: {
    friction: 'words want a little more care today, and your slower, deliberate speech becomes its own kind of power',
    flow: 'your mind is clear and your words land, a beautiful day to say the true thing',
    focus: 'your thoughts gather and sharpen, ready to be spoken',
  },
  Venus: {
    friction: 'love and worth are asking to be met on your own terms, drawn to you rather than chased',
    flow: 'beauty, affection, and abundance move toward you effortlessly',
    focus: 'you long for closeness and loveliness, and you pull them in',
  },
  Mars: {
    friction: 'there is fire in you, and it wants to be aimed at something worthy of it',
    flow: 'you move with real drive, unstoppable toward what matters',
    focus: 'your energy is high and ready to be spent on your desire',
  },
  Sun: {
    friction: 'you are finding your rhythm, and pacing yourself only makes you more magnetic',
    flow: 'you feel fully yourself, warm and impossible to look away from',
    focus: 'the day places you at its center, seen and radiant',
  },
  Jupiter: {
    friction: 'abundance is generous today, and the art is choosing where to pour it',
    flow: 'doors are opening, and you can say a joyful yes to the right one',
    focus: 'life feels expansive, inviting you to want more, not less',
  },
  Saturn: {
    friction: 'a responsibility asks for your presence, and meeting it makes you sovereign',
    flow: 'you are steady and grounded, able to build something that lasts',
    focus: 'one commitment wants your devotion, and devotion suits you',
  },
  Uranus: {
    friction: 'the unexpected is arriving to free you from something that had grown too small',
    flow: 'there is room to move differently and delight in the surprise of it',
    focus: 'you feel the pull toward change, toward a freer version of your life',
  },
  Neptune: {
    friction: 'the edges are soft today, an invitation to rest and dream rather than push',
    flow: 'intuition and imagination move easily, gorgeous for rest and creation',
    focus: 'the day is dreamy and tender, made for beauty and stillness',
  },
  Pluto: {
    friction: 'something deep is being transformed, and your quiet power is more than equal to it',
    flow: 'you carry a still, magnetic power that can move something real',
    focus: 'there is intensity beneath the surface, and it belongs to you',
  },
}

const NATAL_AREA = {
  Sun: 'who you are',
  Moon: 'how you feel',
  Venus: 'what you value and find beautiful',
  Ascendant: 'how you come across',
  Mercury: 'how you think',
  Mars: 'your drive and fire',
  Midheaven: 'your work and reputation',
  Jupiter: 'your growth',
  Saturn: 'your devotion and structure',
  Uranus: 'your need for freedom',
  Neptune: 'your imagination',
  Pluto: 'your depth and power',
  NorthNode: "where you're headed",
}

const TIE = { friction: "and it's refining", flow: "and it's blessing", focus: "and it's centered on" }
const CLOSER = {
  friction: 'Let it move through you without force, your ease is exactly what makes you magnetic.',
  flow: 'Move toward what you desire, it is already turning to meet you.',
  focus: 'Stay soft and clear, and let what you want come to you.',
}

function dedupe(aspects) {
  const seen = new Set()
  const out = []
  for (const a of aspects || []) {
    const k = `${a.transit}-${a.aspect}-${a.natal}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(a)
  }
  return out
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function templateNarrative(aspects) {
  const list = dedupe(aspects)
  if (!list.length) {
    return 'A quiet sky today, nothing pressing on your chart. Move at your own unhurried pace, let your presence do the work, and trust the stillness as its own kind of power.'
  }

  const head = list[0]
  const hq = quality(head.aspect)
  const headClause = (TRANSIT_PLAIN[head.transit] || {})[hq] || ''
  const headArea = NATAL_AREA[head.natal] || ''

  let reading = cap(headClause)
  if (headArea) reading += `, ${TIE[hq]} ${headArea}`
  reading += '.'

  // One more beat, but only from a DIFFERENT transiting planet so we never
  // repeat the same theme or stack a contradictory tone on the same idea.
  const second = list.find((a) => a.transit !== head.transit && a.natal !== head.natal)
  if (second) {
    const sq = quality(second.aspect)
    const c = (TRANSIT_PLAIN[second.transit] || {})[sq] || ''
    const area = NATAL_AREA[second.natal] || ''
    if (c) reading += ` ${cap(c)}${area ? ` — around ${area}` : ''}.`
  }

  reading += ` ${CLOSER[hq]}`
  return reading
}

// Compact, de-duplicated context for the LLM endpoint — includes the aspect
// quality so it can synthesize rather than translate line-by-line.
export function aspectSummary(aspects) {
  return dedupe(aspects)
    .slice(0, 6)
    .map((a) => ({
      transit: a.transit,
      aspect: a.aspect,
      natal: a.natal,
      quality: quality(a.aspect),
      orb: a.orb,
    }))
}
