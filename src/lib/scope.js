// One signed-in account can keep several planners. The account holder stays on
// the original keys (so an existing book never moves). Everyone else is stored
// under a prefix in the same planner_state rows — no new tables.

export const OWNER_ID = 'owner'

// These keys describe the account, not the person whose planner is open.
export const ACCOUNT_KEYS = new Set(['mos:household', 'mos:active-profile'])

const ID_RE = /^[a-z0-9]{6,12}$/

export function isMemberId(id) {
  return typeof id === 'string' && ID_RE.test(id)
}

export function newMemberId() {
  const id = Math.random().toString(36).slice(2, 10)
  return isMemberId(id) ? id : newMemberId()
}

export function normalizeMembers(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  raw.forEach((m) => {
    if (!m || !isMemberId(m.id)) return
    const name = typeof m.name === 'string' ? m.name.trim() : ''
    if (!name || seen.has(m.id)) return
    seen.add(m.id)
    const note = typeof m.note === 'string' ? m.note.trim() : ''
    out.push({ id: m.id, name, note })
  })
  return out
}

export function resolveActive(active, members) {
  const list = normalizeMembers(members)
  if (isMemberId(active) && list.some((m) => m.id === active)) return active
  return OWNER_ID
}

// Physical row key for a logical planner key, given who is open.
export function physicalKey(logicalKey, activeId) {
  if (typeof logicalKey !== 'string' || !logicalKey) return logicalKey
  if (ACCOUNT_KEYS.has(logicalKey)) return logicalKey
  if (!isMemberId(activeId)) return logicalKey
  return `p:${activeId}:${logicalKey}`
}
