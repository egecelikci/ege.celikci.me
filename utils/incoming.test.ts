/**
 * Unit tests for the `incoming:` backlinks helpers.
 *
 * Extraction is AST-based (see utils/mdast.ts), so the fixtures below intentionally cover the link forms a regex approach used to miss: titles, reference links, autolinks, code blocks, image embeds.
 */

import { assertEquals } from "@std/assert";
import {
  buildIncoming,
  buildOutgoing,
  extractBodyLinks,
  frontmatterLinks,
  normalizeUrl,
  noteTitle,
} from "./incoming.ts";

const SITE_URL = "https://ege.celikci.me";

Deno.test("extractBodyLinks finds markdown and html links", () => {
  assertEquals(
    extractBodyLinks(
      "see the [notes](/notes/) and [music](/music/page?x=1#y), " +
        'plus <a href="/tags/coffee/">coffee</a> and ' +
        "[external](https://example.com/) and [frag](#top).",
      { siteUrl: SITE_URL },
    ).sort(),
    ["/music/page/", "/notes/", "/tags/coffee/"],
  );
});

Deno.test("extractBodyLinks keeps link titles out of the target", () => {
  assertEquals(
    extractBodyLinks('[music](/music/ "my playlist")'),
    ["/music/"],
  );
});

Deno.test("extractBodyLinks resolves reference-style links", () => {
  assertEquals(
    extractBodyLinks(
      "see [the notes][n] and also [the notes][n]\n\n" +
        '[n]: /notes/ "Notes"',
    ),
    ["/notes/"],
  );
});

Deno.test("extractBodyLinks ignores code blocks and inline code", () => {
  assertEquals(
    extractBodyLinks(
      "inline `[docs](/docs/)` stays literal\n\n" +
        "```\n[example](/should-not-count/)\n```\n",
    ),
    [],
  );
});

Deno.test("extractBodyLinks ignores image embeds", () => {
  assertEquals(
    extractBodyLinks(
      "![gallery](/assets/images/x.jpg) and " +
        "[<img src='/not-a-link.png'>](/real/)",
    ),
    ["/real/"],
  );
});

Deno.test("extractBodyLinks accepts single-quoted and bare html hrefs", () => {
  assertEquals(
    extractBodyLinks(
      "<a href='/events/'>a</a> <a href=/keys>b</a> " +
        '<a class="x" href="/music/">c</a>',
    ),
    ["/events/", "/keys/", "/music/"],
  );
});

Deno.test("extractBodyLinks maps absolute self-links to paths", () => {
  assertEquals(
    extractBodyLinks(
      `see ${SITE_URL}/notes/42/ and http://ege.celikci.me/music ` +
        "and https://example.com/nope/",
      { siteUrl: SITE_URL },
    ).sort(),
    ["/music/", "/notes/42/"],
  );
});

Deno.test("extractBodyLinks skips absolute links without a siteUrl", () => {
  assertEquals(extractBodyLinks(`see ${SITE_URL}/notes/`), []);
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
  /** A single source object is accepted too (SourceMeta shorthand). */
  assertEquals(frontmatterLinks({ label: "Akarca", url: "/akarca" }), [
    "/akarca/",
  ]);
  assertEquals(frontmatterLinks(undefined), []);
  assertEquals(frontmatterLinks("nope"), []);
});

Deno.test("normalizeUrl unifies trailing slashes and drops fragments", () => {
  assertEquals(normalizeUrl("/notes"), "/notes/");
  assertEquals(normalizeUrl("/notes/"), "/notes/");
  assertEquals(normalizeUrl("/notes/?p=2#x"), "/notes/");
});

Deno.test("normalizeUrl lowercases and decodes percent escapes", () => {
  assertEquals(normalizeUrl("/Music/"), "/music/");
  assertEquals(normalizeUrl("/caf%C3%A9/"), "/café/");
  /** Malformed escapes stay as-is instead of throwing. */
  assertEquals(normalizeUrl("/bad%zz/"), "/bad%zz/");
});

Deno.test("buildIncoming links prose body links and skips unknowns", () => {
  const result = buildIncoming([
    {
      url: "/",
      title: "home",
      bodyLinks: ["/music/", "/missing/", "https://x.com/"],
    },
    { url: "/music/", title: "music" },
  ]);
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

Deno.test("buildIncoming sorts backlinks newest first", () => {
  const result = buildIncoming([
    { url: "/target/", title: "target" },
    {
      url: "/old/",
      title: "old",
      date: "2025-01-01T00:00:00+03:00",
      bodyLinks: ["/target/"],
    },
    {
      url: "/new/",
      title: "new",
      date: "2026-01-01T00:00:00+03:00",
      bodyLinks: ["/target/"],
    },
    { url: "/undated/", title: "undated", bodyLinks: ["/target/"] },
  ]);
  assertEquals(
    result.get("/target/")!.map((l) => l.url),
    ["/new/", "/old/", "/undated/"],
  );
});

Deno.test("buildIncoming exposes the linking page date", () => {
  const date = new Date("2026-08-24T21:33:00+03:00");
  const result = buildIncoming([
    { url: "/komun/", title: "Komün" },
    { url: "/notes/1/", title: "a note", date, bodyLinks: ["/komun/"] },
  ]);
  assertEquals(result.get("/komun/"), [
    { title: "a note", url: "/notes/1/", date },
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
  const date = new Date("2026-08-24T21:33:00+03:00");
  const result = buildIncoming([
    { url: "/komun/", title: "Komün" },
    {
      url: "/notes/20260824213331/",
      title: "",
      date,
      bodyLinks: ["/komun/"],
    },
  ]);
  assertEquals(result.get("/komun/"), [
    {
      title: "note from 24 Aug 2026 21:33",
      url: "/notes/20260824213331/",
      date,
    },
  ]);
});

Deno.test("buildOutgoing lists a page's targets in document order", () => {
  const result = buildOutgoing([
    { url: "/first/", title: "first" },
    { url: "/second/", title: "second" },
    { url: "/third/", title: "third" },
    {
      url: "/from/",
      title: "from",
      bodyLinks: ["/third/", "/first/", "/missing/", "/third/", "/from/"],
    },
  ]);
  assertEquals(
    result.get("/from/")!.map((link) => link.url),
    ["/third/", "/first/"],
  );
});

Deno.test("buildOutgoing keeps the language rule and drops outsiders", () => {
  const result = buildOutgoing([
    { url: "/en/", title: "english page" },
    { url: "/tr/", title: "türkçe sayfa", lang: "tr" },
    {
      url: "/from/",
      title: "from",
      bodyLinks: ["/tr/", "/en/", "https://example.com/"],
    },
  ]);
  assertEquals(
    result.get("/from/")!.map((link) => link.url),
    ["/en/"],
  );
  assertEquals(result.has("/en/"), false);
});
