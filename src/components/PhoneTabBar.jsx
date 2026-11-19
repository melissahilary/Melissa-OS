import React from 'react'
import { Sun, LayoutList, Library, ScanLine } from 'lucide-react'
import { tap } from '../lib/haptics'

const TABS = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'index', label: 'Index', icon: LayoutList },
  { id: 'shelf', label: 'Shelf', icon: Library },
  { id: 'scan', label: 'Scan', icon: ScanLine },
]

export default function PhoneTabBar({ active, onToday, onIndex, onShelf, onScan }) {
  const go = {
    today: onToday,
    index: onIndex,
    shelf: onShelf,
    scan: onScan,
  }
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-cream md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Sections"
    >
      <div className="grid h-[3.25rem] grid-cols-4">
        {TABS.map((t) => {
          const on = active === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => { tap(); go[t.id]() }}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 ${on ? 'text-stone-900' : 'text-stone-400'}`}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="text-[10px] tracking-wide">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
