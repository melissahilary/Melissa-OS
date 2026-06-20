// Turn the computed aspect list into a reading. Voice: plain, warm, precise,
// direct — a smart friend telling the truth, not a fortune cookie. The fallback
// below is used when the Claude endpoint isn't configured; it dedupes, avoids
// contradictory tone-stacking, and resolves into ONE short coherent thought.

function quality(aspect) {
  if (aspect === 'square' || aspect === 'opposition') return 'friction'
  if (aspect === 'trine' || aspect === 'sextile') return 'flow'
  return 'focus' // conjunction
}

// How each transiting planet tends to feel, in plain words, by aspect quality.
const TRANSIT_PLAIN = {
  Moon: {
    friction: "you're more reactive than usual; small stuff gets under your skin",
    flow: 'you feel steady and easy in yourself',
    focus: 'your feelings are right at the surface today',
  },
  Mercury: {
    friction: 'messages and conversations can snag — reread before you send',
    flow: 'talking and thinking come easy; good day to say the thing',
    focus: "your head's busy; ideas and messages pile up",
  },
  Venus: {
    friction: "money or relationship stuff feels a little off — don't force it",
    flow: 'people, money, and taste are all on your side',
    focus: 'you want connection and things that look right',
  },
  Mars: {
    friction: "you've got a short fuse; sitting on the energy just turns it to friction",
    flow: "you've got real drive — push on what matters",
    focus: 'high energy, ready to go after something',
  },
  Sun: {
    friction: "you're a half-step out of sync; pace yourself",
    flow: 'you feel like yourself — warm and visible',
    focus: 'the day puts you front and center',
  },
  Jupiter: {
    friction: "good mood, but don't overcommit or overspend on it",
    flow: 'doors are open; say yes to the right one',
    focus: 'things feel expansive — aim a little bigger',
  },
  Saturn: {
    friction: 'a limit or responsibility presses; handle it instead of dodging it',
    flow: 'steady and productive — good for the boring important work',
    focus: 'time to get serious about one commitment',
  },
  Uranus: {
    friction: 'expect a curveball; stay loose',
    flow: 'room to do something differently',
    focus: "you're restless for a change",
  },
  Neptune: {
    friction: "focus is soft; don't sign or commit to anything you haven't reread",
    flow: 'good for rest, intuition, and creative work',
    focus: "it's a dreamy, low-edges day",
  },
  Pluto: {
    friction: "a control or power dynamic surfaces; don't grip too tight",
    flow: 'quiet power — you can shift something real',
    focus: 'intensity running under the surface',
  },
}

const NATAL_AREA = {
  Sun: 'who you are',
  Moon: 'how you feel',
  Venus: 'what you value and find beautiful',
  Ascendant: 'how you come across',
  Mercury: 'how you think',
  Mars: 'your drive and temper',
  Midheaven: 'your work and reputation',
  Jupiter: 'your growth',
  Saturn: 'your responsibilities',
  Uranus: 'your need for freedom',
  Neptune: 'your imagination',
  Pluto: 'your sense of control',
  NorthNode: "where you're headed",
}

const TIE = { friction: "and it's hitting", flow: "and it's helping", focus: "and it's centered on" }
const CLOSER = {
  friction: "Don't force anything or fire it off hot. Say what you mean, plainly.",
  flow: 'Use it — go after the thing you actually want.',
  focus: 'Keep it simple and say what you mean.',
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
    return "Quiet sky today — nothing strong hitting your chart. Run your own pace and don't read meaning into a slow day."
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
