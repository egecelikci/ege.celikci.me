/**
 * Unit tests for the link mapping used by templates and the event pages.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { getLinkInfo, HOST_MAPPINGS, LINK_MAPPINGS } from "./links.ts";

test("getLinkInfo prefers the host over the declared type", () => {
  const info = getLinkInfo("poster", "https://www.instagram.com/p/abc");
  assert.deepEqual(info.label, "Instagram");
  assert.deepEqual(info.catalog, "simpleicons");
  assert.deepEqual(info.isFallback, false);
});

test("getLinkInfo ignores a leading www and host casing", () => {
  assert.deepEqual(
    getLinkInfo("", "https://WWW.Instagram.COM/p").label,
    "Instagram",
  );
  assert.deepEqual(
    getLinkInfo("", "https://instagram.com/p").label,
    "Instagram",
  );
});

test("getLinkInfo falls back to the type when the host is unknown", () => {
  const info = getLinkInfo("TICKETING", "https://example.com/tickets");
  assert.deepEqual(info.icon, "ticket");
  assert.deepEqual(info.label, "Tickets");
  assert.deepEqual(info.isFallback, false);
});

test("getLinkInfo keeps the given type as the label when nothing matches", () => {
  const info = getLinkInfo("some new kind", "not a url");
  assert.deepEqual(info.icon, "globe");
  assert.deepEqual(info.label, "some new kind");
  assert.deepEqual(info.isFallback, true);
});

test("getLinkInfo never throws on a malformed url", () => {
  assert.deepEqual(getLinkInfo("", "").isFallback, true);
  assert.deepEqual(getLinkInfo("", "::::").isFallback, true);
});

test("every host mapping points at a real catalog entry", () => {
  const catalogs = new Set(["lucide", "simpleicons", "remixicon"]);
  for (const [host, mapping] of Object.entries(HOST_MAPPINGS)) {
    assert.deepEqual(typeof mapping.label, "string", host);
    assert.deepEqual(catalogs.has(mapping.catalog), true, `${host} catalog`);
    assert.deepEqual(mapping.icon.length > 0, true, `${host} icon`);
  }
  for (const [type, mapping] of Object.entries(LINK_MAPPINGS)) {
    assert.deepEqual(catalogs.has(mapping.catalog), true, `${type} catalog`);
  }
});
