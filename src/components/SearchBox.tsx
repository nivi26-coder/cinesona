"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { Suggestion } from "@/lib/movies";

const MIN_CHARS = 2;

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<{ q: string; items: Suggestion[] }>({ q: "", items: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const q = value.trim();

  useEffect(() => {
    if (q.length < MIN_CHARS) return;
    // Debounce typing, and abort the previous request so a slow response for
    // an old query can never overwrite the results for the current one.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data: { suggestions: Suggestion[] } = await res.json();
        setSuggestions({ q, items: data.suggestions });
        setActive(-1);
      } catch {
        // Aborted or offline: keep whatever is showing.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const items = q.length >= MIN_CHARS && suggestions.q === q ? suggestions.items : [];
  const expanded = open && items.length > 0;

  const go = (s: Suggestion) => {
    setOpen(false);
    router.push(`/movies/${s.id}`);
  };

  return (
    <div className="relative flex-1">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search movies
      </label>
      <input
        id={`${listId}-input`}
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Search by title, plot, cast or director…"
        value={value}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && items.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === "ArrowUp" && items.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
          } else if (e.key === "Enter" && expanded && active >= 0) {
            // A highlighted suggestion opens that movie; otherwise Enter
            // submits the form as a normal full-text search.
            e.preventDefault();
            go(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-xl"
        >
          {items.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the input so onBlur doesn't close the list first.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(s)}
              className={`flex cursor-pointer justify-between gap-3 px-4 py-2 text-sm ${
                i === active ? "bg-surface-2 text-accent" : ""
              }`}
            >
              <span className="truncate">{s.title}</span>
              {s.year && <span className="shrink-0 text-muted">{s.year}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
