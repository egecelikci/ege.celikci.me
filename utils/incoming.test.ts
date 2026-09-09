/**
 * utils/incoming.test.ts
 * Unit tests for the `incoming:` backlinks helpers.
 */

import { assertEquals } from "@std/assert";
import {
  buildIncoming,
  extractBodyLinks,
  frontmatterLinks,
  normalizeUrl,
  noteTitle,
} from "./incoming.ts";

Deno.test("extractBodyLinks finds markdown and html links", () => {
  assertEquals(
    extractBodyLinks(
      "see the [notes](/notes/) and [music](/music/page?x=1#y), " +
        'plus <a href="/tags/coffee/">coffee</a> and ' +
        "[external](https://example.com/) and [frag](#top).",
    ).sort(),
    ["/music/page/", "/notes/", "/tags/coffee/"],
  );
});

Deno.test("frontmatterLinks keeps internal source paths only", () => {
  assertEquals(
    frontmatterLinks([
      { label: "Komün", url: "/komun" },
      { label: "Elsewhere", url: "https://example.com/" },
      { label: "No link" },
      "not-an-object",
      null,
    ]),
    ["/komun/"],
  );
  assertEquals(frontmatterLinks(undefined), []);
  assertEquals(frontmatterLinks("nope"), []);
});

Deno.test("normalizeUrl unifies trailing slashes and drops fragments", () => {
  assertEquals(normalizeUrl("/notes"), "/notes/");
  assertEquals(normalizeUrl("/notes/"), "/notes/");
  assertEquals(normalizeUrl("/notes/?p=2#x"), "/notes/");
});

Deno.test("buildIncoming links tagged pages to their tag pages", () => {
  const result = buildIncoming(
    [
      { url: "/notes/1/", title: "moka pot", tags: ["coffee"] },
      { url: "/tags/coffee/", title: "#coffee" },
    ],
    { slugifyTag: (t) => t },
  );
  assertEquals(result.get("/tags/coffee/"), [
    { title: "moka pot", url: "/notes/1/" },
  ]);
  assertEquals(result.has("/tags/"), false);
});

Deno.test("buildIncoming links prose body links and skips unknowns", () => {
  const result = buildIncoming(
    [
      {
        url: "/",
        title: "home",
        bodyLinks: ["/music/", "/missing/", "https://x.com/"],
      },
      { url: "/music/", title: "music" },
    ],
  );
  assertEquals(result.get("/music/"), [{ title: "home", url: "/" }]);
  assertEquals(result.has("/missing/"), false);
});

Deno.test("buildIncoming never links a page to itself", () => {
  const result = buildIncoming([
    { url: "/notes/", title: "notes", bodyLinks: ["/notes/"] },
  ]);
  assertEquals(result.has("/notes/"), false);
});

Deno.test("buildIncoming keeps only same-language backlinks", () => {
  const result = buildIncoming(
    [
      { url: "/contact/", title: "contact" },
      {
        url: "/events/contribute/",
        title: "How to Contribute to Events",
        lang: "en",
        bodyLinks: ["/contact/"],
      },
      {
        url: "/tr/events/contribute/",
        title: "Etkinliklere Nasıl Katkıda Bulunulur",
        lang: "tr",
        bodyLinks: ["/contact/"],
      },
    ],
    { defaultLang: "en" },
  );
  assertEquals(result.get("/contact/"), [
    { title: "How to Contribute to Events", url: "/events/contribute/" },
  ]);
});

Deno.test("buildIncoming matches translated targets with their language", () => {
  const result = buildIncoming(
    [
      { url: "/tr/iletisim/", title: "iletişim", lang: "tr" },
      {
        url: "/tr/events/contribute/",
        title: "Etkinliklere Nasıl Katkıda Bulunulur",
        lang: "tr",
        bodyLinks: ["/tr/iletisim/"],
      },
      {
        url: "/events/contribute/",
        title: "How to Contribute to Events",
        lang: "en",
        bodyLinks: ["/tr/iletisim/"],
      },
    ],
    { defaultLang: "en" },
  );
  assertEquals(result.get("/tr/iletisim/"), [
    {
      title: "Etkinliklere Nasıl Katkıda Bulunulur",
      url: "/tr/events/contribute/",
    },
  ]);
});

Deno.test("noteTitle prefers the authored title", () => {
  assertEquals(noteTitle("Hello", new Date()), "Hello");
});

Deno.test("noteTitle falls back to note from DATE", () => {
  assertEquals(
    noteTitle("", new Date("2026-08-24T21:33:00+03:00")),
    "note from 24 Aug 2026 21:33",
  );
  assertEquals(
    noteTitle("", "2026-08-24T21:33:00+03:00"),
    "note from 24 Aug 2026 21:33",
  );
});

Deno.test("noteTitle degrades to bare note without a usable date", () => {
  assertEquals(noteTitle(""), "note");
  assertEquals(noteTitle("", "not-a-date"), "note");
});

Deno.test("noteTitle abbreviates September like the template grammar", () => {
  assertEquals(
    noteTitle("", new Date("2025-09-05T21:22:00+03:00")),
    "note from 05 Sep 2025 21:22",
  );
});

Deno.test("buildIncoming labels untitled linkers by date", () => {
  const result = buildIncoming([
    { url: "/komun/", title: "Komün" },
    {
      url: "/notes/20260824213331/",
      title: "",
      date: new Date("2026-08-24T21:33:00+03:00"),
      bodyLinks: ["/komun/"],
    },
  ]);
  assertEquals(result.get("/komun/"), [
    {
      title: "note from 24 Aug 2026 21:33",
      url: "/notes/20260824213331/",
    },
  ]);
});
