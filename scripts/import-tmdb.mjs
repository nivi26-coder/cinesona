// Imports series / web series, anime and post-2016 movies from TMDB into
// `titles`. Only the fields needed for browsing and search are stored; the
// detail page fetches seasons, cast, trailers and where-to-watch live.
//
// TMDB terms: cached data must not be older than 6 months, so titles this
// import hasn't refreshed for 180 days are deleted at the end.
//
// Usage: npm run import:tmdb [-- --only=series,anime,movies] [-- --pages=5]
import { parseArgs } from "node:util";
import { chunks, connect, recomputePopularity, slugify, titleKey, upsertTitles } from "./lib/catalog.mjs";
import { mapGenres } from "./lib/genres.mjs";
import { fetchJson, rateLimiter } from "./lib/http.mjs";

const token = process.env.TMDB_API_TOKEN;
if (!token) {
  console.log("TMDB_API_TOKEN is not set; skipping. Get a free API Read Access Token at https://www.themoviedb.org/settings/api");
  process.exit(0);
}

const { values: args } = parseArgs({ options: { only: { type: "string" }, pages: { type: "string" } } });
const only = args.only?.split(",");
const maxPages = args.pages ? Number(args.pages) : undefined;

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
const throttle = rateLimiter(20);

async function tmdb(path, params = {}) {
  await throttle();
  const url = `${API}${path}?${new URLSearchParams({ language: "en-US", ...params })}`;
  return fetchJson(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
}

// Each set is a TMDB "discover" query, most-voted first (20 results per page).
const SETS = [
  { name: "series", media: "tv", kind: "series", pages: 250, params: { sort_by: "vote_count.desc" } },
  {
    name: "anime",
    media: "tv",
    kind: "anime",
    pages: 100,
    params: { sort_by: "vote_count.desc", with_genres: "16", with_original_language: "ja" },
  },
  {
    name: "anime",
    media: "movie",
    kind: "anime",
    pages: 50,
    params: { sort_by: "vote_count.desc", with_genres: "16", with_original_language: "ja" },
  },
  {
    name: "movies",
    media: "movie",
    kind: "movie",
    pages: 150,
    // sample_mflix stops at 2016.
    params: { sort_by: "vote_count.desc", "primary_release_date.gte": "2016-01-01" },
  },
];

const isAnime = (r) => r.original_language === "ja" && r.genre_ids.includes(16);

const { client, titles } = await connect();
try {
  const genreNames = {};
  for (const media of ["movie", "tv"]) {
    const { genres } = await tmdb(`/genre/${media}/list`);
    genreNames[media] = new Map(genres.map((g) => [g.id, g.name]));
  }

  // Films already in sample_mflix: link them to TMDB instead of adding a copy.
  const mflixByKey = new Map();
  for await (const t of titles.find({ source: "mflix" }, { projection: { title: 1, year: 1 } })) {
    mflixByKey.set(titleKey(t.title, t.year), t._id);
  }

  for (const set of SETS) {
    if (only && !only.includes(set.name)) continue;
    const isTv = set.media === "tv";
    const pages = Math.min(set.pages, maxPages ?? set.pages);
    const docs = [];
    const links = [];

    for (let page = 1; page <= pages; page++) {
      const data = await tmdb(`/discover/${set.media}`, { ...set.params, include_adult: "false", page: String(page) });
      for (const r of data.results) {
        // Anime has its own set; keep it out of "series" and "movies".
        if (set.kind !== "anime" && isAnime(r)) continue;

        const title = isTv ? r.name : r.title;
        const original = isTv ? r.original_name : r.original_title;
        const year = Number.parseInt((isTv ? r.first_air_date : r.release_date)?.slice(0, 4), 10) || undefined;
        if (!title) continue;

        if (!isTv) {
          const mflixId = mflixByKey.get(titleKey(title, year));
          if (mflixId) {
            links.push({ updateOne: { filter: { _id: mflixId }, update: { $set: { "ext.tmdbMovie": r.id } } } });
            continue;
          }
        }

        docs.push({
          kind: set.kind,
          title,
          originalTitle: original && original !== title ? original : undefined,
          year,
          synopsis: r.overview || undefined,
          genres: mapGenres(r.genre_ids.map((id) => genreNames[set.media].get(id)).filter(Boolean)),
          poster: r.poster_path ? `${IMG}/w342${r.poster_path}` : undefined,
          backdrop: r.backdrop_path ? `${IMG}/w780${r.backdrop_path}` : undefined,
          score: r.vote_count > 0 ? Math.round(r.vote_average * 10) : undefined,
          scoreSource: "TMDB",
          votes: r.vote_count,
          ext: isTv ? { tmdbTv: r.id } : { tmdbMovie: r.id },
          source: "tmdb",
          slugBase: slugify(year ? `${title} ${year}` : title),
          slugSuffix: String(r.id),
        });
      }
      if (page >= data.total_pages) break;
    }

    const { inserted, updated } = await upsertTitles(titles, docs, isTv ? "ext.tmdbTv" : "ext.tmdbMovie");
    for (const batch of chunks(links, 500)) await titles.bulkWrite(batch, { ordered: false });
    console.log(
      `✓ ${set.name} (${set.media}): ${docs.length} read, ${inserted} new, ${updated} updated, ${links.length} linked to sample_mflix`,
    );
  }

  const { deletedCount } = await titles.deleteMany({
    source: "tmdb",
    updatedAt: { $lt: new Date(Date.now() - SIX_MONTHS_MS) },
  });
  if (deletedCount) console.log(`- removed ${deletedCount} TMDB titles not refreshed for 6 months`);

  await recomputePopularity(titles);
} finally {
  await client.close();
}
