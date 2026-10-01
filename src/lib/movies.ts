import "server-only";
import { cache } from "react";
import { ObjectId, type Document, type Filter, type Sort } from "mongodb";
import { getDb } from "./mongodb";
import type { MovieQuery } from "./query";
import type { SortKey } from "./sorts";

export const PAGE_SIZE = 24;
export const SEARCH_INDEX = "movies_search";

type MovieDoc = {
  _id: ObjectId;
  title: string;
  year?: number | string;
  plot?: string;
  fullplot?: string;
  poster?: string;
  genres?: string[];
  runtime?: number;
  rated?: string;
  cast?: string[];
  directors?: string[];
  writers?: string[];
  languages?: string[];
  countries?: string[];
  released?: Date;
  imdb?: { rating?: number | string; votes?: number | string };
  tomatoes?: {
    viewer?: { rating?: number };
    critic?: { rating?: number };
  };
  awards?: { text?: string };
};

type CommentDoc = {
  _id: ObjectId;
  name: string;
  text: string;
  date: Date;
};

export type MovieCard = {
  id: string;
  title: string;
  year?: number;
  poster?: string;
  genres: string[];
  rating?: number;
};

export type MovieDetail = MovieCard & {
  plot?: string;
  runtime?: number;
  rated?: string;
  cast: string[];
  directors: string[];
  writers: string[];
  languages: string[];
  countries: string[];
  votes?: number;
  tomatoesViewer?: number;
  tomatoesCritic?: number;
  awards?: string;
};

export type MovieComment = { id: string; name: string; text: string; date: string };

export type Suggestion = { id: string; title: string; year?: number };

export type SearchMode = "browse" | "atlas" | "basic";

// The sample data is messy: some numeric fields hold "" or strings like "2007è".
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

const CARD_PROJECTION = { title: 1, year: 1, poster: 1, genres: 1, "imdb.rating": 1 } as const;

function toCard(doc: MovieDoc): MovieCard {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    year: num(doc.year),
    poster: doc.poster,
    genres: doc.genres ?? [],
    rating: num(doc.imdb?.rating),
  };
}

function toDetail(doc: MovieDoc): MovieDetail {
  return {
    ...toCard(doc),
    plot: doc.fullplot ?? doc.plot,
    runtime: num(doc.runtime),
    rated: doc.rated,
    cast: doc.cast ?? [],
    directors: doc.directors ?? [],
    writers: doc.writers ?? [],
    languages: doc.languages ?? [],
    countries: doc.countries ?? [],
    votes: num(doc.imdb?.votes),
    tomatoesViewer: num(doc.tomatoes?.viewer?.rating),
    tomatoesCritic: num(doc.tomatoes?.critic?.rating),
    awards: doc.awards?.text,
  };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const movies = async () => (await getDb()).collection<MovieDoc>("movies");

// Each sort only considers documents where its field is actually a number;
// "Top rated" also ignores films with too few votes to mean anything.
const BROWSE: Record<SortKey, { filter: Filter<MovieDoc>; sort: Sort }> = {
  popular: { filter: { "imdb.votes": { $type: "number" } }, sort: { "imdb.votes": -1 } },
  rating: {
    filter: { "imdb.rating": { $type: "number" }, "imdb.votes": { $gte: 5000 } },
    sort: { "imdb.rating": -1, "imdb.votes": -1 },
  },
  // A numeric range never matches the malformed string years.
  newest: { filter: { year: { $gte: 1800 } }, sort: { year: -1, released: -1 } },
  title: { filter: {}, sort: { title: 1 } },
};

export async function listMovies(
  query: MovieQuery,
): Promise<{ movies: MovieCard[]; hasNext: boolean; mode: SearchMode }> {
  const skip = (query.page - 1) * PAGE_SIZE;
  const genreMatch: Filter<MovieDoc> = query.genre ? { genres: query.genre } : {};
  const col = await movies();

  // Fetch one extra document to know whether a next page exists without
  // running a separate (slow) count over the whole collection.
  const page = (docs: MovieDoc[]) => ({
    movies: docs.slice(0, PAGE_SIZE).map(toCard),
    hasNext: docs.length > PAGE_SIZE,
  });

  if (!query.q) {
    const { filter, sort } = BROWSE[query.sort];
    const docs = await col
      .find({ ...filter, ...genreMatch }, { projection: CARD_PROJECTION })
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
            should: [
              { autocomplete: { query: query.q, path: "title", score: { boost: { value: 3 } } } },
              {
                text: {
                  query: query.q,
                  path: ["title", "plot", "cast", "directors"],
                  fuzzy: { maxEdits: 1 },
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      },
      ...(query.genre ? [{ $match: genreMatch }] : []),
      { $skip: skip },
      { $limit: PAGE_SIZE + 1 },
      { $project: CARD_PROJECTION },
    ];
    const docs = await col.aggregate<MovieDoc>(pipeline).toArray();
    // A missing search index returns zero hits rather than an error, so an
    // empty first page also falls through to the basic search below.
    if (docs.length > 0 || skip > 0) return { ...page(docs), mode: "atlas" };
  } catch {
    // $search only exists on Atlas; fall back to a plain title match.
  }

  const docs = await col
    .find(
      { title: { $regex: escapeRegex(query.q), $options: "i" }, ...genreMatch },
      { projection: CARD_PROJECTION },
    )
    .sort({ "imdb.votes": -1 })
    .skip(skip)
    .limit(PAGE_SIZE + 1)
    .toArray();
  return { ...page(docs), mode: "basic" };
}

export async function suggestTitles(q: string): Promise<Suggestion[]> {
  const col = await movies();
  const toSuggestion = (doc: MovieDoc): Suggestion => ({
    id: doc._id.toHexString(),
    title: doc.title,
    year: num(doc.year),
  });

  try {
    const docs = await col
      .aggregate<MovieDoc>([
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
            },
          },
        },
        { $limit: 50 },
        {
          $project: {
            title: 1,
            year: 1,
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
            // votes is sometimes "" in the sample data; treat it as 0.
            votes: { $cond: [{ $isNumber: "$imdb.votes" }, "$imdb.votes", 0] },
          },
        },
        // Within a tier, show the well-known films first.
        { $sort: { tier: 1, votes: -1 } },
        { $limit: 8 },
      ])
      .toArray();
    if (docs.length > 0) return docs.map(toSuggestion);
  } catch {
    // Fall through to the prefix match.
  }

  const docs = await col
    .find({ title: { $regex: `^${escapeRegex(q)}`, $options: "i" } }, { projection: { title: 1, year: 1 } })
    .sort({ "imdb.votes": -1 })
    .limit(8)
    .toArray();
  return docs.map(toSuggestion);
}

// Cached per request: generateMetadata and the page both need the same movie.
export const getMovie = cache(async (id: string): Promise<MovieDetail | null> => {
  if (!ObjectId.isValid(id)) return null;
  const doc = await (await movies()).findOne({ _id: new ObjectId(id) });
  return doc ? toDetail(doc) : null;
});

export async function getComments(
  movieId: string,
  limit = 20,
): Promise<{ comments: MovieComment[]; total: number }> {
  const col = (await getDb()).collection<CommentDoc & { movie_id: ObjectId }>("comments");
  const filter = { movie_id: new ObjectId(movieId) };
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

// Week 2 replaces this genre overlap with vector similarity on the plot.
export async function getSimilarMovies(movie: MovieDetail, limit = 6): Promise<MovieCard[]> {
  if (movie.genres.length === 0) return [];
  const docs = await (await movies())
    .find(
      {
        _id: { $ne: new ObjectId(movie.id) },
        genres: { $all: movie.genres.slice(0, 2) },
        "imdb.votes": { $type: "number" },
      },
      { projection: CARD_PROJECTION },
    )
    .sort({ "imdb.votes": -1 })
    .limit(limit)
    .toArray();
  return docs.map(toCard);
}

let genresPromise: Promise<string[]> | undefined;

// The genre list never changes, so compute it once per server instance.
export function getGenres(): Promise<string[]> {
  genresPromise ??= movies()
    .then((col) => col.distinct("genres"))
    .then((genres) => (genres as string[]).filter(Boolean).sort())
    .catch((error: unknown) => {
      genresPromise = undefined;
      throw error;
    });
  return genresPromise;
}
