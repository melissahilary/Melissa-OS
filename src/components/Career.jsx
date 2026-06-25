import React, { useRef, useState } from 'react'
import { X, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import SectionTitle from './shared/SectionTitle'
import { useRegisterAdd } from './shared/AddButton'
import Checkbox from './shared/Checkbox'

const uid = () => Math.random().toString(36).slice(2, 10)
const STAGES = ['Researching', 'Applied', 'Screening', 'Interviewing', 'Offer', 'Passed']

const focusAdd = (ref) => {
  const el = ref.current && ref.current.querySelector('input[placeholder], textarea[placeholder]')
  if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
}

export default function Career() {
  const rootRef = useRef(null)
  const [data, setData] = useLocalStorage('mos:career', {
    linkedin: [],
    resume: [],
    jobs: [],
  })
  useRegisterAdd(() => focusAdd(rootRef), [])

  return (
    <div ref={rootRef}>
      <SectionTitle kicker="04 · The next chapter" title="Landing an EA Offer." />

      <div className="grid gap-10 md:grid-cols-2">
        <Checklist
          title="LinkedIn."
          items={data.linkedin}
          onAdd={(text) => setData((d) => ({ ...d, linkedin: [...d.linkedin, { id: uid(), text, done: false }] }))}
          onToggle={(id) => setData((d) => ({ ...d, linkedin: d.linkedin.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }))}
          onRemove={(id) => setData((d) => ({ ...d, linkedin: d.linkedin.filter((x) => x.id !== id) }))}
        />
        <Checklist
          title="Resume."
          items={data.resume}
          onAdd={(text) => setData((d) => ({ ...d, resume: [...d.resume, { id: uid(), text, done: false }] }))}
          onToggle={(id) => setData((d) => ({ ...d, resume: d.resume.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }))}
          onRemove={(id) => setData((d) => ({ ...d, resume: d.resume.filter((x) => x.id !== id) }))}
        />
      </div>

      <JobsPipeline data={data} setData={setData} />
    </div>
  )
}

function Checklist({ title, items, onAdd, onToggle, onRemove }) {
  const [draft, setDraft] = useState('')
  const done = items.filter((i) => i.done).length
  const pct = items.length ? (done / items.length) * 100 : 0
  const commit = () => {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }
  return (
    <section>
      <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-3">{title}</h2>
      <div className="mb-4 h-1.5 w-full bg-stone-200">
        <div className="h-full bg-stone-900 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder="Add a step"
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
      </div>
      <div className="divide-y divide-stone-100">
        {items.map((it) => (
          <div key={it.id} className="group flex items-center gap-3 py-2">
            <Checkbox checked={it.done} onClick={() => onToggle(it.id)} />
            <span className={`flex-1 text-sm ${it.done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{it.text}</span>
            <button onClick={() => onRemove(it.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function JobsPipeline({ data, setData }) {
  const [draft, setDraft] = useState({ role: '', company: '', salary: '', location: '', stage: 'Researching' })
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied] = useState(null)

  const add = () => {
    if (!draft.role.trim() && !draft.company.trim()) return
    setData((d) => ({ ...d, jobs: [...d.jobs, { id: uid(), ...draft, followUp: '', thankYou: '' }] }))
    setDraft({ role: '', company: '', salary: '', location: '', stage: 'Researching' })
  }
  const update = (id, patch) => setData((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }))
  const remove = (id) => setData((d) => ({ ...d, jobs: d.jobs.filter((j) => j.id !== id) }))

  const copy = (id, text) => {
    if (navigator.clipboard) navigator.clipboard.writeText(text || '')
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <section className="mt-12">
      <h2 className="font-serif italic text-2xl md:text-3xl text-stone-900 mb-5">The pipeline.</h2>

      <div className="mb-6 grid gap-2 md:grid-cols-6">
        <input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Role" className="md:col-span-2 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
        <input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Company" className="bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
        <input value={draft.salary} onChange={(e) => setDraft({ ...draft, salary: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Salary" className="bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
        <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Location" className="bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900" />
        <div className="flex gap-2">
          <select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })} className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none">
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {data.jobs.map((job) => {
          const open = expanded === job.id
          return (
            <div key={job.id} className="border border-stone-200">
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setExpanded(open ? null : job.id)} className="text-stone-400 hover:text-stone-900">
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="flex-1">
                  <p className="text-sm text-stone-900">{job.role || 'Untitled role'}</p>
                  <p className="text-xs text-stone-500">
                    {job.company}{job.location ? ` · ${job.location}` : ''}{job.salary ? ` · ${job.salary}` : ''}
                  </p>
                </div>
                <select
                  value={job.stage}
                  onChange={(e) => update(job.id, { stage: e.target.value })}
                  className="border border-stone-300 bg-transparent px-2 py-1 text-xs outline-none"
                >
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => remove(job.id)} className="text-stone-300 hover:text-stone-700"><X size={15} /></button>
              </div>

              {open && (
                <div className="border-t border-stone-200 px-4 py-4 space-y-4">
                  <div>
                    <label className="kicker text-stone-400 mb-1.5 block">Follow-up notes</label>
                    <textarea
                      value={job.followUp}
                      onChange={(e) => update(job.id, { followUp: e.target.value })}
                      className="w-full min-h-[60px] resize-y bg-cream border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="kicker text-stone-400">Thank-you note</label>
                      <button onClick={() => copy(job.id, job.thankYou)} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900">
                        {copied === job.id ? <Check size={13} /> : <Copy size={13} />}
                        {copied === job.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <textarea
                      value={job.thankYou}
                      onChange={(e) => update(job.id, { thankYou: e.target.value })}
                      className="w-full min-h-[80px] resize-y bg-cream border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
