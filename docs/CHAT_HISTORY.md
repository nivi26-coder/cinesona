# Cinesona — Chat History (condensed)

Summary of the Claude Code conversation that created this project (2026-10-01).
Use this to give context to another editor or AI assistant. See `PLAN.md` for the current plan and progress.

---

## 1. "I have data in the MongoDB extension. What project can I build? Prefer SaaS, latest tech, hosting I need to learn."

- Claude first inspected the **local** MongoDB (`127.0.0.1:27017`) and found `travel_app`:
  - `destinations` (24 docs: name, country, price, rating, tags, image)
  - `bookings` (58 docs; 57 pointed to deleted destinations, all test data)
- Suggested a multi-tenant travel-agency booking SaaS, plus a stack and hosting path.

## 2. "I meant this" (screenshot of VS Code MongoDB extension → `cluster0.nlx4fgh.mongodb.net` → `sample_mflix`)

- Clarified that the real data is the **Atlas sample dataset `sample_mflix`**: movies, embedded_movies (with vector embeddings), comments, users, theaters (GeoJSON), sessions.
- Claude did not connect directly (the connection string lives inside the VS Code extension).
- Ideas proposed:
  1. **CineMatch: AI movie discovery** (recommended): semantic search, RAG chat with Claude, Atlas Search autocomplete, watchlists, freemium.
  2. Cinema chain booking SaaS.
  3. Movie recommendation API SaaS.
- Stack: Next.js + TS, Tailwind + shadcn/ui, Vercel AI SDK, Atlas Search + Vector Search, Claude API, Voyage AI, Clerk/Better Auth, Stripe, Upstash, Sentry, PostHog.
- Caveat: existing `plot_embedding` uses OpenAI `text-embedding-ada-002`; query embeddings must match, or re-embed with Voyage.
- 5-week roadmap (see PLAN.md).

## 3. "All this can be used in free tier? If yes proceed. Create folder in D:\react_projects\, refer same git config as D:\react_projects\mediavault-assessment"

**Free tier answer:** mostly yes. Exceptions: Claude API (pay-as-you-go), custom domain (~$10/yr), Vercel Hobby is non-commercial only, Railway/Fly have only trial credit.

**What was built** in `D:\react_projects\cinematch`:
- `create-next-app@latest` → Next.js **16.3.8**, React 19.2, Tailwind v4, ESLint; added `mongodb` 7, `zod` 4, `server-only`.
- Week 1 features: browse grid, genre filter, sort, pagination, Atlas Search + regex fallback, autocomplete combobox, movie detail page (scores, credits, similar movies, comments), loading/error/404 states, setup notice, `npm run db:indexes`.
- Git: `git init -b main`, local `user.name=nivi26-coder`, `user.email=nithishvishal007@gmail.com`, remote `git@github-nivi26coder:nivi26-coder/cinematch.git`. **No commit yet.**

**Verification done:** `typecheck`, `lint`, `build` all pass. Smoke-tested `next start` against a temporary local DB (`cinematch_smoke`, dropped afterwards): sorting, fallback search, genre filter, suggest API, detail page, 404s all OK. **Not yet tested against real Atlas data.**

**Problems found & fixed during the build (useful lessons):**
- Next 16 differs from older versions: `params`/`searchParams` are Promises; `PageProps<'/route'>` is a global type helper; Cache Components are opt-in. Read `node_modules/next/dist/docs/` (per `AGENTS.md`).
- Home page was being **statically prerendered** because it returned the setup notice before reading `searchParams`. Fix: `await props.searchParams` first.
- Mongo driver typings reject `$type: "number"` on a `number | string` field. Used `year: { $gte: 1800 }` instead (range never matches strings).
- Unknown movie IDs returned HTTP **200** ("soft 404") because the root `loading.tsx` starts streaming before `notFound()`. Fix: moved home `page.tsx` + `loading.tsx` into a `(home)` route group.
- Atlas Search with a missing index returns 0 results (not an error), so search also falls back to regex when page 1 is empty.
- Posters use `unoptimized` images to stay within the Vercel Hobby image-optimization quota; dead poster URLs show a title tile.

## 4. "Copy this plan into an md file in the docs folder with links and chat history; mark what's done and not done"

- Created `docs/PLAN.md` (plan, status, checklist, stack, free tiers, links) and this file.

## 5. Renamed to **Cinesona** (2026-10-01)

- "CineMatch" is already in use online, so we looked for a name that is unused across the internet, not only on GitHub.
- Checked about 60 invented names: .com/.app registration through the registries' RDAP endpoints, then a web search for existing products.
- Shortlist (both domains free, no product found): **Cinesona** (cine + persona), FlickSage, ReelWhim, FlickOracle, VibeMatinee, MoodMatinee. Rejected: CineWhim (projector-rental business in Houston), TonightReel (too close to the "NightReel" AI movie-picks app).
- **Chose Cinesona.** Still to do: trademark search (USPTO / WIPO / India IP) and register `cinesona.com`.
- Renamed in `package.json`, `package-lock.json`, the page title and header in `layout.tsx`, the Mongo `appName`, README, PLAN, and the index script comment. The local folder was later renamed to `D:\react_projects\cinesona`.
- Git remote is now `git@github-nivi26coder:nivi26-coder/cinesona.git` (repository not created on GitHub yet; `gh` CLI is not installed, so create it on the website, empty, with no README).
- Git identity in this repo: local `nivi26-coder <nithishvishal007@gmail.com>` (global is `Nithish Vishal`, which this repo overrides). SSH alias `github-nivi26coder` authenticates as nivi26-coder.

## 6. Connected to Atlas (2026-10-01)

- The Atlas connection string had been pasted into `.env.example`. Moved it to `.env.local`, because `.gitignore` excludes `.env*` but keeps `.env.example` (`!.env.example`), so the password would have been pushed to GitHub. The app and `db:indexes` only read `.env.local`. `.env.example` has the `<user>:<password>` placeholder again.
- `npm run db:indexes` created the `comments` index and the `movies_search` Atlas Search index.
- Checked against real data: home, sort, genre filter, pagination, Atlas Search, movie details (comments, "More like this"), real 404s.
- Fixed autocomplete ranking: fuzzy matching ranked "The Goddess" above "The Godfather" for "godf", and "W." above Star Wars for "star w". Now the order is title starts with the query (ignoring a leading The/A/An), then a word starts with it, then typo matches, each sorted by IMDb votes.
- typecheck, lint, build pass. Still not committed.

---

## Open questions / decisions still to make
- Auth provider: **Clerk** (fastest, hosted) vs **Better Auth** (open source, self-hosted in your DB).
- Embeddings: match existing OpenAI ada-002 vectors vs re-embed with **Voyage AI**.
- Create the GitHub repo `nivi26-coder/cinesona`, then make the first commit and push.
