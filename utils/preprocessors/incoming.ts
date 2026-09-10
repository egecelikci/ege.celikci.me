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
  const seen = new Map<string, IncomingEntry>();

  return (site: Lume.Site) => {
    site.preprocess((pages) => {
      for (const page of pages) {
        if (page.data.url) seen.set(page.data.url, entryOf(page));
      }

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

      const siteLang = pages
        .map((p) => (p.data.site as { lang?: unknown } | undefined)?.lang)
        .find((l): l is string => typeof l === "string");
      const incoming = buildIncoming([...seen.values()], {
        slugifyTag: (tag) => tagSlugs.get(tag) ?? tag,
        defaultLang: siteLang ?? "en",
      });

      for (const page of pages) {
        if (!page.data.url) continue;
        page.data.backlinks = incoming.get(page.data.url) ?? [];
      }
    });
  };
}
