import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

// A single context-aware floating "Add" button for the whole app. Pages register
// their add action via useRegisterAdd(handler); the button calls whatever is
// currently registered. The button only shows on pages that register a handler.
const AddCtx = createContext(() => {})

export function useRegisterAdd(handler, deps = []) {
  const register = useContext(AddCtx)
  useEffect(() => {
    register(handler)
    return () => register(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// The shared "Add to your day" chooser used by the home Add button and by
// protocols' Add to Calendar. `recommended` ('event' | 'meal') highlights one.
export function AddChooser({ onEvent, onMeal, onClose, recommended }) {
  const base = 'w-full border px-4 py-3 text-left text-sm text-stone-800 transition-colors hover:border-stone-900'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xs bg-cream border border-stone-300 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="kicker text-stone-400">Add to your day</span>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-900"><X size={18} /></button>
        </div>
        <div className="space-y-2">
          <button onClick={onEvent} className={`${base} ${recommended === 'event' ? 'border-stone-900' : 'border-stone-300'}`}>
            <span className="font-serif text-lg">Event</span>
            <span className="block text-xs text-stone-500">Something you do</span>
          </button>
          <button onClick={onMeal} className={`${base} ${recommended === 'meal' ? 'border-stone-900' : 'border-stone-300'}`}>
            <span className="font-serif text-lg">Meal Item</span>
            <span className="block text-xs text-stone-500">Something you eat or drink</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddProvider({ children }) {
  const ref = useRef(null)
  const [active, setActive] = useState(false)
  const register = useCallback((fn) => {
    ref.current = fn
    setActive(!!fn) // same value → React bails, no extra render
  }, [])

  return (
    <AddCtx.Provider value={register}>
      {children}
      {active && (
        <button
          onClick={() => ref.current && ref.current()}
          className="fixed bottom-6 right-6 z-40 px-6 py-2.5 text-base shadow-lg transition-colors hover:opacity-90"
          style={{ backgroundColor: '#1C1C1A', color: '#FAFAF7', borderRadius: '9999px', fontFamily: 'Cormorant Garamond, serif' }}
        >
          Add
        </button>
      )}
    </AddCtx.Provider>
  )
}
