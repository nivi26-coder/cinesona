import Link from "next/link";
import { movieQueryToSearch, type MovieQuery } from "@/lib/query";

const linkClass =
  "rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent";

export function Pagination({ query, hasNext }: { query: MovieQuery; hasNext: boolean }) {
  if (query.page === 1 && !hasNext) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-4">
      {query.page > 1 ? (
        <Link href={`/${movieQueryToSearch({ ...query, page: query.page - 1 })}`} className={linkClass}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">Page {query.page}</span>
      {hasNext ? (
        <Link href={`/${movieQueryToSearch({ ...query, page: query.page + 1 })}`} className={linkClass}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
