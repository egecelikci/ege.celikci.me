/**
 * netlify/edge-functions/mb-events-proxy.ts
 *
 * Proxies the MusicBrainz browse-by-area event endpoint.
 * Adds a proper User-Agent (required by MB ToS) and caching headers.
 *
 * Registered in netlify.toml:
 *   [[edge_functions]]
 *   path = "/api/mb-events"
 *   function = "mb-events-proxy"
 *
 * Optional: call from the client to get fresher data than the last build.
 */

const IZMIR_AREA_MBID = "f6a9a62a-23b1-4f2e-b2f0-ac36f113f0b5";
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";
const MB_API = "https://musicbrainz.org/ws/2";

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const reqUrl = new URL(req.url);

  // Allow callers to pass ?offset=N for pagination
  const offset = reqUrl.searchParams.get("offset") ?? "0";
  const rawLimit = parseInt(reqUrl.searchParams.get("limit") ?? "100", 10);
  const limit = Math.min(isNaN(rawLimit) ? 100 : rawLimit, 100).toString();

  const mbUrl = new URL(`${MB_API}/event`);
  mbUrl.searchParams.set("area", IZMIR_AREA_MBID);
  mbUrl.searchParams.set(
    "inc",
    "artist-rels+place-rels+url-rels+label-rels",
  );
  mbUrl.searchParams.set("fmt", "json");
  mbUrl.searchParams.set("limit", limit);
  mbUrl.searchParams.set("offset", offset);

  try {
    const res = await fetch(mbUrl.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream MusicBrainz error: ${res.status}` }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const body = await res.text();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Cache at edge for 1 hour; serve stale for up to 24h while revalidating
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
};
