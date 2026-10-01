import "server-only";
import type { TitleDetail } from "../titles";
import { DAY, fetchCachedJson } from "./fetch";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export type WatchOption = { name: string; logo?: string; type: "Stream" | "Free" | "With ads" | "Rent" | "Buy" };

export type TmdbExtras = {
  url: string;
  tagline?: string;
  trailer?: string;
  watch?: { link: string; region: string; options: WatchOption[] };
  cast: string[];
  creators: string[];
  networks: string[];
  seasons?: number;
  episodes?: number;
  status?: string;
  lastAirYear?: number;
  nextEpisode?: { season: number; episode: number; date: string };
};

type Provider = { provider_name: string; logo_path?: string };

type TmdbDetails = {
  id: number;
  tagline?: string;
  status?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  last_air_date?: string;
  next_episode_to_air?: { season_number: number; episode_number: number; air_date: string } | null;
  networks?: { name: string }[];
  created_by?: { name: string }[];
  credits?: { cast?: { name: string }[] };
  videos?: { results?: { site: string; type: string; key: string; official?: boolean }[] };
  "watch/providers"?: {
    results?: Record<
      string,
      { link: string; flatrate?: Provider[]; free?: Provider[]; ads?: Provider[]; rent?: Provider[]; buy?: Provider[] }
    >;
  };
};

function tmdb<T>(path: string, revalidate: number): Promise<T | null> {
  const token = process.env.TMDB_API_TOKEN;
  if (!token) return Promise.resolve(null);
  const sep = path.includes("?") ? "&" : "?";
  return fetchCachedJson<T>(
    `${API}${path}${sep}language=en-US`,
    { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } },
    revalidate,
  );
}

// sample_mflix titles only have an IMDb ID; TMDB can translate it.
async function resolveTmdb(title: TitleDetail): Promise<{ media: "movie" | "tv"; id: number } | null> {
  if (title.ext.tmdbTv) return { media: "tv", id: title.ext.tmdbTv };
  if (title.ext.tmdbMovie) return { media: "movie", id: title.ext.tmdbMovie };
  if (!title.ext.imdb) return null;
  const found = await tmdb<{ movie_results: { id: number }[]; tv_results: { id: number }[] }>(
    `/find/${title.ext.imdb}?external_source=imdb_id`,
    30 * DAY,
  );
  if (found?.movie_results[0]) return { media: "movie", id: found.movie_results[0].id };
  if (found?.tv_results[0]) return { media: "tv", id: found.tv_results[0].id };
  return null;
}

export async function getTmdbExtras(title: TitleDetail): Promise<TmdbExtras | null> {
  if (title.kind === "game") return null;
  const ref = await resolveTmdb(title);
  if (!ref) return null;

  const d = await tmdb<TmdbDetails>(
    `/${ref.media}/${ref.id}?append_to_response=credits,videos,watch/providers`,
    DAY,
  );
  if (!d) return null;

  const videos = d.videos?.results?.filter((v) => v.site === "YouTube" && v.type === "Trailer") ?? [];
  const trailer = videos.find((v) => v.official) ?? videos[0];

  const region = (process.env.WATCH_REGION || "US").toUpperCase();
  const providers = d["watch/providers"]?.results?.[region];
  const options: WatchOption[] = [];
  const seen = new Set<string>();
  // A service listed under several types keeps the cheapest one (stream first).
  const groups = [
    ["Stream", providers?.flatrate],
    ["Free", providers?.free],
    ["With ads", providers?.ads],
    ["Rent", providers?.rent],
    ["Buy", providers?.buy],
  ] as const;
  for (const [type, list] of groups) {
    for (const p of list ?? []) {
      if (seen.has(p.provider_name)) continue;
      seen.add(p.provider_name);
      options.push({ name: p.provider_name, logo: p.logo_path && `${IMG}/w92${p.logo_path}`, type });
    }
  }

  const next = d.next_episode_to_air;
  return {
    url: `https://www.themoviedb.org/${ref.media}/${ref.id}`,
    tagline: d.tagline || undefined,
    trailer: trailer && `https://www.youtube.com/watch?v=${trailer.key}`,
    watch: providers && options.length > 0 ? { link: providers.link, region, options } : undefined,
    cast: (d.credits?.cast ?? []).slice(0, 10).map((c) => c.name),
    creators: (d.created_by ?? []).map((c) => c.name),
    networks: (d.networks ?? []).map((n) => n.name),
    seasons: d.number_of_seasons,
    episodes: d.number_of_episodes,
    status: ref.media === "tv" ? d.status : undefined,
    lastAirYear: d.last_air_date ? Number(d.last_air_date.slice(0, 4)) : undefined,
    nextEpisode: next
      ? { season: next.season_number, episode: next.episode_number, date: next.air_date }
      : undefined,
  };
}
