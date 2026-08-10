import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { PHASES, DEFAULT_PHASE_TINT } from '../../lib/cycle'

const isHex = (s) => /^#([0-9a-f]{6})$/i.test(s)
const norm = (s) => {
  let v = (s || '').trim()
  if (v && v[0] !== '#') v = `#${v}`
  return v.toLowerCase()
}

// A small modal to recolour one cycle phase: pick the app's preset, type a hex,
// or use the colour dial. Save commits it; it then reflects on every calendar.
export default function PhaseColorEditor({ phaseId, value, onSave, onReset, onClose }) {
  const preset = DEFAULT_PHASE_TINT[phaseId]
  const label = (PHASES[phaseId] && PHASES[phaseId].name) || phaseId
  const [hex, setHex] = useState(value || preset)
  const valid = isHex(hex)

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  const save = () => { if (valid) { onSave(hex); onClose() } }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm border border-stone-300 bg-cream shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <span className="kicker text-stone-400">Recolour · {label}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Live preview */}
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 shrink-0 rounded-full border border-black/5" style={{ backgroundColor: valid ? hex : preset }} />
            <div>
              <p className="font-serif text-lg text-stone-900">{label}</p>
              <p className="text-xs text-stone-400">This wash appears on every month calendar.</p>
            </div>
          </div>

          {/* Colour dial + hex, side by side */}
          <div className="flex items-end gap-3">
            <label className="flex flex-col items-center gap-1">
              <span className="kicker text-stone-400">Dial</span>
              <input
                type="color"
                value={valid ? hex : preset}
                onChange={(e) => setHex(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-stone-300 bg-transparent p-0.5"
              />
            </label>
            <label className="flex-1">
              <span className="kicker mb-1 block text-stone-400">Hex</span>
              <input
                value={hex}
                onChange={(e) => setHex(norm(e.target.value))}
                placeholder="#E6D2CB"
                spellCheck={false}
                className={`w-full border-b bg-transparent pb-1.5 font-mono text-sm uppercase outline-none ${valid ? 'border-stone-300 text-stone-800 focus:border-stone-900' : 'border-phase-menstrual text-stone-800'}`}
              />
            </label>
          </div>

          {/* App preset */}
          <button
            onClick={() => setHex(preset)}
            className="flex w-full items-center gap-2.5 border border-stone-200 px-3 py-2 text-left text-sm text-stone-600 transition-colors hover:border-stone-400"
          >
            <span className="h-5 w-5 shrink-0 rounded-full border border-black/5" style={{ backgroundColor: preset }} />
            Use the app preset
            <span className="ml-auto font-mono text-xs uppercase text-stone-400">{preset}</span>
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
          <button onClick={() => { onReset(); onClose() }} className="text-sm text-stone-400 hover:text-stone-700">Reset</button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button onClick={save} disabled={!valid} className={`px-5 py-2 text-sm text-cream ${valid ? 'bg-stone-900 hover:bg-stone-700' : 'cursor-not-allowed bg-stone-300'}`}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
