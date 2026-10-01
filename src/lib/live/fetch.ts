import "server-only";

/**
 * Fetches JSON from a third-party API and keeps it in the Next.js data cache
 * for `revalidate` seconds, so a popular page costs one API call per day, not
 * one per visitor. Any failure (missing key, timeout, rate limit, no match)
 * returns null and the page simply leaves that section out. Only 200
 * responses are cached, so a failed call is retried on the next visit.
 */
export async function fetchCachedJson<T>(url: string, init: RequestInit, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      // Explicit, because POST requests (AniList, IGDB) aren't cached otherwise.
      cache: "force-cache",
      next: { revalidate },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const DAY = 86400;
