// ── The twelve pillars.
//
// The index the whole product is organised by. It lives here rather than in
// the nav so anything that files something under a pillar — a reminder, a
// task, a row in a routine — names it from one place.
export const PILLARS = [
  { id: 'mindset', label: 'Mindset' },
  { id: 'brainhealth', label: 'Brain Health' },
  { id: 'skincare', label: 'Skincare' },
  { id: 'haircare', label: 'Haircare' },
  { id: 'aesthetics', label: 'Aesthetics' },
  { id: 'bodycare', label: 'Bodycare' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'menu', label: 'Nutrition' },
  { id: 'workout', label: 'Hormones' },
  { id: 'diagnostics', label: 'Testing' },
  { id: 'relationship', label: 'Relationships' },
  { id: 'spirituality', label: 'Spirituality' },
]

export const pillarLabel = (id) => (PILLARS.find((p) => p.id === id) || {}).label || ''

export default PILLARS
