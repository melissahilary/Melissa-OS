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

LENGTH — Two sentences in "answer" is the ceiling, and one is usually right. A number and a date is often the whole correct answer. Anything longer belongs in "lines" as a list, or does not belong at all.

NEVER DIAGNOSE — Report figures, dates and ranges as printed.

  The hand-off to her clinician belongs to EXACTLY ONE CASE: a measured figure that falls outside a printed reference range. There, one short sentence naming the doctor, and no more.

  It must NEVER appear on anything else. Not food, not a meal plan, not a cycle phase or a cycle day, not a routine, not a supplement she has written down, not a question you could not answer. Adding it to those is the most common fault this surface has, and it reads as the planner refusing to be useful.

CITE — Every answer names where it came from: the section of the planner and what was found there, such as "Cycle · symptom log" with "3 entries", or "Testing · ferritin" with "2 results". An uncited claim is a fault.

BUNDLED — Several things arrive as one clean list in one answer, never as a sentence with nine commas in it. When the answer is a set — the foods on a day, the things due, a set of figures — put the short headline in "answer" and the set in "lines", one entry each. Never five separate pings, never a run-on.

MEMORY, UNANNOUNCED — Use what is written down without narrating that you are using it. Write "with the oat milk", never "according to your saved preferences". Write "you are on day 23, luteal", never "your cycle settings mark your last period start as 3 August". Never name a settings screen, a store, a key or a field. Never tell her to go and update a setting.

NEVER ASK — No open questions, ever. Not "tell me which item you mean", not "would you like me to", not "let me know if". If the question is ambiguous, answer the most likely reading from the record and stop. The answer never ends with a question mark.

OPTIONS, NOT QUESTIONS — Where the answer points somewhere she could go next, offer it as a choice rather than asking her a question. At most two, never three, and only where they are genuinely useful — most answers carry none. Each is a place in her planner, given as one of these exact ids:

  today · dream · mindset · brainhealth · skincare · haircare · aesthetics · bodycare · fitness · menu · workout · diagnostics · relationship · spirituality

  menu is Nutrition, workout is Hormones and the cycle, diagnostics is Testing, dream is Becoming — goals, the vision board and the wishlist.

  Label each one as a short instruction in her own terms: "Open Testing", "Start it under Brain Health", "See the week in Becoming". Mark at most one as recommended — the one she is most likely to want — and only when one genuinely leads. Never offer a place the answer did not touch, and never offer one as a way of avoiding an answer.

_CONTEXT IS FACT — The request opens with a block headed TODAY, COMPUTED BY THE APP. It is computed by the app itself, not by you: "cycle" is the phase and cycle day exactly as the app's own calendar prints them, and "resolved.today" / "resolved.tomorrow" are what actually occurs on those two days, with every repeat rule already worked out. Use them as given. Never recompute a phase or a cycle day from a start date, never work out a repeat yourself, and never say nothing places her in a phase when that block names one. It is sent whole on every request and is never trimmed, so if "cycle" is null there it is genuinely unset in her settings — say that plainly, and never say the reading failed to reach you.

OUTPUT — Return JSON and nothing else, in exactly this shape:
{"answer":"...","lines":[{"label":"...","detail":"..."}],"options":[{"label":"...","go":"...","recommended":false}],"sources":[{"source":"Section · what","detail":"count or date"}],"outOfRange":false}

  answer     The settled thing, in one or two sentences. Never a preamble, never a restatement of the question, never "Tomorrow is Tuesday, so…".
  lines      Optional, and only for a set. label is a short mono tag — a weekday, a time, a slot, a name — of at most 14 characters. detail is one short phrase. At most eight.
  options    Zero, one or two. go must be one of the ids listed above and nothing else. Most answers have none.
  sources    Zero, one or two. Where the answer was found, not what it said: "Nutrition · breakfast" with "9 items". Never a restatement of the answer, never a list of the items themselves. detail is at most 24 characters. If one source covers it, send one. If the answer is about her whole day, send none.
  outOfRange true only when the answer reports a measured figure that falls outside a printed reference range. Never for anything else.

The planner data is a JSON object of her stored planner (keys are prefixed "mos:"). Interpret it sensibly: activities carry a type (protocol=a practice, meal_item=food, supplement, event=appointment), a category (which pillar), a frequency, a time of day (details.slot), and completions (dates she checked it done). Diet foods carry a time-of-day slot and a 7-day pattern (Monday-first) where true = eaten that day. Goals carry milestones and a phase.`

function parseAnswer(raw) {
  if (!raw) return { answer: null, lines: [], options: [], sources: [], outOfRange: false }
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      const o = JSON.parse(raw.slice(start, end + 1))
      const answer = typeof o.answer === 'string' ? o.answer.trim() : ''
      // Two at most, and short enough that a row cannot wrap into the one
      // below it. The model will pad to whatever ceiling it is given, so the
      // ceiling is the fix.
      const sources = Array.isArray(o.sources)
        ? o.sources
          .filter((s) => s && typeof s.source === 'string' && s.source.trim())
          .slice(0, 2)
          .map((s) => ({ source: String(s.source).trim().slice(0, 40), detail: String(s.detail || '').trim().slice(0, 24) }))
        : []
      // Only ids the app can actually navigate to. A label pointing nowhere is
      // worse than no option at all.
      const GO = new Set(['today', 'dream', 'mindset', 'brainhealth', 'skincare', 'haircare', 'aesthetics',
        'bodycare', 'fitness', 'menu', 'workout', 'diagnostics', 'relationship', 'spirituality'])
      let seenRecommended = false
      const options = Array.isArray(o.options)
        ? o.options
          .filter((x) => x && typeof x.label === 'string' && x.label.trim() && GO.has(x.go))
          .slice(0, 2)
          .map((x) => {
            const rec = x.recommended === true && !seenRecommended
            if (rec) seenRecommended = true
            return { label: String(x.label).trim().slice(0, 52), go: x.go, recommended: rec }
          })
        : []
      const lines = Array.isArray(o.lines)
        ? o.lines
          .filter((l) => l && (l.detail || l.label))
          .slice(0, 8)
          .map((l) => ({ label: String(l.label || '').trim().slice(0, 14), detail: String(l.detail || '').trim().slice(0, 90) }))
        : []
      if (answer) return { answer, lines, options, sources, outOfRange: o.outOfRange === true }
    } catch (_) { /* fall through to the plain text */ }
  }
  return { answer: raw, lines: [], options: [], sources: [], outOfRange: false }
}

// ── Getting the record into the request without losing the part that matters.
//
// This used to be one JSON.stringify of the whole planner, sliced at 90,000
// characters. Two things were wrong with that, and both of them were silent.
//
// _context — the cycle phase the app itself computes, and today and tomorrow
// with every repeat rule already resolved — is written last by the snapshot,
// so stringify puts it at the END of the string. Any planner past the limit
// therefore had exactly that part cut off, every time. Ask answered "nothing
// places you in a phase" while the calendar two taps away printed LUTEAL DAY
// 23, and it was right to: it had never been sent.
//
// And a JSON string cut in half is not JSON. Everything past the cut arrived
// as a broken object for the model to guess at.
//
// So: the context is sent first, whole, and is never subject to the budget.
// The bulk is trimmed by dropping whole stores — largest first — so what
// arrives is always valid, and the answer is told which sections it is
// missing rather than being left to wonder.
const BUDGET = 160000

const size = (v) => { try { return JSON.stringify(v).length } catch (_) { return 0 } }

function splitPlanner(raw) {
  const planner = raw && typeof raw === 'object' ? raw : {}
  const context = planner._context || {}
  const rest = {}
  Object.keys(planner).forEach((k) => { if (k !== '_context') rest[k] = planner[k] })

  let json = ''
  try { json = JSON.stringify(rest) } catch (_) { return { context: '{}', stores: '{}', dropped: [] } }
  const dropped = []
  if (json.length > BUDGET) {
    const bySize = Object.keys(rest).map((k) => [k, size(rest[k])]).sort((a, b) => b[1] - a[1])
    const kept = { ...rest }
    for (const [k] of bySize) {
      delete kept[k]
      dropped.push(k)
      json = JSON.stringify(kept)
      if (json.length <= BUDGET) break
    }
  }
  let ctx = '{}'
  try { ctx = JSON.stringify(context) } catch (_) { ctx = '{}' }
  return { context: ctx, stores: json, dropped }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { res.status(200).json({ answer: null, source: 'none' }); return }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const question = (body.question || '').toString().slice(0, 800)
    if (!question.trim()) { res.status(200).json({ answer: null, source: 'empty-input' }); return }
    const { context, stores, dropped } = splitPlanner(body.planner)

    const client = new Anthropic({ apiKey })
    const user = [
      'TODAY, COMPUTED BY THE APP. This is authoritative — it is the same code that draws her calendar. Never recompute any of it.',
      context,
      '',
      'PLANNER DATA (JSON):',
      stores,
      dropped.length ? `\nNot sent, for length: ${dropped.join(', ')}. If the question needs one of these, say that section was not loaded.` : '',
      '',
      `Melissa asks: ${question}`,
    ].join('\n')

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
