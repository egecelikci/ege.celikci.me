/**
 * Unit tests for the pure webmention statistics helpers.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { computeWebmentionStats, normalizeUrl } from "./webmention-stats.ts";
import type { WebmentionFeed } from "../src/types/index.ts";

test("normalizeUrl strips trailing slashes", () => {
  assert.deepEqual(
    normalizeUrl("https://ege.celikci.me/"),
    "https://ege.celikci.me",
  );
  assert.deepEqual(
    normalizeUrl("https://ege.celikci.me"),
    "https://ege.celikci.me",
  );
  assert.deepEqual(normalizeUrl(""), "");
});

test("computeWebmentionStats counts by type for the page URL", () => {
  const feed: WebmentionFeed = {
    schemaVersion: 1,
    lastFetched: null,
    children: [
      {
        "wm-id": 1,
        "wm-property": "like-of",
        "wm-source": "https://example.com/1",
        "wm-target": "https://ege.celikci.me/notes/a",
        "wm-received": "2026-01-01T00:00:00.000Z",
      },
      {
        "wm-id": 2,
        "wm-property": "repost-of",
        "wm-source": "https://example.com/2",
        "wm-target": "https://ege.celikci.me/notes/a",
        "wm-received": "2026-01-01T00:00:00.000Z",
      },
      {
        "wm-id": 3,
        "wm-property": "in-reply-to",
        "wm-source": "https://example.com/3",
        "wm-target": "https://ege.celikci.me/notes/a",
        "wm-received": "2026-01-01T00:00:00.000Z",
      },
      {
        "wm-id": 4,
        "wm-property": "mention-of",
        "wm-source": "https://example.com/4",
        "wm-target": "https://ege.celikci.me/notes/a",
        "wm-received": "2026-01-01T00:00:00.000Z",
      },
      {
        "wm-id": 5,
        "wm-property": "like-of",
        "wm-source": "https://example.com/5",
        "wm-target": "https://ege.celikci.me/notes/other",
        "wm-received": "2026-01-01T00:00:00.000Z",
      },
    ],
  };

  const stats = computeWebmentionStats(
    feed,
    "https://ege.celikci.me",
    "/notes/a",
    () => false,
  );

  assert.deepEqual(stats, { likes: 1, reposts: 1, replies: 2 });
});

test("computeWebmentionStats ignores own webmentions", () => {
  const feed: WebmentionFeed = {
    schemaVersion: 1,
    lastFetched: null,
    children: [
      {
        "wm-id": 1,
        "wm-property": "like-of",
        "wm-source": "https://example.com/1",
        "wm-target": "https://ege.celikci.me/notes/a",
        "wm-received": "2026-01-01T00:00:00.000Z",
        author: { name: "me", url: "https://ege.celikci.me", photo: null },
      },
    ],
  };

  const stats = computeWebmentionStats(
    feed,
    "https://ege.celikci.me",
    "/notes/a",
    (m) => m.author?.url?.replace(/\/+$/, "") === "https://ege.celikci.me",
  );

  assert.deepEqual(stats, { likes: 0, reposts: 0, replies: 0 });
});

test("computeWebmentionStats normalizes trailing slashes in targets", () => {
  const feed: WebmentionFeed = {
    schemaVersion: 1,
    lastFetched: null,
    children: [
      {
        "wm-id": 1,
        "wm-property": "like-of",
        "wm-source": "https://example.com/1",
        "wm-target": "https://ege.celikci.me/notes/a/",
        "wm-received": "2026-01-01T00:00:00.000Z",
      },
    ],
  };

  const stats = computeWebmentionStats(
    feed,
    "https://ege.celikci.me",
    "/notes/a",
    () => false,
  );

  assert.deepEqual(stats, { likes: 1, reposts: 0, replies: 0 });
});

test("computeWebmentionStats handles missing feed", () => {
  assert.deepEqual(
    computeWebmentionStats(
      undefined,
      "https://ege.celikci.me",
      "/notes/a",
      () => false,
    ),
    { likes: 0, reposts: 0, replies: 0 },
  );
});

test("computeWebmentionStats excludes non-matching targets", () => {
  const feed: WebmentionFeed = {
    schemaVersion: 1,
    lastFetched: null,
    children: [
      {
        "wm-id": 1,
        "wm-property": "like-of",
        "wm-source": "https://example.com/1",
        "wm-target": "https://ege.celikci.me/notes/a",
        "wm-received": "2026-01-01T00:00:00.000Z",
      },
      {
        "wm-id": 2,
        "wm-property": "like-of",
        "wm-source": "https://example.com/2",
        "wm-target": "https://ege.celikci.me/notes/other",
        "wm-received": "2026-01-01T00:00:00.000Z",
      },
    ],
  };

  const stats = computeWebmentionStats(
    feed,
    "https://ege.celikci.me",
    "/notes/a",
    () => false,
  );

  assert.deepEqual(stats, { likes: 1, reposts: 0, replies: 0 });
});
