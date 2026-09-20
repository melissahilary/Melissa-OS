// ── The buttons, as the guidelines have them.
//
// The stylesheet already does most of the work: every pill in the house is
// squared, set in mono, upper case and tracked, and a filled `bg-stone-900`
// pill is repainted cobalt. What a stylesheet cannot fix is a component
// reaching for a different size and a different hover each time it needs a
// button — which is how Settings ended up with five button sizes, and with
// cobalt buttons that turned brown under the cursor, because each one carried
// `hover:bg-stone-700` and painted over the accent the stylesheet had just
// applied.
//
// So the sizes live here rather than in two hundred call sites. There are two
// of them, and two exceptions.

// The one action on a screen. It is cobalt, because the stylesheet makes it so
// — which is also why it must never carry a background on hover. Opacity is the
// only thing allowed to move.
export const BTN = 'inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-cream transition-opacity hover:opacity-90'
// The same button where a row cannot carry the full one.
export const BTN_SM = 'inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 text-sm text-cream transition-opacity hover:opacity-90'

// Everything that is not the one action: a hairline and ink. Never a second
// filled button on the same screen.
export const GHOST = 'inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm text-stone-900 transition-colors hover:border-stone-900'
export const GHOST_SM = 'inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-900 transition-colors hover:border-stone-900'

// Cancelling, dismissing, signing out. A verb with nothing drawn round it, so
// it cannot be mistaken for the thing the screen is for.
export const QUIET = 'inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900'

// Destructive, and only destructive. Oxblood rather than a cycle colour: the
// phase palette means a phase and nothing else, so a delete button wearing
// menstrual brown was spending a colour that already has a job.
export const DANGER = 'inline-flex items-center gap-2 rounded-full border border-oxblood/40 px-4 py-2 text-sm text-oxblood transition-colors hover:bg-oxblood/5'
export const DANGER_SOLID = 'inline-flex items-center gap-2 rounded-full bg-oxblood px-4 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:border disabled:border-stone-200 disabled:bg-transparent disabled:text-stone-400'

// A state, not an action: a squared tag in mono, the same treatment a kicker
// gets. It is a span, so the stylesheet leaves its shape alone — which is why
// it must not borrow the pill's class and pretend to be a button.
export const TAG = 'inline-block bg-stone-900 px-2.5 py-1 text-[10px] tracking-[0.14em] text-cream'
export const TAG_QUIET = 'inline-block bg-stone-500/5 px-2.5 py-1 text-[10px] tracking-[0.14em] text-stone-500'

// A field. The house writes on a ruled line, not in a box — a bordered input
// is a second rectangle competing with the card it sits in, and the stylesheet
// squares it anyway, so a pill-shaped field only ever looked like a mistake.
export const FIELD = 'w-full bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none transition-colors focus:border-stone-900 placeholder:text-stone-400'

// A chip is a state, not an action: it says which way a list is filtered. It is
// small, it is ruled, and when it is on it fills — which the stylesheet then
// paints cobalt, so only one set of these belongs on a screen.
export const CHIP = 'rounded-full border px-3.5 py-1 text-xs transition-colors'
export const CHIP_ON = 'border-stone-900 bg-stone-900 text-cream'
export const CHIP_OFF = 'border-stone-200 text-stone-500 hover:border-stone-900'
