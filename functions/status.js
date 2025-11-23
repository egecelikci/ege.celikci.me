const LISTENBRAINZ_USERNAME = process.env.LISTENBRAINZ_USERNAME;
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_ID = process.env.STEAM_ID;
const ANILIST_ID = process.env.ANILIST_ID;
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

function createStatusHtml(id, plainText, richContent) {
  const span = `<span data-chars="█" data-status="${plainText}">${richContent}</span>`;
  return `<div id="${id}">${span}</div>`;
}

const withTimeout = (promise, ms = 4000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms),
    ),
  ]);

async function getMusicStatus() {
  if (!LISTENBRAINZ_USERNAME) return null;

  try {
    const playingUrl = `https://api.listenbrainz.org/1/user/${LISTENBRAINZ_USERNAME}/playing-now`;
    const recentUrl = `https://api.listenbrainz.org/1/user/${LISTENBRAINZ_USERNAME}/listens?count=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const playingRes = await fetch(playingUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    let listen = null;
    if (playingRes.ok) {
      const playingData = await playingRes.json();
      if (
        playingData?.payload?.playing_now &&
        playingData.payload.listens.length > 0
      ) {
        listen = playingData.payload.listens[0];
      }
    }

    if (!listen) {
      const recentRes = await fetch(recentUrl, {
        headers: { "User-Agent": USER_AGENT },
      }).catch(() => null);
      if (recentRes?.ok) {
        const recentData = await recentRes.json();
        listen = recentData?.payload?.listens?.[0];
      }
    }

    if (!listen) return null;

    const track = listen.track_metadata;
    const trackName = track.track_name || "Unknown Track";
    const recordingMbid =
      track.additional_info?.recording_mbid || track.recording_msid;
    const artistNames = track.additional_info?.artist_names || [];
    const artistMbids = track.additional_info?.artist_mbids || [];

    const trackLink = recordingMbid
      ? `<a href="https://listenbrainz.org/track/${recordingMbid}" target="_blank" rel="noopener noreferrer"><cite>${trackName}</cite></a>`
      : `<cite>${trackName}</cite>`;

    const artistLinks = artistNames
      .map((name, i) => {
        const mbid = artistMbids[i];
        return mbid
          ? `<a href="https://listenbrainz.org/artist/${mbid}" target="_blank" rel="noopener noreferrer">${name}</a>`
          : name;
      })
      .join(" · ");

    const plainText = `${trackName} by ${artistNames.join(" · ")}`;
    return createStatusHtml(
      "music-status",
      plainText,
      `${trackLink} by ${artistLinks}`,
    );
  } catch (err) {
    console.error("Error fetching music:", err);
    return null;
  }
}

async function getGameStatus() {
  if (!STEAM_API_KEY || !STEAM_ID) return null;

  try {
    const steamUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${STEAM_ID}`;
    const recentGamesUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&count=1`;

    const [summaryRes, recentRes] = await Promise.all([
      fetch(steamUrl, { headers: { "User-Agent": USER_AGENT } }),
      fetch(recentGamesUrl, { headers: { "User-Agent": USER_AGENT } }),
    ]);

    if (!summaryRes.ok || !recentRes.ok) {
      console.error("Steam API request failed");
      return null;
    }

    const [summaryData, recentData] = await Promise.all([
      summaryRes.json(),
      recentRes.json(),
    ]);

    const player = summaryData.response?.players?.[0];
    if (player?.gameextrainfo) {
      const gameName = player.gameextrainfo;
      const gameLink = player.gameid
        ? `<a href="https://store.steampowered.com/app/${player.gameid}" target="_blank" rel="noopener noreferrer"><cite>${gameName}</cite></a>`
        : `<cite>${gameName}</cite>`;
      return createStatusHtml("game-status", gameName, gameLink);
    }

    const recentGame = recentData.response?.games?.[0];
    if (recentGame) {
      const gameName = recentGame.name;
      const gameLink = `<a href="https://store.steampowered.com/app/${recentGame.appid}" target="_blank" rel="noopener noreferrer"><cite>${gameName}</cite></a>`;
      return createStatusHtml("game-status", gameName, gameLink);
    }

    return null;
  } catch (err) {
    console.error("Error fetching Steam:", err);
    return null;
  }
}

async function getMangaStatus() {
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
        variables: { userId: ANILIST_ID },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const entry = data?.data?.Page?.mediaList?.[0];

    if (!entry) return null;

    const title = entry.media.title.english || entry.media.title.romaji;
    const url = entry.media.siteUrl;

    const plainText = title;
    const richLink = `<a href="${url}" target="_blank" rel="noopener noreferrer"><cite>${title}</cite></a>`;

    return createStatusHtml("manga-status", plainText, richLink);
  } catch (err) {
    console.error("Error fetching AniList:", err);
    return null;
  }
}

export default async (req, context) => {
  const [musicResult, gameResult, mangaResult] = await Promise.allSettled([
    withTimeout(getMusicStatus(), 4500),
    withTimeout(getGameStatus(), 4500),
    withTimeout(getMangaStatus(), 4500),
  ]);

  const statuses = [];
  if (musicResult.status === "fulfilled" && musicResult.value)
    statuses.push(musicResult.value);
  if (gameResult.status === "fulfilled" && gameResult.value)
    statuses.push(gameResult.value);
  if (mangaResult.status === "fulfilled" && mangaResult.value)
    statuses.push(mangaResult.value);

  const cacheHeader = "public, s-maxage=15, stale-while-revalidate=60";

  if (statuses.length === 0) {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": cacheHeader,
        "Netlify-CDN-Cache-Control": cacheHeader,
      },
    });
  }

  const html = statuses.join("\n");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheHeader,
      "Netlify-CDN-Cache-Control": cacheHeader,
    },
  });
};
