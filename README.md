# Melissa OS — Melissa's Digital Planner

A private React digital planner with an editorial, old-money aesthetic. Cycle-synced
meal planning, daily schedule, wellness protocol tracking, housing, and Dream World
lifestyle design. Data lives in a hosted Postgres (Supabase), tied to your account.

## Your data, on every device

Open the URL, enter your email, click the magic link, and you're in — no password,
no folders, no syncing. Your planner is stored in Supabase Postgres, scoped to your
user account by row-level security, so it's there on every device automatically and
saved the moment you change it.

- **Auth:** Supabase magic-link (passwordless). The session persists, so you rarely
  re-enter your email.
- **Storage:** one `planner_state` table — a row per `(user_id, key)` holding the
  JSON the app uses. RLS guarantees you only ever see your own rows.
- The publishable/anon key shipped in the client is public by design; RLS is what
  keeps data private.

### One-time Supabase setup (required for magic links)

In the Supabase dashboard → **Authentication → URL Configuration**, set:
- **Site URL** → your production URL (the Cloudflare Pages URL).
- **Redirect URLs** → add both your production URL and `http://localhost:5173`
  (Vite dev) so the magic link can return to the app.

Magic-link emails use Supabase's built-in sender on the free tier (low rate limit;
may land in spam). Override the project with your own values via env vars if needed:

```bash
# .env.local
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```

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

Because your data lives in Supabase (not in the deployment), it follows you across
every deploy and every device. After the site is live, add its URL to the Supabase
redirect allow-list (above), open it, sign in with the magic link, and your data is
there. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as Pages environment
variables if you don't want to rely on the in-code defaults.

## Architecture

- `src/lib/supabaseClient.js` — the Supabase browser client.
- `src/lib/dataStore.js` — the data layer. Loads all of the user's rows on sign-in,
  upserts changes (debounced), manages the auth session, and broadcasts changes so
  every reader updates live.
- `src/components/AuthGate.jsx` — splash / magic-link login / app gating.
- `src/hooks/useLocalStorage.js` — thin `[value, setValue, isLoaded]` hook over
  the data store (name kept for compatibility).
- `src/lib/cycle.js` — phase auto-calculation, locked phase nutrition lists,
  frequency codes, hydration unit conversion.
- `src/lib/date.js` — calendar grids, week ranges, moon-phase math.
- `src/components/shared/NotesPopup.jsx` — the universal item-detail modal used by
  every food/supplement/drink/grocery item.

All storage keys are prefixed `mos:`.
