import { z } from "zod";
import { KINDS } from "./kinds";
import { SORT_KEYS } from "./sorts";

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const blankToUndefined = (value: unknown) => {
  const v = first(value);
  return typeof v === "string" && v.trim() === "" ? undefined : v;
};

// Anything malformed in the URL falls back to a default instead of erroring,
// so a hand-edited or stale link still renders a sensible page.
const titleQuerySchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()).catch(undefined),
  kind: z.preprocess(blankToUndefined, z.enum(KINDS).optional()).catch(undefined),
  genre: z.preprocess(blankToUndefined, z.string().max(40).optional()).catch(undefined),
  sort: z.preprocess(first, z.enum(SORT_KEYS)).catch("popular"),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(400)).catch(1),
});

export type TitleQuery = z.infer<typeof titleQuerySchema>;

export function parseTitleQuery(params: RawParams): TitleQuery {
  return titleQuerySchema.parse(params);
}

export function titleQueryToSearch(query: Partial<TitleQuery>): string {
  const search = new URLSearchParams();
  if (query.q) search.set("q", query.q);
  if (query.kind) search.set("kind", query.kind);
  if (query.genre) search.set("genre", query.genre);
  if (query.sort && query.sort !== "popular") search.set("sort", query.sort);
  if (query.page && query.page > 1) search.set("page", String(query.page));
  const s = search.toString();
  return s ? `?${s}` : "";
}
