import React from 'react'

// ── The marks.
//
// The only proprietary drawing in the system. Every one is built on a 24-unit
// square from the same three primitives — a circle, a line and a diagonal — so
// the set reads as one hand. They name a section; they never illustrate a
// feeling. No faces, no leaves, no hearts, no droplets.
//
// Construction: 24 × 24 box with 1.5 units of optical padding. Butt terminals,
// mitred joins, no corner radius. Outline only, at every size, in every mode —
// a filled mark reads as a button. Drawn on the half-unit grid; no free curves.

// Stroke tracks the size: 1 at 16, 1.25 at 24, 1.5 at 32.
const strokeFor = (size) => (size <= 16 ? 1 : size >= 32 ? 1.5 : 1.25)

// Four sizes. Nothing between, nothing above.
const SIZES = [16, 20, 24, 32]
const snap = (size) => SIZES.reduce((a, b) => (Math.abs(b - size) < Math.abs(a - size) ? b : a), 24)

function Mark({ size = 24, title, children, className = '', ...rest }) {
  const s = snap(size)
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeFor(s)}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      {...rest}
    >
      {children}
    </svg>
  )
}

// ── The twelve ──────────────────────────────────────────────────────
// Each is a circle, a line, a diagonal, or a disciplined combination.

export const MindsetMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><path d="M4.5 12h15" /></Mark>
export const BrainHealthMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3" /></Mark>
export const SkincareMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><path d="M6.5 17.5 17.5 6.5" /></Mark>
export const HaircareMark = (p) => <Mark {...p}><path d="M5 19 12 5M10 19 17 5M15 19 19 11" /></Mark>
export const AestheticsMark = (p) => <Mark {...p}><path d="M12 4.5 19.5 12 12 19.5 4.5 12Z" /></Mark>
export const BodycareMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><path d="M4.5 12h15M12 4.5v15" /></Mark>
export const FitnessMark = (p) => <Mark {...p}><path d="M4.5 12h15M6.5 6.5v11M17.5 6.5v11" /></Mark>
export const NutritionMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><path d="M12 4.5v15" /></Mark>
export const CycleMark = (p) => <Mark {...p}><path d="M19.5 12a7.5 7.5 0 1 1-4-6.6" /><path d="M19.5 4.5v5.5H14" /></Mark>
export const TestingMark = (p) => <Mark {...p}><path d="M9.5 4.5h5M12 4.5v9" /><circle cx="12" cy="16" r="3.5" /></Mark>
export const RelationshipsMark = (p) => <Mark {...p}><circle cx="9" cy="12" r="5.5" /><circle cx="15" cy="12" r="5.5" /></Mark>
export const SpiritualityMark = (p) => <Mark {...p}><path d="M12 4.5 19.5 19.5H4.5Z" /></Mark>

export const PILLAR_MARKS = {
  mindset: MindsetMark,
  brainhealth: BrainHealthMark,
  skincare: SkincareMark,
  haircare: HaircareMark,
  aesthetics: AestheticsMark,
  bodycare: BodycareMark,
  fitness: FitnessMark,
  menu: NutritionMark,
  nutrition: NutritionMark,
  workout: CycleMark,
  hormones: CycleMark,
  diagnostics: TestingMark,
  relationship: RelationshipsMark,
  relationships: RelationshipsMark,
  spirituality: SpiritualityMark,
}
export const markFor = (id) => PILLAR_MARKS[id] || MindsetMark

// ── The utility set ─────────────────────────────────────────────────
// Everything that is not a pillar mark, drawn to the same rules so a borrowed
// icon dropped in beside them is visible immediately. None of these carry a
// meaning that is not also in words.

export const AddIcon = (p) => <Mark {...p}><path d="M12 5v14M5 12h14" /></Mark>
export const CloseIcon = (p) => <Mark {...p}><path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" /></Mark>
export const LoggedIcon = (p) => <Mark {...p}><path d="M5 12.5 10 17.5 19 6.5" /></Mark>
export const DueIcon = (p) => <Mark {...p}><circle cx="12" cy="12" r="3.5" /></Mark>
export const NextIcon = (p) => <Mark {...p}><path d="M9 5.5 16 12l-7 6.5" /></Mark>
export const PrevIcon = (p) => <Mark {...p}><path d="M15 5.5 8 12l7 6.5" /></Mark>
export const ExportIcon = (p) => <Mark {...p}><path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><path d="M4.5 14.5v5h15v-5" /></Mark>
export const LockedIcon = (p) => <Mark {...p}><path d="M6.5 11v-2.5a5.5 5.5 0 0 1 11 0V11" /><path d="M4.5 11h15v8.5h-15Z" /></Mark>

// The readings of a set of goals. Each is a picture of the layout it opens —
// three uprights, a grid, three rules, a line with a mark on it — so the row
// reads at a glance the way a clutch of icons on a toolbar should. The filter
// is the funnel every reader already knows, drawn on the half-unit grid.
export const ColumnsIcon = (p) => <Mark {...p}><path d="M4.5 5v14M12 5v14M19.5 5v14" /></Mark>
export const WallIcon = (p) => <Mark {...p}><path d="M4.5 4.5h6.5v6.5H4.5ZM13 4.5h6.5v6.5H13ZM4.5 13h6.5v6.5H4.5ZM13 13h6.5v6.5H13Z" /></Mark>
export const ListIcon = (p) => <Mark {...p}><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></Mark>
export const TimelineIcon = (p) => <Mark {...p}><path d="M4.5 12h15" /><circle cx="9" cy="12" r="2.5" /><circle cx="16" cy="12" r="2.5" /></Mark>
export const FilterIcon = (p) => <Mark {...p}><path d="M4.5 5.5h15L14 12.5v6l-4-2v-4Z" /></Mark>

// The live microphone is perceivable without colour: the mark fills, a hairline
// ring appears around it, and the field says RECORDING in mono. Never colour
// alone — this is a privacy requirement, not a preference.
export function MicIcon({ size = 24, live = false, ...rest }) {
  const s = snap(size)
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeFor(s)}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden
      {...rest}
    >
      <path d="M9 4.5h6v9H9Z" fill={live ? 'currentColor' : 'none'} />
      <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v2" />
      {live && <circle cx="12" cy="12" r="11" strokeWidth={0.75} opacity="0.55" />}
    </svg>
  )
}

export default Mark
