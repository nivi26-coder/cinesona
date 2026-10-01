// Imports games from IGDB (owned by Twitch) into `titles`, most-rated first.
// Needs a free Twitch developer app: https://dev.twitch.tv/console
//
// Usage: npm run import:igdb [-- --limit=1000]
import { parseArgs } from "node:util";
import { connect, recomputePopularity, slugify, upsertTitles } from "./lib/catalog.mjs";
import { mapGenres } from "./lib/genres.mjs";
import { fetchJson, rateLimiter } from "./lib/http.mjs";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.log("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are not set; skipping. Create an app at https://dev.twitch.tv/console");
  process.exit(0);
}

const { values: args } = parseArgs({ options: { limit: { type: "string" } } });
const limit = Number(args.limit ?? 5000);
const PAGE = 500; // IGDB's maximum
const throttle = rateLimiter(3); // IGDB allows 4 requests per second

const { access_token } = await fetchJson(
  `https://id.twitch.tv/oauth2/token?${new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  })}`,
  { method: "POST" },
);

async function igdb(endpoint, body) {
  await throttle();
  return fetchJson(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: { "Client-ID": clientId, Authorization: `Bearer ${access_token}`, accept: "application/json" },
    body,
  });
}

const FIELDS = [
  "name",
  "summary",
  "first_release_date",
  "genres.name",
  "themes.name",
  "platforms.abbreviation",
  "platforms.name",
  "cover.image_id",
  "total_rating",
  "total_rating_count",
  "involved_companies.developer",
  "involved_companies.company.name",
  "url",
].join(",");

const { client, titles } = await connect();
try {
  const docs = [];
  for (let offset = 0; offset < limit; offset += PAGE) {
    // Base games only: no DLCs/expansions (parent_game) or re-releases (version_parent).
    const games = await igdb(
      "games",
      `fields ${FIELDS};
       where parent_game = null & version_parent = null & total_rating_count >= 5;
       sort total_rating_count desc;
       limit ${Math.min(PAGE, limit - offset)}; offset ${offset};`,
    );

    for (const g of games) {
      const themes = (g.themes ?? []).map((t) => t.name);
      if (themes.includes("Erotic")) continue;
      const year = g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : undefined;

      docs.push({
        kind: "game",
        title: g.name,
        year,
        synopsis: g.summary,
        genres: mapGenres([...(g.genres ?? []).map((x) => x.name), ...themes]),
        poster: g.cover?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
          : undefined,
        score: g.total_rating !== undefined ? Math.round(g.total_rating) : undefined,
        scoreSource: "IGDB",
        votes: g.total_rating_count,
        platforms: (g.platforms ?? []).map((p) => p.abbreviation ?? p.name),
        companies: (g.involved_companies ?? []).filter((c) => c.developer).map((c) => c.company?.name).filter(Boolean),
        ext: { igdb: g.id, igdbUrl: g.url },
        source: "igdb",
        slugBase: slugify(year ? `${g.name} ${year}` : g.name),
        slugSuffix: String(g.id),
      });
    }
    if (games.length < PAGE) break;
  }

  const { inserted, updated } = await upsertTitles(titles, docs, "ext.igdb");
  console.log(`✓ games: ${docs.length} read, ${inserted} new, ${updated} updated`);
  await recomputePopularity(titles);
} finally {
  await client.close();
}
