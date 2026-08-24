// Vercel serverless function: turn a goal into an achievement PLAN as structured
// JSON — a ladder of milestones, each carrying the concrete steps that reach it,
// every step routed to one of Melissa's life pillars + a section so the app can
// drop it straight into her planner.
//
// Requires ANTHROPIC_API_KEY in the Vercel project env. Without it (or on any
// error) it returns { milestones: null } so the client can tell the user to add
// steps manually.

import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const SYSTEM = `You are Melissa's chief of staff. You turn one goal into a concrete, achievable PLAN.

Output ONLY a JSON object — no prose, no markdown, no code fences. Shape:
{"milestones":[{"title":string,"steps":[{"title":string,"pillar":string,"section":string,"kind":string,"cadence":string}]}]}

HOW TO PLAN
- Break the goal into 3-5 MILESTONES: ordered checkpoints that together mean the goal is achieved. Each milestone is an outcome ("Baseline & consult", "Active treatment", "Re-test & review"), not a task.
- Under each milestone, give 1-4 STEPS: the concrete actions that reach that checkpoint. Steps are specific and doable ("Book laser consult", "Vitamin C serum every morning", "Full hormone panel on cycle day 3").
- Sequence milestones so earlier ones unblock later ones.

ROUTING — every step must be assigned to one PILLAR and one SECTION so it lands in the right place in her planner. Choose the pillar from EXACTLY this list (use the id):
- skincare (sections: Morning Routine, Evening Routine, Products, Weekly)
- aesthetics (sections: Appointments, Treatments, Services, Devices, Prescribed)
- fitness (sections: Training, Sessions, Appointments, Products)
- hormones (sections: Appointments, Labs, Products)
- nutrition (sections: Diet, Today)
- mindset (sections: Journal, Morning Routine, Evening Routine)
- haircare, bodycare, brainhealth, relationships, spirituality, diagnostics (section: Today)
Pick the single most natural pillar+section for each step.

KIND — one of: "appointment" (a booked visit), "lab" (a test/draw), "treatment" (a clinical procedure), "product" (something to buy/take), "habit" (a recurring practice), "action" (a one-time task).
CADENCE — one of: "once", "daily", "weekly". Habits are daily/weekly; appointments/labs/treatments/actions are once; products are daily unless clearly one-time.

VOICE — Melissa is a woman building a beautiful, high-standard life (skin, body, hormones, mind, home). Keep steps aspirational but concrete and grown-up. No fluff, no motivational filler in the titles.

Return 3-5 milestones. Keep the whole plan tight and real — a plan she could start today.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.log('[goal-plan] no ANTHROPIC_API_KEY in env')
    res.status(200).json({ milestones: null, source: 'none' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const title = (body.title || '').toString().slice(0, 300)
    const why = (body.why || '').toString().slice(0, 500)
    const pillar = (body.pillar || '').toString().slice(0, 40)
    if (!title.trim()) { res.status(200).json({ milestones: null, source: 'empty-input' }); return }

    const client = new Anthropic({ apiKey })
    const user = [
      `GOAL: ${title}`,
      why ? `WHY IT MATTERS: ${why}` : '',
      pillar ? `PRIMARY LIFE AREA (a hint, steps may span others): ${pillar}` : '',
      'Write the plan now as the JSON object.',
    ].filter(Boolean).join('\n')

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    })

    const raw = (message.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const json = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw
    const parsed = JSON.parse(json)

    const PILLARS = ['skincare', 'aesthetics', 'fitness', 'hormones', 'nutrition', 'mindset', 'haircare', 'bodycare', 'brainhealth', 'relationships', 'spirituality', 'diagnostics']
    const KINDS = ['appointment', 'lab', 'treatment', 'product', 'habit', 'action']
    const CADENCE = ['once', 'daily', 'weekly']

    const milestones = (Array.isArray(parsed.milestones) ? parsed.milestones : [])
      .map((m) => ({
        title: (m.title || '').toString().slice(0, 120),
        steps: (Array.isArray(m.steps) ? m.steps : []).map((s) => ({
          title: (s.title || '').toString().slice(0, 160),
          pillar: PILLARS.includes(s.pillar) ? s.pillar : 'mindset',
          section: (s.section || '').toString().slice(0, 40),
          kind: KINDS.includes((s.kind || '').toLowerCase()) ? s.kind.toLowerCase() : 'action',
          cadence: CADENCE.includes((s.cadence || '').toLowerCase()) ? s.cadence.toLowerCase() : 'once',
        })).filter((s) => s.title),
      }))
      .filter((m) => m.title && m.steps.length)

    if (!milestones.length) { res.status(200).json({ milestones: null, source: 'empty' }); return }
    res.status(200).json({ milestones, source: 'claude' })
  } catch (e) {
    const apiMsg = e && e.message ? e.message : 'unknown'
    console.error('[goal-plan] error', apiMsg)
    res.status(200).json({ milestones: null, source: 'error', detail: apiMsg })
  }
}
