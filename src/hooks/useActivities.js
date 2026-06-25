import { useLocalStorage } from './useLocalStorage'
import { normActivity } from '../lib/activities'
import { dateKey } from '../lib/date'

// Single source of truth for every activity (event / meal_item / supplement /
// protocol), stored once in mos:activities.
export function useActivities() {
  const [raw, setRaw] = useLocalStorage('mos:activities', [])
  const activities = (Array.isArray(raw) ? raw : []).map(normActivity)

  const add = (a) => {
    const act = normActivity({ ...a, createdAt: a.createdAt || dateKey(new Date()) })
    setRaw((p) => [...(Array.isArray(p) ? p : []), act])
    return act
  }
  const update = (id, patch) =>
    setRaw((p) => (Array.isArray(p) ? p : []).map((x) => (x.id === id ? normActivity({ ...normActivity(x), ...patch }) : x)))
  const updateDetails = (id, patch) =>
    setRaw((p) => (Array.isArray(p) ? p : []).map((x) => {
      if (x.id !== id) return x
      const a = normActivity(x)
      return normActivity({ ...a, details: { ...a.details, ...patch } })
    }))
  const remove = (id) => setRaw((p) => (Array.isArray(p) ? p : []).filter((x) => x.id !== id))
  const toggleComplete = (id, key) =>
    setRaw((p) => (Array.isArray(p) ? p : []).map((x) => {
      if (x.id !== id) return x
      const a = normActivity(x)
      const comp = { ...a.completions }
      if (comp[key]) delete comp[key]
      else comp[key] = true
      return normActivity({ ...a, completions: comp, lastCompleted: comp[key] ? key : a.lastCompleted })
    }))
  const setOrder = (orderedIds) =>
    setRaw((p) => (Array.isArray(p) ? p : []).map((x) => {
      const idx = orderedIds.indexOf(x.id)
      return idx >= 0 ? normActivity({ ...normActivity(x), order: idx }) : x
    }))

  return { activities, setRaw, add, update, updateDetails, remove, toggleComplete, setOrder }
}

export default useActivities
