/**
 * utils/preprocessors/stats.ts
 * Processes Webmention statistics for pages.
 */

import { site as settings } from "../../_config/metadata.ts";
import { filters } from "../filters.ts";
import type { Webmention } from "../../src/types/index.ts";

function normalizeUrl(url: string) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export default function () {
  return (site: Lume.Site) => {
    site.preprocess([".md"], (pages) => {
      for (const page of pages) {
        const pageUrl = page.data.url;
        if (!pageUrl) continue;

        // Webmention stats logic
        const stats = { likes: 0, reposts: 0, replies: 0 };
        const webmentions = page.data.webmentions;

        if (webmentions?.children?.length) {
          const siteUrl = settings.url;
          const absPageUrl = normalizeUrl(siteUrl + pageUrl);

          const relevantMentions = webmentions.children.filter(
            (entry: Webmention) =>
              normalizeUrl(entry["wm-target"] || "") === absPageUrl &&
              !filters.isOwnWebmention(entry),
          );

          stats.likes = relevantMentions.filter((m) =>
            m["wm-property"] === "like-of"
          ).length;
          stats.reposts = relevantMentions.filter((m) =>
            m["wm-property"] === "repost-of"
          ).length;
          stats.replies = relevantMentions.filter((m) =>
            ["mention-of", "in-reply-to"].includes(m["wm-property"])
          ).length;
        }

        page.data.stats = stats;
      }
    });
  };
}
