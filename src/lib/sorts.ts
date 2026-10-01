// Shared by the server (query building) and the client (filter dropdown).
export const SORT_OPTIONS = {
  popular: "Most popular",
  rating: "Top rated",
  newest: "Newest",
  title: "Title A–Z",
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export const SORT_KEYS = Object.keys(SORT_OPTIONS) as [SortKey, ...SortKey[]];
