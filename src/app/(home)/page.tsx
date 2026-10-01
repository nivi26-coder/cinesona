import { FilterBar } from "@/components/FilterBar";
import { MovieCard } from "@/components/MovieCard";
import { Pagination } from "@/components/Pagination";
import { SetupNotice } from "@/components/SetupNotice";
import { getGenres, listMovies } from "@/lib/movies";
import { isDbConfigured } from "@/lib/mongodb";
import { parseMovieQuery } from "@/lib/query";
import { SORT_OPTIONS } from "@/lib/sorts";

export default async function Home(props: PageProps<"/">) {
  // Read searchParams first: it makes the route render per request, even in a
  // build that has no MONGODB_URI yet.
  const query = parseMovieQuery(await props.searchParams);
  if (!isDbConfigured()) return <SetupNotice />;

  const [genres, { movies, hasNext, mode }] = await Promise.all([getGenres(), listMovies(query)]);

  const heading = query.q
    ? `Results for “${query.q}”`
    : `${SORT_OPTIONS[query.sort]}${query.genre ? ` · ${query.genre}` : ""}`;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find your next movie</h1>
        <FilterBar q={query.q} genre={query.genre} sort={query.sort} genres={genres} />
      </section>

      <section aria-labelledby="results-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="results-heading" className="text-lg font-semibold">
            {heading}
          </h2>
          {mode === "basic" && (
            <p className="text-xs text-muted">
              Basic title search. Run <code className="font-mono">npm run db:indexes</code> to enable full-text
              search.
            </p>
          )}
        </div>

        {movies.length === 0 ? (
          <p className="py-16 text-center text-muted">No movies match that. Try a different search or genre.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
            {movies.map((movie, i) => (
              <li key={movie.id}>
                <MovieCard movie={movie} priority={i < 6} />
              </li>
            ))}
          </ul>
        )}

        <Pagination query={query} hasNext={hasNext} />
      </section>
    </div>
  );
}
