/**
 * Unit tests for the `incoming:` backlinks helpers.
 *
 * Extraction is AST-based (see lib/mdast.ts), so the fixtures below intentionally cover the link forms a regex approach used to miss: titles, reference links, autolinks, code blocks, image embeds.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildIncoming,
  buildOutgoing,
  extractBodyLinks,
  frontmatterLinks,
  normalizeUrl,
  noteTitle,
} from "./incoming.ts";

const SITE_URL = "https://ege.celikci.me";

test("extractBodyLinks finds markdown and html links", () => {
  assert.deepEqual(
    extractBodyLinks(
      "see the [notes](/notes/) and [music](/music/page?x=1#y), " +
        'plus <a href="/tags/coffee/">coffee</a> and ' +
        "[external](https://example.com/) and [frag](#top).",
      { siteUrl: SITE_URL },
    ).sort(),
    ["/music/page/", "/notes/", "/tags/coffee/"],
  );
});

test("extractBodyLinks keeps link titles out of the target", () => {
  assert.deepEqual(extractBodyLinks('[music](/music/ "my playlist")'), [
    "/music/",
  ]);
});

test("extractBodyLinks resolves reference-style links", () => {
  assert.deepEqual(
    extractBodyLinks(
      "see [the notes][n] and also [the notes][n]\n\n" + '[n]: /notes/ "Notes"',
    ),
    ["/notes/"],
  );
});

test("extractBodyLinks ignores code blocks and inline code", () => {
  assert.deepEqual(
    extractBodyLinks(
      "inline `[docs](/docs/)` stays literal\n\n" +
        "```\n[example](/should-not-count/)\n```\n",
    ),
    [],
  );
});

test("extractBodyLinks ignores image embeds", () => {
  assert.deepEqual(
    extractBodyLinks(
      "![gallery](/assets/images/x.jpg) and " +
        "[<img src='/not-a-link.png'>](/real/)",
    ),
    ["/real/"],
  );
});

test("extractBodyLinks accepts single-quoted and bare html hrefs", () => {
  assert.deepEqual(
    extractBodyLinks(
      "<a href='/events/'>a</a> <a href=/keys>b</a> " +
        '<a class="x" href="/music/">c</a>',
    ),
    ["/events/", "/keys/", "/music/"],
  );
});

test("extractBodyLinks maps absolute self-links to paths", () => {
  assert.deepEqual(
    extractBodyLinks(
      `see ${SITE_URL}/notes/42/ and http://ege.celikci.me/music ` +
        "and https://example.com/nope/",
      { siteUrl: SITE_URL },
    ).sort(),
    ["/music/", "/notes/42/"],
  );
});

test("extractBodyLinks skips absolute links without a siteUrl", () => {
  assert.deepEqual(extractBodyLinks(`see ${SITE_URL}/notes/`), []);
});

test("frontmatterLinks keeps internal source paths only", () => {
  assert.deepEqual(
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
  assert.deepEqual(frontmatterLinks({ label: "Akarca", url: "/akarca" }), [
    "/akarca/",
  ]);
  assert.deepEqual(frontmatterLinks(undefined), []);
  assert.deepEqual(frontmatterLinks("nope"), []);
});

test("normalizeUrl unifies trailing slashes and drops fragments", () => {
  assert.deepEqual(normalizeUrl("/notes"), "/notes/");
  assert.deepEqual(normalizeUrl("/notes/"), "/notes/");
  assert.deepEqual(normalizeUrl("/notes/?p=2#x"), "/notes/");
});

test("normalizeUrl lowercases and decodes percent escapes", () => {
  assert.deepEqual(normalizeUrl("/Music/"), "/music/");
  assert.deepEqual(normalizeUrl("/caf%C3%A9/"), "/café/");
  /** Malformed escapes stay as-is instead of throwing. */
  assert.deepEqual(normalizeUrl("/bad%zz/"), "/bad%zz/");
});

test("buildIncoming links prose body links and skips unknowns", () => {
  const result = buildIncoming([
    {
      url: "/",
      title: "home",
      bodyLinks: ["/music/", "/missing/", "https://x.com/"],
    },
    { url: "/music/", title: "music" },
  ]);
  assert.deepEqual(result.get("/music/"), [{ title: "home", url: "/" }]);
  assert.deepEqual(result.has("/missing/"), false);
});

test("buildIncoming never links a page to itself", () => {
  const result = buildIncoming([
    { url: "/notes/", title: "notes", bodyLinks: ["/notes/"] },
  ]);
  assert.deepEqual(result.has("/notes/"), false);
});

test("buildIncoming keeps only same-language backlinks", () => {
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
  assert.deepEqual(result.get("/contact/"), [
    { title: "How to Contribute to Events", url: "/events/contribute/" },
  ]);
});

test("buildIncoming matches translated targets with their language", () => {
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
  assert.deepEqual(result.get("/tr/iletisim/"), [
    {
      title: "Etkinliklere Nasıl Katkıda Bulunulur",
      url: "/tr/events/contribute/",
    },
  ]);
});

test("buildIncoming sorts backlinks newest first", () => {
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
  assert.deepEqual(
    result.get("/target/")!.map((l) => l.url),
    ["/new/", "/old/", "/undated/"],
  );
});

test("buildIncoming exposes the linking page date", () => {
  const date = new Date("2026-08-24T21:33:00+03:00");
  const result = buildIncoming([
    { url: "/komun/", title: "Komün" },
    { url: "/notes/1/", title: "a note", date, bodyLinks: ["/komun/"] },
  ]);
  assert.deepEqual(result.get("/komun/"), [
    { title: "a note", url: "/notes/1/", date },
  ]);
});

test("noteTitle prefers the authored title", () => {
  assert.deepEqual(noteTitle("Hello", new Date()), "Hello");
});

test("noteTitle falls back to note from DATE", () => {
  assert.deepEqual(
    noteTitle("", new Date("2026-08-24T21:33:00+03:00")),
    "note from 24 Aug 2026 21:33",
  );
  assert.deepEqual(
    noteTitle("", "2026-08-24T21:33:00+03:00"),
    "note from 24 Aug 2026 21:33",
  );
});

test("noteTitle degrades to bare note without a usable date", () => {
  assert.deepEqual(noteTitle(""), "note");
  assert.deepEqual(noteTitle("", "not-a-date"), "note");
});

test("noteTitle abbreviates September like the template grammar", () => {
  assert.deepEqual(
    noteTitle("", new Date("2025-09-05T21:22:00+03:00")),
    "note from 05 Sep 2025 21:22",
  );
});

test("buildIncoming labels untitled linkers by date", () => {
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
  assert.deepEqual(result.get("/komun/"), [
    {
      title: "note from 24 Aug 2026 21:33",
      url: "/notes/20260824213331/",
      date,
    },
  ]);
});

test("buildOutgoing lists a page's targets in document order", () => {
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
  assert.deepEqual(
    result.get("/from/")!.map((link) => link.url),
    ["/third/", "/first/"],
  );
});

test("buildOutgoing keeps the language rule and drops outsiders", () => {
  const result = buildOutgoing([
    { url: "/en/", title: "english page" },
    { url: "/tr/", title: "türkçe sayfa", lang: "tr" },
    {
      url: "/from/",
      title: "from",
      bodyLinks: ["/tr/", "/en/", "https://example.com/"],
    },
  ]);
  assert.deepEqual(
    result.get("/from/")!.map((link) => link.url),
    ["/en/"],
  );
  assert.deepEqual(result.has("/en/"), false);
});
