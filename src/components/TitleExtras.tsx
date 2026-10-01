import Image from "next/image";
import { formatDate } from "@/lib/format";
import { getAnilistExtras } from "@/lib/live/anilist";
import { getIgdbExtras } from "@/lib/live/igdb";
import { getTmdbExtras } from "@/lib/live/tmdb";
import type { TitleDetail } from "@/lib/titles";

const pillClass =
  "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent";

/**
 * Live details from TMDB / AniList / IGDB: things that change often or that
 * we don't store (where to watch, airing status, trailers, screenshots).
 * Rendered inside <Suspense>, so a slow API never holds up the rest of the page.
 */
export async function TitleExtras({ title }: { title: TitleDetail }) {
  const [tmdb, anilist, igdb] = await Promise.all([
    getTmdbExtras(title),
    getAnilistExtras(title),
    getIgdbExtras(title),
  ]);
  if (!tmdb && !anilist && !igdb) return null;

  const trailer = tmdb?.trailer ?? anilist?.trailer ?? igdb?.trailer;
  const next = tmdb?.nextEpisode;

  const facts: [string, string | number | undefined][] = [
    ["Status", tmdb?.status ?? anilist?.status],
    ["Format", anilist?.format],
    ["Seasons", tmdb?.seasons],
    ["Episodes", tmdb?.episodes ?? anilist?.episodes],
    [
      "Next episode",
      next
        ? `S${next.season} E${next.episode} · ${formatDate(next.date)}`
        : anilist?.nextEpisode && `Ep ${anilist.nextEpisode.episode} · ${formatDate(anilist.nextEpisode.airingAt)}`,
    ],
    ["Network", tmdb?.networks.join(", ")],
    ["Created by", tmdb?.creators.join(", ")],
    ["Studio", anilist?.studios.join(", ")],
    // Imported TMDB titles don't store cast; sample_mflix ones already show it.
    ["Cast", title.cast.length === 0 ? tmdb?.cast.join(", ") : undefined],
    ["AniList", anilist?.score ? `${anilist.score}/100 · ${anilist.members?.toLocaleString("en")} members` : undefined],
  ];
  const shownFacts = facts.filter(([, v]) => v !== undefined && v !== "");

  const sources = [
    tmdb && { name: "TMDB", url: tmdb.url },
    anilist && { name: "AniList", url: anilist.url },
    igdb?.url && { name: "IGDB", url: igdb.url },
  ].filter(Boolean) as { name: string; url: string }[];

  return (
    <section aria-labelledby="extras-heading" className="flex flex-col gap-6">
      <h2 id="extras-heading" className="sr-only">
        Watch, play and more
      </h2>

      {tmdb?.tagline && <p className="text-lg italic text-muted">“{tmdb.tagline}”</p>}

      {(trailer || anilist?.streaming.length || igdb?.stores.length) && (
        <div className="flex flex-wrap gap-2">
          {trailer && (
            <a href={trailer} target="_blank" rel="noopener noreferrer" className={pillClass}>
              ▶ Watch trailer
            </a>
          )}
          {anilist?.streaming.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={pillClass}>
              {s.site}
            </a>
          ))}
          {igdb?.stores.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={pillClass}>
              {s.name}
            </a>
          ))}
        </div>
      )}

      {tmdb?.watch && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">
            Where to watch <span className="font-normal text-muted">({tmdb.watch.region})</span>
          </h3>
          <ul className="flex flex-wrap gap-3">
            {tmdb.watch.options.map((o) => (
              <li key={o.name}>
                <a
                  href={tmdb.watch!.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pl-1.5 pr-3 text-sm hover:border-accent"
                >
                  {o.logo && (
                    <Image src={o.logo} alt="" width={28} height={28} unoptimized className="rounded-md" />
                  )}
                  <span>
                    {o.name} <span className="text-xs text-muted">· {o.type}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Availability from JustWatch via TMDB.</p>
        </div>
      )}

      {shownFacts.length > 0 && (
        <dl className="grid max-w-prose grid-cols-[110px_1fr] gap-x-4 gap-y-2 text-sm">
          {shownFacts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {anilist && anilist.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tags">
          {anilist.tags.map((t) => (
            <li key={t} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
              {t}
            </li>
          ))}
        </ul>
      )}

      {igdb && igdb.screenshots.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {igdb.screenshots.map((src) => (
            <li key={src} className="relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-2">
              <Image src={src} alt="" fill sizes="(min-width: 640px) 33vw, 50vw" unoptimized className="object-cover" />
            </li>
          ))}
        </ul>
      )}

      {sources.length > 0 && (
        <p className="text-xs text-muted">
          Live data from{" "}
          {sources.map((s, i) => (
            <span key={s.name}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
                {s.name}
              </a>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

export function TitleExtrasSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading watch options">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-24 max-w-prose animate-pulse rounded-lg bg-surface-2" />
    </div>
  );
}
