# Melissa OS — project guide for Claude Code

A private React digital planner for Melissa Devenish. Editorial old-money aesthetic.
No "Glow Protocol" branding anywhere — this is a personal planner.

## Stack
- React 18 + Vite 5 + Tailwind 3, lucide-react icons.
- Fonts: Cormorant Garamond (serif), Inter (sans), Pinyon Script (cursive — only
  "Daily Schedule" and "Melissa's Digital Planner").
- Build: `npm run build` → `dist/`.

## Data & auth — Supabase
- Project ref: `rqtfmhenwmzbeowlqjli` (org "Melissa Devenish").
- Passwordless magic-link auth (Supabase Auth). All data is tied to the user's
  account via RLS.
- Single table `planner_state`: one row per `(user_id, key)` holding a JSON blob.
- Data layer: `src/lib/dataStore.js` (loads rows on sign-in, debounced upserts).
  `src/hooks/useLocalStorage.js` is a thin hook over it (name kept for compat).
- Public URL + publishable key live in `src/lib/supabaseClient.js` (safe to ship;
  RLS is the protection). Env overrides: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Storage keys are prefixed `mos:`.

## Daily horoscope (Today page)
- Deterministic ephemeris in the browser: `src/lib/astrology/` (natal chart
  hard-coded; `transits.js` computes today's geocentric tropical longitudes via
  `astronomy-engine` and aspects them to natal points). Math stays in code.
- Voice from Claude via the Vercel serverless function `api/horoscope.js`
  (model `claude-opus-4-8`). Needs `ANTHROPIC_API_KEY` set in Vercel env; without
  it the card falls back to a deterministic written-from-the-aspects reading.
- Cached per day in `mos:horoscope` so it's at most one LLM call/day.

## Palette — settled, do not change
Melissa signed off on this and asked that it not move. Treat the colours and
the shapes below as fixed; propose, never apply, a change to them.
- Ground `#F8F4EC` · ink `#16130F` · ivory `#F7F4ED` · list panel `#EEEAE1`.
- Cobalt `#1D2FC4` — the AM/PM blocks, the open tab's underline, focus. It
  means "due" or "the section you are in", never a warning or a success.
- Walnut `#68472C` — the day schedule, every sheet (Let go, Add to day,
  Add to a sitting), the month picker. Tan `#C0966F` for labels on it.
- Oxblood `#C87A7A` — the ONLY red. Slide-to-delete and "Let it go", nothing
  else.
- Sitting grounds run light to dark through the day (`src/lib/meals.js`).
- No radii, no shadows (both are forced off in `src/index.css`). A lift is
  said with an outline and an opaque ground.
- One affordance per job: slide a row aside to delete it (never a ×), one `+`
  at the foot of a list, the two-button Let go sheet for anything repeating.
- The page stays where she left it. Anything that opens over the page must not
  move the page under it; `src/lib/holdScroll.js` pins the body while any
  full-screen sheet (fixed, inset-0, z ≥ 50) is up and puts her back after.
  It is global — a new sheet gets this for free and must not fight it.

## Branches & deploy
- Develop on `claude/friendly-albattani-4dzpko`; `main` is production.
- Push to `main` ONLY (one deployment per change). Commit on the feature branch
  locally, `git merge --ff-only` into `main`, and push `main` alone — do not push
  the feature branch (it spawns a redundant preview deploy).
- Vercel Git integration auto-deploys `main`.
  - Project: `melissa-os`, framework Vite. Live: https://melissa-os.vercel.app
  - Vercel team "Glow Protocol": `team_OuXAEo7YnHHcXjqEE70tFgmr` (team label only,
    not in the code).
  - `vercel.json` sets build/output + SPA rewrite; `public/_redirects` is the
    SPA fallback for other static hosts.

## Standing workflow
- "Build X" means: implement, commit, push to `main` (auto-deploys).
- AFTER every push to `main`, verify the deploy via the Vercel MCP:
  `get_deployment` for `melissa-os.vercel.app` with the team id above. Report
  `readyState`, the deployed `githubCommitSha`, and the URL. If it failed, pull
  `get_deployment_build_logs` and fix.
- Always run `npm run build` locally before pushing.
- Note: this sandbox blocks outbound network, so `curl`/CLI deploys fail here;
  use git push + the Vercel MCP (which works) instead.
