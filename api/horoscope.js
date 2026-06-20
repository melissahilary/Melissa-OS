// Vercel serverless function: turn the deterministic aspect list into Melissa's
// daily horoscope in Claude's voice. The astrology MATH happens client-side and
// is passed in; this endpoint only writes the language. Never invents placements.
//
// Requires ANTHROPIC_API_KEY in the Vercel project env. Without it, returns
// { text: null } so the client falls back to its written-from-the-aspects voice.

import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `You are the astrologer-voice for Melissa's private planner.
Write her daily horoscope in an editorial, old-money, quiet-luxury register —
warm, direct, a little Venusian. Second person ("you"). Three to four sentences,
no preamble, no headings, no markdown, no emoji, no bullet points.

Hard rules:
- Use ONLY the transit aspects provided in the user message. Do NOT invent or
  reference any planetary placement, sign, or degree that isn't given to you.
- The aspect math is already computed and authoritative. Your only job is voice.
- Ground the reading in the loudest one or two aspects; you may close with a
  Venus-led note, since Venus rules her whole chart.`

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
        ? aspects.map((a) => `- transiting ${a.transit} ${a.aspect} natal ${a.natal} (orb ${a.orb}°)`)
        : ['- none within orb today']),
      '',
      'Write her horoscope for today.',
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
