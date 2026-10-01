# Cinesona — Project Plan & Progress

> AI-powered movie discovery SaaS built on the MongoDB Atlas `sample_mflix` dataset.
> Goal: learn modern full-stack SaaS development and hosting while building a real, deployable product.

**Last updated:** 2026-10-01
**Overall progress:** Week 1 done and verified against Atlas (~20% of roadmap). Not committed, not deployed.

---

## 1. Status at a glance

| Area | Status |
|---|---|
| Project scaffold (Next.js 16, TS, Tailwind v4) | ✅ Done |
| Week 1: browse, filter, sort, search, autocomplete, movie details | ✅ Done, verified against Atlas |
| Connected to Atlas `sample_mflix` | ✅ Done (`.env.local`) |
| Atlas Search index created | ✅ Done (`movies_search` + `comments` index) |
| Git repo initialised + config | ✅ Done (no commits yet) |
| GitHub repo created / pushed | ❌ Not done |
| Deployed to Vercel | ❌ Not done |
| Week 2: Vector "search by vibe" | ❌ Not started |
| Week 3: Auth, watchlists, reviews | ❌ Not started |
| Week 4: AI chat assistant (RAG) | ❌ Not started |
| Week 5: Stripe, rate limits, Docker, CI, domain | ❌ Not started |

---

## 2. Immediate next steps (do these first)

- [x] Copy `.env.example` → `.env.local`, paste Atlas connection string (Atlas → Cluster0 → **Connect → Drivers**)
- [x] Atlas → **Network Access** → add your IP (use `0.0.0.0/0` later for Vercel)
- [x] `npm run db:indexes` (creates `comments` index + `movies_search` Atlas Search index; wait 1–2 min for build)
- [x] `npm run dev` → verify http://localhost:3000 against real data
- [ ] First commit: `git add -A && git commit -m "feat: week 1 — browse, search, movie details"`
- [ ] Create GitHub repo `nivi26-coder/cinesona` and `git push -u origin main`
- [ ] Import repo on Vercel, add `MONGODB_URI` + `MONGODB_DB` env vars, deploy

---

## 3. The dataset (`sample_mflix` on `cluster0.nlx4fgh.mongodb.net`)

| Collection | ~Docs | Contents | Used for |
|---|---|---|---|
| `movies` | 21,000 | title, plot, fullplot, genres, cast, directors, writers, year, runtime, poster, imdb {rating, votes}, tomatoes, awards | Browse, search, details |
| `embedded_movies` | 3,500 | Same + `plot_embedding` vector (OpenAI `text-embedding-ada-002`, 1536 dims) | Week 2 vector search |
| `comments` | 41,000 | movie_id, name, email, text, date | Movie page comments |
| `users` | 185 | name, email, hashed password | Reference only (real auth in Week 3) |
| `theaters` | 1,500 | address + GeoJSON location | Optional "theaters near me" (`$geoNear`) |
| `sessions` | 1 | sample session | Not used |

**Data quirks handled in code:** `imdb.rating`/`votes` sometimes `""`; `year` sometimes a string like `"2007è"`; many poster URLs are dead.

**Embedding catch (Week 2):** query vectors must come from the same model as `plot_embedding` (OpenAI ada-002), **or** re-embed plots with Voyage AI and query with Voyage.

---

## 4. Project ideas considered

1. **Cinesona (originally "CineMatch") — AI movie discovery (CHOSEN)**: semantic search, RAG chat, watchlists, freemium + Pro subscription.
2. Cinema chain booking SaaS (multi-tenant B2B): showtimes, tickets, `$geoNear` on theaters.
3. Movie recommendation API (developer SaaS): API keys, rate limits, usage-based billing.

Earlier idea (from local `travel_app` DB, not pursued): multi-tenant booking SaaS for travel agencies.

---

## 5. Tech stack

| Layer | Choice | Status |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Components) + TypeScript | ✅ In use |
| UI | Tailwind CSS v4 (custom tokens, light/dark) | ✅ In use |
| UI kit | shadcn/ui | ❌ Not added yet |
| Database | MongoDB Atlas M0 + official `mongodb` Node driver | ✅ In use |
| Search | Atlas Search (autocomplete + fuzzy full-text) | ✅ In use |
| Vector search | Atlas Vector Search | ❌ Week 2 |
| Validation | Zod v4 (URL params) | ✅ In use |
| Embeddings | Voyage AI (or OpenAI ada-002 to match existing vectors) | ❌ Week 2 |
| AI chat | Claude API + Vercel AI SDK (streaming UI) | ❌ Week 4 |
| Auth | Clerk or Better Auth | ❌ Week 3 (decide) |
| Payments | Stripe subscriptions | ❌ Week 5 |
| Rate limiting | Upstash Redis | ❌ Week 5 |
| Monitoring | Sentry (errors), PostHog (analytics) | ❌ Week 5 |
| Testing | Vitest, Playwright | ❌ Not started |

---

## 6. Roadmap & checklist

### Week 1: Browse & search ✅ (code complete)
- [x] Scaffold Next.js 16 + TS + Tailwind + ESLint
- [x] MongoDB client singleton (`src/lib/mongodb.ts`), retries after failed connect
- [x] Movie grid with posters, rating badge, broken-poster fallback
- [x] Genre filter, sort (popular / top rated / newest / A–Z), pagination (limit+1, no slow count)
- [x] URL-driven state validated with Zod; works without JS (`next/form`)
- [x] Atlas Search query (autocomplete + fuzzy text over title/plot/cast/directors)
- [x] Fallback to regex title search when no index / non-Atlas (UI shows notice)
- [x] Autocomplete API `/api/suggest` + accessible combobox (debounce, abort stale requests, keyboard nav)
- [x] Movie details: plot, scores, credits, genres → links, "More like this", comments
- [x] Loading skeleton, error boundary, real HTTP 404 for unknown movies
- [x] Setup notice when `MONGODB_URI` missing
- [x] `npm run db:indexes` script
- [x] Verify against real Atlas data
- [x] Autocomplete ranking: whole-phrase prefix matches first, then by IMDb votes
- [ ] Deploy to Vercel ← pending

### Week 2: Search by vibe (Vector Search) ❌
- [ ] Decide embedding model (match ada-002 or re-embed with Voyage)
- [ ] Create vector index on `embedded_movies.plot_embedding` (+ filter fields genres, year)
- [ ] "Describe what you want to watch" box → `$vectorSearch`
- [ ] Replace genre-based "More like this" with vector similarity

### Week 3: Users ❌
- [ ] Auth (Clerk or Better Auth)
- [ ] Watchlist (add/remove, page)
- [ ] User ratings & reviews (write to own collections, not sample data)
- [ ] Profile page

### Week 4: AI assistant ❌
- [ ] Chat UI with Vercel AI SDK (streaming)
- [ ] RAG: retrieve movies via vector search → Claude answers with real titles
- [ ] Tool use: "add to my watchlist" from chat

### Week 5: SaaS & production ❌
- [ ] Stripe: Free vs Pro plan, checkout, webhook, customer portal
- [ ] AI usage limits per plan (Upstash Redis)
- [ ] Sentry + PostHog
- [ ] Vitest unit tests + Playwright e2e
- [ ] GitHub Actions CI (lint, typecheck, test, build)
- [ ] Dockerfile; deploy a copy to Render / Railway / Fly.io
- [ ] Custom domain via Cloudflare

### Optional extras
- [ ] Theaters near me (`theaters` + `$geoNear` + map)
- [ ] shadcn/ui components
- [ ] Deploy to AWS (App Runner/ECS) or Azure Container Apps

---

## 7. Hosting learning path

1. **Vercel + Atlas M0**: free, auto-deploy from GitHub ← start here
2. **Cloudflare**: domain, DNS, CDN
3. **GitHub Actions**: CI on every push
4. **Docker + Render / Railway / Fly.io**: containers
5. **AWS or Azure containers**: career level

---

## 8. Free tier summary

| Service | Free? | Notes |
|---|---|---|
| MongoDB Atlas M0 | ✅ | 512 MB, max 3 Search/Vector indexes |
| Vercel Hobby | ✅ | **Non-commercial only**; Pro $20/mo when you charge money |
| Clerk / Better Auth | ✅ | Clerk free tier; Better Auth open source |
| Stripe | ✅ | Test mode free; live = per-transaction fee |
| Voyage AI | ✅ | Free token allowance |
| Claude API | ❌ | Pay-as-you-go (pennies while learning) |
| GitHub Actions, Cloudflare, Sentry, PostHog, Upstash, Resend | ✅ | Free tiers |
| Render | ✅ | Free services sleep when idle |
| Railway / Fly.io | ⚠️ | Trial credit only |
| Custom domain | ❌ | ~$10/yr (optional) |

---

## 9. Project structure & key files

```
cinesona/
  .env.example                 env template (MONGODB_URI, MONGODB_DB)
  .nvmrc                       Node 22
  scripts/setup-indexes.mjs    creates comments index + movies_search Atlas Search index
  docs/                        this plan + chat history
  src/
    app/
      layout.tsx               header/footer, fonts, metadata
      globals.css              color tokens (light/dark)
      not-found.tsx, error.tsx
      (home)/page.tsx          home: filters + grid + pagination
      (home)/loading.tsx       skeleton (scoped here so movie pages can 404 properly)
      movies/[id]/page.tsx     movie details, similar, comments
      api/suggest/route.ts     autocomplete endpoint
    components/                SearchBox, FilterBar, MovieCard, Poster, RatingBadge, Pagination, SetupNotice
    lib/
      mongodb.ts               cached MongoClient
      movies.ts                all queries (list, search, suggest, detail, comments, similar, genres)
      query.ts                 Zod URL param parsing + URL building
      sorts.ts                 sort options (shared client/server)
      format.ts                runtime/votes/date formatting
```

**Scripts:** `dev`, `build`, `start`, `lint`, `typecheck`, `db:indexes`

**Git:** local user `nivi26-coder <nithishvishal007@gmail.com>`, remote `git@github-nivi26coder:nivi26-coder/cinesona.git` (SSH alias in `~/.ssh/config`, same as `mediavault-assessment`).

---

## 10. Useful links

**Your accounts / consoles**
- MongoDB Atlas: https://cloud.mongodb.com
- Vercel: https://vercel.com/dashboard · New project: https://vercel.com/new
- GitHub: https://github.com/nivi26-coder

**Docs: core stack**
- Next.js docs: https://nextjs.org/docs (also bundled locally: `node_modules/next/dist/docs/`)
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com
- Zod: https://zod.dev
- MongoDB Node driver: https://www.mongodb.com/docs/drivers/node/current/
- sample_mflix dataset: https://www.mongodb.com/docs/atlas/sample-data/sample-mflix/
- Atlas Search: https://www.mongodb.com/docs/atlas/atlas-search/
- Atlas Vector Search: https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/

**Docs: AI**
- Claude API: https://platform.claude.com/docs
- Vercel AI SDK: https://ai-sdk.dev
- Voyage AI: https://docs.voyageai.com

**Docs: SaaS pieces**
- Clerk: https://clerk.com/docs · Better Auth: https://www.better-auth.com/docs
- Stripe: https://docs.stripe.com
- Upstash: https://upstash.com/docs
- Sentry: https://docs.sentry.io · PostHog: https://posthog.com/docs
- Resend: https://resend.com/docs

**Docs: hosting / DevOps**
- Vercel: https://vercel.com/docs
- Cloudflare: https://developers.cloudflare.com
- GitHub Actions: https://docs.github.com/actions
- Docker: https://docs.docker.com
- Render: https://render.com/docs · Railway: https://docs.railway.com · Fly.io: https://fly.io/docs
