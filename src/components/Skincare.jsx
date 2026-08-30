import React from 'react'
import { Sun, Moon } from 'lucide-react'
import CategorySchedule from './shared/CategorySchedule'
import RoutineBuilder from './shared/RoutineBuilder'
import { CategoryShelf } from './shared/LogShelf'

// Step types a skincare ritual is made of.
const SKIN_TYPES = ['Cleanser', 'Toner', 'Essence', 'Serum', 'Moisturizer', 'SPF', 'Treatment', 'Mask', 'Oil', 'Eye', 'Device']

export default function Skincare({ subPage, cycleConfig }) {
  if (subPage === 'morning') return <RoutineBuilder storeKey="mos:skincare:am" shelfKey="mos:skincare:products" Icon={Sun} intro="The order you begin the day in — each step carries its product, type and cadence." types={SKIN_TYPES} />
  if (subPage === 'evening') return <RoutineBuilder storeKey="mos:skincare:pm" shelfKey="mos:skincare:products" Icon={Moon} intro="How you wind the day down, step by step." types={SKIN_TYPES} />
  if (subPage === 'products') return <CategoryShelf storeKey="mos:skincare:products" blurb="The vanity shelf — everything you own and use." suggestions={['Cleanser', 'Vitamin C', 'Retinal', 'SPF', 'Moisturizer']} notePlaceholder="brand · strength · when you use it" />
  return <CategorySchedule category="skincare" question="What do you want to do for your skin today?" noun="Step" cycleConfig={cycleConfig} />
}
