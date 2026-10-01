export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Spaces calls out so a script never exceeds an API's requests-per-second limit.
export function rateLimiter(perSecond) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const at = Math.max(now, next);
    next = at + 1000 / perSecond;
    if (at > now) await sleep(at - now);
  };
}

// fetch + JSON with retries on rate limits (429), server errors and network
// failures, honouring Retry-After when the API sends it.
export async function fetchJson(url, init = {}, retries = 4) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return res.json();

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) {
      const body = await res.text().catch(() => "");
      throw new Error(`${init.method ?? "GET"} ${url} → ${res.status} ${body.slice(0, 200)}`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
  }
}
