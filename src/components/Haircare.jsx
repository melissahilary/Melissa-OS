import React from 'react'
import { Sparkles } from 'lucide-react'
import CategorySchedule from './shared/CategorySchedule'
import RoutineBuilder from './shared/RoutineBuilder'
import { CategoryLog, CategoryShelf } from './shared/LogShelf'

// Step types a hair ritual is made of.
const HAIR_TYPES = ['Shampoo', 'Conditioner', 'Mask', 'Oil', 'Leave-in', 'Heat protect', 'Scalp treatment', 'Style', 'Supplement']

export default function Haircare({ subPage, cycleConfig }) {
  if (subPage === 'routine') return <RoutineBuilder storeKey="mos:haircare:routine" shelfKey="mos:haircare:products" Icon={Sparkles} intro="Wash day and every day — each step carries its product, type and cadence." types={HAIR_TYPES} />
  if (subPage === 'products') return <CategoryShelf storeKey="mos:haircare:products" blurb="Everything on the hair shelf." suggestions={['Bond builder', 'Rosemary oil', 'Silk pillowcase', 'Heat protectant', 'Scalp serum']} notePlaceholder="brand · how you use it" />
  if (subPage === 'appointments') return <CategoryLog storeKey="mos:haircare:appointments" addNoun="appointment" blurb="Cuts, colour, treatments — the chair you sit in and when." suggestions={['Cut', 'Colour', 'Gloss', 'Keratin', 'Scalp facial', 'Blowout']} place={{ label: 'Where', placeholder: 'stylist · salon' }} fields={[{ key: 'results', label: 'Notes on the result', placeholder: 'formula, length, what to repeat' }]} />
  return <CategorySchedule category="haircare" noun="Item" cycleConfig={cycleConfig} />
}
