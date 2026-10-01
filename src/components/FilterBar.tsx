"use client";

import Form from "next/form";
import type { ChangeEvent } from "react";
import { SORT_KEYS, SORT_OPTIONS, type SortKey } from "@/lib/sorts";
import { SearchBox } from "./SearchBox";

const submitOnChange = (e: ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();

const selectClass =
  "h-11 rounded-lg border border-border bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export function FilterBar({
  q,
  genre,
  sort,
  genres,
}: {
  q?: string;
  genre?: string;
  sort: SortKey;
  genres: string[];
}) {
  return (
    // next/form turns this GET form into a client-side navigation to /?q=…,
    // and it still works as a plain form before JavaScript loads.
    <Form action="/" key={`${q}|${genre}|${sort}`} className="flex flex-col gap-3 sm:flex-row" role="search">
      <SearchBox defaultValue={q} />
      <div className="flex gap-3">
        <label className="sr-only" htmlFor="genre">
          Genre
        </label>
        <select id="genre" name="genre" defaultValue={genre ?? ""} onChange={submitOnChange} className={`${selectClass} flex-1`}>
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="sort">
          Sort by
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={sort}
          onChange={submitOnChange}
          // Search results are ordered by relevance, so sorting doesn't apply.
          disabled={Boolean(q)}
          className={`${selectClass} flex-1 disabled:opacity-50`}
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_OPTIONS[key]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-11 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Search
        </button>
      </div>
    </Form>
  );
}
