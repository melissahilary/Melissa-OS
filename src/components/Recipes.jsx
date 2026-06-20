import React, { useState } from 'react'
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const uid = () => Math.random().toString(36).slice(2, 10)
const UNITS = ['cup', 'tbsp', 'tsp', 'oz', 'g', 'lb', 'ml', 'L', 'piece', 'clove', 'pinch', 'to taste']

export default function Recipes() {
  const [recipes, setRecipes] = useLocalStorage('mos:menu:recipes', [])
  const [expanded, setExpanded] = useState(null)
  const [draft, setDraft] = useState('')

  const add = () => {
    if (!draft.trim()) return
    const r = { id: uid(), name: draft.trim(), ingredients: [], prep: '' }
    setRecipes((prev) => [...prev, r])
    setDraft('')
    setExpanded(r.id)
  }
  const update = (id, patch) => setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const remove = (id) => setRecipes((prev) => prev.filter((r) => r.id !== id))

  return (
    <section>
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="kicker text-stone-400 mb-2">The kitchen</p>
          <h2 className="font-serif italic text-3xl md:text-4xl text-stone-900">Recipes.</h2>
        </div>
        <span className="text-sm text-stone-400">{recipes.length} on file</span>
      </header>

      <div className="mb-6 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="A dish worth keeping"
          className="flex-1 bg-transparent border-b border-stone-300 pb-1.5 text-sm outline-none focus:border-stone-900"
        />
        <button onClick={add} className="bg-stone-900 px-2.5 py-1.5 text-cream hover:bg-stone-700"><Plus size={16} /></button>
      </div>

      {recipes.length === 0 ? (
        <p className="font-serif italic text-lg text-stone-400">No recipes yet.</p>
      ) : (
        <div className="space-y-2">
          {recipes.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              open={expanded === r.id}
              onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              onUpdate={(patch) => update(r.id, patch)}
              onRemove={() => remove(r.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function RecipeCard({ recipe: r, open, onToggle, onUpdate, onRemove }) {
  const [ing, setIng] = useState({ name: '', amount: '', unit: 'cup' })

  const addIngredient = () => {
    if (!ing.name.trim()) return
    onUpdate({ ingredients: [...r.ingredients, { id: uid(), ...ing, name: ing.name.trim() }] })
    setIng({ name: '', amount: '', unit: 'cup' })
  }
  const removeIngredient = (id) => onUpdate({ ingredients: r.ingredients.filter((x) => x.id !== id) })
  const updateIngredient = (id, patch) =>
    onUpdate({ ingredients: r.ingredients.map((x) => (x.id === id ? { ...x, ...patch } : x)) })

  return (
    <div className="border border-stone-200">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className="text-stone-400 hover:text-stone-900">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        <button onClick={onToggle} className="flex-1 text-left">
          <span className="font-serif text-xl text-stone-900">{r.name}</span>
          {r.ingredients.length > 0 && (
            <span className="ml-2 text-xs text-stone-400">{r.ingredients.length} ingredients</span>
          )}
        </button>
        <button onClick={onRemove} className="text-stone-300 hover:text-stone-700"><X size={16} /></button>
      </div>

      {open && (
        <div className="border-t border-stone-200 px-5 py-5 space-y-5">
          <div>
            <p className="kicker text-stone-400 mb-2">Ingredients</p>
            <div className="divide-y divide-stone-100">
              {r.ingredients.map((x) => (
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

          <div>
            <p className="kicker text-stone-400 mb-1.5">Cooking & prep notes</p>
            <textarea
              value={r.prep}
              onChange={(e) => onUpdate({ prep: e.target.value })}
              placeholder="Method, timing, anything to remember"
              className="w-full min-h-[100px] resize-y bg-cream border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
            />
          </div>
        </div>
      )}
    </div>
  )
}
