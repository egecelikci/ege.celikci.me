/**
 * utils/events.test.ts
 * Unit tests for the pure event enrichment helpers.
 */

import { assertEquals } from "@std/assert";
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
import type { MBRelation } from "./fetch-events.ts";

Deno.test("parseEventDate parses ISO strings", () => {
  assertEquals(parseEventDate("2026-08-15"), new Date("2026-08-15"));
});

Deno.test("parseEventDate returns null for empty/garbage input", () => {
  assertEquals(parseEventDate(), null);
  assertEquals(parseEventDate(""), null);
  assertEquals(parseEventDate("not-a-date"), null);
});

Deno.test("isEventUpcoming is true for future dates", () => {
  const today = new Date("2026-08-03");
  assertEquals(
    isEventUpcoming(new Date("2026-08-15"), false, false, today),
    true,
  );
});

Deno.test("isEventUpcoming treats today as upcoming", () => {
  const today = new Date("2026-08-03");
  assertEquals(
    isEventUpcoming(new Date("2026-08-03"), false, false, today),
    true,
  );
});

Deno.test("isEventUpcoming is false for past dates", () => {
  const today = new Date("2026-08-03");
  assertEquals(
    isEventUpcoming(new Date("2026-01-01"), false, false, today),
    false,
  );
});

Deno.test("isEventUpcoming falls back to ended flag when undated", () => {
  const today = new Date("2026-08-03");
  assertEquals(isEventUpcoming(null, false, false, today), true);
  assertEquals(isEventUpcoming(null, true, false, today), false);
});

Deno.test("isEventUpcoming is false when cancelled", () => {
  const today = new Date("2026-08-03");
  assertEquals(
    isEventUpcoming(new Date("2026-08-15"), false, true, today),
    false,
  );
});

Deno.test("resolveVenueName prefers local override", () => {
  const local = { venue_name: "Local Venue" };
  const venueRel = {
    type: "place",
    "target-type": "place" as const,
    "target-credit": "Credit Venue",
    place: { id: "1", name: "MB Venue" },
  };
  assertEquals(resolveVenueName(local, venueRel), "Local Venue");
});

Deno.test("resolveVenueName falls back to target-credit then place name", () => {
  const venueRel = {
    type: "place",
    "target-type": "place" as const,
    "target-credit": "Credit Venue",
    place: { id: "1", name: "MB Venue" },
  };
  assertEquals(resolveVenueName(undefined, venueRel), "Credit Venue");
  assertEquals(
    resolveVenueName(undefined, { ...venueRel, "target-credit": undefined }),
    "MB Venue",
  );
});

Deno.test("extractArtists uses target-credit over artist name", () => {
  const relations: MBRelation[] = [
    {
      type: "performer",
      "target-type": "artist",
      "target-credit": "Stage Name",
      artist: { id: "a", name: "Real Name", "sort-name": "Real Name" },
    },
  ];
  assertEquals(extractArtists(relations), ["Stage Name"]);
});

Deno.test("extractArtists excludes non-performer roles", () => {
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
  assertEquals(extractArtists(relations), ["Performer"]);
});

Deno.test("extractArtists drops entries without names", () => {
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
  assertEquals(extractArtists(relations), ["Performer"]);
});

Deno.test("buildDisplayTitle joins one, two, and many artists", () => {
  assertEquals(buildDisplayTitle(["A"], "Event"), "A");
  assertEquals(buildDisplayTitle(["A", "B"], "Event"), "A & B");
  assertEquals(buildDisplayTitle(["A", "B", "C"], "Event"), "A, B & C");
});

Deno.test("buildDisplayTitle appends venue with @", () => {
  assertEquals(buildDisplayTitle(["A"], "Event", "Venue"), "A @ Venue");
});

Deno.test("buildDisplayTitle falls back to event name without artists", () => {
  assertEquals(buildDisplayTitle([], "Event Name"), "Event Name");
  assertEquals(
    buildDisplayTitle([], "Event Name", "Venue"),
    "Event Name @ Venue",
  );
});

Deno.test("detectCustomTitle is true when no artist appears in name", () => {
  assertEquals(detectCustomTitle("A Night of Noise", ["Unknown"]), true);
});

Deno.test("detectCustomTitle is false when artist appears in name", () => {
  assertEquals(detectCustomTitle("Artist Live", ["artist"]), false);
});

Deno.test("detectCustomTitle is true for empty artist list with a name", () => {
  assertEquals(detectCustomTitle("Event Name", []), true);
  assertEquals(detectCustomTitle("", []), false);
});

Deno.test("filterLabels removes excluded labels", () => {
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
  assertEquals(result.length, 1);
  assertEquals(result[0].label?.id, "keep");
});

Deno.test("sortByDate sorts ascending and descending", () => {
  const events = [
    { beginDate: "2026-08-01T00:00:00.000Z" },
    { beginDate: "2026-08-08T00:00:00.000Z" },
    { beginDate: null },
  ];
  assertEquals(sortByDate(events[0], events[1]), -7 * 24 * 3600 * 1000);
  assertEquals(sortByDate(events[0], events[1], true), 7 * 24 * 3600 * 1000);
});
