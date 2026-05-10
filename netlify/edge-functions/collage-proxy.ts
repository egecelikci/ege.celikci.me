/**
 * Collage Proxy Edge Function
 * Securely fetches album stats, cover art, and Google Fonts —
 * all from a single Netlify Edge Function to avoid CORS and API key exposure.
 */

const LASTFM_API_KEY = Deno.env.get("LASTFM_API_KEY");
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const source = url.searchParams.get("source") ?? "lb";
  const user = url.searchParams.get("user");
  const period = url.searchParams.get("period") ?? "week";
  const mbid = url.searchParams.get("mbid");

  // ── SOURCE: cover ─────────────────────────────────────────────────────────────
  // Proxy Cover Art Archive to avoid mixed-content and CORS issues in the worker.
  if (source === "cover") {
    if (!mbid || !/^[0-9a-f-]{36}$/i.test(mbid)) {
      return jsonError("Valid MBID required", 400);
    }

    try {
      const res = await fetch(
        `https://coverartarchive.org/release-group/${mbid}/front-500`,
        {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(8000),
        },
      );

      if (!res.ok) return jsonError(`Upstream error: ${res.status}`, 502);

      const contentLength = res.headers.get("Content-Length");
      if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
        return jsonError("Image too large", 502);
      }

      return new Response(res.body, {
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
          "Cache-Control": "public, s-maxage=31536000, immutable",
          ...CORS_HEADERS,
        },
      });
    } catch (err: unknown) {
      return jsonError(
        err instanceof Error ? err.message : "Unknown error",
        500,
      );
    }
  }

  // ── SOURCE: font ──────────────────────────────────────────────────────────────
  // Proxy Google Fonts to get binary font files usable in OffscreenCanvas workers.
  // Uses a modern UA to receive WOFF2, with fallback to weight-less and any-weight.
  if (source === "font") {
    const family = url.searchParams.get("family");
    const weight = url.searchParams.get("weight") ?? "400";

    if (!family) return jsonError("Font family required", 400);

    // Modern Chrome UA → Google Fonts returns WOFF2
    const UA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    async function fetchFontBuffer(
      requestedWeight: string | null,
    ): Promise<ArrayBuffer | null> {
      const encoded = family!.replace(/\s+/g, "+");
      const apiUrl = requestedWeight
        ? `https://fonts.googleapis.com/css2?family=${encoded}:wght@${requestedWeight}&display=swap`
        : `https://fonts.googleapis.com/css2?family=${encoded}&display=swap`;

      const cssRes = await fetch(apiUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      });
      if (!cssRes.ok) return null;

      const css = await cssRes.text();
      const urlRegex = /url\(["']?([^"')]+)["']?\)/g;
      const urls: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(css)) !== null) urls.push(match[1]);
      if (urls.length === 0) return null;

      // Google Fonts puts the base Latin subset last
      const fontRes = await fetch(urls[urls.length - 1], {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!fontRes.ok) return null;
      return fontRes.arrayBuffer();
    }

    try {
      // Try requested weight → 400 fallback → no-weight fallback
      let fontBuffer = await fetchFontBuffer(weight);
      if (!fontBuffer && weight !== "400") {
        fontBuffer = await fetchFontBuffer("400");
      }
      if (!fontBuffer) fontBuffer = await fetchFontBuffer(null);

      if (!fontBuffer) return jsonError("Could not retrieve font", 502);
      if (fontBuffer.byteLength < 4) {
        return jsonError("Font file too small", 502);
      }

      const magic = new DataView(fontBuffer).getUint32(0, false);
      // Accepted magic bytes: wOFF (0x774F4646), wOF2 (0x774F4632),
      //   TrueType (0x00010000), 'true' (0x74727565), OTTO (0x4F54544F)
      const validMagics = new Set([
        0x774f4646,
        0x774f4632,
        0x00010000,
        0x74727565,
        0x4f54544f,
      ]);
      if (!validMagics.has(magic)) {
        return jsonError(
          `Invalid font format (magic: 0x${magic.toString(16)})`,
          502,
        );
      }

      const contentType = magic === 0x774f4632
        ? "font/woff2"
        : magic === 0x774f4646
        ? "font/woff"
        : "font/ttf";

      return new Response(fontBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, s-maxage=31536000, immutable",
          ...CORS_HEADERS,
        },
      });
    } catch (err: unknown) {
      return jsonError(
        err instanceof Error ? err.message : "Unknown error",
        500,
      );
    }
  }

  // ── SOURCE: lb / lfm ─────────────────────────────────────────────────────────
  if (!user) return jsonError("Username required", 400);

  try {
    type AlbumEntry = {
      name: string;
      artist: string;
      count: number;
      mbid?: string;
      img?: string;
    };
    let albums: AlbumEntry[] = [];

    if (source === "lb") {
      const res = await fetch(
        `https://api.listenbrainz.org/1/stats/user/${
          encodeURIComponent(user)
        }/release-groups?range=${period}&count=100`,
        { headers: { "User-Agent": USER_AGENT } },
      );
      if (!res.ok) throw new Error(`ListenBrainz API error: ${res.status}`);

      const data = await res.json();
      albums = (data.payload?.release_groups ?? [])
        .filter((a: Record<string, unknown>) => a.release_group_name)
        .map((a: Record<string, unknown>) => ({
          name: a.release_group_name as string,
          artist: a.artist_name as string,
          count: a.listen_count as number,
          mbid: a.release_group_mbid as string | undefined,
        }));
    } else {
      if (!LASTFM_API_KEY) {
        return jsonError("Last.fm API key not configured", 500);
      }

      const lfmPeriodMap: Record<string, string> = {
        week: "7day",
        month: "1month",
        quarter: "3month",
        half_year: "6month",
        year: "12month",
        all_time: "overall",
      };

      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums` +
          `&user=${encodeURIComponent(user)}&api_key=${LASTFM_API_KEY}` +
          `&period=${lfmPeriodMap[period] ?? "7day"}&limit=100&format=json`,
        { headers: { "User-Agent": USER_AGENT } },
      );
      if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.message as string);

      albums = (data.topalbums?.album ?? [])
        .filter(
          (a: Record<string, unknown>) =>
            a.mbid || (Array.isArray(a.image) && a.image.length > 0),
        )
        .map((a: Record<string, unknown>) => {
          const images = a.image as Array<Record<string, string>>;
          const img = images?.[images.length - 1]?.["#text"];
          return {
            name: a.name as string,
            artist: (a.artist as Record<string, string>).name,
            count: a.playcount as number,
            mbid: a.mbid as string | undefined,
            img: img && img.length > 0 ? img : undefined,
          };
        });
    }

    return new Response(JSON.stringify({ albums }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600",
        ...CORS_HEADERS,
      },
    });
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : "Unknown error", 500);
  }
};
