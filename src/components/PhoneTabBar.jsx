import React from 'react'
import { Sun, LayoutList, Library, ScanLine } from 'lucide-react'

export default function PhoneTabBar({ active, onToday, onIndex, onShelf, onScan }) {
  const tabs = [
    { id: 'today', label: 'Today', icon: Sun, onClick: onToday },
    { id: 'index', label: 'Index', icon: LayoutList, onClick: onIndex },
    { id: 'shelf', label: 'Shelf', icon: Library, onClick: onShelf },
    { id: 'scan', label: 'Scan', icon: ScanLine, onClick: onScan },
  ]
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C4A46A] bg-cream md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Phone"
    >
      <div className="grid grid-cols-4">
        {tabs.map((t) => {
          const on = active === t.id
          const Icon = t.icon
          return (
            <button key={t.id} onClick={t.onClick} className={`flex flex-col items-center gap-1 py-2.5 ${on ? 'text-stone-900' : 'text-stone-400'}`}>
              <Icon size={18} strokeWidth={1.5} />
              <span className="text-[10px] tracking-wide">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
