# Cinesona — Project Plan & Progress

> AI-powered discovery for **movies, web series, anime and games**, all in one place.
> Started on the MongoDB Atlas `sample_mflix` dataset; other content comes from free public APIs.
> Goal: learn modern full-stack SaaS development and hosting while building a real, deployable product.

**Last updated:** 2026-10-01
**Overall progress:** Phases 1–2 done; Phase 3 code written (TMDB/IGDB imports waiting for API keys). Not deployed.

---

## 1. Status at a glance

| Area | Status |
|---|---|
| Project scaffold (Next.js 16, TS, Tailwind v4) | ✅ Done |
| Phase 1: movies — browse, filter, sort, search, autocomplete, details | ✅ Done, verified against Atlas |
| Connected to Atlas | ✅ Done (`.env.local`) |
| GitHub repo `nivi26-coder/cinesona` | ✅ Created (first push pending) |
| Deployed to Vercel | ❌ Not done |
| Phase 2: one `titles` catalogue, kind tabs, per-kind pages | ✅ Done, verified (20,653 titles from `sample_mflix`) |
| Phase 3: importers + live API calls | 🟡 Code done. AniList live works. TMDB / IGDB need API keys, then run the imports |
| Phase 4: "search by vibe" across everything (Vector Search) | ❌ Not started |
| Phase 5: auth, lists, reviews | ❌ Not started |
| Phase 6: AI assistant (RAG) | ❌ Not started |
| Phase 7: Stripe, rate limits, Docker, CI, domain | ❌ Not started |

---

## 2. Immediate next steps

- [x] `.env.local` with the Atlas connection string; IP added in Atlas **Network Access**
- [x] `npm run db:indexes` → `titles` indexes + `titles_search` Atlas Search index (old `movies_search` dropped)
- [x] `npm run import:mflix` → copies `sample_mflix.movies` into `cinesona.titles`
- [ ] Delete the two unused Week 1 files: `src/lib/movies.ts` and `src/components/MovieCard.tsx` (`npm run build` fails on `movies.ts` until it's gone)
- [ ] TMDB key: themoviedb.org → Settings → API → copy the **API Read Access Token** into `TMDB_API_TOKEN`, then `npm run import:tmdb`
- [ ] Twitch app for IGDB: dev.twitch.tv → Console → Register Your Application (OAuth redirect `http://localhost`, category "Website Integration") → `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET`, then `npm run import:igdb`
- [ ] Optional: set `WATCH_REGION` (e.g. `IN`) for where-to-watch
- [ ] First commit + `git push -u origin main`
- [ ] Vercel: import repo, env vars `MONGODB_URI`, `MONGODB_DB=cinesona`, `MFLIX_DB=sample_mflix`, `TMDB_API_TOKEN`, `WATCH_REGION`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`; Atlas Network Access `0.0.0.0/0`

---

## 3. Content sources: stored vs live

Rule: **store a slim copy** of what we search, filter and sort on; **fetch live** (cached 1 day in the Next.js data cache) what changes often or what we don't need to search.

| Kind | Stored in `titles` (import script) | Live on the detail page |
|---|---|---|
| Movies to 2016 | `sample_mflix` → `npm run import:mflix` | TMDB (found via IMDb ID): trailer, where to watch |
| Movies 2016+ | TMDB discover → `npm run import:tmdb` | TMDB: trailer, where to watch, cast |
| Series / web series | 221 from `sample_mflix` + TMDB TV | TMDB: seasons, episodes, status, next episode, network, creators, where to watch |
| Anime | 128 from `sample_mflix` + TMDB (Japanese animation) | **AniList**: score, studios, tags, format, next episode, streaming links, trailer |
| Games | IGDB → `npm run import:igdb` | IGDB: screenshots, store links (Steam, GOG…), trailer |

**Licence rules found in each API's terms (checked 2026-10-01):**

| API | Key | Storing data | Rate limit | Commercial |
|---|---|---|---|---|
| TMDB | Free token | Allowed, but **max 6 months** → `import:tmdb` deletes TMDB titles not refreshed for 180 days | ~40 req/s | Separate agreement; logo + notice "This product uses the TMDB API but is not endorsed or certified by TMDB" required |
| AniList | None | **"Hoarding or mass collection … strictly prohibited"** → live only, never imported | 30 req/min (temporarily degraded from 90) | Free under $150/month revenue, licence above that |
| IGDB | Twitch app | Allowed | 4 req/s | Free for commercial too; partnership for big use |

**Overlap rules** (so a title isn't listed twice):
- Japanese animation from TMDB goes to `anime`, never `series` / `movie`.
- TMDB movies that are already in `sample_mflix` (same normalized title + year) are linked (`ext.tmdbMovie`) instead of added.
- `sample_mflix` itself lists 696 films twice; the most-voted copy is kept, the other copies' IDs go in `ext.mflixCopies` (old URLs redirect, comments are merged).

⚠️ Before charging money (Phase 7): TMDB needs a commercial agreement, AniList a licence above $150/month, and Vercel Hobby → Pro.

---

## 4. Data model: one `titles` collection (database `cinesona`)

All kinds live in one collection, so search, vibe search, lists and the AI assistant work across everything with **one Atlas Search index and one Vector Search index** (M0 allows 3 in total). Type: `TitleDoc` in `src/lib/titles.ts`.

| Field | Notes |
|---|---|
| `kind` | `movie` · `series` · `anime` · `game` |
| `slug` | `the-godfather-1972`; unique per kind; `-<id>` suffix on clashes; never changes on re-import |
| `title`, `originalTitle`, `year`, `synopsis` | |
| `genres` | One vocabulary across sources (`scripts/lib/genres.mjs`) |
| `poster`, `backdrop` | URLs only; images stay on TMDB / IGDB / Amazon CDNs |
| `score`, `scoreSource`, `votes` | Score 0–100 (IMDb ×10, TMDB ×10, IGDB as-is) |
| `popularity` | 0–1 rank by votes **within kind + source**, so the "All" tab mixes sources fairly (IMDb votes are in millions, IGDB in hundreds) |
| `directors`, `writers`, `cast`, `companies`, `platforms`, `languages`, `countries`, `runtime`, `rated`, `awards` | Whatever the source has |
| `ext` | `mflix`, `mflixCopies`, `imdb`, `tmdbMovie`, `tmdbTv`, `igdb`, `igdbUrl` (unique partial indexes) |
| `source`, `updatedAt` | `mflix` · `tmdb` · `igdb` |
| `embedding` | Phase 4: Voyage, 1024 dims, int8 |

**Routes:** `/` (tabs All · Movies · Series · Anime · Games via `?kind=`), `/movies/[id]`, `/series/[slug]`, `/anime/[slug]`, `/games/[slug]`. Week 1 links `/movies/<ObjectId>` → 308 redirect to the slug URL.

**Search scoring** (`listTitles`): title matches by relevance; people/studios a fixed weight 4; synopsis 1; typo matches 0.5; all × (1 + popularity). Atlas adds up matching clauses, so without fixed weights a synopsis mentioning "Nolan" beat films Nolan directed.

---

## 5. Storage budget (Atlas M0 = 512 MB)

| Item | Size |
|---|---|
| `sample_mflix` | 216 MB (`embedded_movies` alone is 143 MB) |
| `cinesona.titles` with 20,653 `sample_mflix` titles | ~27 MB data + ~9 MB indexes |
| Expected after TMDB + IGDB imports (~45k titles) | ~70 MB |
| Phase 4 embeddings: 1024 dims × int8 ≈ 1 KB × ~45k | ~45 MB |

→ Fits. Dropping `sample_mflix.embedded_movies` (143 MB) is optional headroom; nothing uses it.

---

## 6. Tech stack

| Layer | Choice | Status |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Components) + TypeScript | ✅ In use |
| UI | Tailwind CSS v4 (custom tokens, light/dark) | ✅ In use |
| UI kit | shadcn/ui | ❌ Not added yet |
| Database | MongoDB Atlas M0 + official `mongodb` Node driver | ✅ In use |
| Search | Atlas Search (autocomplete + weighted full-text) | ✅ In use (`titles_search`) |
| Vector search | Atlas Vector Search | ❌ Phase 4 |
| Validation | Zod v4 (URL params, API responses from importers) | ✅ In use |
| Embeddings | Voyage AI voyage-4 family, 1024 dims, int8 | ❌ Phase 4 |
| Content APIs | TMDB, AniList, IGDB | 🟡 Code done; TMDB/IGDB need keys |
| Scheduled refresh | GitHub Actions cron (weekly import of new / airing titles) | ❌ Phase 3 |
| AI chat | Claude API + Vercel AI SDK (streaming UI) | ❌ Phase 6 |
| Auth | Clerk or Better Auth | ❌ Phase 5 (decide) |
| Payments | Stripe subscriptions | ❌ Phase 7 |
| Rate limiting | Upstash Redis | ❌ Phase 7 |
| Monitoring | Sentry (errors), PostHog (analytics) | ❌ Phase 7 |
| Testing | Vitest, Playwright | ❌ Not started |

---

## 7. Roadmap & checklist

### Phase 1: Movies — browse & search ✅
- [x] Scaffold Next.js 16 + TS + Tailwind + ESLint
- [x] MongoDB client singleton (`src/lib/mongodb.ts`), retries after failed connect
- [x] Movie grid with posters, rating badge, broken-poster fallback
- [x] Genre filter, sort (popular / top rated / newest / A–Z), pagination (limit+1, no slow count)
- [x] URL-driven state validated with Zod; works without JS (`next/form`)
- [x] Atlas Search query (autocomplete + fuzzy text over title/plot/cast/directors)
- [x] Fallback to regex title search when no index / non-Atlas (UI shows notice)
- [x] Autocomplete API `/api/suggest` + accessible combobox (debounce, abort stale requests, keyboard nav)
- [x] Autocomplete ranking: whole-phrase prefix matches first, then by IMDb votes
- [x] Movie details: plot, scores, credits, genres → links, "More like this", comments
- [x] Loading skeleton, error boundary, real HTTP 404 for unknown movies
- [x] Setup notice when `MONGODB_URI` missing
- [x] `npm run db:indexes` script
- [x] Verify against real Atlas data
- [ ] Deploy to Vercel

### Phase 2: One catalogue ✅
- [x] `titles` collection, `TitleDoc` type, indexes (`npm run db:indexes`)
- [x] Shared genre vocabulary + per-source mapping (`scripts/lib/genres.mjs`)
- [x] Migration `sample_mflix.movies` → `titles` (`npm run import:mflix`): kind from `type` / Japanese animation, score ×10, slugs, duplicate merge
- [x] Queries in `src/lib/titles.ts` with `kind` filter; popularity rank per kind + source
- [x] Kind tabs on home; detail pages per kind; redirect old `/movies/<ObjectId>` links
- [x] `titles_search` replaces `movies_search` (title, originalTitle, synopsis, people, companies; kind/genre filters)
- [x] Search re-weighted per field (see §4)

### Phase 3: Importers + live data 🟡
- [x] Import helpers: idempotent upserts keyed on source ID, stable slugs, retries + rate limiting (`scripts/lib/`)
- [x] `npm run import:tmdb [-- --only=series,anime,movies] [-- --pages=N]`: series, anime (Japanese animation), movies 2016+; 6-month purge
- [x] `npm run import:igdb [-- --limit=N]`: base games by rating count, adult themes skipped
- [x] Live (cached 1 day): TMDB extras, AniList extras for anime, IGDB extras for games (`src/lib/live/`), streamed with `<Suspense>`
- [x] Footer attribution + TMDB notice
- [x] AniList live verified (Spirited Away → Studio Ghibli, 86/100)
- [ ] Run `import:tmdb` and `import:igdb` once keys are in `.env.local`; check results
- [ ] TMDB logo in the footer (required by their terms)
- [ ] Better posters for `sample_mflix` (many URLs are dead): fetch TMDB poster via IMDb ID
- [ ] GitHub Actions cron: weekly `import:tmdb` + `import:igdb` (keeps TMDB data under 6 months old)

### Phase 4: Search by vibe ❌
- [ ] Embed synopses with Voyage (1024 dims, int8), batch script with resume
- [ ] Vector index `titles_vector` on `embedding`, filter fields `kind`, `genres`, `year`
- [ ] "Describe what you're in the mood for" box → `$vectorSearch`, optional kind filter
- [ ] "More like this" by vector similarity, including across kinds ("liked this anime? try this game")

### Phase 5: Users ❌
- [ ] Auth (Clerk or Better Auth)
- [ ] Lists across kinds: want to watch / watching / watched; want to play / playing / finished
- [ ] Ratings & reviews (`reviews` collection)
- [ ] Profile page: taste summary across movies, series, anime and games

### Phase 6: AI assistant ❌
- [ ] Chat UI with Vercel AI SDK (streaming)
- [ ] RAG: vector search over `titles` → Claude answers with real titles from the catalogue
- [ ] Tool use: "add to my list" from chat; "something like X but a game"

### Phase 7: SaaS & production ❌
- [ ] Commercial licences for TMDB / IGDB / AniList, or swap sources
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

## 8. Hosting learning path

1. **Vercel + Atlas M0**: free, auto-deploy from GitHub ← start here
2. **Cloudflare**: domain, DNS, CDN
3. **GitHub Actions**: CI on every push + scheduled imports
4. **Docker + Render / Railway / Fly.io**: containers
5. **AWS or Azure containers**: career level

---

## 9. Free tier summary

| Service | Free? | Notes |
|---|---|---|
| MongoDB Atlas M0 | ✅ | 512 MB, max 3 Search/Vector indexes |
| Vercel Hobby | ✅ | **Non-commercial only**; Pro $20/mo when you charge money |
| TMDB / AniList / IGDB | ✅ | Non-commercial; attribution; rate limits |
| Clerk / Better Auth | ✅ | Clerk free tier; Better Auth open source |
| Stripe | ✅ | Test mode free; live = per-transaction fee |
| Voyage AI | ✅ | Free token allowance |
| Claude API | ❌ | Pay-as-you-go (pennies while learning) |
| GitHub Actions, Cloudflare, Sentry, PostHog, Upstash, Resend | ✅ | Free tiers |
| Render | ✅ | Free services sleep when idle |
| Railway / Fly.io | ⚠️ | Trial credit only |
| Custom domain | ❌ | ~$10/yr (optional) |

---

## 10. Project structure & key files

```
cinesona/
  .env.example                 env template (Mongo, TMDB, Twitch/IGDB, watch region)
  .nvmrc                       Node 22
  scripts/
    setup-indexes.mjs          titles indexes + titles_search; comments index; drops old movies_search
    import-mflix.mjs           sample_mflix.movies → titles (dedupes the sample data)
    import-tmdb.mjs            series, anime, movies 2016+ from TMDB
    import-igdb.mjs            games from IGDB
    lib/catalog.mjs            connect, slugify, upsertTitles, recomputePopularity
    lib/genres.mjs             genre vocabulary mapping
    lib/http.mjs               fetchJson with retries, rate limiter
  docs/                        this plan + chat history
  src/
    app/
      layout.tsx               header/footer (attribution), fonts, metadata
      (home)/page.tsx          tabs + filters + grid + pagination
      (home)/loading.tsx       skeleton (scoped here so detail pages can 404 properly)
      movies/[id]/page.tsx     movie detail (id = slug; old ObjectId links redirect)
      series/[slug], anime/[slug], games/[slug]   other detail pages (all render TitlePage)
      api/suggest/route.ts     autocomplete (?q=&kind=)
    components/
      TitlePage.tsx            shared detail page
      TitleExtras.tsx          live TMDB / AniList / IGDB section
      TitleCard, KindTabs, FilterBar, SearchBox, Poster, RatingBadge, Pagination, SetupNotice
    lib/
      titles.ts                all catalogue queries (list, search, suggest, detail, comments, similar, genres)
      live/                    tmdb.ts, anilist.ts, igdb.ts, fetch.ts (cached fetch helper)
      kinds.ts                 kinds, labels, URL paths
      mongodb.ts               cached MongoClient; getDb (cinesona), getMflixDb (sample_mflix)
      query.ts, sorts.ts, format.ts
```

**Scripts:** `dev`, `build`, `start`, `lint`, `typecheck`, `db:indexes`, `import:mflix`, `import:tmdb`, `import:igdb`

**Git:** local user `nivi26-coder <nithishvishal007@gmail.com>`, remote `git@github-nivi26coder:nivi26-coder/cinesona.git` (SSH alias in `~/.ssh/config`, same as `mediavault-assessment`).

---

## 11. Useful links

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

**Docs: content APIs**
- TMDB API: https://developer.themoviedb.org/docs · API key: https://www.themoviedb.org/settings/api
- AniList API: https://docs.anilist.co
- IGDB API: https://api-docs.igdb.com · Twitch dev console: https://dev.twitch.tv/console
- TVmaze (alternative): https://www.tvmaze.com/api · Jikan (alternative): https://jikan.moe · RAWG (alternative): https://rawg.io/apidocs

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
