import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MovieCard } from "@/components/MovieCard";
import { Poster } from "@/components/Poster";
import { SetupNotice } from "@/components/SetupNotice";
import { formatDate, formatRuntime, formatVotes } from "@/lib/format";
import { isDbConfigured } from "@/lib/mongodb";
import { getComments, getMovie, getSimilarMovies } from "@/lib/movies";

export async function generateMetadata(props: PageProps<"/movies/[id]">): Promise<Metadata> {
  if (!isDbConfigured()) return {};
  const movie = await getMovie((await props.params).id);
  return movie ? { title: movie.title, description: movie.plot } : {};
}

export default async function MoviePage(props: PageProps<"/movies/[id]">) {
  if (!isDbConfigured()) return <SetupNotice />;

  const movie = await getMovie((await props.params).id);
  if (!movie) notFound();

  const [{ comments, total }, similar] = await Promise.all([getComments(movie.id), getSimilarMovies(movie)]);

  const facts = [movie.year, movie.rated, formatRuntime(movie.runtime)].filter(Boolean);
  const credits = [
    ["Director", movie.directors],
    ["Writers", movie.writers],
    ["Cast", movie.cast],
    ["Language", movie.languages],
    ["Country", movie.countries],
  ] as const;

  return (
    <article className="flex flex-col gap-12">
      <Link href="/" className="text-sm text-muted hover:text-accent">
        ← All movies
      </Link>

      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <div className="relative mx-auto aspect-[2/3] w-52 overflow-hidden rounded-xl border border-border bg-surface-2 md:w-full">
          <Poster src={movie.poster} title={movie.title} sizes="260px" priority />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{movie.title}</h1>
            {facts.length > 0 && <p className="mt-1 text-muted">{facts.join(" · ")}</p>}
          </div>

          {movie.genres.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Genres">
              {movie.genres.map((g) => (
                <li key={g}>
                  <Link
                    href={`/?genre=${encodeURIComponent(g)}`}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                  >
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <dl className="flex flex-wrap gap-6">
            {movie.rating !== undefined && (
              <Score label="IMDb" value={`${movie.rating.toFixed(1)}/10`} hint={formatVotes(movie.votes) && `${formatVotes(movie.votes)} votes`} />
            )}
            {movie.tomatoesCritic !== undefined && <Score label="Critics" value={`${movie.tomatoesCritic.toFixed(1)}/10`} />}
            {movie.tomatoesViewer !== undefined && <Score label="Audience" value={`${movie.tomatoesViewer.toFixed(1)}/5`} />}
          </dl>

          {movie.plot && <p className="max-w-prose leading-7">{movie.plot}</p>}
          {movie.awards && <p className="text-sm text-muted">🏆 {movie.awards}</p>}

          <dl className="grid max-w-prose grid-cols-[100px_1fr] gap-x-4 gap-y-2 text-sm">
            {credits
              .filter(([, values]) => values.length > 0)
              .map(([label, values]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd>{values.join(", ")}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar-heading" className="flex flex-col gap-4">
          <h2 id="similar-heading" className="text-lg font-semibold">
            More like this
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {similar.map((m) => (
              <li key={m.id}>
                <MovieCard movie={m} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="comments-heading" className="flex max-w-3xl flex-col gap-4">
        <h2 id="comments-heading" className="text-lg font-semibold">
          Comments <span className="text-muted">({total})</span>
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-muted">No comments yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-medium">
                  {c.name} <span className="font-normal text-muted">· {formatDate(c.date)}</span>
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">{c.text}</p>
              </li>
            ))}
          </ul>
        )}
        {total > comments.length && (
          <p className="text-xs text-muted">Showing the {comments.length} most recent.</p>
        )}
      </section>
    </article>
  );
}

function Score({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-xl font-semibold">
        {value}
        {hint && <span className="ml-2 text-xs font-normal text-muted">{hint}</span>}
      </dd>
    </div>
  );
}
