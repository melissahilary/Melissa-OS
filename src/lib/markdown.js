// Render selected structured data into human-readable Markdown so the owned
// folder is pleasant to read, grep, and edit in Obsidian. JSON remains the
// round-tripping source of truth; these files are a generated mirror.

const ROMAN = ['i', 'ii', 'iii']

function dailyNote(dateStr, dream, todos, brain) {
  const lines = [`# ${dateStr}`, '']
  let any = false

  const priorities = (todos || []).filter((t) => t && t.text && t.text.trim())
  if (priorities.length) {
    any = true
    lines.push('## Top priorities', '')
    priorities.forEach((t, i) => lines.push(`${ROMAN[i] || i + 1}. ${t.text.trim()}`))
    lines.push('')
  }

  const blocks = [
    ['Morning', dream && dream.morning],
    ['Afternoon', dream && dream.afternoon],
    ['Evening', dream && dream.evening],
  ].filter(([, items]) => items && items.length)
  if (blocks.length) {
    any = true
    lines.push('## My dream day', '')
    blocks.forEach(([label, items]) => {
      lines.push(`### ${label}`)
      items.forEach((it) => lines.push(`- [${it.done ? 'x' : ' '}] ${it.text}`))
      lines.push('')
    })
  }

  const dump = (brain || []).filter((b) => b && b.text)
  if (dump.length) {
    any = true
    lines.push('## Brain dump', '')
    dump.forEach((b) => lines.push(`- ${b.text}`))
    lines.push('')
  }

  return any ? lines.join('\n') : null
}

function recipesNote(recipes) {
  if (!recipes || !recipes.length) return null
  const lines = ['# Recipes', '']
  recipes.forEach((r) => {
    lines.push(`## ${r.name}`, '')
    if (r.ingredients && r.ingredients.length) {
      lines.push('**Ingredients**', '')
      r.ingredients.forEach((x) =>
        lines.push(`- ${[x.amount, x.unit].filter(Boolean).join(' ')} ${x.name}`.replace(/\s+/g, ' ').trim()),
      )
      lines.push('')
    }
    if (r.prep && r.prep.trim()) {
      lines.push('**Prep**', '', r.prep.trim(), '')
    }
  })
  return lines.join('\n')
}

function intentionsNote(items) {
  if (!items || !items.length) return null
  const lines = ['# Diet intentions', '']
  const groups = [
    ['Foods', 'food'],
    ['Drinks', 'drink'],
    ['Supplements', 'supplement'],
  ]
  groups.forEach(([label, cat]) => {
    const list = items.filter((i) => i.category === cat)
    if (!list.length) return
    lines.push(`## ${label}`, '')
    list.forEach((i) => lines.push(`- ${i.name} — ${i.freq}`))
    lines.push('')
  })
  return lines.join('\n')
}

function groceriesNote(items) {
  if (!items || !items.length) return null
  const lines = ['# Grocery list', '']
  items.forEach((i) => {
    const meta = [i.qty, i.store, i.date].filter(Boolean).join(' · ')
    lines.push(`- [${i.done ? 'x' : ' '}] ${i.name}${meta ? ` (${meta})` : ''}`)
  })
  lines.push('')
  return lines.join('\n')
}

export function buildMarkdownFiles(cacheObj) {
  const files = []

  // Daily notes — one file per date that has content.
  const dream = cacheObj['mos:today:dream-v2'] || {}
  const todos = cacheObj['mos:today:todos-v2'] || {}
  const brain = cacheObj['mos:today:brain-v2'] || {}
  const dates = new Set([...Object.keys(dream), ...Object.keys(todos), ...Object.keys(brain)])
  dates.forEach((d) => {
    const content = dailyNote(d, dream[d], todos[d], brain[d])
    if (content) files.push({ path: `Daily Notes/${d}.md`, content })
  })

  const recipes = recipesNote(cacheObj['mos:menu:recipes'])
  if (recipes) files.push({ path: 'Recipes.md', content: recipes })

  const intentions = intentionsNote(cacheObj['mos:menu:incorporations'])
  if (intentions) files.push({ path: 'Diet Intentions.md', content: intentions })

  const groceries = groceriesNote(cacheObj['mos:menu:groceries'])
  if (groceries) files.push({ path: 'Grocery List.md', content: groceries })

  return files
}
