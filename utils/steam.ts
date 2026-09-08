/**
 * utils/steam.ts
 * Pure helpers for the Steam family library.
 * Kept side-effect free so `utils/steam.test.ts` can cover them.
 */

import type { SteamGameEntry, SteamOwnedGame } from "../src/types/index.ts";

/**
 * Merge per-user owned-games lists into one deduplicated family library.
 * Dedupe key is appid; names come from Steam's own appinfo.
 * Sorted alphabetically since no playtime is tracked.
 */
export function consolidateSteamLibraries(
  libraries: Map<string, SteamOwnedGame[]>,
): SteamGameEntry[] {
  const games = new Map<number, SteamGameEntry>();

  for (const owned of libraries.values()) {
    for (const game of owned) {
      if (!games.has(game.appid)) {
        games.set(game.appid, { appid: game.appid, name: game.name });
      }
    }
  }

  return [...games.values()].sort((a, b) => a.name.localeCompare(b.name));
}
