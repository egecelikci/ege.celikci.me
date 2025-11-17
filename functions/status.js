export default async (req, context) => {
  const LISTENBRAINZ_USERNAME = process.env.LISTENBRAINZ_USERNAME;
  const STEAM_API_KEY = process.env.STEAM_API_KEY;
  const STEAM_ID = process.env.STEAM_ID;

  const statuses = [];

  // ============================================
  // MUSIC STATUS (ListenBrainz)
  // ============================================
  if (LISTENBRAINZ_USERNAME) {
    try {
      const playingUrl = `https://api.listenbrainz.org/1/user/${LISTENBRAINZ_USERNAME}/playing-now`;
      const recentUrl = `https://api.listenbrainz.org/1/user/${LISTENBRAINZ_USERNAME}/listens?count=1`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const playingRes = await fetch(playingUrl, { signal: controller.signal });
      const playingData = await playingRes.json();
      clearTimeout(timeoutId);

      let listen = null;

      if (
        playingData?.payload?.playing_now &&
        playingData.payload.listens.length > 0
      ) {
        listen = playingData.payload.listens[0];
      } else {
        const recentRes = await fetch(recentUrl);
        const recentData = await recentRes.json();
        listen = recentData?.payload?.listens?.[0];
      }

      if (listen) {
        const track = listen.track_metadata.track_name;
        const recordingMbid =
          listen.track_metadata.additional_info.recording_mbid ||
          listen.track_metadata.recording_msid;
        const artistNames =
          listen.track_metadata.additional_info.artist_names || [];
        const artistMbids =
          listen.track_metadata.additional_info.artist_mbids || [];

        const trackLink = recordingMbid
          ? `<a href="https://listenbrainz.org/track/${recordingMbid}" target="_blank" rel="noopener noreferrer"><cite>${track}</cite></a>`
          : `<cite>${track}</cite>`;

        const artistLinks = artistNames
          .map((name, i) => {
            const mbid = artistMbids[i];
            return mbid
              ? `<a href="https://listenbrainz.org/artist/${mbid}" target="_blank" rel="noopener noreferrer">${name}</a>`
              : name;
          })
          .join(", ");

        const plainText = `${track}, ${artistNames.join(", ")}`;

        statuses.push({
          type: "music",
          html: `<span data-chars="X" data-status="${plainText}">${trackLink}, ${artistLinks}</span>`,
        });
      } else {
        statuses.push({
          type: "music",
          html: `<span data-chars="X" data-status="No recent listens">No recent listens</span>`,
        });
      }
    } catch (err) {
      console.error("Error fetching music:", err);
      statuses.push({
        type: "music",
        html: `<span data-chars="X" data-status="Error loading music">Error loading music</span>`,
      });
    }
  }

  // ============================================
  // STEAM STATUS
  // ============================================
  if (STEAM_API_KEY && STEAM_ID) {
    try {
      const steamUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${STEAM_ID}`;
      const recentGamesUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_API_KEY}&steamid=${STEAM_ID}&count=1`;

      const [summaryRes, recentRes] = await Promise.all([
        fetch(steamUrl),
        fetch(recentGamesUrl),
      ]);

      const summaryData = await summaryRes.json();
      const recentData = await recentRes.json();

      const player = summaryData?.response?.players?.[0];
      const recentGame = recentData?.response?.games?.[0];

      if (player?.gameextrainfo) {
        // Currently playing
        const gameLink = player.gameid
          ? `<a href="https://store.steampowered.com/app/${player.gameid}" target="_blank" rel="noopener noreferrer"><cite>${player.gameextrainfo}</cite></a>`
          : `<cite>${player.gameextrainfo}</cite>`;

        statuses.push({
          type: "steam",
          html: `<span data-chars="X" data-status="${player.gameextrainfo}">${gameLink}</span>`,
        });
      } else if (recentGame) {
        // Recently played
        const gameLink = `<a href="https://store.steampowered.com/app/${recentGame.appid}" target="_blank" rel="noopener noreferrer"><cite>${recentGame.name}</cite></a>`;

        statuses.push({
          type: "steam",
          html: `<span data-chars="X" data-status="${recentGame.name}">${gameLink}</span>`,
        });
      } else {
        statuses.push({
          type: "steam",
          html: `<span data-chars="X" data-status="No recent game">No recent game</span>`,
        });
      }
    } catch (err) {
      console.error("Error fetching Steam:", err);
      statuses.push({
        type: "steam",
        html: `<span data-chars="X" data-status="Error loading Steam">Error loading Steam</span>`,
      });
    }
  }

  const html = statuses.map((s) => s.html).join("\n");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
};
