import React from 'react'
import CategorySchedule from './shared/CategorySchedule'
import { CategoryLog } from './shared/LogShelf'
import Labs from './Labs'

// Testing — where every routine draw, scan and exam lives, dated with results.
export default function Diagnostics({ subPage, cycleConfig }) {
  if (subPage === 'bloodwork') return <CategoryLog storeKey="mos:testing:bloodwork" addNoun="draw" blurb="Every draw, dated — because a number without its date is noise." suggestions={['Full panel', 'CBC', 'Metabolic panel', 'Lipids', 'Thyroid', 'Vitamin D', 'Iron / ferritin', 'HbA1c', 'hs-CRP']} place={{ label: 'Where', placeholder: 'lab · clinic' }} fields={[{ key: 'fasting', label: 'Fasting?', placeholder: 'fasted · fed' }, { key: 'results', label: 'Key results', placeholder: 'values to remember' }]} />
  if (subPage === 'imaging') return <CategoryLog storeKey="mos:testing:imaging" addNoun="exam" blurb="Scans and structural exams — what was looked at, and what was seen." suggestions={['DEXA', 'Ultrasound', 'MRI', 'Mammogram', 'Skin check', 'Dental exam', 'Eye exam', 'VO2 max']} place={{ label: 'Where', placeholder: 'imaging center · clinic' }} fields={[{ key: 'results', label: 'Findings', placeholder: 'what was seen' }]} />
  if (subPage === 'log') return <Labs cycleConfig={cycleConfig} />
  return <CategorySchedule category="diagnostics" question="What do you want to test today?" noun="Test" cycleConfig={cycleConfig} />
}
