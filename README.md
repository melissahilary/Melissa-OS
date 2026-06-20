# Melissa OS — Melissa's Digital Planner

A private React digital planner with an editorial, old-money aesthetic. Cycle-synced
meal planning, daily schedule, wellness protocol tracking, housing, and Dream World
lifestyle design. No backend — everything persists in the browser via localStorage.

## Stack

- React 18.3.1 + Vite 5.3.4
- Tailwind CSS 3.4.6 (cream / ink / sand / mauve + four cycle-phase colors)
- lucide-react icons
- Cormorant Garamond (serif), Inter (sans), Pinyon Script (the two brand signatures)

## Run locally

```bash
npm install
npm run dev      # local dev server
npm run build    # outputs dist/
npm run preview  # preview the production build
```

## Deploy to Netlify

Run `npm run build`, then drag the generated `dist/` folder onto the existing
Netlify site's **Deploys** tab (not netlify.com/drop, which creates a new URL).
`netlify.toml` already includes the SPA redirect. Data lives in localStorage tied
to the deployed domain, so it survives every redeploy.

## Architecture

- `src/hooks/useLocalStorage.js` — persistent state with double-write redundancy
  (`window.storage` + `localStorage`), a pre-load write queue, and a
  `mos:storage:change` event bus so components reading the same key sync live.
- `src/lib/cycle.js` — phase auto-calculation, locked phase nutrition lists,
  frequency codes, hydration unit conversion.
- `src/lib/date.js` — calendar grids, week ranges, moon-phase math.
- `src/components/shared/NotesPopup.jsx` — the universal item-detail modal used by
  every food/supplement/drink/grocery item.

All storage keys are prefixed `mos:`.
