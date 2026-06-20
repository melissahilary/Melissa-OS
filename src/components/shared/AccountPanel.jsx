import React, { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import * as store from '../../lib/dataStore'

// Sidebar account summary: which email is signed in, and a way out.
export default function AccountPanel() {
  const [st, setSt] = useState(store.getStatus())
  useEffect(() => store.subscribeStatus(setSt), [])

  if (st.phase !== 'ready') return null

  return (
    <div>
      <p className="kicker text-stone-400 mb-2">Account</p>
      <p className="mb-3 truncate text-sm text-stone-700">{st.email}</p>
      <p className="mb-3 text-xs leading-snug text-stone-400">
        Your planner is saved to your account and syncs to every device automatically.
      </p>
      <button
        onClick={() => store.signOut()}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-stone-400 hover:text-stone-700"
      >
        <LogOut size={13} /> Sign out
      </button>
    </div>
  )
}

// Small dot for the collapsed rail — solid when synced to the account.
export function AccountDot() {
  const [st, setSt] = useState(store.getStatus())
  useEffect(() => store.subscribeStatus(setSt), [])
  const color = st.phase === 'ready' ? '#7B8B5F' : '#d6d3d1'
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} title={st.email || 'Not signed in'} />
}
