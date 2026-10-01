# Cinesona

AI-powered movie discovery built on the MongoDB Atlas `sample_mflix` dataset.

Plan, progress and links: [docs/PLAN.md](docs/PLAN.md). Conversation history: [docs/CHAT_HISTORY.md](docs/CHAT_HISTORY.md).

**Stack:** Next.js 16 (App Router, Server Components) · TypeScript · Tailwind CSS v4 · MongoDB Atlas (Atlas Search) · Zod

## Getting started

```bash
nvm use            # Node 22
npm install
cp .env.example .env.local   # then paste your Atlas connection string
npm run db:indexes           # once: creates the Atlas Search index
npm run dev                  # http://localhost:3000
```

In Atlas, also add your IP under **Network Access** (or `0.0.0.0/0` while learning, which Vercel needs too).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run db:indexes` | Create the `comments` index and the `movies_search` Atlas Search index (safe to re-run) |

## How it works

- **Pages are Server Components** that query MongoDB directly (`src/lib/movies.ts`); no separate API layer.
- **Search** uses Atlas Search (`$search` with autocomplete + fuzzy full-text). Until the index exists, or when
  running against a non-Atlas MongoDB, it falls back to a case-insensitive title match and says so in the UI.
- **Autocomplete** (`/api/suggest`) is debounced, and each keystroke aborts the previous request so stale
  results never overwrite newer ones.
- **URL is the state**: search, genre, sort and page live in the query string, validated with Zod, so every view
  is linkable and works before JavaScript loads (`next/form`).

## Project layout

```
src/
  app/
    (home)/          home page + its loading skeleton
    movies/[id]/     movie details, similar movies, comments
    api/suggest/     autocomplete endpoint
  components/        UI (SearchBox combobox, FilterBar, MovieCard, Poster…)
  lib/               mongodb client, queries, URL parsing, formatting
scripts/             one-off database setup
```

## Roadmap

- [x] **Week 1** – Browse, filter, sort, Atlas Search + autocomplete, movie details
- [ ] **Week 2** – "Search by vibe" with Atlas Vector Search on `embedded_movies`
- [ ] **Week 3** – Auth, watchlists, ratings and reviews
- [ ] **Week 4** – AI chat assistant (RAG with Claude)
- [ ] **Week 5** – Stripe Pro plan, AI usage limits, Docker, CI, custom domain

## Deploy (free)

1. Push to GitHub, import the repo on [Vercel](https://vercel.com/new).
2. Add `MONGODB_URI` and `MONGODB_DB` under **Settings → Environment Variables**.
3. Deploy. Every push to `main` redeploys; every PR gets a preview URL.
