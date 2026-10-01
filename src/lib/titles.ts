import "server-only";
import { cache } from "react";
import { ObjectId, type Document, type Filter, type Sort } from "mongodb";
import type { Kind } from "./kinds";
import { getDb, getMflixDb } from "./mongodb";
import type { TitleQuery } from "./query";
import type { SortKey } from "./sorts";

export const PAGE_SIZE = 24;
export const SEARCH_INDEX = "titles_search";

// One document per movie, series, anime or game. Filled by scripts/import-*.mjs.
type TitleDoc = {
  _id: ObjectId;
  kind: Kind;
  slug: string;
  title: string;
  originalTitle?: string;
  year?: number;
  synopsis?: string;
  genres: string[];
  poster?: string;
  backdrop?: string;
  score?: number; // 0–100
  scoreSource?: "IMDb" | "TMDB" | "IGDB";
  votes?: number;
  popularity: number; // 0–1 rank within kind + source
  runtime?: number;
  rated?: string;
  directors?: string[];
  writers?: string[];
  cast?: string[];
  companies?: string[];
  platforms?: string[];
  languages?: string[];
  countries?: string[];
  awards?: string;
  tomatoesCritic?: number;
  tomatoesViewer?: number;
  ext: {
    mflix?: ObjectId;
    /** Duplicate copies of this film in sample_mflix, merged into this title. */
    mflixCopies?: ObjectId[];
    imdb?: string;
    tmdbMovie?: number;
    tmdbTv?: number;
    igdb?: number;
    igdbUrl?: string;
  };
  source: "mflix" | "tmdb" | "igdb";
};

type CommentDoc = {
  _id: ObjectId;
  movie_id: ObjectId;
  name: string;
  text: string;
  date: Date;
};

export type TitleCard = {
  id: string;
  kind: Kind;
  slug: string;
  title: string;
  year?: number;
  poster?: string;
  genres: string[];
  /** 0–10, for the badge on cards. */
  rating?: number;
};

export type TitleDetail = TitleCard & {
  originalTitle?: string;
  synopsis?: string;
  backdrop?: string;
  score?: number;
  scoreSource?: string;
  votes?: number;
  runtime?: number;
  rated?: string;
  directors: string[];
  writers: string[];
  cast: string[];
  companies: string[];
  platforms: string[];
  languages: string[];
  countries: string[];
  awards?: string;
  tomatoesCritic?: number;
  tomatoesViewer?: number;
  ext: {
    mflix?: string[];
    imdb?: string;
    tmdbMovie?: number;
    tmdbTv?: number;
    igdb?: number;
    igdbUrl?: string;
  };
};

export type TitleComment = { id: string; name: string; text: string; date: string };

export type Suggestion = { id: string; kind: Kind; slug: string; title: string; year?: number };

export type SearchMode = "browse" | "atlas" | "basic";

const CARD_PROJECTION = { kind: 1, slug: 1, title: 1, year: 1, poster: 1, genres: 1, score: 1 } as const;

function toCard(doc: TitleDoc): TitleCard {
  return {
    id: doc._id.toHexString(),
    kind: doc.kind,
    slug: doc.slug,
    title: doc.title,
    year: doc.year,
    poster: doc.poster,
    genres: doc.genres ?? [],
    rating: doc.score !== undefined ? doc.score / 10 : undefined,
  };
}

function toDetail(doc: TitleDoc): TitleDetail {
  return {
    ...toCard(doc),
    originalTitle: doc.originalTitle,
    synopsis: doc.synopsis,
    backdrop: doc.backdrop,
    score: doc.score,
    scoreSource: doc.scoreSource,
    votes: doc.votes,
    runtime: doc.runtime,
    rated: doc.rated,
    directors: doc.directors ?? [],
    writers: doc.writers ?? [],
    cast: doc.cast ?? [],
    companies: doc.companies ?? [],
    platforms: doc.platforms ?? [],
    languages: doc.languages ?? [],
    countries: doc.countries ?? [],
    awards: doc.awards,
    tomatoesCritic: doc.tomatoesCritic,
    tomatoesViewer: doc.tomatoesViewer,
    ext: {
      ...doc.ext,
      // Every sample_mflix ID of this title; comments are attached to all of them.
      mflix: doc.ext.mflix && [doc.ext.mflix, ...(doc.ext.mflixCopies ?? [])].map((id) => id.toHexString()),
    },
  };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const titles = async () => (await getDb()).collection<TitleDoc>("titles");

// Every sort ends on _id so pages never repeat or skip a title between them.
function browse(sort: SortKey): { filter: Filter<TitleDoc>; sort: Sort } {
  switch (sort) {
    case "popular":
      return { filter: {}, sort: { popularity: -1, _id: 1 } };
    case "rating":
      // Ignore titles too obscure for their score to mean much: only the
      // more-voted half of each source competes for "top rated".
      return {
        filter: { score: { $exists: true }, popularity: { $gte: 0.5 } },
        sort: { score: -1, popularity: -1, _id: 1 },
      };
    case "newest":
      // Skip announced-but-unreleased titles.
      return {
        filter: { year: { $lte: new Date().getFullYear() } },
        sort: { year: -1, popularity: -1, _id: 1 },
      };
    case "title":
      return { filter: {}, sort: { title: 1, _id: 1 } };
  }
}

export async function listTitles(
  query: TitleQuery,
): Promise<{ titles: TitleCard[]; hasNext: boolean; mode: SearchMode }> {
  const skip = (query.page - 1) * PAGE_SIZE;
  const match: Filter<TitleDoc> = {
    ...(query.kind && { kind: query.kind }),
    ...(query.genre && { genres: query.genre }),
  };
  const col = await titles();

  // Fetch one extra document to know whether a next page exists without
  // running a separate (slow) count over the whole collection.
  const page = (docs: TitleDoc[]) => ({
    titles: docs.slice(0, PAGE_SIZE).map(toCard),
    hasNext: docs.length > PAGE_SIZE,
  });

  if (!query.q) {
    const { filter, sort } = browse(query.sort);
    const docs = await col
      .find({ ...filter, ...match }, { projection: CARD_PROJECTION })
      .sort(sort)
      .skip(skip)
      .limit(PAGE_SIZE + 1)
      .toArray();
    return { ...page(docs), mode: "browse" };
  }

  try {
    const pipeline: Document[] = [
      {
        $search: {
          index: SEARCH_INDEX,
          compound: {
            // Atlas adds up every matching clause, so each field gets an
            // explicit weight: otherwise a synopsis that mentions "Nolan"
            // outranks a film Nolan directed, and typos ("Dolan") creep in.
            should: [
              // Title: real relevance, so short exact titles win ("The Godfather" before "Part II").
              { autocomplete: { query: query.q, path: "title", score: { boost: { value: 3 } } } },
              { text: { query: query.q, path: "title", score: { boost: { value: 3 } } } },
              // People and studios: a fixed weight, so popularity decides between their titles.
              { text: { query: query.q, path: ["directors", "cast", "companies"], score: { constant: { value: 4 } } } },
              { text: { query: query.q, path: ["originalTitle", "synopsis"], score: { constant: { value: 1 } } } },
              // Typos ("matrx") match, but only as a last resort.
              {
                text: {
                  query: query.q,
                  path: ["title", "directors", "cast", "companies"],
                  fuzzy: { maxEdits: 1, prefixLength: 1 },
                  score: { constant: { value: 0.5 } },
                },
              },
            ],
            minimumShouldMatch: 1,
            filter: [
              ...(query.kind ? [{ equals: { path: "kind", value: query.kind } }] : []),
              ...(query.genre ? [{ equals: { path: "genres", value: query.genre } }] : []),
            ],
            // Between equally relevant matches, prefer the well-known title.
            score: {
              function: {
                multiply: [
                  { score: "relevance" },
                  { add: [{ constant: 1 }, { path: { value: "popularity", undefined: 0 } }] },
                ],
              },
            },
          },
        },
      },
      { $skip: skip },
      { $limit: PAGE_SIZE + 1 },
      { $project: CARD_PROJECTION },
    ];
    const docs = await col.aggregate<TitleDoc>(pipeline).toArray();
    // A missing search index returns zero hits rather than an error, so an
    // empty first page also falls through to the basic search below.
    if (docs.length > 0 || skip > 0) return { ...page(docs), mode: "atlas" };
  } catch {
    // $search only exists on Atlas; fall back to a plain title match.
  }

  const docs = await col
    .find({ title: { $regex: escapeRegex(query.q), $options: "i" }, ...match }, { projection: CARD_PROJECTION })
    .sort({ popularity: -1, _id: 1 })
    .skip(skip)
    .limit(PAGE_SIZE + 1)
    .toArray();
  return { ...page(docs), mode: "basic" };
}

export async function suggestTitles(q: string, kind?: Kind): Promise<Suggestion[]> {
  const col = await titles();
  const toSuggestion = (doc: TitleDoc): Suggestion => ({
    id: doc._id.toHexString(),
    kind: doc.kind,
    slug: doc.slug,
    title: doc.title,
    year: doc.year,
  });
  const projection = { kind: 1, slug: 1, title: 1, year: 1 };

  try {
    const docs = await col
      .aggregate<TitleDoc>([
        {
          $search: {
            index: SEARCH_INDEX,
            // Exact prefix matches outrank typo matches; without this "godf"
            // scores "Goddess" the same as "Godfather".
            compound: {
              should: [
                { autocomplete: { query: q, path: "title", score: { boost: { value: 3 } } } },
                { autocomplete: { query: q, path: "title", fuzzy: { maxEdits: 1, prefixLength: 1 } } },
              ],
              minimumShouldMatch: 1,
              filter: kind ? [{ equals: { path: "kind", value: kind } }] : [],
            },
          },
        },
        { $limit: 50 },
        {
          $project: {
            ...projection,
            popularity: 1,
            // Autocomplete matches each word on its own, so "star w" also
            // finds "W.". Rank whole-phrase matches first: title starts with
            // the query, then a word starts with it, then typo matches.
            tier: {
              $switch: {
                branches: [
                  { case: { $regexMatch: { input: "$title", regex: `^(the |a |an )?${escapeRegex(q)}`, options: "i" } }, then: 0 },
                  { case: { $regexMatch: { input: "$title", regex: `\\b${escapeRegex(q)}`, options: "i" } }, then: 1 },
                ],
                default: 2,
              },
            },
          },
        },
        // Within a tier, show the well-known titles first.
        { $sort: { tier: 1, popularity: -1 } },
        { $limit: 8 },
      ])
      .toArray();
    if (docs.length > 0) return docs.map(toSuggestion);
  } catch {
    // Fall through to the prefix match.
  }

  const docs = await col
    .find({ title: { $regex: `^${escapeRegex(q)}`, $options: "i" }, ...(kind && { kind }) }, { projection })
    .sort({ popularity: -1 })
    .limit(8)
    .toArray();
  return docs.map(toSuggestion);
}

// Cached per request: generateMetadata and the page both need the same title.
export const getTitle = cache(async (kind: Kind, slug: string): Promise<TitleDetail | null> => {
  const doc = await (await titles()).findOne({ kind, slug });
  return doc ? toDetail(doc) : null;
});

/** Week 1 movie URLs used the sample_mflix ObjectId: /movies/573a1396f29313caabce4a9a */
export async function findByMflixId(id: string): Promise<{ kind: Kind; slug: string } | null> {
  if (!/^[0-9a-f]{24}$/i.test(id)) return null;
  const _id = new ObjectId(id);
  return (await titles()).findOne(
    { $or: [{ "ext.mflix": _id }, { "ext.mflixCopies": _id }] },
    { projection: { kind: 1, slug: 1 } },
  );
}

export async function getComments(
  mflixIds: string[],
  limit = 20,
): Promise<{ comments: TitleComment[]; total: number }> {
  const col = (await getMflixDb()).collection<CommentDoc>("comments");
  const filter = { movie_id: { $in: mflixIds.map((id) => new ObjectId(id)) } };
  const [docs, total] = await Promise.all([
    col.find(filter, { projection: { name: 1, text: 1, date: 1 } }).sort({ date: -1 }).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);
  return {
    total,
    comments: docs.map((d) => ({
      id: d._id.toHexString(),
      name: d.name,
      text: d.text,
      date: d.date.toISOString(),
    })),
  };
}

// Phase 4 replaces this genre overlap with vector similarity on the synopsis.
export async function getSimilarTitles(title: TitleDetail, limit = 6): Promise<TitleCard[]> {
  if (title.genres.length === 0) return [];
  const docs = await (await titles())
    .find(
      { _id: { $ne: new ObjectId(title.id) }, kind: title.kind, genres: { $all: title.genres.slice(0, 2) } },
      { projection: CARD_PROJECTION },
    )
    .sort({ popularity: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toCard);
}

const genresByKind = new Map<string, Promise<string[]>>();

// Genres only change when an import runs, so compute each list once per
// server instance.
export function getGenres(kind?: Kind): Promise<string[]> {
  const key = kind ?? "all";
  let promise = genresByKind.get(key);
  if (!promise) {
    promise = titles()
      .then((col) => col.distinct("genres", kind ? { kind } : {}))
      .then((genres) => (genres as string[]).filter(Boolean).sort())
      .catch((error: unknown) => {
        genresByKind.delete(key);
        throw error;
      });
    genresByKind.set(key, promise);
  }
  return promise;
}
