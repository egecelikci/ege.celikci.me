// deno-lint-ignore-file no-explicit-any

const LISTENBRAINZ_USERNAME = Deno.env.get("LISTENBRAINZ_USERNAME",);
const STEAM_API_KEY = Deno.env.get("STEAM_API_KEY",);
const STEAM_ID = Deno.env.get("STEAM_ID",);
const ANILIST_ID = Deno.env.get("ANILIST_ID",);
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

function createStatusHtml(id: string, plainText: string, richContent: string,) {
  const span =
    `<span data-chars="×" data-status="${plainText}">${richContent}</span>`;
  return `<div id="${id}">${span}</div>`;
}

const withTimeout = <T,>(promise: Promise<T>, ms = 4000,): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject,) =>
      setTimeout(() => reject(new Error("Timeout",),), ms,)
    ),
  ],);

async function getMusicStatus(): Promise<string | null> {
  if (!LISTENBRAINZ_USERNAME) return null;

  try {
    const playingUrl =
      `https://api.listenbrainz.org/1/user/${LISTENBRAINZ_USERNAME}/playing-now`;
    const recentUrl =
      `https://api.listenbrainz.org/1/user/${LISTENBRAINZ_USERNAME}/listens?count=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000,);

    const playingRes = await fetch(playingUrl, {
      headers: { "User-Agent": USER_AGENT, },
      signal: controller.signal,
    },).finally(() => clearTimeout(timeoutId,));

    let listen: any = null;
    if (playingRes.ok) {
      const playingData = await playingRes.json();
      if (
        playingData?.payload?.playing_now
        && playingData.payload.listens.length > 0
      ) {
        listen = playingData.payload.listens[0];
      }
    }

    if (!listen) {
      const recentRes = await fetch(recentUrl, {
        headers: { "User-Agent": USER_AGENT, },
      },).catch(() => null);
      if (recentRes?.ok) {
        const recentData = await recentRes.json();
        listen = recentData?.payload?.listens?.[0];
      }
    }

    if (!listen) return null;

    const track = listen.track_metadata;
    const trackName = track.track_name || "Unknown Track";
    const recordingMbid = track.additional_info?.recording_mbid
      || track.recording_msid;
    const artistNames = track.additional_info?.artist_names || [];
    const artistMbids = track.additional_info?.artist_mbids || [];

    const trackLink = recordingMbid
      ? `<a href="https://listenbrainz.org/track/${recordingMbid}" target="_blank" rel="noopener noreferrer"><cite>${trackName}</cite></a>`
      : `<cite>${trackName}</cite>`;

    const artistLinks = artistNames
      .map((name: string, i: number,) => {
        const mbid = artistMbids[i];
        return mbid
          ? `<a href="https://listenbrainz.org/artist/${mbid}" target="_blank" rel="noopener noreferrer">${name}</a>`
          : name;
      },)
      .join(" · ",);

    const plainText = `${trackName} by ${artistNames.join(" · ",)}`;
    return createStatusHtml(
      "music-status",
      plainText,
      `${trackLink} by ${artistLinks}`,
    );
  } catch (err) {
    console.error("Error fetching music:", err,);
    return null;
  }
}

async function getGameStatus(): Promise<string | null> {
  if (!STEAM_API_KEY || !STEAM_ID) return null;

  try {
    const steamUrl =
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${STEAM_ID}`;
    const recentGamesUrl =
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&count=1`;

    const [summaryRes, recentRes,] = await Promise.all([
      fetch(steamUrl, { headers: { "User-Agent": USER_AGENT, }, },),
      fetch(recentGamesUrl, { headers: { "User-Agent": USER_AGENT, }, },),
    ],);

    if (!summaryRes.ok || !recentRes.ok) {
      console.error("Steam API request failed",);
      return null;
    }

    const [summaryData, recentData,] = await Promise.all([
      summaryRes.json(),
      recentRes.json(),
    ],);

    const player = summaryData.response?.players?.[0];
    if (player?.gameextrainfo) {
      const gameName = player.gameextrainfo;
      const gameLink = player.gameid
        ? `<a href="https://store.steampowered.com/app/${player.gameid}" target="_blank" rel="noopener noreferrer"><cite>${gameName}</cite></a>`
        : `<cite>${gameName}</cite>`;
      return createStatusHtml("game-status", gameName, gameLink,);
    }

    const recentGame = recentData.response?.games?.[0];
    if (recentGame) {
      const gameName = recentGame.name;
      const gameLink =
        `<a href="https://store.steampowered.com/app/${recentGame.appid}" target="_blank" rel="noopener noreferrer"><cite>${gameName}</cite></a>`;
      return createStatusHtml("game-status", gameName, gameLink,);
    }

    return null;
  } catch (err) {
    console.error("Error fetching Steam:", err,);
    return null;
  }
}

async function getMangaStatus(): Promise<string | null> {
  if (!ANILIST_ID) return null;

  const query = `
    query ($userId: Int) {
      Page(page: 1, perPage: 1) {
        mediaList(userId: $userId, type: MANGA, sort: UPDATED_TIME_DESC, status_in: [CURRENT, REPEATING, COMPLETED]) {
          media {
            title {
              romaji
              english
            }
            siteUrl
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { userId: Number(ANILIST_ID,), },
      },),
    },);

    if (!response.ok) return null;

    const data = await response.json();
    const entry = data?.data?.Page?.mediaList?.[0];

    if (!entry) return null;

    const title = entry.media.title.english || entry.media.title.romaji;
    const url = entry.media.siteUrl;

    const plainText = title;
    const richLink =
      `<a href="${url}" target="_blank" rel="noopener noreferrer"><cite>${title}</cite></a>`;

    return createStatusHtml("manga-status", plainText, richLink,);
  } catch (err) {
    console.error("Error fetching AniList:", err,);
    return null;
  }
}

/**
 * Generator that yields HTML strings as promises resolve.
 * Uses a Race Pool to yield fastest results first.
 */
async function* generateStatuses(): AsyncGenerator<string | null> {
  // 1. Start all requests in parallel
  const tasks = [
    withTimeout(getMusicStatus(), 4500,).catch(() => null),
    withTimeout(getGameStatus(), 4500,).catch(() => null),
    withTimeout(getMangaStatus(), 4500,).catch(() => null),
  ];

  // 2. Wrap them so we can identify which one finished
  const pending = new Map<
    number,
    Promise<{ index: number; res: string | null; }>
  >();
  tasks.forEach((task, index,) => {
    // We transform the promise to return its own index + result
    const wrapped = task.then((res,) => ({ index, res, }));
    pending.set(index, wrapped,);
  },);

  // 3. Race until no promises are left
  while (pending.size > 0) {
    // Wait for the *next* fastest promise to finish
    const { index, res, } = await Promise.race(pending.values(),);

    // Remove the winner from the pool so we don't race it again
    pending.delete(index,);

    // Yield immediately
    if (res) yield res;
  }
}

export default (_req: Request, _context: any,) => {
  const cacheHeader = "public, s-maxage=15, stale-while-revalidate=60";
  const encoder = new TextEncoder();

  // Create a readable stream that pulls from the generator
  const stream = new ReadableStream({
    async start(controller,) {
      try {
        for await (const chunk of generateStatuses()) {
          // If we have a chunk, send it immediately followed by a newline
          if (chunk) {
            controller.enqueue(encoder.encode(chunk + "\n",),);
          }
        }
      } catch (e) {
        console.error("Streaming error", e,);
        controller.error(e,);
      } finally {
        controller.close();
      }
    },
  },);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheHeader,
      "Netlify-CDN-Cache-Control": cacheHeader,
    },
  },);
};
