/**
 * utils/fetch-steam.ts
 *
 * Fetches Steam family libraries via the Steam Web API and consolidates
 * them into src/_data/games.json for Lume to pick up.
 *
 * Run manually: `deno run -A utils/fetch-steam.ts`
 *
 * Requires STEAM_API_KEY (https://steamcommunity.com/dev/apikey) in .env
 * or the environment (Netlify: site settings → environment variables).
 * The key stays build-time only and is never shipped to the client.
 * Every profile must have a public games list, otherwise Steam returns
 * an empty library for that user instead of an error.
 */

import "@std/dotenv/load";
import { join } from "@std/path";
import type {
  GamesStore,
  SteamOwnedGame,
  SteamPlayerSummary,
} from "../src/types/index.ts";
import { loadState, saveState, sortObjectKeys } from "./cache.ts";
import {
  GamesStoreSchema,
  SteamOwnedGamesResponseSchema,
  SteamPlayerSummariesResponseSchema,
  validateOrThrow,
} from "./schemas.ts";
import { consolidateSteamLibraries } from "./steam.ts";
import { HttpClient } from "./fetch-base.ts";

const CONFIG = {
  rateLimitDelayMs: 1000,

  paths: {
    cacheFile: join(Deno.cwd(), "src", "_data", "games.json"),
  },

  api: {
    base: "https://api.steampowered.com",
  },

  credentials: {
    apiKey: Deno.env.get("STEAM_API_KEY") ?? "",
  },

  steamIds: (Deno.env.get("STEAM_USER_IDS") ??
    "76561198847289673,76561199224416508,76561198418118004")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0),
} as const;

class SteamFetcher {
  constructor(private httpClient: HttpClient, private apiKey: string) {}

  private url(path: string, params: Record<string, string>): string {
    const url = new URL(`${CONFIG.api.base}${path}`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("format", "json");
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    return url.toString();
  }

  async getPlayerSummaries(): Promise<SteamPlayerSummary[]> {
    const data = await this.httpClient.fetch<unknown>(
      this.url("/ISteamUser/GetPlayerSummaries/v0002/", {
        steamids: CONFIG.steamIds.join(","),
      }),
      "json",
      "no-cache",
    );
    return validateOrThrow(SteamPlayerSummariesResponseSchema, data).players;
  }

  async getOwnedGames(steamid: string): Promise<SteamOwnedGame[]> {
    const data = await this.httpClient.fetch<unknown>(
      this.url("/IPlayerService/GetOwnedGames/v0001/", {
        steamid,
        include_appinfo: "1",
        include_played_free_games: "1",
      }),
      "json",
      "no-cache",
    );
    const response = validateOrThrow(SteamOwnedGamesResponseSchema, data);
    return response.games ?? [];
  }
}

async function getSteamData() {
  const httpClient = new HttpClient({
    userAgent: "ege.celikci.me/1.0",
    rateLimitMs: CONFIG.rateLimitDelayMs,
    cacheName: "steam-api-cache",
  });

  const cachedData = await loadState<GamesStore>(
    CONFIG.paths.cacheFile,
    {
      schemaVersion: 2,
      fetchedAt: new Date(0).toISOString(),
      players: [],
      games: [],
    },
    GamesStoreSchema,
  );

  if (!CONFIG.credentials.apiKey) {
    // Seed the initial store so the file exists in git and the page builds.
    // An existing (even stale) cache is always preserved instead.
    if (cachedData.players.length === 0 && cachedData.games.length === 0) {
      try {
        await Deno.stat(CONFIG.paths.cacheFile);
        console.warn(
          "[steam] ⚠️ STEAM_API_KEY is not set, keeping existing cache",
        );
        return { players: cachedData.players, games: cachedData.games };
      } catch {
        await saveState(CONFIG.paths.cacheFile, {
          schemaVersion: 2,
          fetchedAt: new Date().toISOString(),
          players: [],
          games: [],
        }, GamesStoreSchema);
        console.log("[steam] ℹ️ Wrote initial empty store");
        return { players: [], games: [] };
      }
    }
    console.warn(
      "[steam] ⚠️ STEAM_API_KEY is not set, keeping existing cache",
    );
    return { players: cachedData.players, games: cachedData.games };
  }

  const fetcher = new SteamFetcher(httpClient, CONFIG.credentials.apiKey);

  console.log("[steam] ℹ️ Syncing family libraries…");

  try {
    const summaries = await fetcher.getPlayerSummaries();
    if (summaries.length === 0 && cachedData.games.length > 0) {
      console.warn(
        "[steam] ⚠️ Empty player response, keeping existing cache",
      );
      return { players: cachedData.players, games: cachedData.games };
    }

    const libraries = new Map<string, SteamOwnedGame[]>();
    for (const summary of summaries) {
      const owned = await fetcher.getOwnedGames(summary.steamid);
      libraries.set(summary.steamid, owned);
      if (owned.length === 0) {
        console.warn(
          `[steam] ⚠️ No games returned for ${summary.personaname} — profile may be private`,
        );
      }
    }

    const { players, games } = consolidateSteamLibraries(summaries, libraries);
    console.log(
      `[steam] 🔍 Consolidated ${games.length} games across ${players.length} players…`,
    );

    const store: GamesStore = {
      schemaVersion: 2,
      fetchedAt: new Date().toISOString(),
      players,
      games,
    };

    const hasChanged = JSON.stringify(sortObjectKeys(store)) !==
      JSON.stringify(sortObjectKeys(cachedData));

    if (hasChanged) {
      await saveState(CONFIG.paths.cacheFile, store, GamesStoreSchema);
      console.log(`[steam] ✅ Synced ${games.length} games.`);
    } else {
      console.log("[steam] ℹ️ No changes detected, skipping save.");
    }
    return { players, games };
  } catch (err) {
    console.error("[steam] ❌ Sync failed, keeping existing cache:", err);
    return { players: cachedData.players, games: cachedData.games };
  }
}

await getSteamData();
