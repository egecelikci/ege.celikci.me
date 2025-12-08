// deno-lint-ignore-file no-explicit-any
import { ListenBrainzClient } from "https://esm.sh/jsr/@kellnerd/listenbrainz@0.9.2";

const LISTENBRAINZ_USERNAME = Deno.env.get("LISTENBRAINZ_USERNAME",);
const LISTENBRAINZ_TOKEN = Deno.env.get("LISTENBRAINZ_TOKEN",);
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
    const client = new ListenBrainzClient({
      userToken: LISTENBRAINZ_TOKEN || "00000000-0000-4000-8000-000000000000",
    },);

    let listen: any = null;

    try {
      const playingData = await client.getPlayingNow(LISTENBRAINZ_USERNAME,);
      if (
        playingData.count > 0
        && playingData.playing_now
        && playingData.listens.length > 0
      ) {
        listen = playingData.listens[0];
      }
    } catch {
      // Ignore errors here to fall back to recent listens
    }

    if (!listen) {
      try {
        const recentData = await client.getListens(LISTENBRAINZ_USERNAME, {
          count: 1,
        },);
        if (
          recentData.count > 0 && recentData.listens.length > 0
        ) {
          listen = recentData.listens[0];
        }
      } catch {
        // Ignore errors, will return null below
      }
    }

    if (!listen) return null;

    const track = listen.track_metadata;
    const trackName = track.track_name || "Unknown Track";
    const additionalInfo = track.additional_info || {};
    const recordingMbid = additionalInfo.recording_mbid || track.recording_msid;
    const artistNames = additionalInfo.artist_names || [track.artist_name,];
    const artistMbids = additionalInfo.artist_mbids || [];

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
  const tasks = [
    withTimeout(getMusicStatus(), 4500,).catch(() => null),
    withTimeout(getGameStatus(), 4500,).catch(() => null),
    withTimeout(getMangaStatus(), 4500,).catch(() => null),
  ];

  const pending = new Map<
    number,
    Promise<{ index: number; res: string | null; }>
  >();
  tasks.forEach((task, index,) => {
    const wrapped = task.then((res,) => ({ index, res, }));
    pending.set(index, wrapped,);
  },);

  while (pending.size > 0) {
    const { index, res, } = await Promise.race(pending.values(),);

    pending.delete(index,);

    if (res) yield res;
  }
}

export default (_req: Request, _context: any,) => {
  const cacheHeader = "public, s-maxage=15, stale-while-revalidate=60";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller,) {
      try {
        for await (const chunk of generateStatuses()) {
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
