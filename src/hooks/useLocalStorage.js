import { useCallback, useEffect, useRef, useState } from 'react'
import * as store from '../lib/dataStore'

/**
 * useLocalStorage — persistent state backed by Supabase.
 *
 * The name is kept for compatibility, but data now lives in Postgres, scoped to
 * the signed-in user. Returns [value, setValue, isLoaded]; setValue accepts a
 * value or an updater fn. Cross-component sync happens through the store's
 * subscription bus, so when data loads or another component writes, every reader
 * updates live.
 */
export function useLocalStorage(key, initial) {
  const initialRef = useRef(initial)
  const [value, setValue] = useState(() => store.get(key, initialRef.current))
  const [isLoaded, setIsLoaded] = useState(true)

  useEffect(() => {
    // Re-read in case the store changed between render and mount, then subscribe.
    setValue(store.get(key, initialRef.current))
    setIsLoaded(true)
    const unsub = store.subscribe(key, (v) => setValue(v === undefined ? initialRef.current : v))
    return unsub
  }, [key])

  const setStored = useCallback(
    (next) => {
      const prev = store.get(key, initialRef.current)
      const resolved = typeof next === 'function' ? next(prev) : next
      store.set(key, resolved)
    },
    [key],
  )

  return [value, setStored, isLoaded]
}

export default useLocalStorage
