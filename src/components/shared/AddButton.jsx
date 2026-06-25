import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

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
