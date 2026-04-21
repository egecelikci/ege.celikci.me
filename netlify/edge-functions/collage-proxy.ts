/**
 * Collage Proxy Edge Function
 * Securely fetches album stats from ListenBrainz or Last.fm.
 */

const LASTFM_API_KEY = Deno.env.get("LASTFM_API_KEY",);
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

export default async (req: Request,) => {
  const url = new URL(req.url,);
  const source = url.searchParams.get("source",) || "lb";
  const user = url.searchParams.get("user",);
  const period = url.searchParams.get("period",) || "week";
  const mbid = url.searchParams.get("mbid",);

  // Task 1: Extend proxy with cover source
  if (source === "cover") {
    if (!mbid) {
      return new Response(JSON.stringify({ error: "MBID required", },), {
        status: 400,
        headers: { "Content-Type": "application/json", },
      },);
    }

    try {
      const caaUrl =
        `https://coverartarchive.org/release-group/${mbid}/front-500`;
      const res = await fetch(caaUrl, {
        headers: { "User-Agent": USER_AGENT, },
      },);

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Upstream error: ${res.status}`, },),
          {
            status: 502,
            headers: { "Content-Type": "application/json", },
          },
        );
      }

      return new Response(res.body, {
        headers: {
          "Content-Type": res.headers.get("Content-Type",) || "image/jpeg",
          "Cache-Control": "public, s-maxage=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      },);
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message, },), {
        status: 500,
        headers: { "Content-Type": "application/json", },
      },);
    }
  }

  if (!user) {
    return new Response(JSON.stringify({ error: "Username required", },), {
      status: 400,
      headers: { "Content-Type": "application/json", },
    },);
  }

  try {
    let albums = [];

    if (source === "lb") {
      // Increased count to 50 to allow for merging on the client side
      const lbUrl =
        `https://api.listenbrainz.org/1/stats/user/${user}/release-groups?range=${period}&count=50`;
      const res = await fetch(lbUrl, {
        headers: { "User-Agent": USER_AGENT, },
      },);
      if (!res.ok) throw new Error(`ListenBrainz API error: ${res.status}`,);

      const data = await res.json();
      albums = (data.payload.release_groups || [])
        .filter((a: any,) => a.release_group_mbid && a.release_group_name)
        .map((a: any,) => ({
          name: a.release_group_name,
          artist: a.artist_name,
          count: a.listen_count,
          mbid: a.release_group_mbid,
        }));
    } else {
      if (!LASTFM_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Last.fm API Key not configured", },),
          {
            status: 500,
            headers: { "Content-Type": "application/json", },
          },
        );
      }

      const lfmPeriods: Record<string, string> = {
        week: "7day",
        month: "1month",
        quarter: "3month",
        year: "12month",
        all_time: "overall",
      };

      // Increased limit to 50 to allow for merging on the client side
      const lfmUrl =
        `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${user}&api_key=${LASTFM_API_KEY}&period=${
          lfmPeriods[period] || "7day"
        }&limit=50&format=json`;
      const res = await fetch(lfmUrl, {
        headers: { "User-Agent": USER_AGENT, },
      },);
      if (!res.ok) throw new Error(`Last.fm API error: ${res.status}`,);

      const data = await res.json();
      if (data.error) throw new Error(data.message,);

      albums = (data.topalbums?.album || [])
        .filter((a: any,) => a.mbid || (a.image && a.image.length > 0))
        .map((a: any,) => ({
          name: a.name,
          artist: a.artist.name,
          count: a.playcount,
          mbid: a.mbid,
          img: a.image?.[a.image.length - 1]?.["#text"] || "",
        }));
    }

    return new Response(JSON.stringify({ albums, },), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600",
        "Access-Control-Allow-Origin": "*", // Allow local dev to hit the proxy easily
      },
    },);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, },), {
      status: 500,
      headers: { "Content-Type": "application/json", },
    },);
  }
};
