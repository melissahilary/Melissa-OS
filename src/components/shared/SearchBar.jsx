import React from 'react'
import { Search } from 'lucide-react'
import { CloseIcon } from './marks'

// ── Finding it again, from memory.
//
// A ruled line, a glass, and a cross that appears once there is something to
// clear. It was written for the mood board, where the words being searched are
// the ones the pictures gave up by themselves; the goals wall and the wishlist
// need exactly the same thing and there is no reason for three of them.
//
// No placeholder by default. A search field with a glass on it does not need to
// be told what it is, and an empty rule is quieter than a grey sentence.
export default function SearchBar({ value, onChange, label, placeholder = '', className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 border-b border-stone-200 pb-1.5 transition-colors focus-within:border-stone-900 ${className}`}>
      <Search size={14} className="shrink-0 text-stone-300" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-stone-300"
        aria-label={label}
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear" className="shrink-0 text-stone-300 transition-colors hover:text-stone-700">
          <CloseIcon size={13} />
        </button>
      )}
    </div>
  )
}

// Every meaningful word has to appear somewhere in the haystack, so "winter
// coat" does not return every coat. Plural is forgiven in one direction, which
// covers the way people actually type into a box like this.
export function hits(haystack, query) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return true
  const hay = String(haystack || '').toLowerCase()
  const words = q.split(/[^a-z0-9']+/i).filter((w) => w.length > 1)
  if (!words.length) return true
  return words.every((w) => hay.includes(w) || hay.includes(w.replace(/s$/, '')))
}
