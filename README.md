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

## Deploy to Cloudflare Pages

The repo is wired for Cloudflare Pages. `wrangler.toml` sets the build output to
`dist/`, and `public/_redirects` provides the SPA fallback (`/* /index.html 200`)
so deep links resolve.

**Git-connected (recommended):** create a Pages project pointed at this repo with
build command `npm run build` and output directory `dist`. Every push redeploys.

**Direct upload via Wrangler:**

```bash
npm run build
npx wrangler pages deploy dist --project-name melissa-os
```

Data lives in `localStorage` tied to the deployed domain, so it survives every
redeploy. Use a stable custom domain to keep the same data across deploys.

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
