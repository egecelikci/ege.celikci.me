/**
 * Collage Proxy Edge Function
 * Securely fetches album stats from ListenBrainz or Last.fm.
 */

const LASTFM_API_KEY = Deno.env.get("LASTFM_API_KEY");
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

export default async (req: Request) => {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "lb";
  const user = url.searchParams.get("user");
  const period = url.searchParams.get("period") || "week";
  const mbid = url.searchParams.get("mbid");

  // Task 1: Extend proxy with cover source
  if (source === "cover") {
    if (!mbid) {
      return new Response(JSON.stringify({ error: "MBID required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const caaUrl =
        `https://coverartarchive.org/release-group/${mbid}/front-500`;
      const res = await fetch(caaUrl, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Upstream error: ${res.status}` }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const contentLength = res.headers.get("Content-Length");
      if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Image too large" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(res.body, {
        headers: {
          "Content-Type": res.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, s-maxage=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Task 2: Google Fonts proxy
  if (source === "font") {
    const family = url.searchParams.get("family");
    const weight = url.searchParams.get("weight") || "400";

    if (!family) {
      return new Response(JSON.stringify({ error: "Font family required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      // Use IE6 user agent to get TTF instead of WOFF2
      const ua = "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)";
      const encoded = family.replace(/\s+/g, "+");
      const apiUrl =
        `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weight}&display=swap`;

      const cssRes = await fetch(apiUrl, {
        headers: { "User-Agent": ua },
        signal: AbortSignal.timeout(10000),
      });

      if (!cssRes.ok) {
        return new Response(
          JSON.stringify({ error: `Google Fonts API error: ${cssRes.status}` }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const css = await cssRes.text();

      // Extract font URLs from CSS
      const urlRegex = /url\(([^)]+)\)/g;
      const urls: string[] = [];
      let match;

      while ((match = urlRegex.exec(css)) !== null) {
        urls.push(match[1]);
      }

      if (urls.length === 0) {
        return new Response(
          JSON.stringify({ error: "No font URLs found in CSS" }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      // Get the last URL (base Latin subset)
      const fontUrl = urls[urls.length - 1];

      const fontRes = await fetch(fontUrl, {
        headers: { "User-Agent": ua },
        signal: AbortSignal.timeout(15000),
      });

      if (!fontRes.ok) {
        return new Response(
          JSON.stringify({ error: `Font download error: ${fontRes.status}` }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const fontBuffer = await fontRes.arrayBuffer();

      // Validate it's a valid font file (check magic bytes)
      const view = new DataView(fontBuffer);
      const magic = view.getUint32(0, false); // Big-endian

      // Valid font magic bytes: 0x00010000 (TrueType), 0x74727565 (true), 0x4F54544F (OTTO)
      const isValidFont = magic === 0x00010000 || magic === 0x74727565 ||
        magic === 0x4f54544f;

      if (!isValidFont) {
        return new Response(
          JSON.stringify({ error: "Invalid font file format" }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(fontBuffer, {
        headers: {
          "Content-Type": "font/ttf",
          "Cache-Control": "public, s-maxage=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!user) {
    return new Response(JSON.stringify({ error: "Username required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let albums = [];

    if (source === "lb") {
      // Increased count to 100 to allow for merging on the client side and skipping missing covers
      const lbUrl =
        `https://api.listenbrainz.org/1/stats/user/${user}/release-groups?range=${period}&count=100`;
      const res = await fetch(lbUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) throw new Error(`ListenBrainz API error: ${res.status}`);

      const data = await res.json();
      albums = (data.payload.release_groups || [])
        .filter((a: any) => a.release_group_name) // Removed strict mbid requirement here to get more potential results
        .map((a: any) => ({
          name: a.release_group_name,
          artist: a.artist_name,
          count: a.listen_count,
          mbid: a.release_group_mbid,
        }));
    } else {
      if (!LASTFM_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Last.fm API Key not configured" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const lfmPeriods: Record<string, string> = {
        week: "7day",
        month: "1month",
        quarter: "3month",
        half_year: "6month",
        year: "12month",
        all_time: "overall",
      };

      // Increased limit to 100 to allow for merging and skipping missing covers
      const lfmUrl =
        `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${user}&api_key=${LASTFM_API_KEY}&period=${
          lfmPeriods[period] || "7day"
        }&limit=100&format=json`;
      const res = await fetch(lfmUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.message);

      albums = (data.topalbums?.album || [])
        .filter((a: any) => a.mbid || (a.image && a.image.length > 0))
        .map((a: any) => {
          const img = a.image?.[a.image.length - 1]?.["#text"];
          return {
            name: a.name,
            artist: a.artist.name,
            count: a.playcount,
            mbid: a.mbid,
            img: img && img.length > 0 ? img : undefined,
          };
        });
    }

    return new Response(JSON.stringify({ albums }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600",
        "Access-Control-Allow-Origin": "*", // Allow local dev to hit the proxy easily
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
