import React from 'react'
import { Check } from 'lucide-react'

// App-wide checkbox: always an empty bordered square; when checked, a thin ink
// tick appears inside — the box itself is never filled or colored.
export default function Checkbox({ checked, onClick, size = 16, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center border border-stone-400 bg-transparent ${className}`}
      style={{ width: size, height: size }}
      aria-pressed={!!checked}
    >
      {checked && <Check size={Math.max(10, size - 4)} strokeWidth={1.75} style={{ color: '#1C1C1A' }} />}
    </button>
  )
}
