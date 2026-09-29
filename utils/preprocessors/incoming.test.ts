/**
 * Glue tests for the incoming preprocessor: the seam between Lume's page lifecycle and the pure graph helpers. Uses a fake Site that captures the registered callbacks, so the multi-pass behavior (regular pages → generators → watch updates) is exercised without running a real build.
 */

import { assertEquals } from "@std/assert";
import incoming from "./incoming.ts";

interface FakeSite {
  pages: Lume.Page[];
  /** callbacks registered via site.preprocess */
  processors: Array<(pages: Lume.Page[]) => void>;
  /** callbacks registered via site.addEventListener */
  listeners: Map<string, () => void>;
}

function fakeSite(): FakeSite {
  const site: FakeSite = {
    pages: [],
    processors: [],
    listeners: new Map(),
  };
  const lumeSite = {
    preprocess(fn: (pages: Lume.Page[]) => void) {
      site.processors.push(fn);
    },
    addEventListener(type: string, fn: () => void) {
      site.listeners.set(type, fn);
    },
  };
  incoming()(lumeSite as unknown as Lume.Site);
  return site;
}

function page(data: Record<string, unknown>): Lume.Page {
  return { data, src: { path: "/x", ext: ".md" } } as unknown as Lume.Page;
}

/** Typed view of a fake page's injected backlinks. */
function backlinksOf(
  target: Lume.Page,
): Array<{ title: string; url: string }> {
  const links = (target.data.backlinks ?? []) as Array<{
    title: string;
    url: string;
  }>;
  return links.map(({ title, url }) => ({ title, url }));
}

/** Run every registered processor once over the given pages. */
function run(site: FakeSite, pages: Lume.Page[]): void {
  for (const processor of site.processors) processor(pages);
}

Deno.test("preprocessor assigns backlinks from prose links", () => {
  const site = fakeSite();
  const music = page({ url: "/music/", title: "music", content: "" });
  const home = page({
    url: "/",
    title: "home",
    content: "see [music](/music/)",
  });

  run(site, [music, home]);

  assertEquals(backlinksOf(music), [{ title: "home", url: "/" }]);
  assertEquals(backlinksOf(home), []);
});

Deno.test("preprocessor reads top-level frontmatter links", () => {
  const site = fakeSite();
  const place = page({ url: "/akarca/", title: "Akarca", content: "" });
  const note = page({
    url: "/notes/2/",
    title: "swimming",
    content: "",
    links: [{ label: "Akarca", url: "/akarca" }],
  });

  run(site, [place, note]);

  assertEquals(backlinksOf(place), [{ title: "swimming", url: "/notes/2/" }]);
});

Deno.test("later passes reassign backlinks of earlier pages", () => {
  const site = fakeSite();
  const target = page({ url: "/target/", title: "target", content: "" });

  // First pass: only the target exists (regular pages).
  run(site, [target]);
  assertEquals(backlinksOf(target), []);

  // Second pass: generator output links to the target.
  const generated = page({
    url: "/generated/",
    title: "generated",
    content: "see [target](/target/)",
  });
  run(site, [generated]);

  assertEquals(backlinksOf(target), [
    { title: "generated", url: "/generated/" },
  ]);
  // The generated page keeps its (empty) assignment from this pass too.
  assertEquals(backlinksOf(generated), []);
});

Deno.test("beforeUpdate drops pages that no longer exist", () => {
  const site = fakeSite();
  const target = page({ url: "/target/", title: "target", content: "" });
  const gone = page({
    url: "/gone/",
    title: "gone",
    content: "see [target](/target/)",
  });

  run(site, [target, gone]);
  assertEquals(backlinksOf(target).length, 1);

  // The source page is deleted; the watcher fires beforeUpdate.
  site.listeners.get("beforeUpdate")!();
  run(site, [target]);

  assertEquals(backlinksOf(target), []);
});

Deno.test("beforeBuild resets accumulated state", () => {
  const site = fakeSite();
  const target = page({ url: "/target/", title: "target", content: "" });
  const source = page({
    url: "/source/",
    title: "source",
    content: "see [target](/target/)",
  });

  run(site, [target, source]);
  assertEquals(backlinksOf(target).length, 1);

  site.listeners.get("beforeBuild")!();
  run(site, [target]);

  assertEquals(backlinksOf(target), []);
});

Deno.test("pages without url or content are skipped safely", () => {
  const site = fakeSite();
  const noUrl = page({ title: "no url", content: "" });
  const generator = page({ url: "/gen/", title: "gen", content: () => {} });

  run(site, [noUrl, generator]);

  assertEquals(backlinksOf(generator), []);
});

Deno.test("backlinks carry the linking page's icon", () => {
  const site = fakeSite();
  const place = page({ url: "/komun/", title: "Komün", content: "" });
  const note = page({
    url: "/notes/3/",
    title: "a cat",
    tags: ["kedi"],
    content: "see [Komün](/komun/)",
  });

  run(site, [place, note]);

  const links = place.data.backlinks as Array<{
    icon?: string;
    catalog?: string;
  }>;
  assertEquals(links[0].icon, "cat-broken");
  assertEquals(links[0].catalog, "solar");
});

Deno.test("preprocessor sends links to incoming but not outgoing", () => {
  const site = fakeSite();
  const place = page({ url: "/komun/", title: "Komün", content: "" });
  const other = page({ url: "/akarca/", title: "Akarca", content: "" });
  const note = page({
    url: "/notes/4/",
    title: "a note",
    content: "see [Akarca](/akarca/)",
    links: [{ label: "Komün", url: "/komun" }],
  });

  run(site, [place, other, note]);

  /* Prose link is outgoing; the declared link is provenance — still an edge (Komün sees the backlink) but not repeated in the note's outgoing list. */
  const outgoing = note.data.outgoing as Array<{ title: string; url: string }>;
  assertEquals(outgoing.map(({ title, url }) => ({ title, url })), [
    { title: "Akarca", url: "/akarca/" },
  ]);
  assertEquals(backlinksOf(place), [{ title: "a note", url: "/notes/4/" }]);
});
