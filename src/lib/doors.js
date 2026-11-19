// Tag doors. A term matches a whole word. A term ending in * is a stem:
// it must start at a word boundary and may continue (`ovulat*` → ovulation).
// A stem never matches a word that merely contains those letters.

function termToRegExp(term) {
  const stem = term.endsWith('*')
  const word = stem ? term.slice(0, -1) : term
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(stem ? `\\b${esc}\\w*` : `\\b${esc}\\b`, 'i')
}

export function termMatches(text, term) {
  return termToRegExp(term).test(String(text || ''))
}

export const DOORS = [
  { terms: ['eat', 'eating', 'meal', 'diet', 'food', 'dinner', 'lunch', 'breakfast', 'menu'], label: 'The table', page: 'menu', sub: 'diet' },
  { terms: ['supplement', 'vitamin', 'capsule', 'stack', 'magnesium', 'omega'], label: 'Supplements', page: 'menu', sub: 'supplements' },
  { terms: ['recipe', 'cook'], label: 'Recipes', page: 'menu', sub: 'recipes' },
  { terms: ['goal', 'milestone', 'dream', 'project'], label: 'Dream planning', page: 'dream', sub: '' },
  { terms: ['week', 'today', 'schedule', 'appointment', 'calendar', 'agenda'], label: 'Today', page: 'today', sub: '' },
  { terms: ['skin', 'skincare', 'serum', 'retinol', 'spf'], label: 'Skincare', page: 'skincare', sub: 'schedule' },
  { terms: ['hair', 'haircare'], label: 'Haircare', page: 'haircare', sub: 'schedule' },
  { terms: ['cycle', 'period', 'phase', 'phases', 'hormone', 'hormones', 'ovulat*', 'luteal', 'menopause', 'pregnan*'], label: 'My body', page: 'workout', sub: 'cycle' },
  { terms: ['workout', 'training', 'train', 'gym', 'pilates', 'lift', 'fitness'], label: 'Fitness', page: 'fitness', sub: 'schedule' },
  { terms: ['shop', 'shopping', 'grocery', 'buy', 'buying'], label: 'Grocery', page: 'menu', sub: 'grocery' },
]

export function doorsFor(row) {
  const text = `${row && row.q ? row.q : ''} ${row && row.a ? row.a : ''}`
  const out = []
  for (const d of DOORS) {
    if (d.terms.some((t) => termMatches(text, t)) && !out.some((x) => x.label === d.label)) out.push(d)
  }
  return out.slice(0, 3)
}
