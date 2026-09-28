/**
 * Glue tests for the incoming preprocessor: the seam between Lume's
 * page lifecycle and the pure graph helpers. Uses a fake Site that
 * captures the registered callbacks, so the multi-pass behavior
 * (regular pages → generators → watch updates) is exercised without
 * running a real build.
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
  return (target.data.backlinks ?? []) as Array<{ title: string; url: string }>;
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

  assertEquals(music.data.backlinks, [{ title: "home", url: "/" }]);
  assertEquals(home.data.backlinks, []);
});

Deno.test("preprocessor reads sources from the header extension", () => {
  const site = fakeSite();
  const place = page({ url: "/komun/", title: "Komün", content: "" });
  const note = page({
    url: "/notes/1/",
    title: "a note",
    content: "",
    headerExtension: {
      comp: "layout.SourceMeta",
      props: {
        sources: [
          { label: "Elsewhere", url: "https://example.com/" },
          { label: "Komün", url: "/komun" },
        ],
      },
    },
  });

  run(site, [place, note]);

  assertEquals(place.data.backlinks, [{ title: "a note", url: "/notes/1/" }]);
});

Deno.test("preprocessor reads top-level frontmatter sources", () => {
  const site = fakeSite();
  const place = page({ url: "/akarca/", title: "Akarca", content: "" });
  const note = page({
    url: "/notes/2/",
    title: "swimming",
    content: "",
    sources: [{ label: "Akarca", url: "/akarca" }],
  });

  run(site, [place, note]);

  assertEquals(place.data.backlinks, [{ title: "swimming", url: "/notes/2/" }]);
});

Deno.test("later passes reassign backlinks of earlier pages", () => {
  const site = fakeSite();
  const target = page({ url: "/target/", title: "target", content: "" });

  // First pass: only the target exists (regular pages).
  run(site, [target]);
  assertEquals(target.data.backlinks, []);

  // Second pass: generator output links to the target.
  const generated = page({
    url: "/generated/",
    title: "generated",
    content: "see [target](/target/)",
  });
  run(site, [generated]);

  assertEquals(target.data.backlinks, [
    { title: "generated", url: "/generated/" },
  ]);
  // The generated page keeps its (empty) assignment from this pass too.
  assertEquals(generated.data.backlinks, []);
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

  assertEquals(target.data.backlinks, []);
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

  assertEquals(target.data.backlinks, []);
});

Deno.test("pages without url or content are skipped safely", () => {
  const site = fakeSite();
  const noUrl = page({ title: "no url", content: "" });
  const generator = page({ url: "/gen/", title: "gen", content: () => {} });

  run(site, [noUrl, generator]);

  assertEquals(generator.data.backlinks, []);
});
