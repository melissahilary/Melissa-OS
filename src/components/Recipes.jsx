import React, { useMemo, useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { PHASES } from '../lib/cycle'

const uid = () => Math.random().toString(36).slice(2, 10)
const UNITS = ['cup', 'tbsp', 'tsp', 'oz', 'g', 'lb', 'ml', 'L', 'piece', 'clove', 'pinch', 'to taste']

const MEAL_TIMES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drinks']
const PHASE_TAGS = [
  { id: 'follicular', label: 'Follicular' },
  { id: 'ovulation', label: 'Ovulatory' },
  { id: 'luteal', label: 'Luteal' },
  { id: 'menstrual', label: 'Menstrual' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({ id: d, label: d }))
const HAIR_FREQS = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'As Needed'].map((f) => ({ id: f, label: f }))

// Default config — the Meal Planning recipes (meal time + cycle phase).
export const MEAL_RECIPES_CONFIG = {
  storageKey: 'mos:menu:recipes',
  facetA: { key: 'mealTimes', label: 'Meal time', options: MEAL_TIMES.map((m) => ({ id: m, label: m })) },
  facetB: { key: 'phases', label: 'Cycle phase', options: PHASE_TAGS, phaseColors: true },
}

// Haircare recipes — day of week + frequency.
export const HAIRCARE_RECIPES_CONFIG = {
  storageKey: 'mos:haircare:recipes',
  facetA: { key: 'days', label: 'Day of week', options: DAYS },
  facetB: { key: 'frequencies', label: 'Frequency', options: HAIR_FREQS },
}

const labelOf = (facet, id) => (facet.options.find((o) => o.id === id) || {}).label || id

const blankRecipe = (config) => ({
  id: uid(),
  name: '',
  ingredients: [],
  prep: '',
  [config.facetA.key]: [],
  [config.facetB.key]: [],
})

export default function Recipes({ config = MEAL_RECIPES_CONFIG }) {
  const { storageKey, facetA, facetB } = config
  const [recipes, setRecipes] = useLocalStorage(storageKey, [])
  const [filterA, setFilterA] = useState(null)
  const [filterB, setFilterB] = useState(null)
  const [editing, setEditing] = useState(null) // recipe object (new or existing) or null

  const save = (recipe) => {
    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === recipe.id)
      return exists ? prev.map((r) => (r.id === recipe.id ? recipe : r)) : [...prev, recipe]
    })
    setEditing(null)
  }
  const remove = (id) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id))
    setEditing(null)
  }

  const visible = useMemo(
    () =>
      recipes.filter((r) => {
        const a = r[facetA.key] || []
        const b = r[facetB.key] || []
        if (filterA && !a.includes(filterA)) return false
        if (filterB && !b.includes(filterB)) return false
        return true
      }),
    [recipes, filterA, filterB, facetA.key, facetB.key],
  )

  return (
    <section className="mb-10">
      <div className="mb-2 flex justify-end">
        <span className="text-sm text-stone-400">{recipes.length} on file</span>
      </div>
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setEditing(blankRecipe(config))}
          className="flex items-center gap-1.5 bg-stone-900 px-3 py-1.5 text-sm text-cream hover:bg-stone-700"
        >
          <Plus size={15} /> New recipe
        </button>
      </div>

      {/* Filter bar — facet A left, facet B right, full width */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-y border-stone-100 py-3">
        <TagFilter options={facetA.options} active={filterA} onPick={setFilterA} phaseColors={facetA.phaseColors} />
        <TagFilter options={facetB.options} active={filterB} onPick={setFilterB} phaseColors={facetB.phaseColors} />
      </div>

      {recipes.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">No recipes yet.</p>
      ) : visible.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">Nothing matches that filter.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <RecipeCard key={r.id} recipe={r} facetA={facetA} facetB={facetB} onOpen={() => setEditing(r)} />
          ))}
        </div>
      )}

      {editing && (
        <RecipeModal
          config={config}
          recipe={editing}
          isNew={!recipes.some((r) => r.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </section>
  )
}

// Editorial filter tags — plain tracked-caps text, soft underline when active.
function TagFilter({ options, active, onPick, phaseColors }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {options.map((o) => {
        const on = active === o.id
        const underline = phaseColors ? PHASES[o.id]?.color : '#a8a29e'
        return (
          <button
            key={o.id}
            onClick={() => onPick(on ? null : o.id)}
            className={`text-[11px] uppercase tracking-[0.18em] transition-colors ${
              on ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-700'
            }`}
            style={on ? { textDecoration: 'underline', textUnderlineOffset: '5px', textDecorationColor: underline } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function RecipeCard({ recipe, facetA, facetB, onOpen }) {
  const aVals = recipe[facetA.key] || []
  const bVals = recipe[facetB.key] || []
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-start border border-stone-200 bg-white/40 p-4 text-left transition-shadow hover:shadow-md"
    >
      <h3 className="font-serif text-xl text-stone-900">{recipe.name || 'Untitled'}</h3>
      {recipe.prep && recipe.prep.trim() ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-500">{recipe.prep.trim()}</p>
      ) : (
        <p className="mt-2 text-sm italic text-stone-300">No notes yet.</p>
      )}
      {(aVals.length || bVals.length) ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {aVals.map((v) => (
            <span key={v} className="border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">{labelOf(facetA, v)}</span>
          ))}
          {bVals.map((v) =>
            facetB.phaseColors ? (
              <span key={v} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-stone-500">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PHASES[v]?.color }} />
                {labelOf(facetB, v)}
              </span>
            ) : (
              <span key={v} className="border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">{labelOf(facetB, v)}</span>
            ),
          )}
        </div>
      ) : null}
    </button>
  )
}

function FacetEditor({ facet, values, onToggle }) {
  return (
    <div>
      <span className="kicker text-stone-400 mb-2 block">{facet.label}</span>
      <div className="flex flex-wrap gap-1.5">
        {facet.options.map((o) => {
          const on = values.includes(o.id)
          if (facet.phaseColors) {
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onToggle(o.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors"
                style={
                  on
                    ? { backgroundColor: PHASES[o.id].color, color: PHASES[o.id].ink, borderColor: PHASES[o.id].color }
                    : { borderColor: '#d6d3d1', color: '#57534e' }
                }
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PHASES[o.id].color }} />
                {o.label}
              </button>
            )
          }
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              className={`px-2.5 py-1 text-xs border transition-colors ${
                on ? 'bg-stone-900 text-cream border-stone-900' : 'border-stone-300 text-stone-600 hover:border-stone-500'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RecipeModal({ config, recipe, isNew, onClose, onSave, onDelete }) {
  const { facetA, facetB } = config
  const [draft, setDraft] = useState(() => ({
    ...blankRecipe(config),
    ...recipe,
    ingredients: recipe.ingredients ? [...recipe.ingredients] : [],
    [facetA.key]: recipe[facetA.key] ? [...recipe[facetA.key]] : [],
    [facetB.key]: recipe[facetB.key] ? [...recipe[facetB.key]] : [],
  }))
  const [ing, setIng] = useState({ name: '', amount: '', unit: 'cup' })

  const toggle = (key, value) =>
    setDraft((d) => {
      const has = d[key].includes(value)
      return { ...d, [key]: has ? d[key].filter((x) => x !== value) : [...d[key], value] }
    })

  const addIngredient = () => {
    if (!ing.name.trim()) return
    setDraft((d) => ({ ...d, ingredients: [...d.ingredients, { id: uid(), ...ing, name: ing.name.trim() }] }))
    setIng({ name: '', amount: '', unit: 'cup' })
  }
  const removeIngredient = (id) => setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((x) => x.id !== id) }))
  const updateIngredient = (id, patch) =>
    setDraft((d) => ({ ...d, ingredients: d.ingredients.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 px-4 py-10 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-xl bg-cream border border-stone-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Recipe name"
            autoFocus
            className="w-full bg-transparent font-serif italic text-3xl text-stone-900 placeholder-stone-300 outline-none"
          />
          <button onClick={onClose} className="mt-1 text-stone-400 hover:text-stone-900">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[64vh] overflow-y-auto px-6 py-5 space-y-6">
          {/* Tags */}
          <FacetEditor facet={facetA} values={draft[facetA.key]} onToggle={(v) => toggle(facetA.key, v)} />
          <FacetEditor facet={facetB} values={draft[facetB.key]} onToggle={(v) => toggle(facetB.key, v)} />

          {/* Ingredients */}
          <div>
            <span className="kicker text-stone-400 mb-2 block">Ingredients</span>
            <div className="divide-y divide-stone-100">
              {draft.ingredients.map((x) => (
                <div key={x.id} className="group flex items-center gap-2 py-1.5">
                  <span className="flex-1 text-sm text-stone-800">{x.name}</span>
                  <input
                    value={x.amount}
                    onChange={(e) => updateIngredient(x.id, { amount: e.target.value })}
                    className="w-14 bg-transparent border-b border-stone-200 pb-0.5 text-sm text-right outline-none focus:border-stone-900"
                  />
                  <select
                    value={x.unit}
                    onChange={(e) => updateIngredient(x.id, { unit: e.target.value })}
                    className="bg-transparent text-xs text-stone-500 outline-none"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={() => removeIngredient(x.id)} className="text-stone-300 opacity-0 transition-opacity hover:text-stone-700 group-hover:opacity-100">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={ing.name}
                onChange={(e) => setIng({ ...ing, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
                placeholder="Ingredient"
                className="flex-1 bg-transparent border-b border-stone-300 pb-1 text-sm outline-none focus:border-stone-900"
              />
              <input
                value={ing.amount}
                onChange={(e) => setIng({ ...ing, amount: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && addIngredient()}
                placeholder="Amt"
                className="w-14 bg-transparent border-b border-stone-300 pb-1 text-sm text-right outline-none focus:border-stone-900"
              />
              <select
                value={ing.unit}
                onChange={(e) => setIng({ ...ing, unit: e.target.value })}
                className="bg-transparent border-b border-stone-300 pb-1 text-xs text-stone-500 outline-none"
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <button onClick={addIngredient} className="bg-stone-900 px-2 py-1 text-cream hover:bg-stone-700"><Plus size={14} /></button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <span className="kicker text-stone-400 mb-2 block">Cooking & prep notes</span>
            <textarea
              value={draft.prep}
              onChange={(e) => setDraft({ ...draft, prep: e.target.value })}
              placeholder="Method, timing, anything to remember"
              className="w-full min-h-[120px] resize-y bg-white/50 border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4">
          {isNew ? (
            <span />
          ) : (
            <button onClick={() => onDelete(draft.id)} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-phase-menstrual">
              <Trash2 size={15} /> Delete
            </button>
          )}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
            <button
              onClick={() => onSave({ ...draft, name: draft.name.trim() || 'Untitled' })}
              className="px-5 py-2 text-sm bg-stone-900 text-cream hover:bg-stone-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
