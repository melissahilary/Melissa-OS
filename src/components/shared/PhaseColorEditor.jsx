import React, { useEffect, useState } from 'react'
import { CloseIcon, LoggedIcon } from './marks'
import { PHASES, DEFAULT_PHASE_TINT } from '../../lib/cycle'

// A curated set of muted, editorial calendar washes — warm clays, blush, sand,
// sage, mist, slate, lilac, greige. Any phase can be assigned any of these; no
// hex typing or OS colour dial, just tap a swatch.
const WASHES = [
  '#A0654C', '#B07A5F', '#8C5A46', '#9E6A55',
  '#889072', '#7E8768', '#96A084', '#727C5E',
  '#C4A76A', '#CBB27C', '#B79A5E', '#A8894F',
  '#8E8074', '#9C8E82', '#7E7268', '#A39387',
]

export default function PhaseColorEditor({ phaseId, value, onSave, onReset, onClose }) {
  const preset = DEFAULT_PHASE_TINT[phaseId]
  const label = (PHASES[phaseId] && PHASES[phaseId].name) || phaseId
  const [sel, setSel] = useState(value || preset)
  // Always show the current colour, even if it isn't one of the presets.
  const swatches = WASHES.includes(sel) ? WASHES : [sel, ...WASHES]

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-16 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-sm border border-stone-300 bg-cream shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <span className="kicker text-stone-400">Recolour · {label}</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><CloseIcon size={18} /></button>
        </div>

        <div className="px-5 py-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-11 w-11 shrink-0 rounded-full border border-black/5" style={{ backgroundColor: sel }} />
            <div>
              <p className="font-serif text-lg text-stone-900">{label}</p>
              <p className="text-xs text-stone-400">Appears on every month calendar.</p>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2.5">
            {swatches.map((c) => {
              const on = c.toLowerCase() === sel.toLowerCase()
              return (
                <button
                  key={c}
                  onClick={() => setSel(c)}
                  title={c}
                  className={`flex aspect-square items-center justify-center rounded-full border transition-transform hover:scale-110 ${on ? 'border-stone-900' : 'border-black/10'}`}
                  style={{ backgroundColor: c }}
                >
                  {on && <LoggedIcon size={14} className="text-stone-700" strokeWidth={2.5} />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
          <button onClick={() => { onReset(); onClose() }} className="text-sm text-stone-400 hover:text-stone-700">Reset to default</button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button onClick={() => { onSave(sel); onClose() }} className="bg-stone-900 px-5 py-2 text-sm text-cream hover:bg-stone-700">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
