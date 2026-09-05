/**
 * utils/steam.ts
 * Pure helpers for the Steam family library.
 * Kept side-effect free so `utils/steam.test.ts` can cover them.
 */

import type {
  SteamGameEntry,
  SteamOwnedGame,
  SteamPlayerEntry,
  SteamPlayerSummary,
} from "../src/types/index.ts";

export interface ConsolidatedLibrary {
  players: SteamPlayerEntry[];
  games: SteamGameEntry[];
}

/**
 * Merge per-user owned-games lists into one deduplicated family library.
 * Dedupe key is appid; names come from Steam's own appinfo.
 * Sorted alphabetically since no playtime is tracked.
 */
export function consolidateSteamLibraries(
  summaries: SteamPlayerSummary[],
  libraries: Map<string, SteamOwnedGame[]>,
): ConsolidatedLibrary {
  const games = new Map<number, SteamGameEntry>();

  for (const owned of libraries.values()) {
    for (const game of owned) {
      if (!games.has(game.appid)) {
        games.set(game.appid, { appid: game.appid, name: game.name });
      }
    }
  }

  const sortedGames = [...games.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const players: SteamPlayerEntry[] = summaries.map((s) => {
    const owned = libraries.get(s.steamid) ?? [];
    return {
      steamid: s.steamid,
      name: s.personaname,
      profileUrl: s.profileurl,
      avatar: s.avatarmedium || s.avatar,
      gameCount: owned.length,
    };
  });

  return { players, games: sortedGames };
}
