# Melissa OS — Melissa's Digital Planner

A private React digital planner with an editorial, old-money aesthetic. Cycle-synced
meal planning, daily schedule, wellness protocol tracking, housing, and Dream World
lifestyle design. No backend — your data lives in a folder **you** own.

## Your data is owned files

The planner writes to a real folder you choose (via the browser's File System Access
API). Put that folder inside Obsidian, iCloud, or Dropbox and it syncs across devices
for free — no server, no cloud database.

- **Structured data → JSON** in `Melissa OS/data/*.json` (one file per store key).
- **Notes → Markdown** mirror: `Daily Notes/<date>.md`, `Recipes.md`,
  `Diet Intentions.md`, `Grocery List.md` — greppable, diffable, editable by hand
  or by Claude Code.
- The folder is the **single source of truth**. When it's connected, it wins on load.
- `localStorage` is only a fast cache / fallback for browsers without the API
  (Firefox, Safari) — never the canonical store.

Click **Connect a folder** in the sidebar to pick your folder. The handle is
remembered across reloads; after a browser restart you may need to click
**Reconnect folder** once (browsers require a fresh gesture to re-grant access).
Requires a Chromium browser (Chrome / Edge) for folder sync.

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

Because your data lives in your own folder (not in the deployment), it follows you
across every deploy and across devices. After the site is live, open it, click
**Connect a folder**, pick your synced folder, and confirm your real entries load
from the files — not from a per-browser `localStorage` ghost.

## Architecture

- `src/lib/fileStore.js` — the data layer. Reads/writes JSON to your connected
  folder (source of truth), mirrors notes to Markdown, caches in `localStorage`,
  and broadcasts changes so every reader updates live.
- `src/lib/markdown.js` — renders structured data into the Markdown mirror.
- `src/lib/idb.js` — persists the chosen directory handle across reloads.
- `src/hooks/useLocalStorage.js` — thin `[value, setValue, isLoaded]` hook over
  the file store (name kept for compatibility).
- `src/lib/cycle.js` — phase auto-calculation, locked phase nutrition lists,
  frequency codes, hydration unit conversion.
- `src/lib/date.js` — calendar grids, week ranges, moon-phase math.
- `src/components/shared/NotesPopup.jsx` — the universal item-detail modal used by
  every food/supplement/drink/grocery item.

All storage keys are prefixed `mos:`.
