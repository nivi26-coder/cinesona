import { FilterBar } from "@/components/FilterBar";
import { KindTabs } from "@/components/KindTabs";
import { Pagination } from "@/components/Pagination";
import { SetupNotice } from "@/components/SetupNotice";
import { TitleCard } from "@/components/TitleCard";
import { KIND_INFO } from "@/lib/kinds";
import { isDbConfigured } from "@/lib/mongodb";
import { parseTitleQuery } from "@/lib/query";
import { SORT_OPTIONS } from "@/lib/sorts";
import { getGenres, listTitles } from "@/lib/titles";

export default async function Home(props: PageProps<"/">) {
  // Read searchParams first: it makes the route render per request, even in a
  // build that has no MONGODB_URI yet.
  const query = parseTitleQuery(await props.searchParams);
  if (!isDbConfigured()) return <SetupNotice />;

  const [genres, { titles, hasNext, mode }] = await Promise.all([getGenres(query.kind), listTitles(query)]);

  const what = query.kind ? KIND_INFO[query.kind].plural : "All";
  const heading = query.q
    ? `Results for “${query.q}”${query.kind ? ` in ${what}` : ""}`
    : `${SORT_OPTIONS[query.sort]} · ${what}${query.genre ? ` · ${query.genre}` : ""}`;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {query.kind ? `Find your next ${KIND_INFO[query.kind].label.toLowerCase()}` : "Find something to watch or play"}
        </h1>
        <KindTabs query={query} />
        <FilterBar q={query.q} kind={query.kind} genre={query.genre} sort={query.sort} genres={genres} />
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

        {titles.length === 0 ? (
          <p className="py-16 text-center text-muted">Nothing matches that. Try a different search, genre or tab.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
            {titles.map((title, i) => (
              <li key={title.id}>
                <TitleCard title={title} priority={i < 6} showKind={!query.kind} />
              </li>
            ))}
          </ul>
        )}

        <Pagination query={query} hasNext={hasNext} />
      </section>
    </div>
  );
}
