// Shared by the server and the client (tabs, links, labels).
export const KINDS = ["movie", "series", "anime", "game"] as const;

export type Kind = (typeof KINDS)[number];

export const KIND_INFO: Record<Kind, { label: string; plural: string; path: string }> = {
  movie: { label: "Movie", plural: "Movies", path: "movies" },
  series: { label: "Series", plural: "Series", path: "series" },
  anime: { label: "Anime", plural: "Anime", path: "anime" },
  game: { label: "Game", plural: "Games", path: "games" },
};

export const isKind = (value: unknown): value is Kind => KINDS.includes(value as Kind);

export const kindFromPath = (path: string): Kind | undefined => KINDS.find((k) => KIND_INFO[k].path === path);

export const titleHref = (t: { kind: Kind; slug: string }) => `/${KIND_INFO[t.kind].path}/${t.slug}`;
