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

  if (!user) {
    return new Response("Username required", { status: 400 });
  }

  try {
    let albums = [];

    if (source === "lb") {
      const lbUrl = `https://api.listenbrainz.org/1/stats/user/${user}/release-groups?range=${period}&count=9`;
      const res = await fetch(lbUrl, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error("ListenBrainz API error");
      
      const data = await res.json();
      albums = (data.payload.release_groups || []).slice(0, 9).map((a: any) => ({
        name: a.release_group_name,
        artist: a.artist_name,
        count: a.listen_count,
        mbid: a.release_group_mbid,
        // Fallback image logic handled on client for LB
      }));
    } else {
      if (!LASTFM_API_KEY) {
        return new Response("Last.fm API Key not configured on server", { status: 500 });
      }

      // Mapping periods
      const lfmPeriods: Record<string, string> = { 
        week: '7day', 
        month: '1month', 
        quarter: '3month', 
        year: '12month', 
        all_time: 'overall' 
      };
      
      const lfmUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${user}&api_key=${LASTFM_API_KEY}&period=${lfmPeriods[period] || '7day'}&limit=9&format=json`;
      const res = await fetch(lfmUrl, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error("Last.fm API error");

      const data = await res.json();
      if (data.error) throw new Error(data.message);

      albums = (data.topalbums.album || []).map((a: any) => ({
        name: a.name,
        artist: a.artist.name,
        count: a.playcount,
        mbid: a.mbid,
        img: a.image?.[a.image.length - 1]?.['#text'] || ""
      }));
    }

    return new Response(JSON.stringify({ albums }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600", // Cache for 1 hour at edge
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
