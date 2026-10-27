/**
 * Unit tests for the link mapping used by templates and the event pages.
 */

import { assertEquals } from "@std/assert";
import { getLinkInfo, HOST_MAPPINGS, LINK_MAPPINGS } from "./links.ts";

Deno.test("getLinkInfo prefers the host over the declared type", () => {
  const info = getLinkInfo("poster", "https://www.instagram.com/p/abc");
  assertEquals(info.label, "Instagram");
  assertEquals(info.catalog, "simpleicons");
  assertEquals(info.isFallback, false);
});

Deno.test("getLinkInfo ignores a leading www and host casing", () => {
  assertEquals(
    getLinkInfo("", "https://WWW.Instagram.COM/p").label,
    "Instagram",
  );
  assertEquals(getLinkInfo("", "https://instagram.com/p").label, "Instagram");
});

Deno.test("getLinkInfo falls back to the type when the host is unknown", () => {
  const info = getLinkInfo("TICKETING", "https://example.com/tickets");
  assertEquals(info.icon, "ticket");
  assertEquals(info.label, "Tickets");
  assertEquals(info.isFallback, false);
});

Deno.test("getLinkInfo keeps the given type as the label when nothing matches", () => {
  const info = getLinkInfo("some new kind", "not a url");
  assertEquals(info.icon, "globe");
  assertEquals(info.label, "some new kind");
  assertEquals(info.isFallback, true);
});

Deno.test("getLinkInfo never throws on a malformed url", () => {
  assertEquals(getLinkInfo("", "").isFallback, true);
  assertEquals(getLinkInfo("", "::::").isFallback, true);
});

Deno.test("every host mapping points at a real catalog entry", () => {
  const catalogs = new Set(["lucide", "simpleicons", "remixicon"]);
  for (const [host, mapping] of Object.entries(HOST_MAPPINGS)) {
    assertEquals(typeof mapping.label, "string", host);
    assertEquals(catalogs.has(mapping.catalog), true, `${host} catalog`);
    assertEquals(mapping.icon.length > 0, true, `${host} icon`);
  }
  for (const [type, mapping] of Object.entries(LINK_MAPPINGS)) {
    assertEquals(catalogs.has(mapping.catalog), true, `${type} catalog`);
  }
});
