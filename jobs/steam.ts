import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";

// Local runs read secrets from `.env`; Netlify sets them in the environment, which wins.
if (existsSync(".env")) process.loadEnvFile();
import type { GamesStore, SteamOwnedGame } from "../src/types/index.ts";
import { loadState, saveState, sortObjectKeys } from "../lib/cache.ts";
import {
  GamesStoreSchema,
  SteamOwnedGamesResponseSchema,
  validateOrThrow,
} from "../lib/schemas.ts";
import { consolidateSteamLibraries } from "../lib/steam.ts";
import { HttpClient } from "../lib/fetch-base.ts";

const CONFIG = {
  rateLimitDelayMs: 1000,

  paths: {
    cacheFile: join(process.cwd(), "src", "_data", "games.json"),
  },

  api: {
    base: "https://api.steampowered.com",
  },

  credentials: {
    apiKey: process.env.STEAM_API_KEY ?? "",
  },

  steamIds: (process.env.STEAM_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0),
} as const;

const EMPTY_STORE: GamesStore = {
  schemaVersion: 4,
  games: [],
};

class SteamFetcher {
  private httpClient: HttpClient;
  private apiKey: string;

  constructor(httpClient: HttpClient, apiKey: string) {
    this.httpClient = httpClient;
    this.apiKey = apiKey;
  }

  private url(path: string, params: Record<string, string>): string {
    const url = new URL(`${CONFIG.api.base}${path}`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("format", "json");
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    return url.toString();
  }

  async getOwnedGames(steamid: string): Promise<SteamOwnedGame[]> {
    const data = await this.httpClient.fetch<unknown>(
      this.url("/IPlayerService/GetOwnedGames/v0001/", {
        steamid,
        include_appinfo: "1",
        include_played_free_games: "1",
      }),
      "json",
    );
    const response = validateOrThrow(SteamOwnedGamesResponseSchema, data);
    return response.games ?? [];
  }
}

async function getSteamData() {
  const httpClient = new HttpClient({
    userAgent: "ege.celikci.me/1.0",
    rateLimitMs: CONFIG.rateLimitDelayMs,
  });

  const cachedData = await loadState<GamesStore>(
    CONFIG.paths.cacheFile,
    EMPTY_STORE,
    GamesStoreSchema,
  );

  if (!CONFIG.credentials.apiKey) {
    if (cachedData.games.length === 0) {
      try {
        await stat(CONFIG.paths.cacheFile);
        console.warn(
          "[steam] ⚠️ STEAM_API_KEY is not set, keeping existing cache",
        );
        return cachedData.games;
      } catch {
        await saveState(
          CONFIG.paths.cacheFile,
          { ...EMPTY_STORE },
          GamesStoreSchema,
        );
        console.log("[steam] ℹ️ Wrote initial empty store");
        return [];
      }
    }
    console.warn("[steam] ⚠️ STEAM_API_KEY is not set, keeping existing cache");
    return cachedData.games;
  }

  if (CONFIG.steamIds.length === 0) {
    console.warn(
      "[steam] ⚠️ STEAM_USER_IDS is not set, keeping existing cache",
    );
    return cachedData.games;
  }

  const fetcher = new SteamFetcher(httpClient, CONFIG.credentials.apiKey);

  console.log("[steam] ℹ️ Syncing family libraries…");

  try {
    const libraries = new Map<string, SteamOwnedGame[]>();
    for (const steamid of CONFIG.steamIds) {
      const owned = await fetcher.getOwnedGames(steamid);
      libraries.set(steamid, owned);
      if (owned.length === 0) {
        console.warn(
          `[steam] ⚠️ No games returned for ${steamid} — profile may be private`,
        );
      }
    }

    // An empty library is far more likely a private profile or an API hiccup than a sold-off collection, and consolidating it would drop that member's games.
    const empty = [...libraries.values()].some((owned) => owned.length === 0);
    if (empty && cachedData.games.length > 0) {
      console.warn("[steam] ⚠️ A library came back empty, keeping the cache");
      return cachedData.games;
    }

    const games = consolidateSteamLibraries(libraries);
    console.log(`[steam] 🔍 Consolidated ${games.length} games…`);

    const store: GamesStore = {
      schemaVersion: 4,
      games,
    };

    const hasChanged =
      JSON.stringify(sortObjectKeys(store)) !==
      JSON.stringify(sortObjectKeys(cachedData));

    if (hasChanged) {
      await saveState(CONFIG.paths.cacheFile, store, GamesStoreSchema);
      console.log(`[steam] ✅ Synced ${games.length} games.`);
    } else {
      console.log("[steam] ℹ️ No changes detected, skipping save.");
    }
    return games;
  } catch (err) {
    console.error("[steam] ❌ Sync failed, keeping existing cache:", err);
    return cachedData.games;
  }
}

await getSteamData();
