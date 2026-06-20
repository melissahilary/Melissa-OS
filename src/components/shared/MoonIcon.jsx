import React from 'react'

// Geometric cream/ink moon glyphs for the 8 phases. No emoji.
// `index` 0..7 maps to New → Waning Crescent.
export default function MoonIcon({ index = 0, size = 16, ink = '#1C1917', light = '#FAFAF7' }) {
  const r = size / 2
  const c = r
  const ring = <circle cx={c} cy={c} r={r - 0.75} fill="none" stroke={ink} strokeWidth="1" />

  // Helper for the lit portion via two arcs / ellipse masking.
  const body = () => {
    switch (index) {
      case 0: // New
        return <circle cx={c} cy={c} r={r - 0.75} fill={ink} />
      case 4: // Full
        return <circle cx={c} cy={c} r={r - 0.75} fill={ink} />
      case 2: // First quarter — right half lit (ink right)
        return <path d={`M ${c} ${0.75} A ${r - 0.75} ${r - 0.75} 0 0 1 ${c} ${size - 0.75} Z`} fill={ink} />
      case 6: // Last quarter — left half lit (ink left)
        return <path d={`M ${c} ${0.75} A ${r - 0.75} ${r - 0.75} 0 0 0 ${c} ${size - 0.75} Z`} fill={ink} />
      case 1: // Waxing crescent — small ink sliver on the right
        return (
          <>
            <path d={`M ${c} ${0.75} A ${r - 0.75} ${r - 0.75} 0 0 1 ${c} ${size - 0.75} Z`} fill={ink} />
            <ellipse cx={c} cy={c} rx={(r - 0.75) * 0.55} ry={r - 0.75} fill={light} />
          </>
        )
      case 3: // Waxing gibbous — mostly ink, light sliver left
        return (
          <>
            <circle cx={c} cy={c} r={r - 0.75} fill={ink} />
            <path d={`M ${c} ${0.75} A ${r - 0.75} ${r - 0.75} 0 0 0 ${c} ${size - 0.75} Z`} fill={light} />
            <ellipse cx={c} cy={c} rx={(r - 0.75) * 0.55} ry={r - 0.75} fill={ink} />
          </>
        )
      case 5: // Waning gibbous — mostly ink, light sliver right
        return (
          <>
            <circle cx={c} cy={c} r={r - 0.75} fill={ink} />
            <path d={`M ${c} ${0.75} A ${r - 0.75} ${r - 0.75} 0 0 1 ${c} ${size - 0.75} Z`} fill={light} />
            <ellipse cx={c} cy={c} rx={(r - 0.75) * 0.55} ry={r - 0.75} fill={ink} />
          </>
        )
      case 7: // Waning crescent — small ink sliver on the left
        return (
          <>
            <path d={`M ${c} ${0.75} A ${r - 0.75} ${r - 0.75} 0 0 0 ${c} ${size - 0.75} Z`} fill={ink} />
            <ellipse cx={c} cy={c} rx={(r - 0.75) * 0.55} ry={r - 0.75} fill={light} />
          </>
        )
      default:
        return null
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r - 0.75} fill={light} />
      {body()}
      {ring}
    </svg>
  )
}
