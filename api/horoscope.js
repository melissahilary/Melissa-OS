// Vercel serverless function: turn the deterministic aspect list into Melissa's
// daily horoscope in Claude's voice. The astrology MATH happens client-side and
// is passed in; this endpoint only writes the language. Never invents placements.
//
// Requires ANTHROPIC_API_KEY in the Vercel project env. Without it, returns
// { text: null } so the client falls back to its written-from-the-aspects voice.

import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `You write Melissa's daily horoscope.

Voice: plain, warm, precise, direct — like a smart friend telling her the truth,
not a fortune cookie. Short sentences. Normal words. Second person ("you").
No mysticism, no purple prose, no astrology-app filler. Banned (and anything
like them): "presses against", "easy concord", "the hours ahead", "the cosmos",
"energies", "the universe", "the heavens", "flows", "colors your day".

How to write it:
- The transit aspects in the user message are already computed and authoritative.
  Use ONLY those. Never invent or mention any placement, sign, or degree not listed.
- Synthesize them into ONE coherent reading — not a list, not one sentence per
  aspect. Dedupe overlaps. If two aspects conflict (one tense "friction", one
  easy "flow"), name it honestly as two things happening at once; do not state
  both as if they're separate unrelated facts.
- Say what today actually means for her in practical terms: how she might feel,
  what to watch for, what to do about it.
- 3 to 4 short sentences. No preamble, headings, markdown, emoji, or bullet points.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Not configured yet — let the client use its deterministic fallback voice.
    res.status(200).json({ text: null, source: 'none' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const { date, aspects = [], natal = {} } = body

    const client = new Anthropic({ apiKey })

    const userContent = [
      `Date: ${date}`,
      '',
      "Melissa's natal big three (context only — do not restate as today's transits):",
      ...Object.entries(natal).map(([k, v]) => `- ${k}: ${v}`),
      '',
      "Today's exact transit aspects to her natal chart (loudest first):",
      ...(aspects.length
        ? aspects.map(
            (a) =>
              `- transiting ${a.transit} ${a.aspect} natal ${a.natal} (${a.quality || 'aspect'}, orb ${a.orb}°)`,
          )
        : ['- none within orb today']),
      '',
      'Synthesize these into one coherent reading for today.',
    ].join('\n')

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    })

    const text = (message.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    res.status(200).json({ text: text || null, source: text ? 'claude' : 'none' })
  } catch (err) {
    // Surface nothing sensitive; client falls back to its written voice.
    res.status(200).json({ text: null, source: 'error', detail: String(err && err.message) })
  }
}
