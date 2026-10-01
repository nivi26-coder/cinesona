import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { formatDate, formatRuntime, formatVotes } from "@/lib/format";
import { KIND_INFO, titleHref, type Kind } from "@/lib/kinds";
import { isDbConfigured } from "@/lib/mongodb";
import { titleQueryToSearch } from "@/lib/query";
import { findByMflixId, getComments, getSimilarTitles, getTitle, type TitleDetail } from "@/lib/titles";
import { Poster } from "./Poster";
import { SetupNotice } from "./SetupNotice";
import { TitleCard } from "./TitleCard";
import { TitleExtras, TitleExtrasSkeleton } from "./TitleExtras";

// Shared by /movies/[id], /series/[slug], /anime/[slug] and /games/[slug].

export async function titleMetadata(kind: Kind, slug: string): Promise<Metadata> {
  if (!isDbConfigured()) return {};
  const title = await getTitle(kind, slug);
  return title ? { title: title.title, description: title.synopsis?.slice(0, 300) } : {};
}

const COMPANY_LABEL: Record<Kind, string> = { movie: "Studio", series: "Studio", anime: "Studio", game: "Developer" };

function scoreText(t: TitleDetail): string | undefined {
  if (t.score === undefined) return undefined;
  // IGDB scores are out of 100; IMDb and TMDB are shown out of 10 as on their sites.
  return t.scoreSource === "IGDB" ? `${t.score}/100` : `${(t.score / 10).toFixed(1)}/10`;
}

export async function TitlePage({ kind, slug }: { kind: Kind; slug: string }) {
  if (!isDbConfigured()) return <SetupNotice />;

  const title = await getTitle(kind, slug);
  if (!title) {
    if (kind === "movie") {
      const moved = await findByMflixId(slug);
      if (moved) permanentRedirect(titleHref(moved));
    }
    notFound();
  }

  const [comments, similar] = await Promise.all([
    title.ext.mflix ? getComments(title.ext.mflix) : null,
    getSimilarTitles(title),
  ]);

  const info = KIND_INFO[kind];
  const facts = [info.label, title.year, title.rated, formatRuntime(title.runtime)].filter(Boolean);
  const credits = [
    ["Director", title.directors],
    ["Writers", title.writers],
    ["Cast", title.cast],
    [COMPANY_LABEL[kind], title.companies],
    ["Platforms", title.platforms],
    ["Language", title.languages],
    ["Country", title.countries],
  ] as const;
  const score = scoreText(title);

  return (
    <article className="flex flex-col gap-12">
      <Link href={`/${titleQueryToSearch({ kind })}`} className="text-sm text-muted hover:text-accent">
        ← All {info.plural.toLowerCase()}
      </Link>

      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <div className="relative mx-auto aspect-[2/3] w-52 self-start overflow-hidden rounded-xl border border-border bg-surface-2 md:w-full">
          <Poster src={title.poster} title={title.title} sizes="260px" priority />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title.title}</h1>
            {title.originalTitle && <p className="mt-1 text-sm text-muted">{title.originalTitle}</p>}
            <p className="mt-1 text-muted">{facts.join(" · ")}</p>
          </div>

          {title.genres.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Genres">
              {title.genres.map((g) => (
                <li key={g}>
                  <Link
                    href={`/${titleQueryToSearch({ kind, genre: g })}`}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:border-accent hover:text-accent"
                  >
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <dl className="flex flex-wrap gap-6">
            {score && (
              <Score
                label={title.scoreSource ?? "Score"}
                value={score}
                hint={formatVotes(title.votes) && `${formatVotes(title.votes)} votes`}
              />
            )}
            {title.tomatoesCritic !== undefined && <Score label="Critics" value={`${title.tomatoesCritic.toFixed(1)}/10`} />}
            {title.tomatoesViewer !== undefined && <Score label="Audience" value={`${title.tomatoesViewer.toFixed(1)}/5`} />}
          </dl>

          {title.synopsis && <p className="max-w-prose leading-7">{title.synopsis}</p>}
          {title.awards && <p className="text-sm text-muted">🏆 {title.awards}</p>}

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

          <Suspense fallback={<TitleExtrasSkeleton />}>
            <TitleExtras title={title} />
          </Suspense>
        </div>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar-heading" className="flex flex-col gap-4">
          <h2 id="similar-heading" className="text-lg font-semibold">
            More like this
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {similar.map((t) => (
              <li key={t.id}>
                <TitleCard title={t} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {comments && (
        <section aria-labelledby="comments-heading" className="flex max-w-3xl flex-col gap-4">
          <h2 id="comments-heading" className="text-lg font-semibold">
            Comments <span className="text-muted">({comments.total})</span>
          </h2>
          {comments.comments.length === 0 ? (
            <p className="text-sm text-muted">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {comments.comments.map((c) => (
                <li key={c.id} className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-sm font-medium">
                    {c.name} <span className="font-normal text-muted">· {formatDate(c.date)}</span>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">{c.text}</p>
                </li>
              ))}
            </ul>
          )}
          {comments.total > comments.comments.length && (
            <p className="text-xs text-muted">Showing the {comments.comments.length} most recent.</p>
          )}
        </section>
      )}
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
