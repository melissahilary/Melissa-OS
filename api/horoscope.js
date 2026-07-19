// Vercel serverless function: turn the deterministic aspect list into Melissa's
// daily horoscope as STRUCTURED JSON (a theme + a per-aspect meaning), in Claude's
// voice. The astrology MATH happens client-side and is passed in; this endpoint
// only writes the language. Never invents placements.
//
// Requires ANTHROPIC_API_KEY in the Vercel project env. Without it (or on any
// error) it returns { theme: null, aspects: null } so the client falls back to
// its written-from-the-aspects voice.

import Anthropic from '@anthropic-ai/sdk'

// Give the function room for Opus latency + retry backoff on overloaded responses.
export const maxDuration = 30

const SYSTEM = `You write Melissa's daily horoscope as STRUCTURED JSON.

Output ONLY a JSON object — no prose, no markdown, no code fences. Shape:
{"theme": string, "summary": string, "aspects": [{"from": string, "to": string, "type": string, "meaning": string}]}

WHO YOU WRITE FOR — Speak to Melissa as a Greek goddess: magnetism, peace, and
effortlessness, a woman whose ease creates desire and life energy in everything
around her. This is a LIFE horoscope: read the whole of her life through today's
sky — love, work, body, spirit, money, creativity — not just a passing mood.

STANCE — Encouraging, sovereign, alive, and honest. You MAY name a true call-out
in any area when the sky asks for it; do not flatter or go toothless. But every
call-out is framed as her power and her invitation — where her energy wants to
move, what is being refined in her, what she is being freed from. Every tension is
magnetism in the making.

CRITICAL — NEVER TELL HER WHAT NOT TO DO. Only ever affirm what she IS and what
she moves toward. Write in pure affirmatives. Do NOT give warnings, cautions, or
instructions to stop, resist, hold back, or be careful. Do NOT use negation or
prohibition of any kind: no "don't", "avoid", "resist", "instead of", "rather
than", "without", "be careful", "watch out", "beware", "no need to", "try not to".
Do NOT use deficit words: struggle, weakness, "you're not", "you can't", "you
fail", "bad day", "off". Where another astrologer would warn, you instead name the
gift inside it and the beautiful thing she is moving toward. Challenge is always
her growth and her power, never something happening TO her, and never a rule about
what to avoid.

Rules:
- "theme": 2-3 words, lowercase, the through-line of the day (e.g. "soft power").
  No punctuation except an optional ending period.
- "summary": EXACTLY ONE sentence — no more, no less. A single radiant,
  self-contained line, second person, in the goddess voice above: magnetic,
  peaceful, effortless, and lifting. One sentence only, ending in a single period.
- "aspects": echo back the aspects you are given, preserving "from", "to", and
  "type" EXACTLY as provided. Add "meaning": exactly ONE sentence, second person
  ("you"), specific to that pairing, empowering, and DIFFERENT from every other
  meaning. VALIDATE each aspect before returning: every entry must have two
  DISTINCT "I" statements (the "from" and "to" must not be the same), and its
  "type" must be one of: square, quincunx, trine, sextile. If an aspect has the
  same statement on both sides, or its type is not one of those four, DROP it from
  the array entirely. No orphaned or duplicate entries.
  Do NOT use em dashes or en dashes (— or –); use commas or plain short sentences.
- Voice: warm, magnetic, serene, desire-affirming. Evocative language about energy,
  magnetism, desire and life force is welcome, but keep it elegant — no astrology-app
  clichés, no doom, no fear.
- Use ONLY the aspects provided. Return valid JSON and nothing else.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.log('[horoscope] no ANTHROPIC_API_KEY in env')
    res.status(200).json({ theme: null, aspects: null, source: 'none' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { date, aspects = [], natal = {} } = body

    // maxRetries rides out Anthropic 429/5xx/529 "overloaded" with backoff.
    const client = new Anthropic({ apiKey, maxRetries: 5 })

    const userContent = [
      `Date: ${date}`,
      '',
      "Melissa's natal big three (context only — do not restate as today's transits):",
      ...Object.entries(natal).map(([k, v]) => `- ${k}: ${v}`),
      '',
      "Today's aspects (write one distinct meaning for each; keep from/to/type exactly):",
      ...(aspects.length
        ? aspects.map(
            (a) =>
              `- from "${a.from}" to "${a.to}", type "${a.type}" (${a.quality || 'aspect'}, orb ${a.orb}°)`,
          )
        : ['- none within orb today']),
      '',
      'Return the JSON object now.',
    ].join('\n')

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    })

    const text = (message.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    // Robustly extract the JSON object from the model output.
    let raw = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    const s = raw.indexOf('{')
    const e = raw.lastIndexOf('}')
    if (s >= 0 && e > s) raw = raw.slice(s, e + 1)
    const parsed = JSON.parse(raw)

    const theme = typeof parsed.theme === 'string' ? parsed.theme.trim() : null
    const summary = typeof parsed.summary === 'string' ? parsed.summary.replace(/\s*[—–]\s*/g, ', ').trim() : ''
    const VALID_TYPES = ['square', 'quincunx', 'trine', 'sextile']
    const cleaned = Array.isArray(parsed.aspects)
      ? parsed.aspects
          .filter((a) => a && a.from && a.to && a.type && a.meaning)
          // Drop same-statement pairs and any type without a defined operator.
          .filter((a) => String(a.from).trim().toUpperCase() !== String(a.to).trim().toUpperCase())
          .filter((a) => VALID_TYPES.includes(String(a.type).toLowerCase()))
          .map((a) => ({
            from: String(a.from),
            to: String(a.to),
            type: String(a.type),
            meaning: String(a.meaning).replace(/\s*[—–]\s*/g, ', ').trim(),
          }))
      : null

    if (theme && cleaned && cleaned.length) {
      console.log('[horoscope] ok', JSON.stringify({ theme, n: cleaned.length }))
      res.status(200).json({ theme, summary, aspects: cleaned, source: 'claude' })
    } else {
      console.log('[horoscope] empty', JSON.stringify({ themeOk: !!theme, raw: text.slice(0, 240) }))
      res.status(200).json({ theme: null, aspects: null, source: 'empty' })
    }
  } catch (err) {
    const status = err && err.status
    const apiMsg =
      (err && err.error && err.error.error && err.error.error.message) ||
      (err && err.message) ||
      'unknown'
    console.error(`[horoscope] FAIL ${status} ${apiMsg}`)
    res.status(200).json({ theme: null, aspects: null, source: 'error', detail: apiMsg })
  }
}
