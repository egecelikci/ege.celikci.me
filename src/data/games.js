import Fetch from "@11ty/eleventy-fetch";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STEAM_API_KEY = process.env.STEAM_API_KEY;

const STEAM_IDS = process.env.STEAM_IDS
  ? process.env.STEAM_IDS.split(",").map((id) => id.trim())
  : [];

let games = [];

if (!STEAM_API_KEY) {
  console.warn("STEAM_API_KEY not set, skipping games data fetch");
} else {
  // Collect all games from all users
  const allGamesMap = new Map();

  for (const steamId of STEAM_IDS) {
    const gamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;

    try {
      const data = await Fetch(gamesUrl, {
        duration: "1d",
        type: "json",
        fetchOptions: {
          headers: {
            "User-Agent": "eleventy-fetch (https://ege.celikci.me)",
          },
        },
      });

      if (data?.response?.games) {
        for (const game of data.response.games) {
          if (!allGamesMap.has(game.appid)) {
            allGamesMap.set(game.appid, game);
          }
        }
      }

      await sleep(1000);
    } catch (err) {
      console.error(`Error fetching games for Steam ID ${steamId}:`, err);
    }
  }

  games = Array.from(allGamesMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export default { games };
