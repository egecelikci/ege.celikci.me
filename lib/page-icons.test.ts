/**
 * Unit tests for the page-kind icon mapping.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { pageIcon } from "./page-icons.ts";

test("pageIcon prefers a tag over the page type", () => {
  assert.deepEqual(
    pageIcon({ type: "note", tags: ["kedi"] }).icon,
    "cat-broken",
  );
  assert.deepEqual(pageIcon({ type: "note", tags: ["kedi"] }).catalog, "solar");
  assert.deepEqual(
    pageIcon({ type: "note", tags: ["places"] }).icon,
    "map-pin",
  );
});

test("pageIcon falls back to the type, then to a page glyph", () => {
  assert.deepEqual(pageIcon({ type: "note" }).icon, "sticky-note");
  assert.deepEqual(
    pageIcon({ type: "note", tags: ["whatever"] }).icon,
    "sticky-note",
  );
  assert.deepEqual(pageIcon({}).icon, "file-text");
  /** Lume allows a single tag as a bare string. */
  assert.deepEqual(pageIcon({ tags: "kedi" }).icon, "cat-broken");
  assert.deepEqual(pageIcon({ type: "note" }).catalog, "lucide");
});
