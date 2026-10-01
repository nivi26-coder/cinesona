import Link from "next/link";
import { KIND_INFO, KINDS, type Kind } from "@/lib/kinds";
import { titleQueryToSearch, type TitleQuery } from "@/lib/query";

// Switching tabs keeps the search and sort but drops the genre, since each
// kind has its own genre list.
export function KindTabs({ query }: { query: TitleQuery }) {
  const tabs: { kind?: Kind; label: string }[] = [
    { label: "All" },
    ...KINDS.map((kind) => ({ kind, label: KIND_INFO[kind].plural })),
  ];

  return (
    <nav aria-label="Content type" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {tabs.map(({ kind, label }) => {
        const current = query.kind === kind;
        return (
          <Link
            key={label}
            href={`/${titleQueryToSearch({ q: query.q, sort: query.sort, kind })}`}
            aria-current={current ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
              current ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
