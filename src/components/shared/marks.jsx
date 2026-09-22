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
//
// The set, as it is drawn in the brand guidelines. Numbered there 01–12, in
// that order, and this file is the transcription — not an interpretation of it.
// Where the old drawings and the guidelines disagreed, the guidelines won:
// Fitness was a barbell and is a triangle; Nutrition was a halved circle and is
// a bowl; Spirituality was a solid triangle and is an eight-pointed star;
// Testing was a thermometer and is a vial; Skincare was a slashed circle and is
// a bead on its stalk; Haircare leaned and now stands straight.
//
// Hormones keeps the Cycle mark, which is what the guidelines have for 09.

// 01 — a circle, halved on the horizon.
export const MindsetMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><path d="M4.5 12h15" /></Mark>
// 02 — a circle within a circle, and a centre held.
export const BrainHealthMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3.25" /><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" /></Mark>
// 03 — a bead on its stalk.
export const SkincareMark = (p) => <Mark {...p}><circle cx="12" cy="13" r="6.5" /><path d="M12 6.5v-3" /></Mark>
// 04 — three strands, standing.
export const HaircareMark = (p) => <Mark {...p}><path d="M7.5 5v14M12 5v14M16.5 5v14" /></Mark>
// 05 — the square, turned.
export const AestheticsMark = (p) => <Mark {...p}><path d="M12 4.5 19.5 12 12 19.5 4.5 12Z" /></Mark>
// 06 — the axis through the body.
export const BodycareMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="6" /><path d="M12 3.5v17" /></Mark>
// 07 — the triangle, on its base.
export const FitnessMark = (p) => <Mark {...p}><path d="M12 5 19.5 19H4.5Z" /></Mark>
// 08 — the bowl.
export const NutritionMark = (p) => <Mark {...p}><path d="M4.5 9.5h15" /><path d="M19.5 9.5a7.5 7.5 0 0 1-15 0" /></Mark>
// 09 — the quarter taken out of the round.
export const CycleMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><path d="M12 4.5v7.5h7.5" /></Mark>
// 10 — the vial.
export const TestingMark = (p) => <Mark {...p}><path d="M9.5 4.5h5v12.5a2.5 2.5 0 0 1-5 0Z" /><path d="M9.5 8.5h5" /></Mark>
// 11 — two rounds, overlapping.
export const RelationshipsMark = (p) => <Mark {...p}><circle cx="9.5" cy="12" r="5.5" /><circle cx="14.5" cy="12" r="5.5" /></Mark>
// 12 — eight rays from one point.
export const SpiritualityMark = (p) => <Mark {...p}><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" /></Mark>

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

// ── The house mark ──────────────────────────────────────────────────
//
// A ruled square with one letter set inside it, straight off the brand
// guidelines page: the O in Bodoni, at 0.32 of the square's height, optically
// centred. It is not an SVG because the letter is the typeface — drawing it as
// a path would be a copy of the mark rather than the mark.
//
// It stands where the index used to spell out PILLARS OF HEALTH. A title that
// names the thing you are already looking at is a caption; a mark is a door.
// Under the pointer the whole mark goes to the accent and the letter reverses
// out of it — the square fills, the O takes the ground. Fading the mark to 60%
// was the generic hover every element in every interface has; a mark that
// inverts is the mark doing something only it can do. Put `group` on whatever
// wraps it.
export function HouseMark({ size = 104, className = '', title }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border border-stone-900 transition-colors duration-200 group-hover:border-cobalt group-hover:bg-cobalt ${className}`}
      style={{ width: size, height: size }}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <span
        className="font-serif leading-none text-stone-900 transition-colors duration-200 group-hover:text-cream"
        style={{ fontSize: Math.round(size * 0.46), letterSpacing: 0 }}
      >
        O
      </span>
    </span>
  )
}

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
// The signifier on a picture that can be replaced. Small enough to sit in the
// corner of a thumbnail without covering what it is pointing at.
export const EditIcon = (p) => <Mark {...p}><path d="M4.5 19.5l1-4 9.5-9.5 3 3-9.5 9.5Z" /><path d="M15 6l2-2 3 3-2 2" /></Mark>
export const LockedIcon = (p) => <Mark {...p}><path d="M6.5 11v-2.5a5.5 5.5 0 0 1 11 0V11" /><path d="M4.5 11h15v8.5h-15Z" /></Mark>

// The readings of a set of goals. Each is a picture of the layout it opens —
// three uprights, a grid, three rules — so the row reads at a glance the way a
// clutch of icons on a toolbar should. The filter is the funnel every reader
// already knows, drawn on the half-unit grid.
export const ColumnsIcon = (p) => <Mark {...p}><path d="M4.5 5v14M12 5v14M19.5 5v14" /></Mark>
export const WallIcon = (p) => <Mark {...p}><path d="M4.5 4.5h6.5v6.5H4.5ZM13 4.5h6.5v6.5H13ZM4.5 13h6.5v6.5H4.5ZM13 13h6.5v6.5H13Z" /></Mark>
export const ListIcon = (p) => <Mark {...p}><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></Mark>
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
