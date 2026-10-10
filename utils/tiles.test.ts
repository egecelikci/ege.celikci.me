import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  dayStamp,
  extractName,
  newestBuild,
  pointMapAt,
  staleExtracts,
} from "./tiles.ts";

Deno.test("dayStamp formats in UTC", () => {
  assertEquals(dayStamp(new Date("2026-10-07T23:30:00Z")), "20261007");
  assertEquals(dayStamp(new Date("2026-10-08T00:00:00+03:00")), "20261007");
});

Deno.test("extractName uses the build date, not today", () => {
  assertEquals(
    extractName("https://build.protomaps.com/20261005.pmtiles"),
    "izmir-20261005.pmtiles",
  );
  assertThrows(() => extractName("https://example.com/latest.pmtiles"));
});

Deno.test("pointMapAt rewrites the TILES constant once and is idempotent", () => {
  const source =
    'const A = 1;\nconst TILES = "/assets/tiles/izmir-20261006.pmtiles";\n';
  const url = "/assets/tiles/izmir-20261007.pmtiles";
  const updated = pointMapAt(source, url);
  assertEquals(updated, `const A = 1;\nconst TILES = "${url}";\n`);
  assertEquals(pointMapAt(updated!, url), updated);
});

Deno.test("pointMapAt returns null when the constant is missing", () => {
  assertEquals(pointMapAt("const A = 1;", "/x"), null);
  assertEquals(
    pointMapAt('const TILES =\n  "/assets/tiles/izmir-20261006.pmtiles"', "/x"),
    null,
  );
});

Deno.test("staleExtracts lists older and partial extracts only", () => {
  assertEquals(
    staleExtracts(
      [
        "izmir-20261006.pmtiles",
        "izmir-20261007.pmtiles",
        "izmir-20261007.pmtiles.part",
        ".gitkeep",
        "other.pmtiles",
      ],
      "izmir-20261007.pmtiles",
    ),
    ["izmir-20261006.pmtiles", "izmir-20261007.pmtiles.part"],
  );
});

/** A fetch stub that answers by URL and records what was asked. */
function stubFetch(answers: Record<string, number | "error">) {
  const asked: string[] = [];
  const fetcher = ((input: string | URL | Request) => {
    const url = String(input);
    asked.push(url);
    const answer = answers[url] ?? 404;
    if (answer === "error") return Promise.reject(new TypeError("network"));
    return Promise.resolve(new Response("x", { status: answer }));
  }) as typeof fetch;
  return { asked, fetcher };
}

Deno.test("newestBuild walks back to the first build that answers", async () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const { asked, fetcher } = stubFetch({
    "https://build.protomaps.com/20261006.pmtiles": "error",
    "https://build.protomaps.com/20261005.pmtiles": 206,
  });
  assertEquals(
    await newestBuild(fetcher, now),
    "https://build.protomaps.com/20261005.pmtiles",
  );
  assertEquals(asked.length, 3);
});

Deno.test("newestBuild gives up after six days", async () => {
  const { asked, fetcher } = stubFetch({});
  await assertRejects(() =>
    newestBuild(fetcher, new Date("2026-10-07T12:00:00Z"))
  );
  assertEquals(asked.length, 6);
});
