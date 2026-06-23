// Vercel serverless function: turn the deterministic aspect list into Melissa's
// daily horoscope as STRUCTURED JSON (a theme + a per-aspect meaning), in Claude's
// voice. The astrology MATH happens client-side and is passed in; this endpoint
// only writes the language. Never invents placements.
//
// Requires ANTHROPIC_API_KEY in the Vercel project env. Without it (or on any
// error) it returns { theme: null, aspects: null } so the client falls back to
// its written-from-the-aspects voice.

import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `You write Melissa's daily horoscope as STRUCTURED JSON.

Output ONLY a JSON object — no prose, no markdown, no code fences. Shape:
{"theme": string, "aspects": [{"from": string, "to": string, "type": string, "meaning": string}]}

Rules:
- "theme": 2-3 words, lowercase, the single through-line tying today's aspects
  together (e.g. "say it plainly"). No punctuation except an optional ending period.
- "aspects": echo back EVERY aspect you are given, preserving its "from", "to",
  and "type" EXACTLY as provided (do not add, drop, reorder fields, or rename).
  Add "meaning": exactly ONE sentence, second person ("you"), specific to that
  precise pairing for today, and DIFFERENT from every other meaning in the array.
  Do NOT use em dashes or en dashes (— or –); use commas or plain short sentences.
- Voice: plain, warm, precise, direct — a smart friend telling the truth. Normal
  words. No mysticism, no astrology-app filler. Banned: "energies", "the cosmos",
  "the universe", "the heavens", "flows", "vibrations", "presses against".
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

    const client = new Anthropic({ apiKey })

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
    const cleaned = Array.isArray(parsed.aspects)
      ? parsed.aspects
          .filter((a) => a && a.from && a.to && a.type && a.meaning)
          .map((a) => ({
            from: String(a.from),
            to: String(a.to),
            type: String(a.type),
            meaning: String(a.meaning).replace(/\s*[—–]\s*/g, ', ').trim(),
          }))
      : null

    if (theme && cleaned && cleaned.length) {
      console.log('[horoscope] ok', JSON.stringify({ theme, n: cleaned.length }))
      res.status(200).json({ theme, aspects: cleaned, source: 'claude' })
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
    console.error('[horoscope] APIerror', JSON.stringify({ status, apiMsg }))
    res.status(200).json({ theme: null, aspects: null, source: 'error', detail: apiMsg })
  }
}
