import "server-only";
import type { TitleDetail } from "../titles";
import { DAY, fetchCachedJson } from "./fetch";

// AniList forbids bulk downloading ("hoarding"), so it is only ever called
// live for the one anime being viewed, and cached for a day. No key needed.
// Rate limit: 30 requests/minute at the moment.

export type AnilistExtras = {
  url: string;
  score?: number;
  members?: number;
  format?: string;
  episodes?: number;
  status?: string;
  studios: string[];
  tags: string[];
  nextEpisode?: { episode: number; airingAt: string };
  streaming: { site: string; url: string }[];
  trailer?: string;
};

const QUERY = `
query ($search: String, $from: FuzzyDateInt, $to: FuzzyDateInt) {
  Media(search: $search, type: ANIME, startDate_greater: $from, startDate_lesser: $to) {
    siteUrl
    averageScore
    popularity
    format
    episodes
    status
    studios(isMain: true) { nodes { name } }
    tags { name rank isMediaSpoiler }
    nextAiringEpisode { episode airingAt }
    externalLinks { site url type }
    trailer { id site }
  }
}`;

type Media = {
  siteUrl: string;
  averageScore: number | null;
  popularity: number | null;
  format: string | null;
  episodes: number | null;
  status: string | null;
  studios: { nodes: { name: string }[] };
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[];
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  externalLinks: { site: string; url: string; type: string }[];
  trailer: { id: string; site: string } | null;
};

const STATUS: Record<string, string> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "On hiatus",
};

const FORMAT: Record<string, string> = {
  TV: "TV series",
  TV_SHORT: "TV short",
  MOVIE: "Film",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "Web series",
  MUSIC: "Music video",
};

export async function getAnilistExtras(title: TitleDetail): Promise<AnilistExtras | null> {
  if (title.kind !== "anime") return null;

  // Match on title, within a year either side of ours (FuzzyDateInt = YYYYMMDD).
  const variables = {
    search: title.title,
    from: title.year ? (title.year - 2) * 10000 + 1231 : null,
    to: title.year ? (title.year + 2) * 10000 : null,
  };
  const data = await fetchCachedJson<{ data: { Media: Media | null } }>(
    "https://graphql.anilist.co",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables }),
    },
    DAY,
  );
  const m = data?.data.Media;
  if (!m) return null;

  const trailer =
    m.trailer?.site === "youtube"
      ? `https://www.youtube.com/watch?v=${m.trailer.id}`
      : m.trailer?.site === "dailymotion"
        ? `https://www.dailymotion.com/video/${m.trailer.id}`
        : undefined;

  return {
    url: m.siteUrl,
    score: m.averageScore ?? undefined,
    members: m.popularity ?? undefined,
    format: m.format ? (FORMAT[m.format] ?? m.format) : undefined,
    episodes: m.episodes ?? undefined,
    status: m.status ? (STATUS[m.status] ?? m.status) : undefined,
    studios: m.studios.nodes.map((s) => s.name),
    tags: m.tags
      .filter((t) => !t.isMediaSpoiler && t.rank >= 60)
      .slice(0, 8)
      .map((t) => t.name),
    nextEpisode: m.nextAiringEpisode
      ? { episode: m.nextAiringEpisode.episode, airingAt: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString() }
      : undefined,
    streaming: m.externalLinks.filter((l) => l.type === "STREAMING").map((l) => ({ site: l.site, url: l.url })),
    trailer,
  };
}
