import React, { useEffect, useState } from 'react'
import { FolderOpen, FolderSync, AlertCircle, Check, Save } from 'lucide-react'
import * as store from '../../lib/fileStore'

// Sidebar panel for connecting the planner to an owned folder. The folder is the
// source of truth (JSON + Markdown); localStorage is only a cache.
export default function StoragePanel() {
  const [st, setSt] = useState(store.getStatus())
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => store.subscribeStatus(setSt), [])

  const connect = async () => {
    setBusy(true)
    await store.connect()
    setBusy(false)
  }
  const reconnect = async () => {
    setBusy(true)
    await store.requestPermission()
    setBusy(false)
  }
  const saveNow = async () => {
    setBusy(true)
    await store.flush()
    setBusy(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (!st.supported) {
    return (
      <div>
        <p className="kicker text-stone-400 mb-2">Storage</p>
        <div className="flex items-start gap-2 text-xs text-stone-500">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p>Folder sync needs Chrome or Edge. Saving locally in this browser for now.</p>
        </div>
      </div>
    )
  }

  if (st.status === 'connected') {
    return (
      <div>
        <p className="kicker text-stone-400 mb-2">Storage</p>
        <div className="mb-3 flex items-center gap-2 text-sm text-stone-700">
          <FolderSync size={15} className="text-phase-follicular" />
          <span className="truncate">Synced to {st.folderName}</span>
        </div>
        <p className="mb-3 text-xs leading-snug text-stone-400">
          JSON and Markdown are written to this folder — your single source of truth.
        </p>
        <div className="flex gap-2">
          <button
            onClick={saveNow}
            disabled={busy}
            className="flex items-center gap-1.5 border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:border-stone-900 hover:text-stone-900 disabled:opacity-50"
          >
            {saved ? <Check size={13} /> : <Save size={13} />}
            {saved ? 'Saved' : 'Save now'}
          </button>
          <button
            onClick={() => store.disconnect()}
            className="px-2.5 py-1 text-xs text-stone-400 hover:text-stone-700"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  if (st.status === 'needs-permission') {
    return (
      <div>
        <p className="kicker text-stone-400 mb-2">Storage</p>
        <p className="mb-3 text-xs leading-snug text-stone-500">
          Reconnect to {st.folderName || 'your folder'} to load and save your planner.
        </p>
        <button
          onClick={reconnect}
          disabled={busy}
          className="flex items-center gap-1.5 bg-stone-900 px-3 py-1.5 text-xs text-cream hover:bg-stone-700 disabled:opacity-50"
        >
          <FolderSync size={14} /> Reconnect folder
        </button>
      </div>
    )
  }

  return (
    <div>
      <p className="kicker text-stone-400 mb-2">Storage</p>
      <p className="mb-3 text-xs leading-snug text-stone-500">
        Connect a folder you own — inside Obsidian, iCloud, or Dropbox — and your planner
        saves there as JSON and Markdown. It syncs across devices for free, and you can
        grep, diff, and back it up.
      </p>
      <button
        onClick={connect}
        disabled={busy}
        className="flex items-center gap-1.5 bg-stone-900 px-3 py-1.5 text-xs text-cream hover:bg-stone-700 disabled:opacity-50"
      >
        <FolderOpen size={14} /> Connect a folder
      </button>
      {st.status === 'denied' && (
        <p className="mt-2 text-xs text-phase-menstrual">Permission was declined. Try again to grant access.</p>
      )}
    </div>
  )
}

// Small dot for the collapsed rail showing whether a folder is connected.
export function StorageDot() {
  const [st, setSt] = useState(store.getStatus())
  useEffect(() => store.subscribeStatus(setSt), [])
  const color = st.status === 'connected' ? '#7B8B5F' : st.status === 'needs-permission' ? '#C9A961' : '#d6d3d1'
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} title={`Storage: ${st.status}`} />
}
