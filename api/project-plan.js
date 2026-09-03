// Vercel serverless function: turn a project — and the goal it is working
// toward — into an ordered set of steps from start to finish, as JSON. Every
// step comes back as plain text she can edit before any of it is imported.
//
// Requires ANTHROPIC_API_KEY in the Vercel project env. Without it (or on any
// error) it returns { steps: null } so the client can say so.

import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const SYSTEM = `You are Melissa's chief of staff. You turn one PROJECT into a complete, ordered list of steps from where she is now to done.

Output ONLY a JSON object — no prose, no markdown, no code fences. Shape:
{"steps":[{"title":string,"detail":string}]}

HOW TO PLAN
- Read the project and, if given, the goal it serves. The goal is the point of the project; every step should move toward it.
- Give 6-14 STEPS in the order she would actually do them, first to last. Each is one concrete, doable action ("Get three quotes for the kitchen", "Book the venue walkthrough"), not a phase or an outcome.
- "detail" is one short sentence saying what the step involves or what to watch for. It may be empty.
- If she already has some steps, do not repeat them — continue from where they leave off, filling gaps and finishing the sequence.
- Start where a person who does not know where to begin would need to start. The first two or three steps should be small enough to do this week.

VOICE — Melissa is a woman building a beautiful, high-standard life. Concrete, grown-up, no motivational filler. Titles are short. No numbering in the titles.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.log('[project-plan] no ANTHROPIC_API_KEY in env')
    res.status(200).json({ steps: null, source: 'none' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const name = (body.name || '').toString().slice(0, 200)
    const goal = (body.goal || '').toString().slice(0, 300)
    const existing = (Array.isArray(body.existing) ? body.existing : []).map((t) => String(t || '').slice(0, 160)).filter(Boolean).slice(0, 40)
    const due = (body.due || '').toString().slice(0, 10)
    if (!name.trim() && !goal.trim()) { res.status(200).json({ steps: null, source: 'empty-input' }); return }

    const client = new Anthropic({ apiKey })
    const user = [
      `PROJECT: ${name || '(unnamed)'}`,
      goal ? `THE GOAL IT SERVES: ${goal}` : '',
      due ? `DUE: ${due}` : '',
      existing.length ? `STEPS SHE ALREADY HAS (do not repeat):\n${existing.map((t) => `- ${t}`).join('\n')}` : '',
      'Write the steps now as the JSON object.',
    ].filter(Boolean).join('\n')

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1400,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    })

    const raw = (message.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const json = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw
    const parsed = JSON.parse(json)

    const steps = (Array.isArray(parsed.steps) ? parsed.steps : [])
      .map((s) => ({
        title: (s && s.title ? s.title : '').toString().replace(/^\s*\d+[.)]\s*/, '').slice(0, 160),
        detail: (s && s.detail ? s.detail : '').toString().slice(0, 240),
      }))
      .filter((s) => s.title)
      .slice(0, 20)

    if (!steps.length) { res.status(200).json({ steps: null, source: 'empty' }); return }
    res.status(200).json({ steps, source: 'claude' })
  } catch (e) {
    const apiMsg = e && e.message ? e.message : 'unknown'
    console.error('[project-plan] error', apiMsg)
    res.status(200).json({ steps: null, source: 'error', detail: apiMsg })
  }
}
