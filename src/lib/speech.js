// ── Speaking to the planner.
//
// The tax every planner has failed on is that you have to feed it by hand. This
// is the other way in: the browser's own speech engine listens, and what she
// says lands in whatever field she's standing in — no upload step of ours, no
// key to hold, no round trip. (The recognition itself runs through the
// platform's speech service, the same one the OS keyboard uses.)

const Engine = () => {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export const speechSupported = () => !!Engine()

// Spoken structure. Deliberately two commands, not twenty — the engine already
// punctuates, and a long command list is something to remember rather than a
// thing that helps.
const SPOKEN = [
  [/\bnew paragraph\b/gi, '\n\n'],
  [/\bnew line\b/gi, '\n'],
]

// Speech arrives as a lowercase run. `fresh` says whether she's starting a
// sentence or continuing one she already typed — continuing must not capitalise.
export function tidy(text, { fresh = true } = {}) {
  let t = String(text || '')
  SPOKEN.forEach(([re, to]) => { t = t.replace(re, to) })
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n')
  // after a full stop, and after a line break, a new sentence begins
  t = t.replace(/([.!?]\s+|\n+)([a-z])/g, (_m, lead, c) => lead + c.toUpperCase())
  if (fresh) t = t.replace(/^(\s*)([a-z])/, (_m, sp, c) => sp + c.toUpperCase())
  return t
}

// Join two runs of speech without doubling or swallowing the space between.
const join = (a, b) => {
  if (!a) return b
  if (!b) return a
  return /[\s\n]$/.test(a) || /^[\s\n]/.test(b) ? a + b : `${a} ${b}`
}

// A listening session. `onText` receives the whole utterance every time — final
// words plus whatever is still being heard — so the caller never has to stitch.
export function createListener({ lang = 'en-US', onText, onState, onError } = {}) {
  const Recognition = Engine()
  if (!Recognition) return null

  let rec = null
  let wanted = false
  let settled = ''
  let restarts = 0
  let restartTimer = null

  function build() {
    const r = new Recognition()
    r.lang = lang
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) settled = join(settled, chunk.trim())
        else interim = join(interim, chunk.trim())
      }
      restarts = 0 // words arriving means the engine is healthy
      if (onText) onText(join(settled, interim))
    }

    r.onerror = (e) => {
      // Silence and self-restarts are the engine idling, not a failure to report.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      wanted = false
      const denied = e.error === 'not-allowed' || e.error === 'service-not-allowed'
      if (onError) onError(denied ? 'Microphone is blocked for this site.' : 'Dictation stopped.')
      if (onState) onState(false)
    }

    r.onend = () => {
      // Chrome ends the session at every pause and Safari after every sentence,
      // so staying listening means restarting — but never in a tight loop.
      if (!wanted) { if (onState) onState(false); return }
      if (restarts > 6) { wanted = false; if (onState) onState(false); return }
      restarts += 1
      restartTimer = setTimeout(() => { try { r.start() } catch { /* already running */ } }, 120)
    }

    return r
  }

  return {
    start() {
      if (wanted) return
      settled = ''
      restarts = 0
      wanted = true
      rec = build()
      try {
        rec.start()
        if (onState) onState(true)
      } catch {
        wanted = false
        if (onState) onState(false)
      }
    },
    stop() {
      wanted = false
      clearTimeout(restartTimer)
      if (rec) { try { rec.stop() } catch { /* nothing running */ } }
      if (onState) onState(false)
    },
  }
}
