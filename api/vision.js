// Vercel serverless function: read a saved picture and say, plainly, what is in
// it. Nothing else.
//
// The whole point of this endpoint is restraint. It names the object and lists
// what is observably true — colour, material, kind, a brand only if the logo is
// legible. It does not decide what the picture means to her, what "life area" it
// belongs to, what it says about her taste, or what she is trying to become.
// That reading is hers, and a machine guessing at it would be both wrong and
// presumptuous.
//
// Requires ANTHROPIC_API_KEY. Without it the board simply keeps the picture
// unnamed, which is exactly what it did before.

import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 25

const SYSTEM = `You look at one saved image and describe what is visibly in it. You are a cataloguer, not a critic.

Return ONLY a JSON object — no prose, no markdown, no code fences:
{"title": string, "kind": string, "colors": [string], "material": string, "brand": string, "room": string, "search": string}

title — a plain factual name for the main subject, 2–6 words, sentence case.
  Good: "Black leather top-handle bag" · "Green kitchen with brass tap" · "Arched doorway, plaster walls"
  Bad: "Wealth" · "Quiet luxury" · "The life you want" · "Elegance"

kind — the category of object or scene in one or two plain words: bag, coat, kitchen, bathroom, chair, lighting, hairstyle, interior, landscape, tablescape, ring, car.

colors — one to three dominant colours in ordinary words: "cobalt", "cream", "walnut", "black", "sage".

material — the main visible material if clear: leather, linen, marble, brass, oak, velvet, ceramic. Empty string if not clear.

brand — ONLY if a logo or wordmark is actually legible in the image. Otherwise an empty string. Never guess a brand from style.

room — only for interiors: kitchen, bathroom, bedroom, living room, hallway, garden, office. Empty string otherwise.

search — one dense sentence of concrete visual detail so this image can be found later by someone describing it from memory. Include shapes, features, light, setting, notable details. Example: "cobalt blue leather bucket bag with top handle, held at hip, pale wood floor, black skirt, daylight".

HARD RULES
- Describe only what is visible. Never infer aspiration, mood, lifestyle, wealth, taste, personality or intent.
- Never assign a theme, category of life, or emotional meaning.
- Never mention a person's appearance, body, age, weight, race or attractiveness. If a person is in frame, describe only the object or the setting.
- If you cannot tell something, return an empty string rather than guessing.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const empty = { title: '', kind: '', colors: [], material: '', brand: '', room: '', search: '' }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(200).json(empty)

  const { image, mediaType } = req.body || {}
  if (!image || typeof image !== 'string') return res.status(400).json({ error: 'No image' })
  // Roughly 1.4MB of base64 — the client sends a small thumbnail, not the original.
  if (image.length > 1_900_000) return res.status(413).json({ error: 'Too large' })

  try {
    const anthropic = new Anthropic({ apiKey: key })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
          { type: 'text', text: 'Describe this image as JSON.' },
        ],
      }],
    })

    const text = (msg.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim()
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end < 0) return res.status(200).json(empty)

    const parsed = JSON.parse(text.slice(start, end + 1))
    const str = (v) => (typeof v === 'string' ? v.trim().slice(0, 120) : '')
    return res.status(200).json({
      title: str(parsed.title),
      kind: str(parsed.kind).toLowerCase(),
      colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 3).map((c) => str(c).toLowerCase()).filter(Boolean) : [],
      material: str(parsed.material).toLowerCase(),
      brand: str(parsed.brand),
      room: str(parsed.room).toLowerCase(),
      search: typeof parsed.search === 'string' ? parsed.search.trim().slice(0, 400) : '',
    })
  } catch (e) {
    console.warn('[mos] vision failed', e && e.message)
    return res.status(200).json(empty)
  }
}
