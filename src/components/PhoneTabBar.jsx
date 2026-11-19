import React from 'react'
import { Sun, LayoutList, TrendingUp, MessageCircle } from 'lucide-react'

// The phone's dock. Desktop keeps the index and the floating buttons; a hand
// needs the four rooms one thumb can reach.
export default function PhoneTabBar({ active, onToday, onIndex, onPortfolio, onAsk }) {
  const tabs = [
    { id: 'today', label: 'Today', icon: Sun, onClick: onToday },
    { id: 'index', label: 'Index', icon: LayoutList, onClick: onIndex },
    { id: 'portfolio', label: 'Portfolio', icon: TrendingUp, onClick: onPortfolio },
    { id: 'ask', label: 'Esmé', icon: MessageCircle, onClick: onAsk },
  ]
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-cream/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Phone"
    >
      <div className="grid grid-cols-4">
        {tabs.map((t) => {
          const on = active === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={t.onClick}
              className={`flex flex-col items-center gap-1 py-2.5 ${on ? 'text-stone-900' : 'text-stone-400'}`}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="text-[10px] tracking-wide">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
