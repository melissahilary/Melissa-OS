import React, { useEffect, useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'

const EMPTY = {
  brand: '',
  ingredients: '',
  feelings: { energy: '', digestion: '', mood: '' },
  note: '',
  time: '',
  qty: '',
  cost: '',
  photo: '',
  drink: { temp: '', caffeine: '', sweeteners: '' },
  supp: { brandDose: '', withFood: '', form: '', purpose: [] },
}

function merge(initial) {
  const base = JSON.parse(JSON.stringify(EMPTY))
  if (!initial) return base
  return {
    ...base,
    ...initial,
    feelings: { ...base.feelings, ...(initial.feelings || {}) },
    drink: { ...base.drink, ...(initial.drink || {}) },
    supp: { ...base.supp, ...(initial.supp || {}), purpose: (initial.supp && initial.supp.purpose) || [] },
  }
}

// A row of single-select chips.
function ChipGroup({ label, options, value, onChange }) {
  return (
    <div>
      <p className="kicker text-stone-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? '' : opt)}
              className={`px-2.5 py-1 text-xs border transition-colors ${
                active
                  ? 'bg-stone-900 text-cream border-stone-900'
                  : 'bg-transparent text-stone-600 border-stone-300 hover:border-stone-500'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MultiChipGroup({ label, options, values, onToggle }) {
  return (
    <div>
      <p className="kicker text-stone-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = values.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`px-2.5 py-1 text-xs border transition-colors ${
                active
                  ? 'bg-stone-900 text-cream border-stone-900'
                  : 'bg-transparent text-stone-600 border-stone-300 hover:border-stone-500'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const fieldCls =
  'w-full bg-cream border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-900 transition-colors'

const labelCls = 'kicker text-stone-400 mb-1.5 block'

/**
 * NotesPopup — universal item-detail modal.
 * variant: 'food' | 'drink' | 'supplement' | 'grocery'
 */
export default function NotesPopup({ open, onClose, onSave, itemName, initial, variant = 'food', cyclePhaseLabel }) {
  const [data, setData] = useState(() => merge(initial))
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    if (open) {
      setData(merge(initial))
      setShowMore(false)
    }
  }, [open, initial])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const set = (patch) => setData((d) => ({ ...d, ...patch }))
  const setFeeling = (k, v) => setData((d) => ({ ...d, feelings: { ...d.feelings, [k]: v } }))
  const setDrink = (k, v) => setData((d) => ({ ...d, drink: { ...d.drink, [k]: v } }))
  const setSupp = (k, v) => setData((d) => ({ ...d, supp: { ...d.supp, [k]: v } }))
  const togglePurpose = (p) =>
    setData((d) => {
      const has = d.supp.purpose.includes(p)
      return { ...d, supp: { ...d.supp, purpose: has ? d.supp.purpose.filter((x) => x !== p) : [...d.supp.purpose, p] } }
    })

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set({ photo: reader.result })
    reader.readAsDataURL(file)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl bg-cream border border-stone-300 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <div>
            <p className="kicker text-stone-400 mb-1">
              {variant === 'drink' ? 'Drink notes' : variant === 'supplement' ? 'Supplement notes' : variant === 'grocery' ? 'Item notes' : 'Food notes'}
            </p>
            <h2 className="font-serif italic text-3xl leading-tight text-stone-900">{itemName || 'Untitled'}</h2>
          </div>
          <button type="button" onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Tier 1 */}
          <div>
            <label className={labelCls}>Brand / source</label>
            <input
              className={fieldCls}
              value={data.brand}
              onChange={(e) => set({ brand: e.target.value })}
              placeholder="Where it came from"
            />
          </div>

          <div>
            <label className={labelCls}>Ingredients / what's in it</label>
            <textarea
              className={`${fieldCls} min-h-[64px] resize-y`}
              value={data.ingredients}
              onChange={(e) => set({ ingredients: e.target.value })}
              placeholder="The make-up of it"
            />
          </div>

          <div className="space-y-3">
            <ChipGroup label="Energy" options={['low', 'steady', 'spike', 'crash']} value={data.feelings.energy} onChange={(v) => setFeeling('energy', v)} />
            <ChipGroup label="Digestion" options={['fine', 'bloated', 'heavy', 'great']} value={data.feelings.digestion} onChange={(v) => setFeeling('digestion', v)} />
            <ChipGroup label="Mood" options={['calm', 'anxious', 'clear', 'foggy']} value={data.feelings.mood} onChange={(v) => setFeeling('mood', v)} />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${fieldCls} min-h-[64px] resize-y`}
              value={data.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Anything worth remembering"
            />
          </div>

          {/* Drink-specific */}
          {variant === 'drink' && (
            <div className="space-y-3 border-t border-stone-200 pt-4">
              <ChipGroup label="Temperature" options={['hot', 'iced', 'room temp']} value={data.drink.temp} onChange={(v) => setDrink('temp', v)} />
              <div>
                <label className={labelCls}>Caffeine content (mg)</label>
                <input className={fieldCls} type="number" value={data.drink.caffeine} onChange={(e) => setDrink('caffeine', e.target.value)} placeholder="0" />
              </div>
              <ChipGroup label="Sweeteners used" options={['honey', 'stevia', 'monk fruit', 'none']} value={data.drink.sweeteners} onChange={(v) => setDrink('sweeteners', v)} />
            </div>
          )}

          {/* Supplement-specific */}
          {variant === 'supplement' && (
            <div className="space-y-3 border-t border-stone-200 pt-4">
              <div>
                <label className={labelCls}>Brand + dose</label>
                <input className={fieldCls} value={data.supp.brandDose} onChange={(e) => setSupp('brandDose', e.target.value)} placeholder="Sports Research, 1000mg" />
              </div>
              <ChipGroup label="Taken with food" options={['yes', 'no']} value={data.supp.withFood} onChange={(v) => setSupp('withFood', v)} />
              <ChipGroup label="Form" options={['capsule', 'liquid', 'powder', 'gummy']} value={data.supp.form} onChange={(v) => setSupp('form', v)} />
              <MultiChipGroup label="Purpose" options={['gut', 'sleep', 'hormones', 'iron', 'mood', 'immunity']} values={data.supp.purpose} onToggle={togglePurpose} />
            </div>
          )}

          {/* Tier 2 — collapsible */}
          <div className="border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              className="flex items-center gap-1.5 kicker text-stone-500 hover:text-stone-900 transition-colors"
            >
              {showMore ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              More details
            </button>

            {showMore && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Time consumed</label>
                    <input className={fieldCls} type="time" value={data.time} onChange={(e) => set({ time: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Cost ($)</label>
                    <input className={fieldCls} type="number" value={data.cost} onChange={(e) => set({ cost: e.target.value })} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Quantity / serving size</label>
                  <input className={fieldCls} value={data.qty} onChange={(e) => set({ qty: e.target.value })} placeholder="e.g. 1 cup" />
                </div>
                <div>
                  <label className={labelCls}>Cycle phase</label>
                  <div className="px-3 py-2 text-sm text-stone-600 bg-stone-100 border border-stone-200">
                    {cyclePhaseLabel || 'Set your last period on the Today page'}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Photo</label>
                  <input className={`${fieldCls} py-1.5`} type="file" accept="image/*" onChange={onPhoto} />
                  {data.photo ? (
                    <img src={data.photo} alt="" className="mt-3 max-h-40 border border-stone-200" />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-stone-200 px-6 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(data)}
            className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// True when a notes object holds anything worth marking with the ✎ glyph.
export function hasNotes(notes) {
  if (!notes || typeof notes !== 'object') return false
  const { brand, ingredients, feelings, note, time, qty, cost, photo, drink, supp } = notes
  if (brand || ingredients || note || time || qty || cost || photo) return true
  if (feelings && (feelings.energy || feelings.digestion || feelings.mood)) return true
  if (drink && (drink.temp || drink.caffeine || drink.sweeteners)) return true
  if (supp && (supp.brandDose || supp.withFood || supp.form || (supp.purpose && supp.purpose.length))) return true
  return false
}
