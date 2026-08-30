import React from 'react'
import CategorySchedule from './shared/CategorySchedule'
import { CategoryLog, CategoryShelf } from './shared/LogShelf'

export default function Bodycare({ subPage, cycleConfig }) {
  if (subPage === 'therapies') return <CategoryLog storeKey="mos:bodycare:therapies" addNoun="therapy" blurb="The body work — recovery, lymph, skin, ritual." suggestions={['Lymphatic drainage', 'Sauna', 'Cold plunge', 'Massage', 'Dry brushing', 'Red light', 'Body scrub', 'Contrast shower']} place={{ label: 'Where', placeholder: 'spa · home' }} fields={[{ key: 'results', label: 'How it felt', placeholder: 'what it did for you' }]} />
  if (subPage === 'products') return <CategoryShelf storeKey="mos:bodycare:products" blurb="Oils, scrubs, tools — the body shelf." suggestions={['Body oil', 'Gua sha', 'Dry brush', 'Exfoliant', 'Firming cream']} notePlaceholder="brand · how you use it" />
  return <CategorySchedule category="bodycare" question="What do you want to do for your body today?" noun="Item" cycleConfig={cycleConfig} />
}
