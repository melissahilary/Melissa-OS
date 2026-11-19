import { useLocalStorage } from './useLocalStorage'
import { normalizeMembers, resolveActive, OWNER_ID } from '../lib/scope'

// The given name of whoever's planner is open. The account holder still reads
// as Melissa until a first name is written in Settings.
export function useHouseName() {
  const [profile] = useLocalStorage('mos:profile', {})
  const [household] = useLocalStorage('mos:household', [])
  const [active] = useLocalStorage('mos:active-profile', OWNER_ID)
  const members = normalizeMembers(household)
  const id = resolveActive(active, members)
  const raw = profile && typeof profile === 'object' ? (profile.firstName || profile.name || '') : ''
  const fromProfile = String(raw).trim().split(/\s+/)[0]
  if (fromProfile) return fromProfile
  if (id === OWNER_ID) return 'Melissa'
  const member = members.find((m) => m.id === id)
  const fromMember = member ? member.name.trim().split(/\s+/)[0] : ''
  return fromMember || 'You'
}

export function useActiveProfileId() {
  const [household] = useLocalStorage('mos:household', [])
  const [active] = useLocalStorage('mos:active-profile', OWNER_ID)
  return resolveActive(active, normalizeMembers(household))
}
