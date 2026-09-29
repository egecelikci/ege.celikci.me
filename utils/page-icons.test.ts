/**
 * Unit tests for the page-kind icon mapping.
 */

import { assertEquals } from "@std/assert";
import { pageIcon } from "./page-icons.ts";

Deno.test("pageIcon prefers a tag over the page type", () => {
  assertEquals(pageIcon({ type: "note", tags: ["kedi"] }).icon, "cat-broken");
  assertEquals(pageIcon({ type: "note", tags: ["kedi"] }).catalog, "solar");
  assertEquals(pageIcon({ type: "note", tags: ["places"] }).icon, "map-pin");
});

Deno.test("pageIcon falls back to the type, then to a page glyph", () => {
  assertEquals(pageIcon({ type: "note" }).icon, "sticky-note");
  assertEquals(
    pageIcon({ type: "note", tags: ["whatever"] }).icon,
    "sticky-note",
  );
  assertEquals(pageIcon({}).icon, "file-text");
  /** Lume allows a single tag as a bare string. */
  assertEquals(pageIcon({ tags: "kedi" }).icon, "cat-broken");
  assertEquals(pageIcon({ type: "note" }).catalog, "lucide");
});
