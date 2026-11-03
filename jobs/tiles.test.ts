import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayStamp,
  extractName,
  newestBuild,
  pointMapAt,
  staleExtracts,
} from "./tiles.ts";

test("dayStamp formats in UTC", () => {
  assert.deepEqual(dayStamp(new Date("2026-10-07T23:30:00Z")), "20261007");
  assert.deepEqual(dayStamp(new Date("2026-10-08T00:00:00+03:00")), "20261007");
});

test("extractName uses the build date, not today", () => {
  assert.deepEqual(
    extractName("https://build.protomaps.com/20261005.pmtiles"),
    "izmir-20261005.pmtiles",
  );
  assert.throws(() => extractName("https://example.com/latest.pmtiles"));
});

test("pointMapAt rewrites the TILES constant once and is idempotent", () => {
  const source =
    'const A = 1;\nconst TILES = "/assets/tiles/izmir-20261006.pmtiles";\n';
  const url = "/assets/tiles/izmir-20261007.pmtiles";
  const updated = pointMapAt(source, url);
  assert.deepEqual(updated, `const A = 1;\nconst TILES = "${url}";\n`);
  assert.deepEqual(pointMapAt(updated!, url), updated);
});

test("pointMapAt returns null when the constant is missing", () => {
  assert.deepEqual(pointMapAt("const A = 1;", "/x"), null);
  assert.deepEqual(
    pointMapAt('const TILES =\n  "/assets/tiles/izmir-20261006.pmtiles"', "/x"),
    null,
  );
});

test("staleExtracts lists older and partial extracts only", () => {
  assert.deepEqual(
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

test("newestBuild walks back to the first build that answers", async () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const { asked, fetcher } = stubFetch({
    "https://build.protomaps.com/20261006.pmtiles": "error",
    "https://build.protomaps.com/20261005.pmtiles": 206,
  });
  assert.deepEqual(
    await newestBuild(fetcher, now),
    "https://build.protomaps.com/20261005.pmtiles",
  );
  assert.deepEqual(asked.length, 3);
});

test("newestBuild gives up after six days", async () => {
  const { asked, fetcher } = stubFetch({});
  await assert.rejects(() =>
    newestBuild(fetcher, new Date("2026-10-07T12:00:00Z")),
  );
  assert.deepEqual(asked.length, 6);
});
