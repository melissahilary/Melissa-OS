import { useCallback, useEffect, useRef, useState } from 'react'

const CHANGE_EVENT = 'mos:storage:change'

// Read a key, preferring window.storage when the host provides it, falling
// back to window.localStorage. Returns the parsed value or `fallback`.
function readKey(key, fallback) {
  try {
    let raw = null
    if (typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function') {
      raw = window.storage.get(key)
    }
    if (raw == null && typeof window !== 'undefined' && window.localStorage) {
      raw = window.localStorage.getItem(key)
    }
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

// Write a key to BOTH stores for redundancy.
function writeKey(key, value) {
  const raw = JSON.stringify(value)
  try {
    if (typeof window !== 'undefined' && window.storage && typeof window.storage.set === 'function') {
      window.storage.set(key, raw)
    }
  } catch {
    /* ignore — fall through to localStorage */
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, raw)
    }
  } catch {
    /* storage may be full or unavailable */
  }
}

/**
 * useLocalStorage — persistent state tied to a storage key.
 *
 * Returns [value, setValue, isLoaded].
 *  - Reads window.storage first, then localStorage on mount.
 *  - Writes to both stores on every change (redundancy).
 *  - Queues writes that happen before the initial load resolves.
 *  - Broadcasts a `mos:storage:change` event so other components reading the
 *    same key update live (cross-component sync).
 */
export function useLocalStorage(key, initial) {
  const [value, setValueState] = useState(initial)
  const [isLoaded, setIsLoaded] = useState(false)
  const loadedRef = useRef(false)
  const pendingRef = useRef(null)

  // Initial load.
  useEffect(() => {
    const stored = readKey(key, initial)
    setValueState(stored)
    loadedRef.current = true
    setIsLoaded(true)

    // Flush any update that arrived before load completed.
    if (pendingRef.current != null) {
      const queued = pendingRef.current
      pendingRef.current = null
      const resolved = typeof queued === 'function' ? queued(stored) : queued
      setValueState(resolved)
      writeKey(key, resolved)
      broadcast(key, resolved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Listen for changes from other components on the same key.
  useEffect(() => {
    function handle(e) {
      if (!e.detail || e.detail.key !== key) return
      if (e.detail.source === instanceId.current) return
      setValueState(e.detail.value)
    }
    window.addEventListener(CHANGE_EVENT, handle)
    return () => window.removeEventListener(CHANGE_EVENT, handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const instanceId = useRef(Math.random().toString(36).slice(2))

  function broadcast(k, v) {
    try {
      window.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, { detail: { key: k, value: v, source: instanceId.current } }),
      )
    } catch {
      /* CustomEvent unsupported — sync silently degrades */
    }
  }

  const setValue = useCallback(
    (next) => {
      // Race-condition fix: if we are asked to set before the initial load
      // finished, queue it and let the load effect flush it.
      if (!loadedRef.current) {
        pendingRef.current = next
        setTimeout(() => {
          if (loadedRef.current && pendingRef.current != null) {
            const queued = pendingRef.current
            pendingRef.current = null
            setValueState((prev) => {
              const resolved = typeof queued === 'function' ? queued(prev) : queued
              writeKey(key, resolved)
              broadcast(key, resolved)
              return resolved
            })
          }
        }, 0)
        return
      }

      setValueState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        writeKey(key, resolved)
        broadcast(key, resolved)
        return resolved
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  return [value, setValue, isLoaded]
}

export default useLocalStorage
