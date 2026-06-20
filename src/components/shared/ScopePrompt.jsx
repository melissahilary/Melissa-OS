import React from 'react'

// Modal that asks how far a change to a recurring item should reach.
// Calls onChoose('one' | 'following' | 'all') or onClose for cancel.
export default function ScopePrompt({ open, itemName, action = 'change', onChoose, onClose }) {
  if (!open) return null

  const verb = action === 'remove' ? 'Remove' : 'Update'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 px-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-sm bg-cream border border-stone-300 shadow-2xl">
        <div className="border-b border-stone-200 px-6 py-5">
          <p className="kicker text-stone-400 mb-1">Recurring item</p>
          <h2 className="font-serif italic text-2xl leading-tight text-stone-900">{itemName}</h2>
          <p className="mt-2 text-sm text-stone-500">{verb} how many of these?</p>
        </div>
        <div className="p-3 space-y-1.5">
          {[
            { id: 'one', label: 'This event only' },
            { id: 'following', label: 'This and following' },
            { id: 'all', label: 'All events' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => onChoose(opt.id)}
              className="block w-full px-4 py-3 text-left text-sm text-stone-700 border border-stone-200 hover:bg-stone-900 hover:text-cream transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end border-t border-stone-200 px-6 py-3">
          <button onClick={onClose} className="text-sm text-stone-500 hover:text-stone-900">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
