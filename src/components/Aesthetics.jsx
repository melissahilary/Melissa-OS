import React from 'react'
import CategorySchedule from './shared/CategorySchedule'
import { CategoryLog, CategoryShelf } from './shared/LogShelf'

// Dated visits (logs) and things you keep using (shelves).
const LOG = {
  treatments: {
    addNoun: 'treatment',
    blurb: 'Clinical — done to the skin or body. Track the downtime and how it settles.',
    suggestions: ['Injectables', 'Laser', 'Skin resurfacing', 'Peel', 'Microneedling', 'Radiofrequency', 'Ultrasound lifting', 'Threads', 'Body contouring', 'Cryotherapy', 'IV therapy'],
    place: { label: 'Where', placeholder: 'provider · clinic' },
    fields: [
      { key: 'downtime', label: 'Downtime', placeholder: 'how long to settle' },
      { key: 'results', label: 'Results', placeholder: 'how it turned out' },
    ],
  },
  services: {
    addNoun: 'service',
    blurb: 'Maintenance & cosmetic — no real recovery.',
    suggestions: ['Facial', 'Hair removal', 'Lash & brow', 'Nails', 'Scalp treatment', 'Lymphatic drainage'],
    place: { label: 'Where', placeholder: 'provider · salon' },
    fields: [],
  },
  appointments: {
    addNoun: 'appointment',
    blurb: 'Information only — no procedure. Consultations and evaluations.',
    suggestions: ['Consultation', 'Surgical consultation', 'Dental aesthetics'],
    place: { label: 'Who / where', placeholder: 'provider · clinic' },
    fields: [],
  },
}

const SHELF = {
  devices: {
    blurb: 'At-home tools that do the in-office job — recurring use, no provider.',
    suggestions: ['LED mask', 'Microcurrent', 'At-home microneedling', 'Red light'],
    notePlaceholder: 'what it does · how often',
  },
  prescribed: {
    blurb: 'Prescribed or dispensed to take home and keep using — it starts at a visit but needs its own tracking.',
    suggestions: ['Tretinoin', 'Medical-grade serum', 'Post-procedure kit'],
    notePlaceholder: 'from which visit · how to use',
  },
}

export default function Aesthetics({ subPage, cycleConfig }) {
  if (subPage === 'schedule' || subPage === 'monthly' || subPage === 'weekly') return <CategorySchedule category="aesthetics" question="What do you want to book today?" noun="Treatment" cycleConfig={cycleConfig} />
  if (LOG[subPage]) return <CategoryLog storeKey={`mos:aesthetics:${subPage}`} {...LOG[subPage]} />
  if (SHELF[subPage]) return <CategoryShelf storeKey={`mos:aesthetics:${subPage}`} {...SHELF[subPage]} />
  return <CategorySchedule category="aesthetics" question="What do you want to book today?" noun="Treatment" cycleConfig={cycleConfig} />
}
