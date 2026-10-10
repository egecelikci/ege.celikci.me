/**
 * Collage Proxy Edge Function
 * Securely fetches album stats, cover art, and Google Fonts —
 * all from a single Netlify Edge Function to avoid CORS and API key exposure.
 */

const LASTFM_API_KEY = Deno.env.get("LASTFM_API_KEY");
const LISTENBRAINZ_TOKEN = Deno.env.get("LISTENBRAINZ_TOKEN");
/** ListenBrainz asks for `App/<version> ( contact )` and may block requests without it. */
const USER_AGENT = "ege.celikci.me/1.0 ( ege@celikci.me )";

/** Ranges accepted by ListenBrainz `stats/user/{user}/release-groups`. */
const LISTENBRAINZ_RANGES = new Set([
  "this_week",
  "this_month",
  "this_year",
  "week",
  "month",
  "quarter",
  "half_yearly",
  "year",
  "all_time",
]);

/** Our period names mapped to Last.fm's `user.getTopAlbums` periods. */
const LASTFM_PERIODS: Record<string, string> = {
  week: "7day",
  month: "1month",
  quarter: "3month",
  half_year: "6month",
  year: "12month",
  all_time: "overall",
};

/** Stats change at most daily, so serve a cached copy while refreshing it. */
const STATS_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/** Last.fm cover file names: a 32-hex hash and an image extension. */
const LASTFM_COVER = /^[0-9a-f]{32}\.(?:png|jpe?g|gif|webp)$/;

/**
 * Turn a Last.fm image URL into a same-origin proxy URL, so the browser never contacts Last.fm.
 *
 * @param img - The image URL from `user.getTopAlbums`.
 * @returns The proxy URL, or `undefined` when the URL is not a Last.fm cover.
 */
function proxiedLastfmCover(img: string | undefined): string | undefined {
  const file = img?.split("/").pop() ?? "";
  return LASTFM_COVER.test(file)
    ? `/api/collage-proxy?source=cover&lfm=${file}`
    : undefined;
}

/**
 * Pick the upstream image for a cover request.
 *
 * @param params - `lfm` for a Last.fm cover, `release` and `caa` for an exact Cover Art Archive image, or `mbid` for a release group's front.
 * @returns The upstream URL, or `null` when the parameters are invalid.
 */
function coverUpstream(params: URLSearchParams): string | null {
  const lfm = params.get("lfm");
  if (lfm) {
    return LASTFM_COVER.test(lfm)
      ? `https://lastfm.freetls.fastly.net/i/u/300x300/${lfm}`
      : null;
  }
  const release = params.get("release");
  const caa = params.get("caa");
  if (release || caa) {
    return release && /^[0-9a-f-]{36}$/i.test(release) && caa &&
        /^\d+$/.test(caa)
      ? `https://coverartarchive.org/release/${release}/${caa}-500.jpg`
      : null;
  }
  const mbid = params.get("mbid");
  return mbid && /^[0-9a-f-]{36}$/i.test(mbid)
    ? `https://coverartarchive.org/release-group/${mbid}/front-500`
    : null;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default async (req: Request): Promise<Response> => {
  /** Handle CORS preflight */
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const source = url.searchParams.get("source") ?? "lb";
  const user = url.searchParams.get("user");
  const period = url.searchParams.get("period") ?? "week";
  if (source === "lb" && !LISTENBRAINZ_RANGES.has(period)) {
    return jsonError(`Unknown ListenBrainz range: ${period}`, 400);
  }
  if (source === "lfm" && !(period in LASTFM_PERIODS)) {
    return jsonError(`Unknown Last.fm period: ${period}`, 400);
  }

  /**
   * SOURCE: cover
   * Proxy Cover Art Archive and Last.fm covers, so the worker only ever talks to this origin.
   */
  if (source === "cover") {
    const upstream = coverUpstream(url.searchParams);
    if (!upstream) return jsonError("Valid cover id required", 400);

    try {
      const res = await fetch(
        upstream,
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
    } catch {
      return jsonError("Cover Art Archive is unreachable", 502);
    }
  }

  /**
   * SOURCE: font
   * Proxy Google Fonts to get binary font files usable in OffscreenCanvas workers.
   * Uses a modern UA to receive WOFF2, with fallback to weight-less and any-weight.
   */
  if (source === "font") {
    const family = url.searchParams.get("family");
    const weight = url.searchParams.get("weight") ?? "400";

    if (!family) return jsonError("Font family required", 400);

    /** Modern Chrome UA → Google Fonts returns WOFF2 */
    const UA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    const fetchFontBuffer = async (
      requestedWeight: string | null,
    ): Promise<ArrayBuffer | null> => {
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

      /** Google Fonts puts the base Latin subset last */
      const fontRes = await fetch(urls[urls.length - 1], {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!fontRes.ok) return null;
      return fontRes.arrayBuffer();
    };

    try {
      /** Try requested weight → 400 fallback → no-weight fallback */
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
      /**
       * Accepted magic bytes: wOFF (0x774F4646), wOF2 (0x774F4632),
       *   TrueType (0x00010000), 'true' (0x74727565), OTTO (0x4F54544F)
       */
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
    } catch {
      return jsonError("Google Fonts is unreachable", 502);
    }
  }

  /** SOURCE: lb / lfm */
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
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
            ...(LISTENBRAINZ_TOKEN
              ? { Authorization: `Token ${LISTENBRAINZ_TOKEN}` }
              : {}),
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (res.status === 204) {
        return jsonError(
          "ListenBrainz has not calculated stats for this range yet",
          404,
        );
      }
      if (res.status === 404) {
        return jsonError("ListenBrainz user not found", 404);
      }
      if (res.status === 429) {
        return jsonError(
          "ListenBrainz rate limit reached, try again soon",
          503,
        );
      }
      if (!res.ok) {
        await res.body?.cancel();
        return jsonError(`ListenBrainz error ${res.status}`, 502);
      }

      // A bot check page arrives as HTML with status 200.
      const data = res.headers.get("Content-Type")?.includes("json")
        ? await res.json().catch(() => null)
        : null;
      if (!data) {
        return jsonError(
          "ListenBrainz is unavailable right now, try again later",
          502,
        );
      }
      albums = (data.payload?.release_groups ?? [])
        .filter((a: Record<string, unknown>) => a.release_group_name)
        .map((a: Record<string, unknown>) => ({
          name: a.release_group_name as string,
          artist: a.artist_name as string,
          count: a.listen_count as number,
          mbid: a.release_group_mbid as string | undefined,
          // ListenBrainz names the exact cover image, which skips the release-group lookup and redirect.
          img: a.caa_release_mbid && a.caa_id
            ? `/api/collage-proxy?source=cover&release=${a.caa_release_mbid}&caa=${a.caa_id}`
            : undefined,
        }));
    } else {
      if (!LASTFM_API_KEY) {
        return jsonError("Last.fm API key not configured", 500);
      }

      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums` +
          `&user=${encodeURIComponent(user)}&api_key=${LASTFM_API_KEY}` +
          `&period=${LASTFM_PERIODS[period]}&limit=100&format=json`,
        {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(10000),
        },
      );
      const data = await res.json().catch(() => null);
      // Last.fm error 6 is "user not found"; it also answers some errors with a 200.
      if (data?.error === 6) return jsonError("Last.fm user not found", 404);
      if (!res.ok || !data || data.error) {
        return jsonError(`Last.fm error ${data?.error ?? res.status}`, 502);
      }

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
            img: proxiedLastfmCover(img),
          };
        });
    }

    return new Response(JSON.stringify({ albums }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": STATS_CACHE,
        ...CORS_HEADERS,
      },
    });
  } catch {
    // Upstream error messages can carry the request URL and with it the API key, so they stay server-side.
    return jsonError("The stats service is unreachable", 502);
  }
};
