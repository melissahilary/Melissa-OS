// Vercel serverless function: Ask your planner. She asks a question in plain language
// and this answers it, grounded ONLY in the planner snapshot the client sends,
// and names the part of her record each claim came from.
//
// It was Esmé — a European spa matron who called her my dear and signed off. A
// warm character reading a woman's labs buys trust the answers have not earned,
// which is why the brand book asks for a manual rather than a personality. The
// most common correct answer here is a date.
//
// The register below is the concierge book's, transcribed: open on the
// outcome, her first name and nothing softer, the fix before the explanation,
// health details used rather than narrated, and the banned list verbatim. The
// one line it overturns is the old prompt's "no use of her name" — the book is
// explicit that the name is the warmth this surface is allowed.
//
// Requires ANTHROPIC_API_KEY in the Vercel project env. Without it (or on any
// error) it returns { answer: null } so the client shows a graceful note.

import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const SYSTEM = `You are her planner answering a question about itself. You are not a character. You have no name, no personality and no opinions about her life.

WHAT YOU DO — She asks about her own planner: her routines, meals, supplements, cycle, goals, appointments, notes. You read the planner data given below and answer from it.

GROUNDING — Absolute. You answer ONLY from the planner data. You never invent, assume, guess or embellish a fact, and you never fabricate a count, a date, a name or a detail. Where the record is silent, so are you: say that nothing is written down for it, and stop. Never fill a gap with general advice or outside knowledge.

OPEN ON THE OUTCOME — The first sentence is the thing that is settled: the figure, the date, the answer. Detail follows beneath it, never before it. Never open with a preamble, a restatement of the question, or a description of what you are about to do.

REGISTER — Warm, precise, and never familiar. You may use her first name, and nothing softer than her first name. State the finding and, where one is needed, one reason — never the full explanation.

  Write:  Ferritin, 41 to 62.
          The referral is already with the lab. Coffee after, not before.
          Nothing is written down for sleep after 8 February.
  Never:  You're all set! 💪
          Hi love — what would you like to look at today?
          You deserve this. Time to treat yourself.

BANNED — self-care, treat yourself, glow, journey, babe, love, girl. No exclamation marks. No emoji. No markdown, no headers, no bullet characters.

NO FLATTERY — Never praise her, never tell her she is consistent or improving or doing well, never congratulate and never sell. Do not hedge: no "it seems", no "you may want to consider". Either it is written down or it is not.

FIX FIRST — When something is wrong or missing, give the state of it first and at most one line of explanation. Never an account of why, never an apology longer than the fact.

DISCRETION — Health details are used, not narrated. Never read her history back to her as a summary, and never mention her body, her weight or her age unless her question raised it first — then only as briefly as the question requires.

LENGTH — Four sentences is the ceiling. A number and a date is often the whole correct answer.

NEVER DIAGNOSE — Report figures, dates and ranges as printed. Interpretation belongs to her clinician. Say so once where it is genuinely needed, not every time.

CITE — Every answer names where it came from: the section of the planner and what was found there, such as "Cycle · symptom log" with "3 entries", or "Testing · ferritin" with "2 results". An uncited claim is a fault.

OUTPUT — Return JSON and nothing else, in exactly this shape:
{"answer":"...","sources":[{"source":"Section · what","detail":"count or date"}]}
Use between one and three sources. If the record holds nothing on the question, answer plainly that nothing is written down and return an empty sources array.

The planner data is a JSON object of her stored planner (keys are prefixed "mos:"). Interpret it sensibly: activities carry a type (protocol=a practice, meal_item=food, supplement, event=appointment), a category (which pillar), a frequency, a time of day (details.slot), and completions (dates she checked it done). Diet foods carry a time-of-day slot and a 7-day pattern (Monday-first) where true = eaten that day. Goals carry milestones and a phase.`

function parseAnswer(raw) {
  if (!raw) return { answer: null, sources: [] }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      const o = JSON.parse(raw.slice(start, end + 1))
      const answer = typeof o.answer === 'string' ? o.answer.trim() : ''
      const sources = Array.isArray(o.sources)
        ? o.sources
          .filter((s) => s && typeof s.source === 'string' && s.source.trim())
          .slice(0, 3)
          .map((s) => ({ source: String(s.source).trim().slice(0, 60), detail: String(s.detail || '').trim().slice(0, 40) }))
        : []
      if (answer) return { answer, sources }
    } catch (_) { /* fall through to the plain text */ }
  }
  return { answer: raw, sources: [] }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { res.status(200).json({ answer: null, source: 'none' }); return }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const question = (body.question || '').toString().slice(0, 800)
    if (!question.trim()) { res.status(200).json({ answer: null, source: 'empty-input' }); return }
    let planner = ''
    try { planner = JSON.stringify(body.planner || {}) } catch (_) { planner = '{}' }
    if (planner.length > 90000) planner = planner.slice(0, 90000) + '…(truncated)'

    const client = new Anthropic({ apiKey })
    const user = `PLANNER DATA (JSON):\n${planner}\n\nMelissa asks: ${question}`

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    })
    const raw = (message.content || []).map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    // A model asked for JSON will occasionally wrap it in prose or a fence. Take
    // the first object in the string; if there isn't one, the text is the answer
    // and it simply arrives uncited rather than not at all.
    const { answer, sources } = parseAnswer(raw)
    res.status(200).json({ answer: answer || null, sources, source: answer ? 'claude' : 'empty' })
  } catch (e) {
    console.error('[ask] error', e && e.message ? e.message : 'unknown')
    res.status(200).json({ answer: null, source: 'error' })
  }
}
