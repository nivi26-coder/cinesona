import "server-only";
import type { TitleDetail } from "../titles";
import { DAY, fetchCachedJson } from "./fetch";

export type IgdbExtras = {
  url?: string;
  screenshots: string[];
  trailer?: string;
  stores: { name: string; url: string }[];
};

type Game = {
  url?: string;
  screenshots?: { image_id: string }[];
  videos?: { video_id: string }[];
  websites?: { url: string }[];
};

// Store names by URL, so we don't depend on IGDB's website category codes.
const STORES: [RegExp, string][] = [
  [/store\.steampowered\.com/, "Steam"],
  [/gog\.com/, "GOG"],
  [/epicgames\.com/, "Epic Games"],
  [/store\.playstation\.com/, "PlayStation Store"],
  [/xbox\.com|microsoft\.com/, "Microsoft Store"],
  [/nintendo\.(com|co\.\w+)/, "Nintendo eShop"],
  [/itch\.io/, "itch.io"],
  [/apps\.apple\.com/, "App Store"],
  [/play\.google\.com/, "Google Play"],
];

// Twitch app tokens last ~60 days; keep one per server instance (never in the
// shared fetch cache, since it's a secret).
let tokenPromise: Promise<{ token: string; expiresAt: number } | null> | undefined;

function getToken(): Promise<{ token: string; expiresAt: number } | null> {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return Promise.resolve(null);

  tokenPromise ??= fetch(
    `https://id.twitch.tv/oauth2/token?${new URLSearchParams({
      client_id: id,
      client_secret: secret,
      grant_type: "client_credentials",
    })}`,
    { method: "POST", cache: "no-store", signal: AbortSignal.timeout(5000) },
  )
    .then(async (res) => {
      if (!res.ok) throw new Error(`Twitch token: ${res.status}`);
      const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
      return { token: access_token, expiresAt: Date.now() + (expires_in - 3600) * 1000 };
    })
    .catch(() => {
      tokenPromise = undefined;
      return null;
    });

  return tokenPromise.then((t) => {
    if (t && t.expiresAt < Date.now()) {
      tokenPromise = undefined;
      return getToken();
    }
    return t;
  });
}

export async function getIgdbExtras(title: TitleDetail): Promise<IgdbExtras | null> {
  const gameId = title.ext.igdb;
  if (title.kind !== "game" || !Number.isInteger(gameId)) return null;
  const auth = await getToken();
  if (!auth) return null;

  const games = await fetchCachedJson<Game[]>(
    "https://api.igdb.com/v4/games",
    {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${auth.token}`,
        Accept: "application/json",
      },
      body: `fields url, screenshots.image_id, videos.video_id, websites.url; where id = ${gameId};`,
    },
    DAY,
  );
  const g = games?.[0];
  if (!g) return null;

  const stores: IgdbExtras["stores"] = [];
  for (const { url } of g.websites ?? []) {
    const name = STORES.find(([pattern]) => pattern.test(url))?.[1];
    if (name && !stores.some((s) => s.name === name)) stores.push({ name, url });
  }

  return {
    url: g.url,
    screenshots: (g.screenshots ?? [])
      .slice(0, 6)
      .map((s) => `https://images.igdb.com/igdb/image/upload/t_screenshot_med/${s.image_id}.jpg`),
    trailer: g.videos?.[0] && `https://www.youtube.com/watch?v=${g.videos[0].video_id}`,
    stores,
  };
}
