import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import type { Webmention, WebmentionFeed } from "../src/types/index.ts";
import {
  type FetchPage,
  mergeMentions,
  parseMentions,
  syncWebmentions,
} from "./webmentions.ts";

function mention(id: number, received: string, extra = {}): Webmention {
  return {
    "wm-id": id,
    "wm-property": "like-of",
    "wm-source": `https://example.com/${id}`,
    "wm-target": "https://ege.celikci.me/notes/1/",
    "wm-received": received,
    author: { name: `Author ${id}` },
    ...extra,
  } as Webmention;
}

const empty: WebmentionFeed = {
  schemaVersion: 1,
  children: [],
  lastFetched: null,
};
const jf2 = (children: unknown[]) => ({ type: "feed", children });

/** A fake API that serves `pages` in order and records the query of every call. */
function fakeApi(pages: (unknown | null)[]) {
  const calls: Record<string, string>[] = [];
  const fetchPage: FetchPage = (params) => {
    calls.push(Object.fromEntries(params));
    const i = calls.length - 1;
    return Promise.resolve(i < pages.length ? pages[i] : jf2([]));
  };
  return { calls, fetchPage };
}

Deno.test("parseMentions drops unsupported and malformed entries instead of the whole batch", () => {
  const parsed = parseMentions(jf2([
    mention(1, "2026-01-01T00:00:00Z"),
    { ...mention(2, "2026-01-02T00:00:00Z"), "wm-property": "bookmark-of" },
    { "wm-id": "not a number" },
  ]));
  assertEquals(parsed?.mentions.map((m) => m["wm-id"]), [1]);
  assertEquals(parsed?.dropped, 2);
});

Deno.test("parseMentions drops author links that are not http(s)", () => {
  const parsed = parseMentions(jf2([
    mention(1, "2026-01-01T00:00:00Z", {
      author: {
        name: "x",
        url: "javascript:alert(1)",
        photo: "https://a.example/p.png",
      },
    }),
  ]));
  assertEquals(parsed?.mentions[0].author?.url, null);
  assertEquals(parsed?.mentions[0].author?.photo, "https://a.example/p.png");
});

Deno.test("parseMentions rejects bodies that are not a jf2 feed", () => {
  assertEquals(parseMentions(null), null);
  assertEquals(parseMentions("<html>"), null);
  assertEquals(parseMentions({ error: "forbidden" }), null);
});

Deno.test("mergeMentions adds, updates, sorts newest first, and leaves its inputs alone", () => {
  const existing = [mention(1, "2026-01-01T00:00:00Z")];
  const snapshot = structuredClone(existing);
  const edited = mention(1, "2026-01-01T00:00:00Z", {
    "wm-property": "in-reply-to",
  });
  const fresh = mention(2, "2026-02-01T00:00:00Z");
  const result = mergeMentions(existing, [edited, fresh]);
  assertEquals(result.added, 1);
  assertEquals(result.updated, 1);
  assertEquals(result.mentions.map((m) => m["wm-id"]), [2, 1]);
  assertEquals(result.mentions[1]["wm-property"], "in-reply-to");
  assertEquals(existing, snapshot);
});

Deno.test("mergeMentions counts identical entries as unchanged", () => {
  const m = mention(1, "2026-01-01T00:00:00Z");
  const result = mergeMentions([m], [structuredClone(m)]);
  assertEquals([result.added, result.updated], [0, 0]);
});

Deno.test("syncWebmentions asks for everything after the highest stored id", async () => {
  const feed = {
    ...empty,
    children: [
      mention(7, "2026-01-01T00:00:00Z"),
      mention(3, "2025-01-01T00:00:00Z"),
    ],
  };
  const api = fakeApi([jf2([])]);
  await syncWebmentions(feed, api.fetchPage);
  assertEquals(api.calls[0].since_id, "7");
});

Deno.test("syncWebmentions omits since_id on the first sync", async () => {
  const api = fakeApi([jf2([])]);
  await syncWebmentions(empty, api.fetchPage);
  assertEquals("since_id" in api.calls[0], false);
});

Deno.test("syncWebmentions returns the stored feed untouched when nothing is new, so the next run asks again", async () => {
  const feed = { ...empty, children: [mention(1, "2026-01-01T00:00:00Z")] };
  for (let run = 0; run < 2; run++) {
    const api = fakeApi([jf2([])]);
    const result = await syncWebmentions(feed, api.fetchPage);
    assertStrictEquals(result.feed, feed);
    assertEquals(api.calls.length, 1);
  }
});

Deno.test("syncWebmentions pages until a short page and merges every page", async () => {
  const api = fakeApi([
    jf2([
      mention(1, "2026-01-01T00:00:00Z"),
      mention(2, "2026-01-02T00:00:00Z"),
    ]),
    jf2([mention(3, "2026-01-03T00:00:00Z")]),
  ]);
  const now = new Date("2026-10-10T00:00:00Z");
  const result = await syncWebmentions(empty, api.fetchPage, {
    perPage: 2,
    now: () => now,
  });
  assertEquals(api.calls.map((c) => c.page), ["0", "1"]);
  assertEquals(result.feed.children.map((m) => m["wm-id"]), [3, 2, 1]);
  assertEquals(result.feed.lastFetched, now.toISOString());
  assertEquals(result.added, 3);
});

Deno.test("syncWebmentions counts dropped entries towards a full page", async () => {
  const api = fakeApi([
    jf2([mention(1, "2026-01-01T00:00:00Z"), { broken: true }]),
    jf2([]),
  ]);
  const result = await syncWebmentions(empty, api.fetchPage, { perPage: 2 });
  assertEquals(api.calls.length, 2);
  assertEquals(result.dropped, 1);
});

Deno.test("syncWebmentions throws on a failed page so the caller keeps its cache", async () => {
  const api = fakeApi([jf2([mention(1, "2026-01-01T00:00:00Z")]), null]);
  await assertRejects(() =>
    syncWebmentions(empty, api.fetchPage, { perPage: 1 })
  );
});

Deno.test("syncWebmentions stops at maxPages", async () => {
  const full = jf2([mention(1, "2026-01-01T00:00:00Z")]);
  const api = fakeApi([full, full, full, full]);
  await syncWebmentions(empty, api.fetchPage, { perPage: 1, maxPages: 3 });
  assertEquals(api.calls.length, 3);
});
