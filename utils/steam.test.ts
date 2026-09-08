/**
 * utils/steam.test.ts
 * Unit tests for the pure Steam library helpers.
 */

import { assertEquals } from "@std/assert";
import { consolidateSteamLibraries } from "./steam.ts";
import type { SteamOwnedGame } from "../src/types/index.ts";

function game(appid: number, name: string): SteamOwnedGame {
  return { appid, name, playtime_forever: 600, playtime_2weeks: 60 };
}

Deno.test("consolidateSteamLibraries dedupes by appid", () => {
  const libraries = new Map([
    ["1", [game(730, "CS2"), game(440, "TF2")]],
    ["2", [game(440, "TF2")]],
  ]);

  assertEquals(consolidateSteamLibraries(libraries), [
    { appid: 730, name: "CS2" },
    { appid: 440, name: "TF2" },
  ]);
});

Deno.test("consolidateSteamLibraries sorts alphabetically", () => {
  const libraries = new Map([
    ["1", [game(1, "Zoo Tycoon"), game(2, "Age of Empires")]],
  ]);

  assertEquals(
    consolidateSteamLibraries(libraries).map((g) => g.name),
    ["Age of Empires", "Zoo Tycoon"],
  );
});

Deno.test("consolidateSteamLibraries handles empty libraries", () => {
  assertEquals(consolidateSteamLibraries(new Map()), []);
});
