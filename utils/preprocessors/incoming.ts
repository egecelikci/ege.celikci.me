/**
 * utils/preprocessors/incoming.ts
 * Feeds `backlinks` for the inline "incoming:" lines in page.vto:
 * the reverse index of the doc graph, built from tag memberships
 * and prose body links. Also audits orphans to the build log.
 */

import {
  buildIncoming,
  extractBodyLinks,
  frontmatterLinks,
  type IncomingEntry,
} from "../incoming.ts";

function entryOf(page: Lume.Page): IncomingEntry {
  const data = page.data;
  const source = data.content;
  const bodyLinks = typeof source === "string" ? extractBodyLinks(source) : [];
  return {
    url: data.url as string,
    title: (data.title as string | undefined) ?? "",
    lang: data.lang as string | undefined,
    date: data.date as Date | undefined,
    tags: (data.tags as string[] | undefined) ?? [],
    bodyLinks: [...bodyLinks, ...frontmatterLinks(data.sources)],
  };
}

export default function () {
  // Preprocessors run twice per build (source pages, then generated
  // pages). Accumulate across runs so the graph always sees the union.
  const seen = new Map<string, IncomingEntry>();

  return (site: Lume.Site) => {
    site.preprocess((pages) => {
      for (const page of pages) {
        if (page.data.url) seen.set(page.data.url, entryOf(page));
      }

      // tag slug lookup: tag pages exist only for tags with content
      const tagSlugs = new Map<string, string>();
      for (const page of pages) {
        const tag = page.data.tag;
        if (typeof tag === "string" && page.data.url) {
          tagSlugs.set(
            tag,
            String(page.data.url).split("/").filter(Boolean).pop()!,
          );
        }
      }

      // untranslated pages render in the default language, so they
      // match backlinks from it (site.lang in _config/metadata.ts)
      const siteLang = pages
        .map((p) => (p.data.site as { lang?: unknown } | undefined)?.lang)
        .find((l): l is string => typeof l === "string");
      const incoming = buildIncoming([...seen.values()], {
        slugifyTag: (tag) => tagSlugs.get(tag) ?? tag,
        defaultLang: siteLang ?? "en",
      });

      // oscean-style self-audit: report orphaned pages (zero incoming
      // links, not linked by tags or prose). Listing pages and the home
      // are exempt: they are entry points, not content.
      // notes live in the stream; assets, feeds and well-known files
      // are not content. Everything else with zero incoming links is
      // worth reporting.
      const orphanSkip = [
        /^\/assets\//,
        /^\/notes\//,
        /^\/event\//,
        /^\/tags\//,
        /^\/.well-known/,
        /\.(xml|txt|ics|json|html|ico|woff2?)$/,
      ];
      const orphans = [...seen.values()].filter((e) =>
        !incoming.has(e.url) && e.url !== "/" &&
        !orphanSkip.some((re) => re.test(e.url)) &&
        !e.tags?.includes("meta")
      );
      if (orphans.length > 0) {
        console.warn(
          `[incoming] orphaned pages (no incoming links): ${
            orphans.map((o) => o.url).join(", ")
          }`,
        );
      }

      for (const page of pages) {
        if (!page.data.url) continue;
        page.data.backlinks = incoming.get(page.data.url) ?? [];
      }
    });
  };
}
