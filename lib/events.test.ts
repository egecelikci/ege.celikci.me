/**
 * Unit tests for the pure event enrichment helpers.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDisplayTitle,
  detectCustomTitle,
  extractArtists,
  filterLabels,
  isEventUpcoming,
  parseEventDate,
  resolveVenueName,
  sortByDate,
} from "./events.ts";
import type { MBRelation } from "./schemas.ts";

test("parseEventDate parses ISO strings", () => {
  assert.deepEqual(parseEventDate("2026-08-15"), new Date("2026-08-15"));
});

test("parseEventDate returns null for empty/garbage input", () => {
  assert.deepEqual(parseEventDate(), null);
  assert.deepEqual(parseEventDate(""), null);
  assert.deepEqual(parseEventDate("not-a-date"), null);
});

test("isEventUpcoming is true for future dates", () => {
  const today = new Date("2026-08-03");
  assert.deepEqual(
    isEventUpcoming(new Date("2026-08-15"), false, false, today),
    true,
  );
});

test("isEventUpcoming treats today as upcoming", () => {
  const today = new Date("2026-08-03");
  assert.deepEqual(
    isEventUpcoming(new Date("2026-08-03"), false, false, today),
    true,
  );
});

test("isEventUpcoming is false for past dates", () => {
  const today = new Date("2026-08-03");
  assert.deepEqual(
    isEventUpcoming(new Date("2026-01-01"), false, false, today),
    false,
  );
});

test("isEventUpcoming falls back to ended flag when undated", () => {
  const today = new Date("2026-08-03");
  assert.deepEqual(isEventUpcoming(null, false, false, today), true);
  assert.deepEqual(isEventUpcoming(null, true, false, today), false);
});

test("isEventUpcoming is false when cancelled", () => {
  const today = new Date("2026-08-03");
  assert.deepEqual(
    isEventUpcoming(new Date("2026-08-15"), false, true, today),
    false,
  );
});

test("resolveVenueName prefers local override", () => {
  const local = { venue_name: "Local Venue" };
  const venueRel = {
    type: "place",
    "target-type": "place" as const,
    "target-credit": "Credit Venue",
    place: { id: "1", name: "MB Venue" },
  };
  assert.deepEqual(resolveVenueName(local, venueRel), "Local Venue");
});

test("resolveVenueName falls back to target-credit then place name", () => {
  const venueRel = {
    type: "place",
    "target-type": "place" as const,
    "target-credit": "Credit Venue",
    place: { id: "1", name: "MB Venue" },
  };
  assert.deepEqual(resolveVenueName(undefined, venueRel), "Credit Venue");
  assert.deepEqual(
    resolveVenueName(undefined, { ...venueRel, "target-credit": undefined }),
    "MB Venue",
  );
});

test("extractArtists uses target-credit over artist name", () => {
  const relations: MBRelation[] = [
    {
      type: "performer",
      "target-type": "artist",
      "target-credit": "Stage Name",
      artist: { id: "a", name: "Real Name", "sort-name": "Real Name" },
    },
  ];
  assert.deepEqual(extractArtists(relations), ["Stage Name"]);
});

test("extractArtists excludes non-performer roles", () => {
  const relations: MBRelation[] = [
    {
      type: "graphic design",
      "target-type": "artist",
      artist: { id: "a", name: "Designer", "sort-name": "Designer" },
    },
    {
      type: "performer",
      "target-type": "artist",
      artist: { id: "b", name: "Performer", "sort-name": "Performer" },
    },
  ];
  assert.deepEqual(extractArtists(relations), ["Performer"]);
});

test("extractArtists drops entries without names", () => {
  const relations: MBRelation[] = [
    {
      type: "performer",
      "target-type": "artist",
      artist: { id: "a", name: "Performer", "sort-name": "Performer" },
    },
    {
      type: "performer",
      "target-type": "artist",
      artist: { id: "b", name: "", "sort-name": "" },
    },
  ];
  assert.deepEqual(extractArtists(relations), ["Performer"]);
});

test("buildDisplayTitle joins one, two, and many artists", () => {
  assert.deepEqual(buildDisplayTitle(["A"], "Event"), "A");
  assert.deepEqual(buildDisplayTitle(["A", "B"], "Event"), "A & B");
  assert.deepEqual(buildDisplayTitle(["A", "B", "C"], "Event"), "A, B & C");
});

test("buildDisplayTitle appends venue with @", () => {
  assert.deepEqual(buildDisplayTitle(["A"], "Event", "Venue"), "A @ Venue");
});

test("buildDisplayTitle falls back to event name without artists", () => {
  assert.deepEqual(buildDisplayTitle([], "Event Name"), "Event Name");
  assert.deepEqual(
    buildDisplayTitle([], "Event Name", "Venue"),
    "Event Name @ Venue",
  );
});

test("detectCustomTitle is true when no artist appears in name", () => {
  assert.deepEqual(detectCustomTitle("A Night of Noise", ["Unknown"]), true);
});

test("detectCustomTitle is false when artist appears in name", () => {
  assert.deepEqual(detectCustomTitle("Artist Live", ["artist"]), false);
});

test("detectCustomTitle is true for empty artist list with a name", () => {
  assert.deepEqual(detectCustomTitle("Event Name", []), true);
  assert.deepEqual(detectCustomTitle("", []), false);
});

test("filterLabels removes excluded labels", () => {
  const relations: MBRelation[] = [
    {
      type: "signed by",
      "target-type": "label",
      label: { id: "keep", name: "Keep", "sort-name": "Keep" },
    },
    {
      type: "signed by",
      "target-type": "label",
      label: { id: "drop", name: "Drop", "sort-name": "Drop" },
    },
  ];
  const result = filterLabels(relations, ["drop"]);
  assert.deepEqual(result.length, 1);
  assert.deepEqual(result[0].label?.id, "keep");
});

test("sortByDate sorts ascending and descending", () => {
  const events = [
    { beginDate: "2026-08-01T00:00:00.000Z" },
    { beginDate: "2026-08-08T00:00:00.000Z" },
    { beginDate: null },
  ];
  assert.deepEqual(sortByDate(events[0], events[1]), -7 * 24 * 3600 * 1000);
  assert.deepEqual(
    sortByDate(events[0], events[1], true),
    7 * 24 * 3600 * 1000,
  );
});
