import assert from "node:assert/strict";
import { test } from "node:test";
import type { Webmention, WebmentionFeed } from "../src/types/index.ts";
import {
  type FetchPage,
  isOwnWebmention,
  mergeMentions,
  ownUrls,
  parseMentions,
  publicFeed,
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

test("parseMentions drops unsupported and malformed entries instead of the whole batch", () => {
  const parsed = parseMentions(
    jf2([
      mention(1, "2026-01-01T00:00:00Z"),
      { ...mention(2, "2026-01-02T00:00:00Z"), "wm-property": "bookmark-of" },
      { "wm-id": "not a number" },
    ]),
  );
  assert.deepEqual(
    parsed?.mentions.map((m) => m["wm-id"]),
    [1],
  );
  assert.deepEqual(parsed?.dropped, 2);
});

test("parseMentions drops author links that are not http(s)", () => {
  const parsed = parseMentions(
    jf2([
      mention(1, "2026-01-01T00:00:00Z", {
        author: {
          name: "x",
          url: "javascript:alert(1)",
          photo: "https://a.example/p.png",
        },
      }),
    ]),
  );
  assert.deepEqual(parsed?.mentions[0].author?.url, null);
  assert.deepEqual(
    parsed?.mentions[0].author?.photo,
    "https://a.example/p.png",
  );
});

test("parseMentions rejects bodies that are not a jf2 feed", () => {
  assert.deepEqual(parseMentions(null), null);
  assert.deepEqual(parseMentions("<html>"), null);
  assert.deepEqual(parseMentions({ error: "forbidden" }), null);
});

test("mergeMentions adds, updates, sorts newest first, and leaves its inputs alone", () => {
  const existing = [mention(1, "2026-01-01T00:00:00Z")];
  const snapshot = structuredClone(existing);
  const edited = mention(1, "2026-01-01T00:00:00Z", {
    "wm-property": "in-reply-to",
  });
  const fresh = mention(2, "2026-02-01T00:00:00Z");
  const result = mergeMentions(existing, [edited, fresh]);
  assert.deepEqual(result.added, 1);
  assert.deepEqual(result.updated, 1);
  assert.deepEqual(
    result.mentions.map((m) => m["wm-id"]),
    [2, 1],
  );
  assert.deepEqual(result.mentions[1]["wm-property"], "in-reply-to");
  assert.deepEqual(existing, snapshot);
});

test("mergeMentions counts identical entries as unchanged", () => {
  const m = mention(1, "2026-01-01T00:00:00Z");
  const result = mergeMentions([m], [structuredClone(m)]);
  assert.deepEqual([result.added, result.updated], [0, 0]);
});

test("syncWebmentions asks for everything after the highest stored id", async () => {
  const feed = {
    ...empty,
    children: [
      mention(7, "2026-01-01T00:00:00Z"),
      mention(3, "2025-01-01T00:00:00Z"),
    ],
  };
  const api = fakeApi([jf2([])]);
  await syncWebmentions(feed, api.fetchPage);
  assert.deepEqual(api.calls[0].since_id, "7");
});

test("syncWebmentions omits since_id on the first sync", async () => {
  const api = fakeApi([jf2([])]);
  await syncWebmentions(empty, api.fetchPage);
  assert.deepEqual("since_id" in api.calls[0], false);
});

test("syncWebmentions returns the stored feed untouched when nothing is new, so the next run asks again", async () => {
  const feed = { ...empty, children: [mention(1, "2026-01-01T00:00:00Z")] };
  for (let run = 0; run < 2; run++) {
    const api = fakeApi([jf2([])]);
    const result = await syncWebmentions(feed, api.fetchPage);
    assert.equal(result.feed, feed);
    assert.deepEqual(api.calls.length, 1);
  }
});

test("syncWebmentions pages until a short page and merges every page", async () => {
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
  assert.deepEqual(
    api.calls.map((c) => c.page),
    ["0", "1"],
  );
  assert.deepEqual(
    result.feed.children.map((m) => m["wm-id"]),
    [3, 2, 1],
  );
  assert.deepEqual(result.feed.lastFetched, now.toISOString());
  assert.deepEqual(result.added, 3);
});

test("syncWebmentions counts dropped entries towards a full page", async () => {
  const api = fakeApi([
    jf2([mention(1, "2026-01-01T00:00:00Z"), { broken: true }]),
    jf2([]),
  ]);
  const result = await syncWebmentions(empty, api.fetchPage, { perPage: 2 });
  assert.deepEqual(api.calls.length, 2);
  assert.deepEqual(result.dropped, 1);
});

test("syncWebmentions throws on a failed page so the caller keeps its cache", async () => {
  const api = fakeApi([jf2([mention(1, "2026-01-01T00:00:00Z")]), null]);
  await assert.rejects(() =>
    syncWebmentions(empty, api.fetchPage, { perPage: 1 }),
  );
});

test("syncWebmentions stops at maxPages", async () => {
  const full = jf2([mention(1, "2026-01-01T00:00:00Z")]);
  const api = fakeApi([full, full, full, full]);
  await syncWebmentions(empty, api.fetchPage, { perPage: 1, maxPages: 3 });
  assert.deepEqual(api.calls.length, 3);
});

test("ownUrls normalises the site and every author profile", () => {
  const own = ownUrls("https://ege.celikci.me/", {
    social: {
      mastodon: { url: "https://ieji.de/@eg/" },
      bluesky: { url: "https://bsky.app/profile/did:plc:test" },
    },
    links: [{ url: "https://git.celikci.me/egecelikci/" }],
  });
  assert.deepEqual(own, [
    "https://ege.celikci.me",
    "https://ieji.de/@eg",
    "https://bsky.app/profile/did:plc:test",
    "https://git.celikci.me/egecelikci",
  ]);
});

test("isOwnWebmention compares normalised urls and ignores missing authors", () => {
  const own = ["https://ege.celikci.me"];
  assert.deepEqual(
    isOwnWebmention({ author: { url: "https://ege.celikci.me/" } }, own),
    true,
  );
  assert.deepEqual(
    isOwnWebmention({ author: { url: "https://other.example" } }, own),
    false,
  );
  assert.deepEqual(isOwnWebmention({}, own), false);
  assert.deepEqual(isOwnWebmention({ author: null }, own), false);
  assert.deepEqual(isOwnWebmention({ author: { url: null } }, own), false);
  assert.deepEqual(isOwnWebmention({ author: { url: "" } }, own), false);
});

test("publicFeed drops private mentions and keeps the rest untouched", () => {
  const visible = mention(1, "2026-01-01T00:00:00Z");
  const hidden = mention(2, "2026-01-02T00:00:00Z", { "wm-private": true });
  const flaggedPublic = mention(3, "2026-01-03T00:00:00Z", {
    "wm-private": false,
  });
  const feed: WebmentionFeed = {
    schemaVersion: 1,
    children: [visible, hidden, flaggedPublic],
    lastFetched: null,
  };

  const shown = publicFeed(feed);
  assert.deepEqual(
    shown.children.map((m) => m["wm-id"]),
    [1, 3],
  );
  // The stored feed keeps the private one, so sync can still advance past its id.
  assert.deepEqual(feed.children.length, 3);
});
