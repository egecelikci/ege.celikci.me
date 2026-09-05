/**
 * utils/steam.test.ts
 * Unit tests for the pure Steam library helpers.
 */

import { assertEquals } from "@std/assert";
import { consolidateSteamLibraries } from "./steam.ts";
import type { SteamOwnedGame, SteamPlayerSummary } from "../src/types/index.ts";

const summaries: SteamPlayerSummary[] = [
  {
    steamid: "1",
    personaname: "Ege",
    profileurl: "https://steamcommunity.com/id/ege/",
    avatar: "a",
    avatarmedium: "am",
    avatarfull: "af",
  },
  {
    steamid: "2",
    personaname: "Sibling",
    profileurl: "https://steamcommunity.com/id/sib/",
    avatar: "a",
    avatarmedium: "am",
    avatarfull: "af",
  },
];

function game(appid: number, name: string): SteamOwnedGame {
  return { appid, name, playtime_forever: 600, playtime_2weeks: 60 };
}

Deno.test("consolidateSteamLibraries dedupes by appid", () => {
  const libraries = new Map([
    ["1", [game(730, "CS2"), game(440, "TF2")]],
    ["2", [game(440, "TF2")]],
  ]);

  const { players, games } = consolidateSteamLibraries(summaries, libraries);

  assertEquals(games, [
    { appid: 730, name: "CS2" },
    { appid: 440, name: "TF2" },
  ]);
  assertEquals(players, [
    {
      steamid: "1",
      name: "Ege",
      profileUrl: "https://steamcommunity.com/id/ege/",
      avatar: "am",
      gameCount: 2,
    },
    {
      steamid: "2",
      name: "Sibling",
      profileUrl: "https://steamcommunity.com/id/sib/",
      avatar: "am",
      gameCount: 1,
    },
  ]);
});

Deno.test("consolidateSteamLibraries sorts alphabetically", () => {
  const libraries = new Map([
    ["1", [game(1, "Zoo Tycoon"), game(2, "Age of Empires")]],
  ]);

  const { games } = consolidateSteamLibraries(
    [summaries[0]],
    libraries,
  );

  assertEquals(games.map((g) => g.name), ["Age of Empires", "Zoo Tycoon"]);
});

Deno.test("consolidateSteamLibraries handles empty libraries", () => {
  const { players, games } = consolidateSteamLibraries(summaries, new Map());
  assertEquals(games, []);
  assertEquals(players[0].gameCount, 0);
});
