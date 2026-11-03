/**
 * Unit tests for the template filters. `webmentionsByUrl` renders untrusted webmention bodies into HTML, so the sanitising and the own-mention filtering are the parts that must not regress.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Webmention } from "../src/types/index.ts";
import { createFilters, type FilterMeta } from "./template-filters.ts";

const meta: FilterMeta = {
  site: { url: "https://ege.celikci.me", host: "ege.celikci.me" },
  author: {
    username: "egecelikci",
    social: {
      mastodon: { url: "https://ieji.de/@eg/" },
      bluesky: { url: "https://bsky.app/profile/did:plc:test" },
    },
    links: [{ url: "https://git.celikci.me/egecelikci/" }],
  },
  git: { host: "git.celikci.me" },
};

const filters = createFilters(meta);

test("humanizeNumber shortens thousands only", () => {
  assert.deepEqual(filters.humanizeNumber(999), 999);
  assert.deepEqual(filters.humanizeNumber(1000), "1K");
  assert.deepEqual(filters.humanizeNumber(1500), "1.5K");
});

test("slice mirrors Array.slice", () => {
  assert.deepEqual(filters.slice([1, 2, 3], 1), [2, 3]);
  assert.deepEqual(filters.slice([1, 2, 3], 0, 2), [1, 2]);
});

test("resolveSourceUrl maps a page path onto the repo browser", () => {
  assert.deepEqual(
    filters.resolveSourceUrl("/src/index.md"),
    "https://git.celikci.me/egecelikci/ege.celikci.me/src/branch/main/src/index.md",
  );
  assert.deepEqual(
    filters.resolveSourceUrl("src/index.md"),
    "https://git.celikci.me/egecelikci/ege.celikci.me/src/branch/main/src/index.md",
  );
});

test("isOwnWebmention matches every own URL, with or without a trailing slash", () => {
  assert.deepEqual(
    filters.isOwnWebmention({ author: { url: "https://ege.celikci.me" } }),
    true,
  );
  assert.deepEqual(
    filters.isOwnWebmention({ author: { url: "https://ieji.de/@eg" } }),
    true,
  );
  assert.deepEqual(
    filters.isOwnWebmention({ author: { url: "https://social.example/@eg" } }),
    false,
  );
});

test("isOwnWebmention never claims a mention with no author", () => {
  assert.deepEqual(filters.isOwnWebmention({}), false);
  assert.deepEqual(filters.isOwnWebmention({ author: null }), false);
  assert.deepEqual(filters.isOwnWebmention({ author: { url: null } }), false);
});

test("webmentionsByUrl keeps only mentions for that page", () => {
  const kept = filters.webmentionsByUrl(
    [
      mention({ "wm-target": "https://ege.celikci.me/notes/one/" }),
      mention({ "wm-target": "https://ege.celikci.me/notes/two/" }),
    ],
    "/notes/one/",
  );
  assert.deepEqual(kept.length, 1);
  assert.deepEqual(kept[0]["wm-target"], "https://ege.celikci.me/notes/one/");
});

test("webmentionsByUrl returns nothing without mentions", () => {
  assert.deepEqual(filters.webmentionsByUrl(undefined, "/x/"), []);
});

test("webmentionsByUrl drops unsupported properties and nameless authors", () => {
  const kept = filters.webmentionsByUrl(
    [
      mention({ "wm-property": "bookmark-of" }),
      mention({ author: { name: "" } }),
      mention({ "wm-property": "like-of" }),
    ],
    "/x/",
  );
  assert.deepEqual(
    kept.map((entry) => entry["wm-property"]),
    ["like-of"],
  );
});

test("webmentionsByUrl drops own mentions and syndicated copies", () => {
  const kept = filters.webmentionsByUrl(
    [
      mention({ author: { name: "eg", url: "https://ieji.de/@eg" } }),
      mention({ url: "https://bsky.app/profile/did:plc:test/post/1" }),
      mention({ url: "https://other.example/1" }),
    ],
    "/x/",
    { bsky: "https://bsky.app/profile/did:plc:test/post/1" },
  );
  assert.deepEqual(
    kept.map((entry) => entry.url),
    ["https://other.example/1"],
  );
});

test("webmentionsByUrl keeps only the allowed tags and escapes the rest", () => {
  const [kept] = filters.webmentionsByUrl(
    [
      mention({
        content: {
          html: '<p>hi<script>alert(1)</script><img src=x onerror="alert(2)"><b>bold</b><a href="javascript:alert(3)">link</a></p>',
        },
      }),
    ],
    "/x/",
  );
  const value = kept.content?.value as string;

  assert.deepEqual(value.includes("<b>bold</b>"), true);
  // Everything outside the whitelist is escaped rather than dropped, so it stays inert and stays readable.
  assert.deepEqual(value.includes("<script"), false);
  assert.deepEqual(value.includes("<img"), false);
  assert.deepEqual(value.includes("&lt;script&gt;"), true);
  assert.deepEqual(value.includes("javascript:"), false);
});

test("webmentionsByUrl collapses a very long mention into a link to its source", () => {
  const [kept] = filters.webmentionsByUrl(
    [
      mention({
        "wm-source": "https://blog.example/post?a=<script>",
        content: { html: `<p>${"x".repeat(2500)}</p>` },
      }),
    ],
    "/x/",
  );
  const value = kept.content?.value as string;
  assert.deepEqual(value.includes("mentioned this in"), true);
  assert.deepEqual(value.includes("<script"), false);
});

test("webmentionsByUrl sorts oldest first", () => {
  const kept = filters.webmentionsByUrl(
    [
      mention({ "wm-received": "2026-02-01T00:00:00Z" }),
      mention({ "wm-received": "2026-01-01T00:00:00Z" }),
    ],
    "/x/",
  );
  assert.deepEqual(
    kept.map((entry) => entry["wm-received"]),
    ["2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"],
  );
});

/** A mention the filters accept, so each test only has to state what it changes. */
function mention(overrides: Record<string, unknown>): Webmention {
  return {
    "wm-target": "https://ege.celikci.me/x/",
    "wm-property": "mention-of",
    "wm-received": "2026-01-01T00:00:00Z",
    author: { name: "someone", url: "https://other.example" },
    ...overrides,
  } as unknown as Webmention;
}

test("a long mention from a non-http source renders nothing instead of a link", () => {
  const [kept] = filters.webmentionsByUrl(
    [
      mention({
        "wm-source": "javascript:alert(1)",
        content: { html: `<p>${"x".repeat(2500)}</p>` },
      }),
    ],
    "/x/",
  );
  assert.deepEqual(kept.content?.value, "");
});

test("a long mention's source cannot break out of the href", () => {
  const [kept] = filters.webmentionsByUrl(
    [
      mention({
        "wm-source": 'https://blog.example/p"onmouseover="alert(1)',
        content: { html: `<p>${"x".repeat(2500)}</p>` },
      }),
    ],
    "/x/",
  );
  const value = kept.content?.value as string;
  // The quote is percent-encoded, so `onmouseover` stays inside the path instead of becoming an attribute.
  assert.deepEqual(value.includes('"onmouseover'), false);
  assert.deepEqual(value.includes("%22onmouseover=%22"), true);
});
