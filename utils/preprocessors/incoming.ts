/**
 * Builds the `backlinks` reverse index and injects it into every page.
 *
 * Lume runs preprocessors twice per build (regular pages, then
 * generator output) and again per renderOrder group. The entry/page
 * maps therefore accumulate across passes within one build, and the
 * graph is rebuilt + reassigned on every pass — so a link discovered
 * by a later pass still lands on pages assigned in an earlier one.
 * The maps reset on `beforeUpdate`/`beforeBuild` so watch mode never
 * carries entries for deleted or renamed pages.
 */

import { site as settings } from "../../_config/metadata.ts";
import {
  buildIncoming,
  extractBodyLinks,
  frontmatterLinks,
  type IncomingEntry,
  normalizeUrl,
} from "../incoming.ts";

/** Sources may live in frontmatter or under a SourceMeta header extension. */
function sourcesOf(data: Lume.Page["data"]): unknown {
  const top = data.sources;
  const extension = data.headerExtension;
  const nested = extension && typeof extension === "object" &&
      "props" in extension
    ? (extension as { props?: { sources?: unknown } }).props?.sources
    : undefined;
  return Array.isArray(top) || (top && typeof top === "object") ? top : nested;
}

function entryOf(page: Lume.Page): IncomingEntry {
  const data = page.data;
  const source = data.content;
  const bodyLinks = typeof source === "string"
    ? extractBodyLinks(source, { siteUrl: settings.url })
    : [];
  return {
    url: data.url as string,
    title: (data.title as string | undefined) ?? "",
    lang: data.lang as string | undefined,
    date: data.date as Date | undefined,
    bodyLinks: [...bodyLinks, ...frontmatterLinks(sourcesOf(data))],
  };
}

export default function () {
  const entries = new Map<string, IncomingEntry>();
  const touched = new Map<string, Lume.Page>();

  return (site: Lume.Site) => {
    const reset = () => {
      entries.clear();
      touched.clear();
    };
    site.addEventListener("beforeBuild", reset);
    site.addEventListener("beforeUpdate", reset);

    site.preprocess((pages) => {
      for (const page of pages) {
        const url = page.data.url;
        if (!url) continue;
        entries.set(url, entryOf(page));
        touched.set(url, page);
      }

      const incoming = buildIncoming([...entries.values()], {
        defaultLang: settings.lang,
      });

      /**
       * Reassign on every pass: later passes may discover new sources
       * for pages already visited by an earlier pass.
       */
      for (const [url, page] of touched) {
        page.data.backlinks = incoming.get(normalizeUrl(url)) ?? [];
      }
    });
  };
}
