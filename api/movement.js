// Vercel serverless function: read a form of movement and say what it asks of
// the body. The client sends the lines it has not had read yet; this hands back
// up to three qualities per line, from a fixed list of eight. It writes no
// prose and invents no categories.
//
// Requires ANTHROPIC_API_KEY in the Vercel project env. Without it (or on any
// error) it returns { kinds: {} } and the client keeps its own keyword reading,
// so a line is never left blank.

import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 20

const IDS = ['strength', 'core', 'flexibility', 'cardio', 'glutes', 'pelvic', 'mobility', 'posture']

const SYSTEM = `You classify forms of exercise by what they ask of the body.

Output ONLY a JSON object, no prose, no markdown, no code fences. Shape:
{"kinds": {"<id>": ["<quality>", ...], ...}}

The keys of "kinds" are EXACTLY the ids you are given, every one of them.
Each value is an array of 1 to 3 qualities, most central first.

The ONLY permitted qualities are these eight, lowercase, spelled exactly:
strength - loading muscle against resistance
core - the deep abdominals and trunk
flexibility - lengthening tissue, holding end range
cardio - sustained work of the heart and lungs
glutes - the hips and seat specifically
pelvic - the pelvic floor and the breath that drives it
mobility - joints moving freely through their range
posture - how the spine and shoulders are carried

Rules:
- Judge the activity as it is actually practised, not by its name alone. A
  reformer class is core, posture and strength. A long walk is cardio and
  mobility. Heavy lower-body lifting is strength and glutes.
- Return at most three, and only ones genuinely central to it. Two is usually
  right; one is fine when the thing is singular.
- Any detail given (minutes, distance, sets) may sharpen the reading.
- If an entry is unrecognisable as exercise, return ["cardio"].
- Never invent a quality outside the eight. Never omit an id.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const items = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 40) : []
  const clean = items
    .map((x) => ({
      id: String((x && x.id) || '').slice(0, 200),
      name: String((x && x.name) || '').slice(0, 120).trim(),
      detail: String((x && x.detail) || '').slice(0, 120).trim(),
    }))
    .filter((x) => x.id && x.name)

  if (!clean.length) return res.status(200).json({ kinds: {}, source: 'empty' })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(200).json({ kinds: {}, source: 'no-key' })

  try {
    const client = new Anthropic({ apiKey: key })
    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 900,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          'Classify each of these. Return the JSON object now.',
          '',
          ...clean.map((x) => `- id ${JSON.stringify(x.id)}: ${x.name}${x.detail ? ` (${x.detail})` : ''}`),
        ].join('\n'),
      }],
    })

    const text = (message.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
    let raw = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    const s = raw.indexOf('{')
    const e = raw.lastIndexOf('}')
    if (s >= 0 && e > s) raw = raw.slice(s, e + 1)
    const parsed = JSON.parse(raw)

    const out = {}
    const got = parsed && typeof parsed.kinds === 'object' && parsed.kinds ? parsed.kinds : {}
    for (const x of clean) {
      const list = Array.isArray(got[x.id]) ? got[x.id] : null
      if (!list) continue
      const tidy = []
      for (const q of list) {
        const id = String(q || '').trim().toLowerCase()
        if (IDS.includes(id) && !tidy.includes(id)) tidy.push(id)
      }
      if (tidy.length) out[x.id] = tidy.slice(0, 3)
    }

    console.log('[movement] ok', JSON.stringify({ asked: clean.length, read: Object.keys(out).length }))
    res.status(200).json({ kinds: out, source: 'claude' })
  } catch (err) {
    const apiMsg =
      (err && err.error && err.error.error && err.error.error.message) || (err && err.message) || 'unknown'
    console.error(`[movement] FAIL ${err && err.status} ${apiMsg}`)
    res.status(200).json({ kinds: {}, source: 'error' })
  }
}
