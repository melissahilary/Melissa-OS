import React from 'react'

// ── One way to say how often, everywhere in the house. The Repeat control on an
// event, the cadence on a routine step and the replace-rhythm on a product all
// speak this same vocabulary, so "Bi-weekly" means the same thing and looks the
// same wherever it's chosen.

export const PATTERNS = [
  { id: 'once', label: 'Does not repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekends', label: 'Weekends' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Bi-weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
  { id: 'asneeded', label: 'As needed' },
]

export const UNITS = [
  { id: 'day', label: 'days' },
  { id: 'week', label: 'weeks' },
  { id: 'month', label: 'months' },
  { id: 'quarter', label: 'quarters' },
  { id: 'year', label: 'years' },
]

// What a chosen cadence reads as in a list.
export const cadenceLabel = (c) => {
  if (!c) return ''
  if (typeof c === 'string') return c // a cadence typed in freehand, before this control existed
  const { pattern, interval, unit } = c
  if (!pattern) return ''
  if (pattern === 'custom') {
    const n = Math.max(1, Number(interval) || 1)
    const u = (UNITS.find((x) => x.id === (unit || 'week')) || UNITS[1]).label
    return `Every ${n} ${n === 1 ? u.replace(/s$/, '') : u}`
  }
  return (PATTERNS.find((p) => p.id === pattern) || {}).label || ''
}

// Read whatever is stored — a legacy string or a structured cadence.
export const normCadence = (c) =>
  c && typeof c === 'object'
    ? { pattern: c.pattern || '', interval: c.interval || 2, unit: c.unit || 'week' }
    : { pattern: '', interval: 2, unit: 'week', legacy: typeof c === 'string' ? c : '' }

export default function CadencePicker({ value, onChange, options = PATTERNS, allowClear = true }) {
  const c = normCadence(value)
  const set = (patch) => onChange({ pattern: c.pattern, interval: c.interval, unit: c.unit, ...patch })
  const chip = (on) => `rounded-full px-3.5 py-1.5 text-xs transition-colors ${on ? 'bg-stone-900 text-cream' : 'border border-stone-300 text-stone-600 hover:border-stone-500'}`
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => set({ pattern: allowClear && c.pattern === p.id ? '' : p.id })}
            className={chip(c.pattern === p.id)}
          >{p.label}</button>
        ))}
      </div>
      {c.pattern === 'custom' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-stone-600">
          <span>Every</span>
          <input
            type="number"
            min="1"
            value={c.interval}
            onChange={(e) => set({ interval: Math.max(1, Number(e.target.value) || 1) })}
            className="w-16 border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900"
          />
          <select
            value={c.unit}
            onChange={(e) => set({ unit: e.target.value })}
            className="border-b border-stone-300 bg-transparent pb-1 text-sm outline-none focus:border-stone-900"
          >
            {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
