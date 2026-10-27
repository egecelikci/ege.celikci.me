/**
 * Unit tests for the template filters. `webmentionsByUrl` renders untrusted webmention bodies into HTML, so the sanitising and the own-mention filtering are the parts that must not regress.
 */

import { assertEquals } from "@std/assert";
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

Deno.test("humanizeNumber shortens thousands only", () => {
  assertEquals(filters.humanizeNumber(999), 999);
  assertEquals(filters.humanizeNumber(1000), "1K");
  assertEquals(filters.humanizeNumber(1500), "1.5K");
});

Deno.test("slice mirrors Array.slice", () => {
  assertEquals(filters.slice([1, 2, 3], 1), [2, 3]);
  assertEquals(filters.slice([1, 2, 3], 0, 2), [1, 2]);
});

Deno.test("resolveSourceUrl maps a page path onto the repo browser", () => {
  assertEquals(
    filters.resolveSourceUrl("/src/index.md"),
    "https://git.celikci.me/egecelikci/ege.celikci.me/src/branch/main/src/index.md",
  );
  assertEquals(
    filters.resolveSourceUrl("src/index.md"),
    "https://git.celikci.me/egecelikci/ege.celikci.me/src/branch/main/src/index.md",
  );
});

Deno.test("isOwnWebmention matches every own URL, with or without a trailing slash", () => {
  assertEquals(
    filters.isOwnWebmention({ author: { url: "https://ege.celikci.me" } }),
    true,
  );
  assertEquals(
    filters.isOwnWebmention({ author: { url: "https://ieji.de/@eg" } }),
    true,
  );
  assertEquals(
    filters.isOwnWebmention({ author: { url: "https://social.example/@eg" } }),
    false,
  );
});

Deno.test("isOwnWebmention never claims a mention with no author", () => {
  assertEquals(filters.isOwnWebmention({}), false);
  assertEquals(filters.isOwnWebmention({ author: null }), false);
  assertEquals(filters.isOwnWebmention({ author: { url: null } }), false);
});

Deno.test("webmentionsByUrl keeps only mentions for that page", () => {
  const kept = filters.webmentionsByUrl(
    [
      mention({ "wm-target": "https://ege.celikci.me/notes/one/" }),
      mention({ "wm-target": "https://ege.celikci.me/notes/two/" }),
    ],
    "/notes/one/",
  );
  assertEquals(kept.length, 1);
  assertEquals(kept[0]["wm-target"], "https://ege.celikci.me/notes/one/");
});

Deno.test("webmentionsByUrl returns nothing without mentions", () => {
  assertEquals(filters.webmentionsByUrl(undefined, "/x/"), []);
});

Deno.test("webmentionsByUrl drops unsupported properties and nameless authors", () => {
  const kept = filters.webmentionsByUrl(
    [
      mention({ "wm-property": "bookmark-of" }),
      mention({ author: { name: "" } }),
      mention({ "wm-property": "like-of" }),
    ],
    "/x/",
  );
  assertEquals(kept.map((entry) => entry["wm-property"]), ["like-of"]);
});

Deno.test("webmentionsByUrl drops own mentions and syndicated copies", () => {
  const kept = filters.webmentionsByUrl(
    [
      mention({ author: { name: "eg", url: "https://ieji.de/@eg" } }),
      mention({ url: "https://bsky.app/profile/did:plc:test/post/1" }),
      mention({ url: "https://other.example/1" }),
    ],
    "/x/",
    { bsky: "https://bsky.app/profile/did:plc:test/post/1" },
  );
  assertEquals(kept.map((entry) => entry.url), ["https://other.example/1"]);
});

Deno.test("webmentionsByUrl keeps only the allowed tags and escapes the rest", () => {
  const [kept] = filters.webmentionsByUrl(
    [
      mention({
        content: {
          html:
            '<p>hi<script>alert(1)</script><img src=x onerror="alert(2)"><b>bold</b><a href="javascript:alert(3)">link</a></p>',
        },
      }),
    ],
    "/x/",
  );
  const value = kept.content?.value as string;

  assertEquals(value.includes("<b>bold</b>"), true);
  // Everything outside the whitelist is escaped rather than dropped, so it stays inert and stays readable.
  assertEquals(value.includes("<script"), false);
  assertEquals(value.includes("<img"), false);
  assertEquals(value.includes("&lt;script&gt;"), true);
  assertEquals(value.includes("javascript:"), false);
});

Deno.test("webmentionsByUrl collapses a very long mention into a link to its source", () => {
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
  assertEquals(value.includes("mentioned this in"), true);
  assertEquals(value.includes("<script"), false);
});

Deno.test("webmentionsByUrl sorts oldest first", () => {
  const kept = filters.webmentionsByUrl(
    [
      mention({ "wm-received": "2026-02-01T00:00:00Z" }),
      mention({ "wm-received": "2026-01-01T00:00:00Z" }),
    ],
    "/x/",
  );
  assertEquals(kept.map((entry) => entry["wm-received"]), [
    "2026-01-01T00:00:00Z",
    "2026-02-01T00:00:00Z",
  ]);
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
