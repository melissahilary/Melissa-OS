import { useLocalStorage } from './useLocalStorage'
import { DEFAULT_PHASE_TINT } from '../lib/cycle'

// One shared, persisted source of truth for the cycle-phase calendar washes.
// Any override is merged over the defaults, so every month calendar reads the
// same colors and edits reflect everywhere on save.
export function usePhaseColors() {
  const [stored, setStored] = useLocalStorage('mos:settings:phaseColors', {})
  const overrides = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  const colors = { ...DEFAULT_PHASE_TINT, ...overrides }
  const setColor = (id, hex) => setStored((p) => ({ ...(p && typeof p === 'object' && !Array.isArray(p) ? p : {}), [id]: hex }))
  const resetColor = (id) => setStored((p) => {
    const next = { ...(p && typeof p === 'object' && !Array.isArray(p) ? p : {}) }
    delete next[id]
    return next
  })
  return { colors, setColor, resetColor }
}
