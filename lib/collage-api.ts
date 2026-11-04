/**
 * URLs of the collage proxy edge function, shared by the proxy, the collage tool and its worker.
 *
 * Every parameter lives in the path as key/value pairs (`/api/collage-proxy/cover/mbid/<id>`), not in the query string: under concurrent requests Netlify's edge cache served one query string's response for another, so a cover could come back as stats JSON.
 * @module
 */

/** The proxy's route, also the prefix of every URL it serves. */
export const COLLAGE_API = "/api/collage-proxy";

/**
 * Build a proxy URL.
 *
 * @param source - `lb`, `lfm`, `cover` or `font`.
 * @param params - The parameters, in a stable order so equal requests share one cache entry.
 * @returns The same-origin URL.
 * @example
 * ```ts
 * collageApiUrl("cover", { mbid: "…" }); // "/api/collage-proxy/cover/mbid/…"
 * ```
 */
export function collageApiUrl(
  source: string,
  params: Record<string, string>,
): string {
  const pairs = Object.entries(params).flatMap(([key, value]) => [
    key,
    encodeURIComponent(value),
  ]);
  return [COLLAGE_API, source, ...pairs].join("/");
}

/**
 * Read a proxy URL back into the `source` and parameters it was built from.
 *
 * @param url - The request URL; the legacy query string form is read as is.
 * @returns The parameters, or `null` when the path is malformed.
 */
export function collageApiParams(url: URL): URLSearchParams | null {
  const rest = url.pathname
    .slice(COLLAGE_API.length)
    .split("/")
    .filter(Boolean);
  if (rest.length === 0) return url.searchParams;
  const [source, ...pairs] = rest;
  if (pairs.length % 2 !== 0) return null;
  const params = new URLSearchParams({ source });
  try {
    for (let i = 0; i < pairs.length; i += 2) {
      params.set(pairs[i], decodeURIComponent(pairs[i + 1]));
    }
  } catch {
    return null;
  }
  return params;
}
